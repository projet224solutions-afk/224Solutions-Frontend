/**
 * RETRY WITH EXPONENTIAL BACKOFF - 224Solutions Enterprise
 * Gestion intelligente des retentatives avec backoff exponentiel et jitter
 */

export interface RetryConfig {
  maxRetries: number;            // Nombre maximum de tentatives
  initialDelayMs: number;        // Délai initial en ms
  maxDelayMs: number;            // Délai maximum en ms
  backoffMultiplier: number;     // Multiplicateur de backoff
  jitter: boolean;               // Ajouter du jitter pour éviter les thundering herds
  retryableErrors?: string[];    // Erreurs à réessayer (vide = toutes)
  nonRetryableErrors?: string[]; // Erreurs à ne pas réessayer
  onRetry?: (attempt: number, error: any, nextDelayMs: number) => void;
  shouldRetry?: (error: any, attempt: number) => boolean;

  /** Legacy aliases (kept for backwards compatibility) */
  baseDelay?: number;
  backoffFactor?: number;
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
  totalTimeMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  nonRetryableErrors: ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR']
};

/**
 * Exécuter une fonction avec retry et backoff exponentiel
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  // Normalize legacy config fields (baseDelay/backoffFactor)
  const normalizedConfig: Partial<RetryConfig> = { ...config };
  if (normalizedConfig.baseDelay != null && normalizedConfig.initialDelayMs == null) {
    normalizedConfig.initialDelayMs = normalizedConfig.baseDelay;
  }
  if (normalizedConfig.backoffFactor != null && normalizedConfig.backoffMultiplier == null) {
    normalizedConfig.backoffMultiplier = normalizedConfig.backoffFactor;
  }

  const finalConfig: RetryConfig = { ...DEFAULT_CONFIG, ...normalizedConfig };
  const _startTime = Date.now();
  let lastError: any;

  for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // Vérifier si l'erreur est retryable
      if (!isRetryable(error, attempt, finalConfig)) {
        throw error;
      }

      // Si c'était la dernière tentative, throw
      if (attempt > finalConfig.maxRetries) {
        throw error;
      }

      // Calculer le délai avec backoff exponentiel
      const delay = calculateDelay(attempt, finalConfig);

      // Callback onRetry
      if (finalConfig.onRetry) {
        finalConfig.onRetry(attempt, error, delay);
      }

      console.warn(`🔄 Retry ${attempt}/${finalConfig.maxRetries} in ${delay}ms:`, getErrorMessage(error));

      // Attendre avant la prochaine tentative
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Version avec résultat détaillé
 */
export async function retryWithBackoffResult<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const data = await retryWithBackoff(fn, {
      ...config,
      onRetry: (attempt) => {
        attempts = attempt;
        config.onRetry?.(attempt, null, 0);
      }
    });

    return {
      success: true,
      data,
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error,
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Calculer le délai avec backoff exponentiel et jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  // Backoff exponentiel
  let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);

  // Limiter au délai maximum
  delay = Math.min(delay, config.maxDelayMs);

  // Ajouter du jitter (±25%)
  if (config.jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 à 1.25
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

/**
 * Vérifier si une erreur est retryable
 */
function isRetryable(error: any, attempt: number, config: RetryConfig): boolean {
  // Custom shouldRetry function
  if (config.shouldRetry) {
    return config.shouldRetry(error, attempt);
  }

  const errorCode = getErrorCode(error);
  const errorMessage = getErrorMessage(error);

  // Vérifier les erreurs non-retryables
  if (config.nonRetryableErrors?.length) {
    for (const nonRetryable of config.nonRetryableErrors) {
      if (errorCode === nonRetryable || errorMessage.includes(nonRetryable)) {
        return false;
      }
    }
  }

  // Vérifier les erreurs retryables spécifiques
  if (config.retryableErrors?.length) {
    for (const retryable of config.retryableErrors) {
      if (errorCode === retryable || errorMessage.includes(retryable)) {
        return true;
      }
    }
    return false;
  }

  // Par défaut, retry les erreurs réseau et timeout
  return isNetworkError(error) || isTimeoutError(error) || isTransientError(error);
}

/**
 * Détecter les erreurs réseau
 */
function isNetworkError(error: any): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('socket') ||
    error.name === 'TypeError' && message.includes('failed to fetch')
  );
}

/**
 * Détecter les erreurs timeout
 */
function isTimeoutError(error: any): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('etimedout') ||
    error.name === 'AbortError'
  );
}

/**
 * Détecter les erreurs transitoires (5xx, rate limit)
 */
function isTransientError(error: any): boolean {
  const status = error.status || error.statusCode || error.code;
  const message = getErrorMessage(error).toLowerCase();

  return (
    // Erreurs serveur 5xx
    (typeof status === 'number' && status >= 500 && status < 600) ||
    status === 429 || // Rate limit
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('service unavailable') ||
    message.includes('bad gateway') ||
    message.includes('gateway timeout')
  );
}

/**
 * Extraire le code d'erreur
 */
function getErrorCode(error: any): string {
  return error.code || error.errorCode || error.error?.code || '';
}

/**
 * Extraire le message d'erreur
 */
function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  return error.message || error.error?.message || String(error);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Décorateur pour ajouter retry à une fonction
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  return ((...args: Parameters<T>) => {
    return retryWithBackoff(() => fn(...args), config);
  }) as T;
}

/**
 * Créer un retry handler réutilisable
 */
export function createRetryHandler(config: Partial<RetryConfig> = {}) {
  return <T>(fn: () => Promise<T>) => retryWithBackoff(fn, config);
}

// Presets pour cas courants
export const retryPresets = {
  /** Pour les appels API rapides */
  api: {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitter: true
  } as Partial<RetryConfig>,

  /** Pour les opérations de base de données */
  database: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true
  } as Partial<RetryConfig>,

  /** Pour les uploads de fichiers */
  upload: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 3,
    jitter: true
  } as Partial<RetryConfig>,

  /** Pour les webhooks */
  webhook: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 3,
    jitter: true
  } as Partial<RetryConfig>,

  /** Pour les paiements (conservateur) */
  payment: {
    maxRetries: 2,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitter: false, // Pas de jitter pour les paiements
    nonRetryableErrors: ['INSUFFICIENT_FUNDS', 'CARD_DECLINED', 'INVALID_CARD']
  } as Partial<RetryConfig>
};

import { toast } from 'sonner';

/**
 * Gestionnaire d'erreurs API robuste.
 * Gere les erreurs reseau, les timeouts et le retry automatique.
 */

export interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wrapper pour executer une fonction avec retry et timeout.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30000,
    onRetry,
  } = config;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        ),
      ]);

      return result;
    } catch (error: any) {
      lastError = error;

      if (
        error?.message?.includes('JWT') ||
        error?.message?.includes('authentication') ||
        error?.message?.includes('permission') ||
        error?.code === 'PGRST301' ||
        error?.code === '42501'
      ) {
        throw new ApiError(
          'Erreur d\'authentification. Veuillez vous reconnecter.',
          error.code,
          error.status,
          error
        );
      }

      if (attempt === maxRetries) {
        break;
      }

      onRetry?.(attempt + 1, error);

      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const errorMessage = getErrorMessage(lastError);
  const error = lastError as any;
  throw new ApiError(errorMessage, error?.code, error?.status, lastError);
}

/**
 * Extraire un message d'erreur lisible.
 */
function getErrorMessage(error: any): string {
  if (error?.message) {
    if (error.message.includes('timeout')) {
      return 'La requete a pris trop de temps. Verifiez votre connexion.';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Erreur de connexion reseau. Verifiez votre connexion Internet.';
    }
    if (error.message.includes('Failed to fetch')) {
      return 'Impossible de contacter le serveur. Verifiez votre connexion.';
    }
    return error.message;
  }

  return 'Une erreur inconnue est survenue. Veuillez reessayer.';
}

/**
 * Gerer et afficher les erreurs a l'utilisateur.
 */
export function handleApiError(error: any, context?: string): void {
  console.error(`[API Error${context ? ` - ${context}` : ''}]:`, error);

  let message = getErrorMessage(error);

  if (context) {
    message = `${context}: ${message}`;
  }

  if (
    error?.message?.includes('timeout') ||
    error?.message?.includes('network') ||
    error?.message?.includes('fetch')
  ) {
    toast.error(message, {
      description: 'Verifiez votre connexion Internet',
      duration: 5000,
    });
  } else if (error?.message?.includes('authentication')) {
    toast.error(message, {
      description: 'Vous devez vous reconnecter',
      duration: 5000,
      action: {
        label: 'Se reconnecter',
        onClick: () => {
          window.location.pathname = '/auth';
        },
      },
    });
  } else {
    toast.error(message, {
      duration: 4000,
    });
  }
}

/**
 * Verifier l'etat de la connexion reseau.
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Wrapper pour les appels Supabase avec gestion d'erreur automatique.
 */
export async function supabaseCall<T>(
  call: () => Promise<{ data: T | null; error: unknown }>,
  config?: RetryConfig & { context?: string; silent?: boolean }
): Promise<T> {
  if (!isOnline()) {
    const error = new ApiError(
      'Vous etes hors ligne. Verifiez votre connexion Internet.',
      'OFFLINE'
    );
    if (!config?.silent) {
      handleApiError(error, config?.context);
    }
    throw error;
  }

  try {
    const result = await withRetry(call, {
      maxRetries: config?.maxRetries ?? 2,
      retryDelay: config?.retryDelay ?? 1000,
      timeout: config?.timeout ?? 30000,
      onRetry: config?.onRetry,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.data === null && !config?.silent) {
      console.warn('[Supabase] Received null data:', config?.context);
    }

    return result.data as T;
  } catch (error: any) {
    if (!config?.silent) {
      handleApiError(error, config?.context);
    }
    throw error;
  }
}

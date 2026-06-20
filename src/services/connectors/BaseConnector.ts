/**
 * BASE CONNECTOR - Classe abstraite pour tous les connecteurs
 * Implémente les fonctionnalités communes: retry, circuit breaker, logging
 *
 * @module BaseConnector
 * @version 1.0.0
 * @author 224Solutions
 */

import type {
  IExternalConnector,
  ConnectorType,
  ConnectorStatus,
  ConnectorConfig,
  AuthResult,
  ProductImportResult,
  SyncResult,
  OrderData,
  SupplierOrderResult,
  TrackingData,
  TrackingResult,
  ConnectorError,
  ErrorHandlingResult,
  CircuitBreakerState,
  CircuitBreakerConfig,
  ConnectorLog,
  RateLimitConfig
} from './types';

// ==================== DEFAULT CONFIGURATIONS ====================

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequestsPerMinute: 30,
  maxRequestsPerHour: 500,
  maxRequestsPerDay: 5000,
  currentMinuteRequests: 0,
  currentHourRequests: 0,
  currentDayRequests: 0,
  lastResetTimestamp: Date.now()
};

const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute
  monitoringPeriod: 300000 // 5 minutes
};

// ==================== BASE CONNECTOR CLASS ====================

export abstract class BaseConnector implements IExternalConnector {
  // Identification (abstract - doit être défini par chaque connecteur)
  abstract readonly connectorType: ConnectorType;
  abstract readonly connectorName: string;
  abstract readonly connectorVersion: string;

  // État
  status: ConnectorStatus = 'inactive';
  lastSync: Date | null = null;
  errorCount: number = 0;

  // Configuration
  config: ConnectorConfig;

  // Circuit Breaker
  protected circuitBreaker: CircuitBreakerState = {
    status: 'closed',
    failureCount: 0,
    successCount: 0
  };
  protected circuitBreakerConfig: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER;

  // Rate Limiting
  protected rateLimit: RateLimitConfig;

  // Logs buffer
  protected logs: ConnectorLog[] = [];
  protected maxLogsBuffer: number = 100;

  // ==================== CONSTRUCTOR ====================

  constructor(config: Partial<ConnectorConfig>) {
    this.config = {
      baseUrl: '',
      rateLimit: { ...DEFAULT_RATE_LIMIT },
      timeout: 30000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      sandbox: false,
      autoSync: true,
      syncIntervalMinutes: 60,
      ...config
    };

    this.rateLimit = { ...this.config.rateLimit };
    this.resetRateLimitCounters();
  }

  // ==================== MÉTHODES ABSTRAITES ====================
  // Ces méthodes DOIVENT être implémentées par chaque connecteur spécifique

  protected abstract doAuthenticate(): Promise<AuthResult>;
  protected abstract doImportProduct(sourceUrl: string): Promise<ProductImportResult>;
  protected abstract doSyncPrice(productIds?: string[]): Promise<SyncResult>;
  protected abstract doSyncAvailability(productIds?: string[]): Promise<SyncResult>;
  protected abstract doCreateSupplierOrder(orderData: OrderData): Promise<SupplierOrderResult>;
  protected abstract doPushTracking(trackingData: TrackingData): Promise<TrackingResult>;
  protected abstract doValidateConnection(): Promise<boolean>;

  // ==================== IMPLÉMENTATION INTERFACE ====================

  async authenticate(): Promise<AuthResult> {
    this.log('info', 'Tentative d\'authentification...');

    try {
      // Vérifier le circuit breaker
      if (!this.canProceed()) {
        return {
          success: false,
          error: 'Circuit breaker open - service temporairement indisponible',
          errorCode: 'CIRCUIT_BREAKER_OPEN'
        };
      }

      // Vérifier le rate limit
      if (!this.checkRateLimit()) {
        return {
          success: false,
          error: 'Rate limit atteint',
          errorCode: 'RATE_LIMIT_EXCEEDED'
        };
      }

      const result = await this.withRetry(() => this.doAuthenticate());

      if (result.success) {
        this.status = 'active';
        this.recordSuccess();
        this.log('info', 'Authentification réussie');

        // Stocker les tokens
        if (result.accessToken) {
          this.config.accessToken = result.accessToken;
        }
        if (result.refreshToken) {
          this.config.refreshToken = result.refreshToken;
        }
      } else {
        this.status = 'authentication_failed';
        this.recordFailure();
        this.log('error', `Authentification échouée: ${result.error}`);
      }

      return result;
    } catch (error: any) {
      this.recordFailure();
      this.log('error', `Erreur authentification: ${error.message}`);
      return {
        success: false,
        error: error.message,
        errorCode: 'AUTH_ERROR'
      };
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      const isValid = await this.doValidateConnection();
      this.status = isValid ? 'active' : 'error';
      return isValid;
    } catch (error: any) {
      this.status = 'error';
      this.log('error', `Erreur validation connexion: ${error.message}`);
      return false;
    }
  }

  async importProduct(sourceUrl: string): Promise<ProductImportResult> {
    this.log('info', `Import produit: ${sourceUrl}`);

    try {
      if (!this.canProceed()) {
        return {
          success: false,
          errors: ['Circuit breaker open - service temporairement indisponible']
        };
      }

      if (!this.checkRateLimit()) {
        return {
          success: false,
          errors: ['Rate limit atteint - réessayez plus tard']
        };
      }

      const startTime = Date.now();
      const result = await this.withRetry(() => this.doImportProduct(sourceUrl));
      result.scrapingTimeMs = Date.now() - startTime;

      if (result.success) {
        this.recordSuccess();
        this.log('info', `Produit importé avec succès: ${result.productId}`);
      } else {
        this.recordFailure();
        this.log('error', `Échec import: ${result.errors?.join(', ')}`);
      }

      return result;
    } catch (error: any) {
      this.recordFailure();
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  async syncPrice(productIds?: string[]): Promise<SyncResult> {
    this.log('sync', `Sync prix pour ${productIds?.length || 'tous les'} produits`);

    const startedAt = new Date();

    try {
      if (!this.canProceed()) {
        return this.createFailedSyncResult('price', startedAt, 'Circuit breaker open');
      }

      if (!this.checkRateLimit()) {
        return this.createFailedSyncResult('price', startedAt, 'Rate limit exceeded');
      }

      const result = await this.withRetry(() => this.doSyncPrice(productIds));
      this.lastSync = new Date();

      if (result.success) {
        this.recordSuccess();
      } else {
        this.recordFailure();
      }

      return result;
    } catch (error: any) {
      this.recordFailure();
      return this.createFailedSyncResult('price', startedAt, error.message);
    }
  }

  async syncAvailability(productIds?: string[]): Promise<SyncResult> {
    this.log('sync', `Sync disponibilité pour ${productIds?.length || 'tous les'} produits`);

    const startedAt = new Date();

    try {
      if (!this.canProceed()) {
        return this.createFailedSyncResult('availability', startedAt, 'Circuit breaker open');
      }

      if (!this.checkRateLimit()) {
        return this.createFailedSyncResult('availability', startedAt, 'Rate limit exceeded');
      }

      const result = await this.withRetry(() => this.doSyncAvailability(productIds));
      this.lastSync = new Date();

      if (result.success) {
        this.recordSuccess();
      } else {
        this.recordFailure();
      }

      return result;
    } catch (error: any) {
      this.recordFailure();
      return this.createFailedSyncResult('availability', startedAt, error.message);
    }
  }

  async onOrderCreated(orderData: OrderData): Promise<SupplierOrderResult> {
    this.log('order', `Création commande fournisseur pour: ${orderData.orderId}`);

    try {
      if (!this.canProceed()) {
        return {
          success: false,
          error: 'Circuit breaker open',
          errorCode: 'CIRCUIT_BREAKER_OPEN'
        };
      }

      if (!this.checkRateLimit()) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          errorCode: 'RATE_LIMIT_EXCEEDED'
        };
      }

      const result = await this.withRetry(() => this.doCreateSupplierOrder(orderData));

      if (result.success) {
        this.recordSuccess();
        this.log('order', `Commande fournisseur créée: ${result.supplierOrderId}`);
      } else {
        this.recordFailure();
        this.log('error', `Échec création commande: ${result.error}`);
      }

      return result;
    } catch (error: any) {
      this.recordFailure();
      return {
        success: false,
        error: error.message,
        errorCode: 'ORDER_CREATION_ERROR'
      };
    }
  }

  async pushTracking(trackingData: TrackingData): Promise<TrackingResult> {
    this.log('info', `Push tracking: ${trackingData.trackingNumber}`);

    try {
      if (!this.canProceed()) {
        return {
          success: false,
          trackingUpdated: false,
          error: 'Circuit breaker open'
        };
      }

      const result = await this.withRetry(() => this.doPushTracking(trackingData));

      if (result.success) {
        this.recordSuccess();
      } else {
        this.recordFailure();
      }

      return result;
    } catch (error: any) {
      this.recordFailure();
      return {
        success: false,
        trackingUpdated: false,
        error: error.message
      };
    }
  }

  async handleError(error: ConnectorError): Promise<ErrorHandlingResult> {
    this.log('error', `Gestion erreur: ${error.code} - ${error.message}`);
    this.errorCount++;

    // Déterminer l'action selon la sévérité
    let action: 'retry' | 'skip' | 'disable' | 'alert' | 'none' = 'none';
    let retryAfterMs: number | undefined;
    let alertSent = false;

    switch (error.severity) {
      case 'critical':
        // Désactiver le connecteur et alerter
        this.status = 'error';
        action = 'disable';
        alertSent = true;
        this.log('critical', `CRITIQUE: Connecteur désactivé - ${error.message}`);
        break;

      case 'high':
        // Alerter et retry avec délai
        action = error.retryable ? 'retry' : 'alert';
        retryAfterMs = error.retryable ? 60000 : undefined;
        alertSent = true;
        break;

      case 'medium':
        // Retry si possible
        action = error.retryable ? 'retry' : 'skip';
        retryAfterMs = error.retryable ? 30000 : undefined;
        break;

      case 'low':
        // Log et continuer
        action = error.retryable ? 'retry' : 'skip';
        retryAfterMs = error.retryable ? 5000 : undefined;
        break;
    }

    return {
      handled: true,
      action,
      retryAfterMs,
      alertSent,
      logId: this.generateLogId()
    };
  }

  async disconnect(): Promise<void> {
    this.log('info', 'Déconnexion du connecteur');
    this.status = 'inactive';
    this.config.accessToken = undefined;
    this.config.refreshToken = undefined;
    await this.flushLogs();
  }

  // ==================== CIRCUIT BREAKER ====================

  protected canProceed(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.status) {
      case 'closed':
        return true;

      case 'open':
        // Vérifier si on peut passer en half_open
        if (this.circuitBreaker.nextRetryTime && now >= this.circuitBreaker.nextRetryTime.getTime()) {
          this.circuitBreaker.status = 'half_open';
          this.circuitBreaker.successCount = 0;
          this.log('info', 'Circuit breaker: passage en half_open');
          return true;
        }
        return false;

      case 'half_open':
        return true;
    }
  }

  protected recordSuccess(): void {
    this.circuitBreaker.successCount++;
    this.circuitBreaker.lastSuccessTime = new Date();

    if (this.circuitBreaker.status === 'half_open') {
      if (this.circuitBreaker.successCount >= this.circuitBreakerConfig.successThreshold) {
        this.circuitBreaker.status = 'closed';
        this.circuitBreaker.failureCount = 0;
        this.log('info', 'Circuit breaker: fermé (service restauré)');
      }
    }
  }

  protected recordFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = new Date();

    if (this.circuitBreaker.status === 'half_open') {
      // Retour à open
      this.circuitBreaker.status = 'open';
      this.circuitBreaker.nextRetryTime = new Date(Date.now() + this.circuitBreakerConfig.timeout);
      this.log('warning', 'Circuit breaker: retour à open (échec en half_open)');
    } else if (this.circuitBreaker.status === 'closed') {
      if (this.circuitBreaker.failureCount >= this.circuitBreakerConfig.failureThreshold) {
        this.circuitBreaker.status = 'open';
        this.circuitBreaker.nextRetryTime = new Date(Date.now() + this.circuitBreakerConfig.timeout);
        this.status = 'error';
        this.log('warning', 'Circuit breaker: ouvert (seuil d\'erreurs atteint)');
      }
    }
  }

  // ==================== RATE LIMITING ====================

  protected checkRateLimit(): boolean {
    this.resetRateLimitCounters();

    if (this.rateLimit.currentMinuteRequests >= this.rateLimit.maxRequestsPerMinute) {
      this.status = 'rate_limited';
      this.log('warning', 'Rate limit minute atteint');
      return false;
    }

    if (this.rateLimit.currentHourRequests >= this.rateLimit.maxRequestsPerHour) {
      this.status = 'rate_limited';
      this.log('warning', 'Rate limit heure atteint');
      return false;
    }

    if (this.rateLimit.currentDayRequests >= this.rateLimit.maxRequestsPerDay) {
      this.status = 'rate_limited';
      this.log('warning', 'Rate limit jour atteint');
      return false;
    }

    this.rateLimit.currentMinuteRequests++;
    this.rateLimit.currentHourRequests++;
    this.rateLimit.currentDayRequests++;

    return true;
  }

  protected resetRateLimitCounters(): void {
    const now = Date.now();
    const lastReset = this.rateLimit.lastResetTimestamp;

    // Reset minute counter
    if (now - lastReset >= 60000) {
      this.rateLimit.currentMinuteRequests = 0;
    }

    // Reset hour counter
    if (now - lastReset >= 3600000) {
      this.rateLimit.currentHourRequests = 0;
    }

    // Reset day counter
    if (now - lastReset >= 86400000) {
      this.rateLimit.currentDayRequests = 0;
      this.rateLimit.lastResetTimestamp = now;
    }
  }

  // ==================== RETRY LOGIC ====================

  protected async withRetry<T>(
    operation: () => Promise<T>,
    attempts: number = this.config.retryAttempts
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        if (attempt < attempts) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
          this.log('warning', `Tentative ${attempt}/${attempts} échouée, retry dans ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Toutes les tentatives ont échoué');
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== LOGGING ====================

  protected log(
    logType: ConnectorLog['logType'],
    message: string,
    details?: Record<string, unknown>
  ): void {
    const log: ConnectorLog = {
      id: this.generateLogId(),
      connectorType: this.connectorType,
      logType,
      message,
      details,
      createdAt: new Date()
    };

    this.logs.push(log);

    // Émettre dans la console en dev
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[${this.connectorName}]`;
      switch (logType) {
        case 'error':
          console.error(prefix, message, details);
          break;
        case 'warning':
          console.warn(prefix, message, details);
          break;
        default:
          console.log(prefix, message, details);
      }
    }

    // Limiter la taille du buffer
    if (this.logs.length > this.maxLogsBuffer) {
      this.logs.shift();
    }
  }

  protected async flushLogs(): Promise<void> {
    // À implémenter: envoyer les logs vers Supabase ou un service de logging
    // Pour l'instant, on vide le buffer
    this.logs = [];
  }

  protected generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== HELPERS ====================

  protected createFailedSyncResult(
    syncType: 'price' | 'availability' | 'product_details' | 'tracking' | 'full',
    startedAt: Date,
    errorMessage: string
  ): SyncResult {
    return {
      success: false,
      syncType,
      productsUpdated: 0,
      pricesUpdated: 0,
      stocksUpdated: 0,
      errors: [{ productId: '', errorType: 'SYNC_FAILED', message: errorMessage, retryable: true }],
      warnings: [],
      startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime()
    };
  }

  // ==================== PUBLIC GETTERS ====================

  getStatus(): ConnectorStatus {
    return this.status;
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  getRateLimitState(): RateLimitConfig {
    return { ...this.rateLimit };
  }

  getLogs(): ConnectorLog[] {
    return [...this.logs];
  }

  getMetrics(): {
    status: ConnectorStatus;
    errorCount: number;
    lastSync: Date | null;
    circuitBreaker: CircuitBreakerState;
  } {
    return {
      status: this.status,
      errorCount: this.errorCount,
      lastSync: this.lastSync,
      circuitBreaker: this.getCircuitBreakerState()
    };
  }
}

export default BaseConnector;

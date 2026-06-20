/**
 * REQUEST QUEUE - 224Solutions Enterprise
 * File d'attente intelligente pour les requêtes avec priorité et déduplication
 */

export type RequestPriority = 'critical' | 'high' | 'normal' | 'low';

interface QueuedRequest<T = any> {
  id: string;
  priority: RequestPriority;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  createdAt: number;
  retries: number;
  maxRetries: number;
  dedupeKey?: string;
  timeout: number;
  metadata?: Record<string, any>;
}

interface RequestQueueConfig {
  maxConcurrent: number;         // Requêtes simultanées max
  maxQueueSize: number;          // Taille max de la file
  defaultTimeout: number;        // Timeout par défaut (ms)
  defaultMaxRetries: number;     // Retries par défaut
  processInterval: number;       // Intervalle de traitement (ms)
  enableDeduplication: boolean;  // Activer la déduplication
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
}

const DEFAULT_CONFIG: RequestQueueConfig = {
  maxConcurrent: 6,
  maxQueueSize: 100,
  defaultTimeout: 30000,
  defaultMaxRetries: 2,
  processInterval: 50,
  enableDeduplication: true
};

const PRIORITY_ORDER: Record<RequestPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3
};

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing: Set<string> = new Set();
  private dedupeCache: Map<string, Promise<any>> = new Map();
  private config: RequestQueueConfig;
  private processTimer: NodeJS.Timeout | null = null;
  private stats: QueueStats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    avgProcessingTime: 0
  };
  private processingTimes: number[] = [];
  private paused: boolean = false;

  constructor(config: Partial<RequestQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startProcessing();
  }

  /**
   * Ajouter une requête à la file
   */
  async enqueue<T>(
    fn: () => Promise<T>,
    options: {
      priority?: RequestPriority;
      dedupeKey?: string;
      timeout?: number;
      maxRetries?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<T> {
    const {
      priority = 'normal',
      dedupeKey,
      timeout = this.config.defaultTimeout,
      maxRetries = this.config.defaultMaxRetries,
      metadata
    } = options;

    // Déduplication
    if (this.config.enableDeduplication && dedupeKey) {
      const existing = this.dedupeCache.get(dedupeKey);
      if (existing) {
        console.debug(`🔄 [RequestQueue] Deduplicated: ${dedupeKey}`);
        return existing;
      }
    }

    // Vérifier la taille de la file
    if (this.queue.length >= this.config.maxQueueSize) {
      // Supprimer les requêtes low priority anciennes
      const lowPriorityIndex = this.queue.findIndex(r => r.priority === 'low');
      if (lowPriorityIndex !== -1) {
        const removed = this.queue.splice(lowPriorityIndex, 1)[0];
        removed.reject(new Error('Request dropped due to queue overflow'));
      } else {
        throw new Error('Request queue is full');
      }
    }

    // Créer la promesse
    const promise = new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: crypto.randomUUID(),
        priority,
        fn,
        resolve,
        reject,
        createdAt: Date.now(),
        retries: 0,
        maxRetries,
        dedupeKey,
        timeout,
        metadata
      };

      // Insérer selon la priorité
      this.insertByPriority(request);
      this.stats.pending = this.queue.length;
    });

    // Cache pour déduplication
    if (this.config.enableDeduplication && dedupeKey) {
      this.dedupeCache.set(dedupeKey, promise);
      promise.finally(() => {
        this.dedupeCache.delete(dedupeKey);
      });
    }

    return promise;
  }

  /**
   * Insérer une requête selon sa priorité
   */
  private insertByPriority(request: QueuedRequest): void {
    const insertIndex = this.queue.findIndex(
      r => PRIORITY_ORDER[r.priority] > PRIORITY_ORDER[request.priority]
    );

    if (insertIndex === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(insertIndex, 0, request);
    }
  }

  /**
   * Démarrer le traitement de la file
   */
  private startProcessing(): void {
    if (typeof window === 'undefined') return;

    this.processTimer = setInterval(() => {
      if (!this.paused) {
        this.processNext();
      }
    }, this.config.processInterval);
  }

  /**
   * Traiter les requêtes suivantes
   */
  private async processNext(): Promise<void> {
    // Vérifier si on peut traiter plus de requêtes
    while (
      this.queue.length > 0 &&
      this.processing.size < this.config.maxConcurrent
    ) {
      const request = this.queue.shift();
      if (!request) break;

      this.processing.add(request.id);
      this.stats.processing = this.processing.size;
      this.stats.pending = this.queue.length;

      this.processRequest(request);
    }
  }

  /**
   * Traiter une requête individuelle
   */
  private async processRequest<T>(request: QueuedRequest<T>): Promise<void> {
    const startTime = Date.now();

    // Créer un timeout
    const timeoutId = setTimeout(() => {
      if (this.processing.has(request.id)) {
        this.handleTimeout(request);
      }
    }, request.timeout);

    try {
      const result = await request.fn();
      clearTimeout(timeoutId);

      // Enregistrer le temps de traitement
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);

      this.stats.completed++;
      request.resolve(result);
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry si possible
      if (request.retries < request.maxRetries) {
        request.retries++;
        console.warn(`🔄 [RequestQueue] Retry ${request.retries}/${request.maxRetries} for ${request.id}`);
        this.insertByPriority(request);
      } else {
        this.stats.failed++;
        request.reject(error);
      }
    } finally {
      this.processing.delete(request.id);
      this.stats.processing = this.processing.size;
    }
  }

  /**
   * Gérer le timeout d'une requête
   */
  private handleTimeout<T>(request: QueuedRequest<T>): void {
    this.processing.delete(request.id);
    this.stats.processing = this.processing.size;
    this.stats.failed++;

    request.reject(new Error(`Request timeout after ${request.timeout}ms`));
  }

  /**
   * Enregistrer le temps de traitement
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);

    // Garder les 100 derniers
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }

    // Calculer la moyenne
    this.stats.avgProcessingTime = Math.round(
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
    );
  }

  /**
   * Mettre en pause le traitement
   */
  pause(): void {
    this.paused = true;
    console.log('⏸️ [RequestQueue] Paused');
  }

  /**
   * Reprendre le traitement
   */
  resume(): void {
    this.paused = false;
    console.log('▶️ [RequestQueue] Resumed');
  }

  /**
   * Vider la file
   */
  clear(rejectReason?: string): void {
    const error = new Error(rejectReason || 'Queue cleared');
    this.queue.forEach(request => request.reject(error));
    this.queue = [];
    this.stats.pending = 0;
    console.log('🗑️ [RequestQueue] Cleared');
  }

  /**
   * Annuler une requête spécifique
   */
  cancel(id: string): boolean {
    const index = this.queue.findIndex(r => r.id === id);
    if (index !== -1) {
      const request = this.queue.splice(index, 1)[0];
      request.reject(new Error('Request cancelled'));
      this.stats.pending = this.queue.length;
      return true;
    }
    return false;
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Obtenir l'état de la file
   */
  getQueueState(): {
    queueLength: number;
    processingCount: number;
    isPaused: boolean;
    config: RequestQueueConfig;
  } {
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      isPaused: this.paused,
      config: this.config
    };
  }

  /**
   * Mettre à jour la configuration
   */
  updateConfig(config: Partial<RequestQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Arrêter et nettoyer
   */
  destroy(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
    this.clear('Queue destroyed');
    this.dedupeCache.clear();
  }
}

// Instance globale
export const requestQueue = new RequestQueue();

// Export pour création d'instances personnalisées
export { RequestQueue };
export type { RequestQueueConfig, QueueStats, QueuedRequest };

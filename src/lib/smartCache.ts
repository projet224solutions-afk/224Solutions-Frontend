/**
 * 🚀 SMART CACHE SERVICE - 224Solutions Enterprise
 * Cache multi-couches haute performance pour supporter millions de req/sec
 *
 * Architecture:
 * L1 → Mémoire (Map) : <1ms, données chaudes
 * L2 → IndexedDB : <5ms, persistance offline
 * L3 → Supabase/API : ~100-500ms, source de vérité
 *
 * Inspiré de Redis/Memcached mais côté client
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // en ms
  accessCount: number;
  lastAccess: number;
  size: number; // estimation en bytes
  tags: string[];
}

interface CacheConfig {
  maxMemoryEntries: number;     // Max entrées en mémoire (L1)
  maxMemoryBytes: number;       // Max taille mémoire (~50MB)
  defaultTTL: number;           // TTL par défaut (5 min)
  cleanupInterval: number;      // Nettoyage toutes les 60s
  enableIndexedDB: boolean;     // Activer L2
  enableMetrics: boolean;       // Métriques de performance
}

// TTL préconfiguré par type de données
export const CACHE_TTL = {
  REALTIME: 5 * 1000,            // 5s - données temps réel (prix, position)
  HOT: 30 * 1000,                // 30s - données chaudes (feed, notifications)
  WARM: 2 * 60 * 1000,           // 2min - données tièdes (profil, panier)
  STANDARD: 5 * 60 * 1000,       // 5min - données standard (produits, vendeurs)
  COLD: 15 * 60 * 1000,          // 15min - données froides (catégories, config)
  STATIC: 60 * 60 * 1000,        // 1h - données quasi-statiques (taux de change)
  PERMANENT: 24 * 60 * 60 * 1000 // 24h - données permanentes (pays, devises)
} as const;

// Tags pour invalidation groupée
export const CACHE_TAGS = {
  PRODUCTS: 'products',
  VENDORS: 'vendors',
  USER: 'user',
  WALLET: 'wallet',
  ORDERS: 'orders',
  ANALYTICS: 'analytics',
  CONFIG: 'config',
  FX_RATES: 'fx_rates',
} as const;

class SmartCacheService {
  private static instance: SmartCacheService;

  // L1 - Cache mémoire (ultra rapide)
  private memoryCache: Map<string, CacheEntry> = new Map();

  // Métriques
  private metrics = {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0,
    evictions: 0,
    totalRequests: 0,
    savedBytes: 0,
    savedRequests: 0,
  };

  private config: CacheConfig = {
    maxMemoryEntries: 1000,
    maxMemoryBytes: 50 * 1024 * 1024, // 50MB
    defaultTTL: CACHE_TTL.STANDARD,
    cleanupInterval: 60 * 1000,
    enableIndexedDB: true,
    enableMetrics: true,
  };

  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private currentMemorySize = 0;

  private constructor() {
    this.startCleanup();
  }

  static getInstance(): SmartCacheService {
    if (!this.instance) this.instance = new SmartCacheService();
    return this.instance;
  }

  // ==================== CORE API ====================

  /**
   * Récupère une valeur du cache ou exécute le fetcher
   * Pattern "stale-while-revalidate" automatique
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      ttl?: number;
      tags?: string[];
      staleWhileRevalidate?: boolean;
      forceRefresh?: boolean;
    }
  ): Promise<T> {
    const ttl = options?.ttl ?? this.config.defaultTTL;
    const tags = options?.tags ?? [];

    this.metrics.totalRequests++;

    // Force refresh
    if (options?.forceRefresh) {
      const data = await fetcher();
      this.set(key, data, ttl, tags);
      return data;
    }

    // Vérifier L1 (mémoire)
    const l1 = this.getFromMemory(key);
    if (l1 !== undefined) {
      this.metrics.hits++;
      this.metrics.l1Hits++;
      this.metrics.savedRequests++;

      // Stale-while-revalidate: retourner le cache mais rafraîchir en arrière-plan
      if (options?.staleWhileRevalidate && this.isStale(key)) {
        this.revalidateInBackground(key, fetcher, ttl, tags);
      }

      return l1 as T;
    }

    // Vérifier L2 (IndexedDB)
    if (this.config.enableIndexedDB) {
      const l2 = await this.getFromIndexedDB(key);
      if (l2 !== undefined) {
        this.metrics.hits++;
        this.metrics.l2Hits++;
        this.metrics.savedRequests++;
        // Promouvoir en L1
        this.setInMemory(key, l2, ttl, tags);
        return l2 as T;
      }
    }

    // Cache miss → fetch
    this.metrics.misses++;
    const data = await fetcher();
    this.set(key, data, ttl, tags);
    return data;
  }

  /**
   * Set une valeur dans le cache (L1 + L2)
   */
  set<T>(key: string, data: T, ttl = this.config.defaultTTL, tags: string[] = []): void {
    this.setInMemory(key, data, ttl, tags);

    if (this.config.enableIndexedDB) {
      this.setInIndexedDB(key, data, ttl, tags).catch(() => {});
    }
  }

  /**
   * Invalider par clé exacte
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
    this.deleteFromIndexedDB(key).catch(() => {});
  }

  /**
   * Invalider par tag (ex: tous les produits)
   */
  invalidateByTag(tag: string): void {
    let count = 0;
    for (const [key, entry] of this.memoryCache) {
      if (entry.tags.includes(tag)) {
        this.memoryCache.delete(key);
        this.deleteFromIndexedDB(key).catch(() => {});
        count++;
      }
    }
    console.log(`🗑️ [Cache] Invalidé ${count} entrées avec tag "${tag}"`);
  }

  /**
   * Invalider par pattern (ex: "products:*")
   */
  invalidateByPattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        this.deleteFromIndexedDB(key).catch(() => {});
      }
    }
  }

  /**
   * Vider tout le cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.currentMemorySize = 0;
    this.clearIndexedDB().catch(() => {});
  }

  /**
   * Obtenir les métriques de performance
   */
  getMetrics() {
    const hitRate = this.metrics.totalRequests > 0
      ? Math.round((this.metrics.hits / this.metrics.totalRequests) * 100)
      : 0;

    return {
      ...this.metrics,
      hitRate,
      entriesCount: this.memoryCache.size,
      memoryUsage: this.currentMemorySize,
      memoryUsageMB: (this.currentMemorySize / (1024 * 1024)).toFixed(2),
    };
  }

  // ==================== L1 - MÉMOIRE ====================

  private setInMemory<T>(key: string, data: T, ttl: number, tags: string[]): void {
    const size = this.estimateSize(data);

    // Éviction LRU si nécessaire
    while (
      (this.memoryCache.size >= this.config.maxMemoryEntries ||
       this.currentMemorySize + size > this.config.maxMemoryBytes) &&
      this.memoryCache.size > 0
    ) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccess: Date.now(),
      size,
      tags,
    };

    this.memoryCache.set(key, entry);
    this.currentMemorySize += size;
  }

  private getFromMemory(key: string): any | undefined {
    const entry = this.memoryCache.get(key);
    if (!entry) return undefined;

    // Vérifier expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      this.currentMemorySize -= entry.size;
      return undefined;
    }

    // Mettre à jour les stats d'accès
    entry.accessCount++;
    entry.lastAccess = Date.now();

    return entry.data;
  }

  private isStale(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return true;
    // Considéré stale si > 75% du TTL écoulé
    return (Date.now() - entry.timestamp) > (entry.ttl * 0.75);
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestAccess = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.memoryCache.get(oldestKey);
      if (entry) this.currentMemorySize -= entry.size;
      this.memoryCache.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  // ==================== L2 - INDEXEDDB ====================

  // 🚀 Connection pool: reuse single IDB connection instead of opening per-operation
  private dbInstance: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbInstance) return Promise.resolve(this.dbInstance);
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('224sol-cache', 1);
      request.onerror = () => { this.dbPromise = null; reject(request.error); };
      request.onsuccess = () => {
        this.dbInstance = request.result;
        this.dbInstance.onclose = () => { this.dbInstance = null; this.dbPromise = null; };
        resolve(this.dbInstance);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });

    return this.dbPromise;
  }

  private async getFromIndexedDB(key: string): Promise<any | undefined> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cache', 'readonly');
        const store = tx.objectStore('cache');
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          if (!result) return resolve(undefined);
          // Vérifier expiration
          if (Date.now() - result.timestamp > result.ttl) {
            resolve(undefined);
          } else {
            resolve(result.data);
          }
        };
        request.onerror = () => resolve(undefined);
      });
    } catch {
      return undefined;
    }
  }

  private async setInIndexedDB<T>(key: string, data: T, ttl: number, tags: string[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      store.put({ key, data, timestamp: Date.now(), ttl, tags });
    } catch {}
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').delete(key);
    } catch {}
  }

  private async clearIndexedDB(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').clear();
    } catch {}
  }

  // ==================== UTILITIES ====================

  private async revalidateInBackground<T>(
    key: string, fetcher: () => Promise<T>, ttl: number, tags: string[]
  ): Promise<void> {
    try {
      const data = await fetcher();
      this.set(key, data, ttl, tags);
    } catch {
      // Silencieux - le cache stale reste valide
    }
  }

  private estimateSize(data: any): number {
    try {
      // 🚀 Fast size estimation without Blob constructor (which is slow)
      const json = JSON.stringify(data);
      // UTF-8 byte length ≈ string length * 2 (rough but fast)
      return json.length * 2;
    } catch {
      return 1024;
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      let cleaned = 0;
      const now = Date.now();

      for (const [key, entry] of this.memoryCache) {
        if (now - entry.timestamp > entry.ttl) {
          this.currentMemorySize -= entry.size;
          this.memoryCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 [Cache] Nettoyé ${cleaned} entrées expirées. Restant: ${this.memoryCache.size}`);
      }
    }, this.config.cleanupInterval);
  }

  destroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.memoryCache.clear();
    this.currentMemorySize = 0;
  }
}

export const smartCache = SmartCacheService.getInstance();

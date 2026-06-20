/**
 * Service de Cache Distribué pour 100M+ utilisateurs
 * Simulation côté client avec IndexedDB + Memory Cache
 * En production: connexion à Redis Cluster
 */

import { REDIS_CONFIG, CACHE_KEYS, CACHE_STRATEGIES } from '@/config/redis';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
  strategy: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  avgResponseTime: number;
}

class CacheService {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0,
    avgResponseTime: 0,
  };
  private responseTimes: number[] = [];
  private maxMemorySize = 10000; // Max entries in memory
  private dbName = 'sokoby_cache';
  private db: IDBDatabase | null = null;

  constructor() {
    this.initIndexedDB();
    this.startCleanupInterval();
  }

  private async initIndexedDB(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  /**
   * Récupère une valeur du cache (Memory -> IndexedDB)
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();

    // 1. Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      memoryEntry.hits++;
      this.recordHit(startTime);
      return memoryEntry.value;
    }

    // 2. Check IndexedDB
    const dbEntry = await this.getFromIndexedDB<T>(key);
    if (dbEntry && dbEntry.expiresAt > Date.now()) {
      // Promote to memory cache
      this.memoryCache.set(key, dbEntry);
      this.recordHit(startTime);
      return dbEntry.value;
    }

    this.recordMiss(startTime);
    return null;
  }

  /**
   * Stocke une valeur dans le cache
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    strategy: string = CACHE_STRATEGIES.CACHE_ASIDE
  ): Promise<void> {
    const ttl = ttlSeconds || REDIS_CONFIG.ttl.cache;
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + (ttl * 1000),
      createdAt: Date.now(),
      hits: 0,
      strategy,
    };

    // Memory cache with LRU eviction
    if (this.memoryCache.size >= this.maxMemorySize) {
      this.evictLRU();
    }
    this.memoryCache.set(key, entry);
    this.stats.size = this.memoryCache.size;

    // Persist to IndexedDB
    await this.setToIndexedDB(key, entry);
  }

  /**
   * Supprime une entrée du cache
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.deleteFromIndexedDB(key);
    this.stats.size = this.memoryCache.size;
  }

  /**
   * Supprime les entrées correspondant à un pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    let deleted = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        await this.deleteFromIndexedDB(key);
        deleted++;
      }
    }

    this.stats.size = this.memoryCache.size;
    return deleted;
  }

  /**
   * Cache avec fallback (Read-Through pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttlSeconds, CACHE_STRATEGIES.READ_THROUGH);
    return value;
  }

  /**
   * Cache utilisateur
   */
  async cacheUser(userId: string, userData: any): Promise<void> {
    await this.set(
      `${CACHE_KEYS.USER}${userId}`,
      userData,
      REDIS_CONFIG.ttl.userProfile
    );
  }

  async getUser(userId: string): Promise<any> {
    return this.get(`${CACHE_KEYS.USER}${userId}`);
  }

  /**
   * Cache wallet
   */
  async cacheWallet(walletId: string, walletData: any): Promise<void> {
    await this.set(
      `${CACHE_KEYS.WALLET}${walletId}`,
      walletData,
      REDIS_CONFIG.ttl.cache
    );
  }

  async getWallet(walletId: string): Promise<any> {
    return this.get(`${CACHE_KEYS.WALLET}${walletId}`);
  }

  /**
   * Cache produit
   */
  async cacheProduct(productId: string, productData: any): Promise<void> {
    await this.set(
      `${CACHE_KEYS.PRODUCT}${productId}`,
      productData,
      REDIS_CONFIG.ttl.cache
    );
  }

  async getProduct(productId: string): Promise<any> {
    return this.get(`${CACHE_KEYS.PRODUCT}${productId}`);
  }

  /**
   * Cache de recherche
   */
  async cacheSearch(query: string, results: any[]): Promise<void> {
    const key = `${CACHE_KEYS.SEARCH}${this.hashQuery(query)}`;
    await this.set(key, results, REDIS_CONFIG.ttl.cache);
  }

  async getSearchCache(query: string): Promise<any[] | null> {
    const key = `${CACHE_KEYS.SEARCH}${this.hashQuery(query)}`;
    return this.get(key);
  }

  /**
   * Invalidation du cache
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.deletePattern(`${CACHE_KEYS.USER}${userId}*`);
  }

  async invalidateProduct(productId: string): Promise<void> {
    await this.delete(`${CACHE_KEYS.PRODUCT}${productId}`);
    // Invalider aussi les recherches liées
    await this.deletePattern(`${CACHE_KEYS.SEARCH}*`);
  }

  /**
   * Statistiques du cache
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      avgResponseTime: this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
        : 0,
    };
  }

  /**
   * Vide tout le cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    if (this.db) {
      const tx = this.db.transaction('cache', 'readwrite');
      tx.objectStore('cache').clear();
    }
    this.stats = { hits: 0, misses: 0, size: 0, hitRate: 0, avgResponseTime: 0 };
    this.responseTimes = [];
  }

  // === Private Methods ===

  private async getFromIndexedDB<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const tx = this.db!.transaction('cache', 'readonly');
      const request = tx.objectStore('cache').get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private async setToIndexedDB<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction('cache', 'readwrite');
      tx.objectStore('cache').put({ key, ...entry });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction('cache', 'readwrite');
      tx.objectStore('cache').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  private recordHit(startTime: number): void {
    this.stats.hits++;
    this.responseTimes.push(performance.now() - startTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  private recordMiss(startTime: number): void {
    this.stats.misses++;
    this.responseTimes.push(performance.now() - startTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt < now) {
          this.memoryCache.delete(key);
        }
      }
      this.stats.size = this.memoryCache.size;
    }, 60000); // Cleanup every minute
  }

  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// Singleton export
export const cacheService = new CacheService();
export default cacheService;

/**
 * Configuration Redis Cluster pour 100M+ utilisateurs
 * Support multi-région avec failover automatique
 */

export interface RedisNodeConfig {
  host: string;
  port: number;
  password?: string;
  region: string;
  role: 'master' | 'replica';
}

export interface RedisClusterConfig {
  nodes: RedisNodeConfig[];
  options: {
    maxRedirections: number;
    retryDelayOnFailover: number;
    retryDelayOnClusterDown: number;
    scaleReads: 'master' | 'slave' | 'all';
    enableReadyCheck: boolean;
    enableOfflineQueue: boolean;
  };
  ttl: {
    session: number;      // 24h
    cache: number;        // 1h
    rateLimit: number;    // 1min
    realtime: number;     // 5min
    userProfile: number;  // 30min
  };
}

// Configuration des clusters Redis par région
export const REDIS_CLUSTERS: Record<string, RedisNodeConfig[]> = {
  'africa-west': [
    { host: 'redis-africa-master.example.com', port: 6379, region: 'africa-west', role: 'master' },
    { host: 'redis-africa-replica1.example.com', port: 6379, region: 'africa-west', role: 'replica' },
    { host: 'redis-africa-replica2.example.com', port: 6379, region: 'africa-west', role: 'replica' },
  ],
  'europe-west': [
    { host: 'redis-europe-master.example.com', port: 6379, region: 'europe-west', role: 'master' },
    { host: 'redis-europe-replica1.example.com', port: 6379, region: 'europe-west', role: 'replica' },
  ],
  'us-east': [
    { host: 'redis-us-master.example.com', port: 6379, region: 'us-east', role: 'master' },
    { host: 'redis-us-replica1.example.com', port: 6379, region: 'us-east', role: 'replica' },
  ],
  'asia-southeast': [
    { host: 'redis-asia-master.example.com', port: 6379, region: 'asia-southeast', role: 'master' },
    { host: 'redis-asia-replica1.example.com', port: 6379, region: 'asia-southeast', role: 'replica' },
  ],
};

// Configuration globale du cluster
export const REDIS_CONFIG: RedisClusterConfig = {
  nodes: Object.values(REDIS_CLUSTERS).flat(),
  options: {
    maxRedirections: 16,
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 100,
    scaleReads: 'slave', // Lecture sur replicas pour performance
    enableReadyCheck: true,
    enableOfflineQueue: true,
  },
  ttl: {
    session: 86400,      // 24 heures
    cache: 3600,         // 1 heure
    rateLimit: 60,       // 1 minute
    realtime: 300,       // 5 minutes
    userProfile: 1800,   // 30 minutes
  },
};

// Préfixes de clés pour organisation
export const CACHE_KEYS = {
  USER: 'user:',
  SESSION: 'session:',
  RATE_LIMIT: 'rate:',
  WALLET: 'wallet:',
  PRODUCT: 'product:',
  ORDER: 'order:',
  VENDOR: 'vendor:',
  SEARCH: 'search:',
  GEO: 'geo:',
  LOCK: 'lock:',
  QUEUE: 'queue:',
  PUBSUB: 'pubsub:',
} as const;

// Stratégies de cache
export const CACHE_STRATEGIES = {
  WRITE_THROUGH: 'write-through',     // Écriture synchrone DB + Cache
  WRITE_BEHIND: 'write-behind',       // Écriture async au cache
  READ_THROUGH: 'read-through',       // Lecture cache-first
  CACHE_ASIDE: 'cache-aside',         // Application gère le cache
  REFRESH_AHEAD: 'refresh-ahead',     // Refresh proactif
} as const;

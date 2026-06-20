/**
 * 🌍 Configuration Multi-Région - 224Solutions
 * Support pour 100M+ utilisateurs avec déploiement global
 */

export interface RegionConfig {
  id: string;
  name: string;
  displayName: string;
  continent: string;
  timezone: string;
  currency: string;
  languages: string[];
  endpoints: {
    api: string;
    cdn: string;
    websocket: string;
    database: string;
  };
  latency: {
    threshold: number; // ms - max acceptable latency
    optimal: number;   // ms - target latency
  };
  enabled: boolean;
  isPrimary: boolean;
  failoverRegions: string[];
}

export interface RegionHealth {
  regionId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency: number;
  lastCheck: string;
  uptime: number;
  errorRate: number;
  load: number; // 0-100
}

// ==================== RÉGIONS CONFIGURÉES ====================

export const REGIONS: Record<string, RegionConfig> = {
  // Afrique de l'Ouest - Région Principale
  'africa-west': {
    id: 'africa-west',
    name: 'africa-west',
    displayName: 'Afrique de l\'Ouest',
    continent: 'Africa',
    timezone: 'Africa/Conakry',
    currency: 'GNF',
    languages: ['fr', 'ff', 'sus'],
    endpoints: {
      api: 'https://224solution.net',
      cdn: 'https://224solution.net',
      websocket: 'wss://224solution.net',
      database: 'https://db-africa.supabase.co',
    },
    latency: {
      threshold: 200,
      optimal: 50,
    },
    enabled: true,
    isPrimary: true,
    failoverRegions: ['europe-west', 'africa-central'],
  },

  // Europe de l'Ouest
  'europe-west': {
    id: 'europe-west',
    name: 'europe-west',
    displayName: 'Europe de l\'Ouest',
    continent: 'Europe',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    languages: ['fr', 'en', 'de', 'es'],
    endpoints: {
      api: 'https://api-eu.224solution.net',
      cdn: 'https://cdn-eu.224solution.net',
      websocket: 'wss://ws-eu.224solution.net',
      database: 'https://db-eu.supabase.co',
    },
    latency: {
      threshold: 100,
      optimal: 30,
    },
    enabled: true,
    isPrimary: false,
    failoverRegions: ['europe-central', 'africa-west'],
  },

  // Europe Centrale
  'europe-central': {
    id: 'europe-central',
    name: 'europe-central',
    displayName: 'Europe Centrale',
    continent: 'Europe',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
    languages: ['de', 'en', 'fr'],
    endpoints: {
      api: 'https://api-eu-central.224solution.net',
      cdn: 'https://cdn-eu-central.224solution.net',
      websocket: 'wss://ws-eu-central.224solution.net',
      database: 'https://db-eu-central.supabase.co',
    },
    latency: {
      threshold: 100,
      optimal: 30,
    },
    enabled: true,
    isPrimary: false,
    failoverRegions: ['europe-west', 'us-east'],
  },

  // États-Unis Est
  'us-east': {
    id: 'us-east',
    name: 'us-east',
    displayName: 'États-Unis Est',
    continent: 'North America',
    timezone: 'America/New_York',
    currency: 'USD',
    languages: ['en', 'es', 'fr'],
    endpoints: {
      api: 'https://api-us-east.224solution.net',
      cdn: 'https://cdn-us-east.224solution.net',
      websocket: 'wss://ws-us-east.224solution.net',
      database: 'https://db-us-east.supabase.co',
    },
    latency: {
      threshold: 100,
      optimal: 30,
    },
    enabled: true,
    isPrimary: false,
    failoverRegions: ['us-west', 'europe-west'],
  },

  // États-Unis Ouest
  'us-west': {
    id: 'us-west',
    name: 'us-west',
    displayName: 'États-Unis Ouest',
    continent: 'North America',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    languages: ['en', 'es'],
    endpoints: {
      api: 'https://api-us-west.224solution.net',
      cdn: 'https://cdn-us-west.224solution.net',
      websocket: 'wss://ws-us-west.224solution.net',
      database: 'https://db-us-west.supabase.co',
    },
    latency: {
      threshold: 100,
      optimal: 30,
    },
    enabled: true,
    isPrimary: false,
    failoverRegions: ['us-east', 'asia-east'],
  },

  // Afrique Centrale
  'africa-central': {
    id: 'africa-central',
    name: 'africa-central',
    displayName: 'Afrique Centrale',
    continent: 'Africa',
    timezone: 'Africa/Lagos',
    currency: 'XOF',
    languages: ['fr', 'en'],
    endpoints: {
      api: 'https://api-africa-central.224solution.net',
      cdn: 'https://cdn-africa-central.224solution.net',
      websocket: 'wss://ws-africa-central.224solution.net',
      database: 'https://db-africa-central.supabase.co',
    },
    latency: {
      threshold: 200,
      optimal: 80,
    },
    enabled: true,
    isPrimary: false,
    failoverRegions: ['africa-west', 'europe-west'],
  },

  // Asie Est
  'asia-east': {
    id: 'asia-east',
    name: 'asia-east',
    displayName: 'Asie de l\'Est',
    continent: 'Asia',
    timezone: 'Asia/Singapore',
    currency: 'USD',
    languages: ['en', 'zh', 'ms'],
    endpoints: {
      api: 'https://api-asia.224solution.net',
      cdn: 'https://cdn-asia.224solution.net',
      websocket: 'wss://ws-asia.224solution.net',
      database: 'https://db-asia.supabase.co',
    },
    latency: {
      threshold: 150,
      optimal: 50,
    },
    enabled: false, // Désactivé pour l'instant
    isPrimary: false,
    failoverRegions: ['us-west', 'europe-central'],
  },
};

// ==================== HELPERS ====================

export const getEnabledRegions = (): RegionConfig[] =>
  Object.values(REGIONS).filter(r => r.enabled);

export const getPrimaryRegion = (): RegionConfig =>
  Object.values(REGIONS).find(r => r.isPrimary) || REGIONS['africa-west'];

export const getRegionById = (id: string): RegionConfig | undefined =>
  REGIONS[id];

export const getRegionsByContinent = (continent: string): RegionConfig[] =>
  Object.values(REGIONS).filter(r => r.continent === continent && r.enabled);

export const getFailoverRegions = (regionId: string): RegionConfig[] => {
  const region = REGIONS[regionId];
  if (!region) return [];
  return region.failoverRegions
    .map(id => REGIONS[id])
    .filter((r): r is RegionConfig => r !== undefined && r.enabled);
};

// ==================== CONFIGURATION GLOBALE ====================

export const GLOBAL_CONFIG = {
  // Load Balancing
  loadBalancing: {
    algorithm: 'latency-based' as const, // 'round-robin' | 'latency-based' | 'geo-based' | 'weighted'
    healthCheckInterval: 30000, // 30 seconds
    failoverThreshold: 3, // nombre d'échecs avant failover
    stickySession: true,
    sessionTTL: 3600000, // 1 hour
  },

  // CDN
  cdn: {
    provider: 'cloudflare',
    cacheControl: {
      static: 'public, max-age=31536000, immutable', // 1 year
      dynamic: 'public, max-age=0, must-revalidate',
      api: 'private, no-cache, no-store',
    },
    compression: {
      gzip: true,
      brotli: true,
    },
  },

  // Database
  database: {
    readReplicas: true,
    connectionPooling: true,
    maxConnections: 100,
    statementTimeout: 30000, // 30 seconds
  },

  // Caching
  cache: {
    provider: 'redis',
    ttl: {
      short: 60, // 1 minute
      medium: 300, // 5 minutes
      long: 3600, // 1 hour
      veryLong: 86400, // 24 hours
    },
  },

  // Rate Limiting (per region)
  rateLimiting: {
    global: {
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
    },
    perUser: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
    },
  },

  // Scaling
  scaling: {
    minInstances: 2,
    maxInstances: 100,
    targetCPU: 70,
    targetMemory: 80,
    cooldownPeriod: 300, // 5 minutes
  },
};

export type LoadBalancingAlgorithm = typeof GLOBAL_CONFIG.loadBalancing.algorithm;

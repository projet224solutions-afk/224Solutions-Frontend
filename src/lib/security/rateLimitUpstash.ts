/**
 * Configuration Upstash Redis pour rate limiting distribué
 * Alternative à rate limiting local pour production
 * Phase 4: Cache Redis Distribué
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * Rate limiter avec Upstash Redis (production)
 */
export const checkRateLimit = async (config: RateLimitConfig): Promise<RateLimitResult> => {
  // Redis REST credentials must never live in the browser.
  // Frontend keeps a local fallback only; distributed limiting belongs server-side.
  return checkRateLimitLocal(config);
};

/**
 * Rate limiter local (fallback)
 */
const checkRateLimitLocal = (config: RateLimitConfig): RateLimitResult => {
  const { maxRequests, windowMs, identifier } = config;
  const key = `ratelimit_${identifier}`;
  const now = Date.now();

  // Récupérer historique
  const stored = localStorage.getItem(key);
  let requests: number[] = stored ? JSON.parse(stored) : [];

  // Filtrer requêtes hors fenêtre
  requests = requests.filter(timestamp => now - timestamp < windowMs);

  // Ajouter nouvelle requête
  requests.push(now);

  // Sauvegarder
  localStorage.setItem(key, JSON.stringify(requests));

  const allowed = requests.length <= maxRequests;
  const remaining = Math.max(0, maxRequests - requests.length);
  const oldestRequest = requests[0] || now;
  const resetAt = new Date(oldestRequest + windowMs);

  return {
    allowed,
    remaining,
    resetAt,
    retryAfter: allowed ? undefined : Math.ceil((oldestRequest + windowMs - now) / 1000)
  };
};

/**
 * Présets de configuration
 */
export const RATE_LIMIT_PRESETS = {
  // Authentification: 5 tentatives par 5 minutes
  auth: {
    maxRequests: 5,
    windowMs: 5 * 60 * 1000
  },

  // API standard: 100 requêtes par minute
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000
  },

  // API stricte: 10 requêtes par minute
  apiStrict: {
    maxRequests: 10,
    windowMs: 60 * 1000
  },

  // Wallet operations: 20 requêtes par minute
  wallet: {
    maxRequests: 20,
    windowMs: 60 * 1000
  },

  // Email/SMS: 3 par heure
  notifications: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000
  }
};

/**
 * Helper pour appliquer rate limit facilement
 */
export const withRateLimit = async <T>(
  identifier: string,
  preset: keyof typeof RATE_LIMIT_PRESETS,
  fn: () => Promise<T>
): Promise<T> => {
  const config = {
    ...RATE_LIMIT_PRESETS[preset],
    identifier
  };

  const result = await checkRateLimit(config);

  if (!result.allowed) {
    throw new Error(
      `Rate limit dépassé. Réessayez dans ${result.retryAfter} secondes.`
    );
  }

  return fn();
};

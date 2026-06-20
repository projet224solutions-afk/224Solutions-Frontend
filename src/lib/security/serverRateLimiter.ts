/**
 * RATE LIMITER SERVEUR
 * Protection contre les attaques par force brute
 * 224SOLUTIONS - Sécurité avancée
 *
 * Utilise une approche hybride:
 * - En mémoire pour le développement
 * - Compatible Upstash Redis pour la production
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

interface RateLimitConfig {
  maxRequests: number;      // Nombre max de requêtes
  windowMs: number;         // Fenêtre de temps en ms
  blockDurationMs: number;  // Durée de blocage après dépassement
  keyPrefix?: string;       // Préfixe pour les clés Redis
}

// Configurations par type d'endpoint
export const RATE_LIMIT_CONFIGS = {
  // Authentification - très restrictif
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000,        // 5 tentatives par minute
    blockDurationMs: 15 * 60 * 1000, // Blocage 15 minutes
    keyPrefix: 'rl:auth:'
  },
  // API standard
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000,        // 100 requêtes par minute
    blockDurationMs: 5 * 60 * 1000,
    keyPrefix: 'rl:api:'
  },
  // Transactions financières
  financial: {
    maxRequests: 10,
    windowMs: 60 * 1000,        // 10 transactions par minute
    blockDurationMs: 30 * 60 * 1000, // Blocage 30 minutes
    keyPrefix: 'rl:financial:'
  },
  // Upload de fichiers
  upload: {
    maxRequests: 20,
    windowMs: 60 * 1000,        // 20 uploads par minute
    blockDurationMs: 10 * 60 * 1000,
    keyPrefix: 'rl:upload:'
  },
  // OTP/MFA
  otp: {
    maxRequests: 3,
    windowMs: 60 * 1000,        // 3 tentatives par minute
    blockDurationMs: 60 * 60 * 1000, // Blocage 1 heure
    keyPrefix: 'rl:otp:'
  }
} as const;

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

// Store en mémoire pour le développement
const memoryStore = new Map<string, RateLimitEntry>();

// Nettoyage périodique (toutes les 5 minutes)
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetTime < now && (!entry.blockUntil || entry.blockUntil < now)) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

startCleanup();

/**
 * Interface pour le stockage Redis (Upstash)
 */
interface RedisClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
}

let redisClient: RedisClient | null = null;

/**
 * Configure le client Redis (Upstash) pour la production
 */
export function configureRedis(client: RedisClient): void {
  redisClient = client;
  console.log('[RateLimiter] ✅ Redis configuré');
}

/**
 * Vérifie si une requête doit être limitée
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<{
  allowed: boolean;
  remaining: number;
  resetIn: number;
  blocked: boolean;
  retryAfter?: number;
}> {
  const config = RATE_LIMIT_CONFIGS[type];
  const key = `${config.keyPrefix}${identifier}`;
  const now = Date.now();

  // Utiliser Redis si disponible, sinon mémoire
  if (redisClient) {
    return checkRateLimitRedis(key, config, now);
  }

  return checkRateLimitMemory(key, config, now);
}

/**
 * Rate limiting en mémoire (développement)
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig,
  now: number
): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  blocked: boolean;
  retryAfter?: number;
} {
  let entry = memoryStore.get(key);

  // Vérifier si bloqué
  if (entry?.blocked && entry.blockUntil && entry.blockUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.blockUntil - now,
      blocked: true,
      retryAfter: Math.ceil((entry.blockUntil - now) / 1000)
    };
  }

  // Réinitialiser si fenêtre expirée
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
      blocked: false
    };
  }

  // Incrémenter le compteur
  entry.count++;

  // Vérifier si limite dépassée
  if (entry.count > config.maxRequests) {
    entry.blocked = true;
    entry.blockUntil = now + config.blockDurationMs;
    memoryStore.set(key, entry);

    console.warn(`[RateLimiter] 🚫 Bloqué: ${key}`);

    return {
      allowed: false,
      remaining: 0,
      resetIn: config.blockDurationMs,
      blocked: true,
      retryAfter: Math.ceil(config.blockDurationMs / 1000)
    };
  }

  memoryStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
    blocked: false
  };
}

/**
 * Rate limiting avec Redis (production)
 */
async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig,
  now: number
): Promise<{
  allowed: boolean;
  remaining: number;
  resetIn: number;
  blocked: boolean;
  retryAfter?: number;
}> {
  if (!redisClient) {
    throw new Error('Redis client not configured');
  }

  const blockKey = `${key}:blocked`;

  // Vérifier si bloqué
  const blockUntil = await redisClient.get(blockKey);
  if (blockUntil) {
    const blockEnd = parseInt(blockUntil, 10);
    if (blockEnd > now) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: blockEnd - now,
        blocked: true,
        retryAfter: Math.ceil((blockEnd - now) / 1000)
      };
    }
    await redisClient.del(blockKey);
  }

  // Incrémenter le compteur
  const count = await redisClient.incr(key);

  // Définir l'expiration si nouvelle clé
  if (count === 1) {
    await redisClient.expire(key, Math.ceil(config.windowMs / 1000));
  }

  // Vérifier si limite dépassée
  if (count > config.maxRequests) {
    const blockEnd = now + config.blockDurationMs;
    await redisClient.set(blockKey, blockEnd.toString(), {
      ex: Math.ceil(config.blockDurationMs / 1000)
    });

    console.warn(`[RateLimiter] 🚫 Bloqué (Redis): ${key}`);

    return {
      allowed: false,
      remaining: 0,
      resetIn: config.blockDurationMs,
      blocked: true,
      retryAfter: Math.ceil(config.blockDurationMs / 1000)
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - count,
    resetIn: config.windowMs,
    blocked: false
  };
}

/**
 * Réinitialiser le rate limit pour un identifiant
 */
export async function resetRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<void> {
  const config = RATE_LIMIT_CONFIGS[type];
  const key = `${config.keyPrefix}${identifier}`;

  if (redisClient) {
    await redisClient.del(key);
    await redisClient.del(`${key}:blocked`);
  } else {
    memoryStore.delete(key);
  }

  console.log(`[RateLimiter] ✅ Reset: ${key}`);
}

/**
 * Middleware pour Express/Edge Functions
 */
export function rateLimitMiddleware(type: RateLimitType = 'api') {
  return async (req: Request): Promise<Response | null> => {
    // Extraire l'identifiant (IP ou user ID)
    const identifier = getIdentifier(req);
    const result = await checkRateLimit(identifier, type);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: result.blocked
            ? `Trop de tentatives. Réessayez dans ${result.retryAfter} secondes.`
            : 'Limite de requêtes dépassée.',
          retryAfter: result.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.retryAfter || 60),
            'X-RateLimit-Limit': String(RATE_LIMIT_CONFIGS[type].maxRequests),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(Math.ceil(result.resetIn / 1000))
          }
        }
      );
    }

    return null; // Continuer le traitement
  };
}

/**
 * Extraire l'identifiant de la requête
 */
function getIdentifier(req: Request): string {
  // Essayer d'obtenir l'IP réelle (derrière un proxy)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback: utiliser un hash de l'User-Agent
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return `ua:${hashString(userAgent)}`;
}

/**
 * Hash simple pour les identifiants
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Headers de rate limit pour les réponses
 */
export function getRateLimitHeaders(
  type: RateLimitType,
  remaining: number,
  resetIn: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(RATE_LIMIT_CONFIGS[type].maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetIn / 1000))
  };
}

export default {
  checkRateLimit,
  resetRateLimit,
  rateLimitMiddleware,
  getRateLimitHeaders,
  configureRedis,
  RATE_LIMIT_CONFIGS
};

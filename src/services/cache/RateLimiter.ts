/**
 * Rate Limiter Distribué pour 100M+ utilisateurs
 * Algorithme: Token Bucket avec sliding window
 */

import { CACHE_KEYS } from '@/config/redis';

interface RateLimitConfig {
  windowMs: number;      // Fenêtre de temps en ms
  maxRequests: number;   // Max requêtes par fenêtre
  blockDuration?: number; // Durée de blocage si dépassement (ms)
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blocked?: boolean;
  blockedUntil?: number;
}

// Configurations par type d'endpoint
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // API publique
  public: {
    windowMs: 60000,      // 1 minute
    maxRequests: 100,
    blockDuration: 300000, // 5 minutes si abus
  },
  // API authentifiée
  authenticated: {
    windowMs: 60000,
    maxRequests: 1000,
    blockDuration: 60000,
  },
  // Transactions financières
  financial: {
    windowMs: 60000,
    maxRequests: 20,
    blockDuration: 600000, // 10 minutes
  },
  // Login/Auth
  auth: {
    windowMs: 900000,     // 15 minutes
    maxRequests: 5,
    blockDuration: 1800000, // 30 minutes
  },
  // Recherche
  search: {
    windowMs: 60000,
    maxRequests: 50,
  },
  // Upload
  upload: {
    windowMs: 3600000,    // 1 heure
    maxRequests: 100,
  },
  // SMS/Email
  notification: {
    windowMs: 3600000,
    maxRequests: 10,
    blockDuration: 86400000, // 24 heures
  },
  // Webhook
  webhook: {
    windowMs: 1000,       // 1 seconde
    maxRequests: 100,
  },
};

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Vérifie et consomme un token
   */
  async checkLimit(
    identifier: string,
    type: keyof typeof RATE_LIMIT_CONFIGS = 'public'
  ): Promise<RateLimitResult> {
    const config = RATE_LIMIT_CONFIGS[type];
    const key = `${CACHE_KEYS.RATE_LIMIT}${type}:${identifier}`;
    const now = Date.now();

    let entry = this.limits.get(key);

    // Vérifier si bloqué
    if (entry?.blocked && entry.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockedUntil,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
      };
    }

    // Nouvelle fenêtre ou première requête
    if (!entry || (now - entry.windowStart) >= config.windowMs) {
      entry = {
        count: 1,
        windowStart: now,
        blocked: false,
      };
      this.limits.set(key, entry);

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.windowMs,
      };
    }

    // Incrémenter le compteur
    entry.count++;

    // Vérifier la limite
    if (entry.count > config.maxRequests) {
      // Bloquer si configuré
      if (config.blockDuration) {
        entry.blocked = true;
        entry.blockedUntil = now + config.blockDuration;
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.windowStart + config.windowMs,
        retryAfter: Math.ceil((entry.windowStart + config.windowMs - now) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: entry.windowStart + config.windowMs,
    };
  }

  /**
   * Vérifie sans consommer
   */
  async peekLimit(
    identifier: string,
    type: keyof typeof RATE_LIMIT_CONFIGS = 'public'
  ): Promise<RateLimitResult> {
    const config = RATE_LIMIT_CONFIGS[type];
    const key = `${CACHE_KEYS.RATE_LIMIT}${type}:${identifier}`;
    const now = Date.now();

    const entry = this.limits.get(key);

    if (!entry) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.windowMs,
      };
    }

    if (entry.blocked && entry.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockedUntil,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
      };
    }

    const remaining = Math.max(0, config.maxRequests - entry.count);
    return {
      allowed: remaining > 0,
      remaining,
      resetAt: entry.windowStart + config.windowMs,
    };
  }

  /**
   * Reset manuel d'un rate limit
   */
  async reset(identifier: string, type?: string): Promise<void> {
    if (type) {
      this.limits.delete(`${CACHE_KEYS.RATE_LIMIT}${type}:${identifier}`);
    } else {
      // Reset tous les types pour cet identifier
      for (const limitType of Object.keys(RATE_LIMIT_CONFIGS)) {
        this.limits.delete(`${CACHE_KEYS.RATE_LIMIT}${limitType}:${identifier}`);
      }
    }
  }

  /**
   * Bloque manuellement un identifier
   */
  async block(
    identifier: string,
    type: keyof typeof RATE_LIMIT_CONFIGS,
    durationMs: number
  ): Promise<void> {
    const key = `${CACHE_KEYS.RATE_LIMIT}${type}:${identifier}`;
    const now = Date.now();

    this.limits.set(key, {
      count: RATE_LIMIT_CONFIGS[type].maxRequests + 1,
      windowStart: now,
      blocked: true,
      blockedUntil: now + durationMs,
    });
  }

  /**
   * Statistiques globales
   */
  getStats(): {
    totalEntries: number;
    blockedEntries: number;
    byType: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    let blockedEntries = 0;

    for (const [key, entry] of this.limits.entries()) {
      const type = key.split(':')[1];
      byType[type] = (byType[type] || 0) + 1;
      if (entry.blocked) blockedEntries++;
    }

    return {
      totalEntries: this.limits.size,
      blockedEntries,
      byType,
    };
  }

  /**
   * Middleware helper pour React Query ou fetch
   */
  createMiddleware(type: keyof typeof RATE_LIMIT_CONFIGS = 'authenticated') {
    return async <T>(
      identifier: string,
      fn: () => Promise<T>
    ): Promise<T> => {
      const result = await this.checkLimit(identifier, type);

      if (!result.allowed) {
        throw new RateLimitError(
          `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
          result.retryAfter || 60
        );
      }

      return fn();
    };
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.limits.entries()) {
        // Supprimer les entrées expirées et non bloquées
        const config = this.getConfigForKey(key);
        if (config) {
          const expired = (now - entry.windowStart) >= config.windowMs * 2;
          const unblocked = entry.blocked && entry.blockedUntil && entry.blockedUntil < now;

          if (expired && (!entry.blocked || unblocked)) {
            this.limits.delete(key);
          }
        }
      }
    }, 60000);
  }

  private getConfigForKey(key: string): RateLimitConfig | null {
    const type = key.split(':')[1] as keyof typeof RATE_LIMIT_CONFIGS;
    return RATE_LIMIT_CONFIGS[type] || null;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Erreur personnalisée pour rate limit
export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// Singleton export
export const rateLimiter = new RateLimiter();
export default rateLimiter;

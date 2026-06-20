/**
 * CLIENT-SIDE RATE LIMITER UTILITY
 * Limite les appels API côté client pour éviter les abus
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private limits: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Vérifie si une action est autorisée selon le rate limit
   */
  check(key: string, config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }): boolean {
    const now = Date.now();
    const limit = this.limits.get(key);

    if (!limit || now > limit.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return true;
    }

    if (limit.count >= config.maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Nettoie les entrées expirées
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, limit] of this.limits.entries()) {
      if (now > limit.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Nettoyage automatique toutes les 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);
}

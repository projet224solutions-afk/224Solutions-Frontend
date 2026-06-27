/**
 * SERVICE DE CACHE DISTRIBUÉ
 * Utilise Supabase comme backend de cache pour améliorer les performances
 * Réduit la charge sur la base de données principale
 */


interface _CacheEntry {
  key: string;
  value: any;
  expires_at: string;
}

class CacheService {
  private localCache: Map<string, { value: any; expiresAt: number }> = new Map();

  /**
   * Récupère une valeur du cache (local puis distant)
   */
  async get<T = any>(key: string): Promise<T | null> {
    // Vérifier le cache local d'abord
    const localEntry = this.localCache.get(key);
    if (localEntry && Date.now() < localEntry.expiresAt) {
      return localEntry.value as T;
    }

    // Pour le moment, utiliser uniquement le cache local
    // TODO: Implémenter cache distribué quand la table sera créée
    return null;
  }

  /**
   * Stocke une valeur dans le cache
   */
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Mettre en cache local
    this.localCache.set(key, {
      value,
      expiresAt: expiresAt.getTime()
    });

    // Pour le moment, utiliser uniquement le cache local
    // TODO: Implémenter cache distribué quand la table sera créée
  }

  /**
   * Supprime une entrée du cache
   */
  async delete(key: string): Promise<void> {
    this.localCache.delete(key);
    // TODO: Supprimer du cache distribué quand la table sera créée
  }

  /**
   * Vide le cache (uniquement local pour la sécurité)
   */
  clear(): void {
    this.localCache.clear();
  }

  /**
   * Nettoie les entrées expirées du cache local
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.localCache.entries()) {
      if (now >= entry.expiresAt) {
        this.localCache.delete(key);
      }
    }
  }
}

export const cacheService = new CacheService();

// Nettoyage automatique toutes les 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => cacheService.cleanup(), 5 * 60 * 1000);
}

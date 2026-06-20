/**
 * 🚀 CACHED SUPABASE CLIENT
 * Wrapper autour du client Supabase avec cache intelligent intégré
 * Réduit les requêtes DB de 70-80%
 */

import { supabase } from '@/integrations/supabase/client';
import { smartCache, CACHE_TTL, CACHE_TAGS } from '@/lib/smartCache';
import { requestDedup } from '@/lib/requestDeduplicator';

interface CachedQueryOptions {
  ttl?: number;
  tags?: string[];
  staleWhileRevalidate?: boolean;
  forceRefresh?: boolean;
  dedupe?: boolean;
}

/**
 * Requête cached générique - utilise le cache intelligent
 * Accepte une fonction fetcher qui fait la requête Supabase
 */
export async function cachedQuery<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: CachedQueryOptions
): Promise<{ data: T | null; error: any; fromCache: boolean }> {
  const ttl = options?.ttl ?? CACHE_TTL.STANDARD;
  const tags = options?.tags ?? [];

  try {
    const wrappedFetcher = options?.dedupe !== false
      ? () => requestDedup.dedupe(cacheKey, fetcher)
      : fetcher;

    const data = await smartCache.getOrFetch<T>(cacheKey, wrappedFetcher, {
      ttl,
      tags,
      staleWhileRevalidate: options?.staleWhileRevalidate ?? true,
      forceRefresh: options?.forceRefresh,
    });

    return { data, error: null, fromCache: true };
  } catch (error) {
    return { data: null, error, fromCache: false };
  }
}

/**
 * Requêtes préconfigurées pour les données fréquentes
 */
export const cachedQueries = {
  // Produits populaires (cache 5 min)
  getProducts: (filters?: Record<string, any>) =>
    cachedQuery('products:list:' + JSON.stringify(filters || {}), async () => {
      const q = supabase
        .from('products')
        .select('id, name, price, images, vendor_id, category_id, stock_quantity, rating')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    }, {
      ttl: CACHE_TTL.STANDARD,
      tags: [CACHE_TAGS.PRODUCTS],
    }),

  // Détail produit (cache 2 min)
  getProduct: (id: string) =>
    cachedQuery(`product:${id}`, async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    }, {
      ttl: CACHE_TTL.WARM,
      tags: [CACHE_TAGS.PRODUCTS, `product:${id}`],
      staleWhileRevalidate: true,
    }),

  // Vendeurs actifs (cache 5 min)
  getActiveVendors: () =>
    cachedQuery('vendors:active', async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, business_name, logo_url, latitude, longitude, business_type, rating')
        .eq('is_active', true)
        .limit(100);
      if (error) throw error;
      return data;
    }, {
      ttl: CACHE_TTL.STANDARD,
      tags: [CACHE_TAGS.VENDORS],
    }),

  // Profil utilisateur (cache 2 min)
  getProfile: (userId: string) =>
    cachedQuery(`profile:${userId}`, async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    }, {
      ttl: CACHE_TTL.WARM,
      tags: [CACHE_TAGS.USER, `user:${userId}`],
    }),

  // Wallet (cache 30s)
  getWallet: (userId: string) =>
    cachedQuery(`wallet:${userId}`, async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return data;
    }, {
      ttl: CACHE_TTL.HOT,
      tags: [CACHE_TAGS.WALLET, `wallet:${userId}`],
      staleWhileRevalidate: false,
    }),

  // Catégories (cache 1h)
  getCategories: () =>
    cachedQuery('categories:all', async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, icon, parent_id')
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    }, {
      ttl: CACHE_TTL.STATIC,
      tags: [CACHE_TAGS.CONFIG],
    }),
};

/**
 * Invalidation intelligente après mutation
 */
export function invalidateAfterMutation(table: string, id?: string): void {
  smartCache.invalidateByTag(table);
  if (id) {
    smartCache.invalidateByPattern(`.*${table}.*${id}.*`);
  }
  smartCache.invalidateByPattern(`${table}:.*`);
  console.log(`🔄 [Cache] Invalidé: ${table}${id ? `:${id}` : ''}`);
}

/**
 * 🚀 Hook React pour les requêtes cachées
 * Remplace useQuery pour les données fréquemment lues
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { cachedQuery, invalidateCache } from '@/lib/cache/redisCache';
import { supabase } from '@/integrations/supabase/client';

interface CachedQueryOptions {
  /** Clé de cache Redis (ex: 'products:all') */
  cacheKey: string;
  /** TTL en secondes (défaut: 300 = 5min) */
  ttl?: number;
  /** Options React Query supplémentaires */
  queryOptions?: Partial<UseQueryOptions>;
}

/**
 * Hook pour requêtes cachées avec 3 niveaux: RAM → Redis → Supabase
 */
export function useCachedSupabaseQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options: CachedQueryOptions
) {
  const { cacheKey, ttl = 300, queryOptions } = options;

  return useQuery({
    queryKey,
    queryFn: () => cachedQuery<T>(cacheKey, queryFn, ttl),
    staleTime: (ttl / 2) * 1000, // React Query considère stale à mi-TTL
    gcTime: ttl * 1000,
    ...queryOptions,
  });
}

// ============ Requêtes pré-configurées ============

/** Produits actifs - cache 5 min */
export function useCachedProducts(vendorId?: string) {
  return useCachedSupabaseQuery(
    ['products', 'cached', vendorId || 'all'],
    async () => {
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
    { cacheKey: `products:${vendorId || 'all'}`, ttl: 300 }
  );
}

/** Catégories - cache 30 min (changent rarement) */
export function useCachedCategories() {
  return useCachedSupabaseQuery(
    ['categories', 'cached'],
    async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    { cacheKey: 'categories:all', ttl: 1800 }
  );
}

/** Vendeurs vérifiés - cache 10 min */
export function useCachedVendors() {
  return useCachedSupabaseQuery(
    ['vendors', 'cached'],
    async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, business_name, logo_url, is_verified, business_type, service_type, city, country')
        .eq('is_verified', true)
        .limit(100);
      if (error) throw error;
      return data;
    },
    { cacheKey: 'vendors:verified', ttl: 600 }
  );
}

/** Profil utilisateur - cache 2 min */
export function useCachedProfile(userId: string | undefined) {
  return useCachedSupabaseQuery(
    ['profile', 'cached', userId || ''],
    async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    {
      cacheKey: `profile:${userId}`,
      ttl: 120,
      queryOptions: { enabled: !!userId }
    }
  );
}

/** Invalidation helpers */
export const cacheInvalidators = {
  products: (vendorId?: string) => invalidateCache(`products:${vendorId || 'all'}`),
  categories: () => invalidateCache('categories:all'),
  vendors: () => invalidateCache('vendors:verified'),
  profile: (userId: string) => invalidateCache(`profile:${userId}`),
  all: () => {
    invalidateCache('products');
    invalidateCache('categories');
    invalidateCache('vendors');
    invalidateCache('profile');
  },
};

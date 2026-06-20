/**
 * 🔍 Hook de découverte - Produits de catégories non explorées
 * Brise la "bulle de filtre" en suggérant des produits que l'utilisateur
 * n'a pas encore vus, basé sur ses vues et recherches récentes
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CACHE_TTL, DISCOVERY_MIN_PRODUCTS, filterByAllowedVendors } from '@/config/recommendationConfig';
import { getCurrencyForCountry } from '@/data/countryMappings';

interface DiscoveryProduct {
  product_id: string;
  name: string;
  price: number;
  currency?: string;
  images: string[];
  promotional_videos?: string[];
  rating: number | null;
  reason?: string;
  category_name?: string;
  vendor_id?: string | null;
  vendor_name?: string | null;
  vendor_user_id?: string | null;
}

const DISCOVERY_TIMEOUT_MS = 4500;

async function withDiscoveryTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), DISCOVERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function useDiscoveryProducts(limit = 12, enabled = true) {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ['discovery-products', user?.id ?? 'anon'],
    queryFn: async (): Promise<DiscoveryProduct[]> => {
      try {
        // 1. Récupérer les produits vus (si connecté)
        let viewedIds: string[] = [];
        let viewedCategoryIds: string[] = [];

      if (user) {
        const { data: viewedProducts } = await supabase
          .from('product_views')
          .select('product_id')
          .eq('user_id', user.id)
          .order('viewed_at', { ascending: false })
          .limit(50);

        viewedIds = (viewedProducts || []).map(v => v.product_id);

        if (viewedIds.length > 0) {
          const { data: viewedCats } = await supabase
            .from('products')
            .select('category_id')
            .in('id', viewedIds)
            .not('category_id', 'is', null);

          viewedCategoryIds = [...new Set((viewedCats || []).map(p => p.category_id).filter(Boolean))] as string[];
        }
      }

      // 2. Priorité aux produits récents et aux nouvelles catégories
      let query = supabase
        .from('products')
        .select('id, name, price, images, promotional_videos, rating, category_id, vendor_id, seller_currency, categories(name), vendors(id, user_id, business_name, business_type, country, shop_currency)')
        .eq('is_active', true)
        .order('created_at', { ascending: false }) // Nouveautés en premier
        .limit(limit * 3);

      if (viewedCategoryIds.length > 0 && viewedCategoryIds.length < 10) {
        for (const catId of viewedCategoryIds.slice(0, 5)) {
          query = query.neq('category_id', catId);
        }
      }

      const { data: discoveryData, error } = await withDiscoveryTimeout(query, 'discovery_products');
      if (error) throw error;

      const unseen = filterByAllowedVendors(discoveryData || [])
        .filter(p => !viewedIds.includes(p.id))
        .slice(0, limit);

      // Si pas assez, compléter avec des produits populaires
      if (unseen.length < DISCOVERY_MIN_PRODUCTS) {
        const { data: fallback } = await withDiscoveryTimeout(
          supabase
            .from('products')
            .select('id, name, price, images, promotional_videos, rating, category_id, vendor_id, seller_currency, categories(name), vendors(id, user_id, business_name, business_type, country, shop_currency)')
            .eq('is_active', true)
            .order('reviews_count', { ascending: false })
            .limit(limit * 2),
          'discovery_fallback'
        );

        const fallbackFiltered = filterByAllowedVendors(fallback || [])
          .filter(p => !viewedIds.includes(p.id) && !unseen.find(u => u.id === p.id))
          .slice(0, limit - unseen.length);

        unseen.push(...fallbackFiltered);
      }

      return unseen.map(p => {
        const v = Array.isArray((p as any).vendors) ? (p as any).vendors[0] : (p as any).vendors;
        // DEVISE = PAYS DU VENDEUR (fiable) : Guinée→GNF, Sénégal→XOF.
        const currency = getCurrencyForCountry(v?.country || '');
        return {
          product_id: p.id,
          name: p.name,
          price: p.price,
          currency,
          images: Array.isArray(p.images) ? (p.images as string[]) : [],
          promotional_videos: Array.isArray((p as any).promotional_videos) ? (p as any).promotional_videos as string[] : [],
          rating: p.rating,
          reason: `Découvrir: ${(p.categories as any)?.name || 'Nouveauté'}`,
          category_name: (p.categories as any)?.name,
          vendor_id: (p as any).vendor_id || v?.id || null,
          vendor_name: v?.business_name || '',
          vendor_user_id: v?.user_id || null,
        };
      });
    } catch (error) {
      console.warn('[DiscoveryProducts] fallback empty', error);
      return [];
    }
  },
    enabled: enabled && !authLoading,
    staleTime: CACHE_TTL.discovery.staleTime,
    gcTime: CACHE_TTL.discovery.gcTime,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}

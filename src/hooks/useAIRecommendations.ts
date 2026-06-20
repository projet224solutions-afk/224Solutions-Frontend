/**
 * 🤖 HOOK DE RECOMMANDATIONS IA - 224SOLUTIONS
 * Appelle l'edge function ai-recommend pour des suggestions Gemini-powered
 * Ne s'active que si l'utilisateur est connecté (évite le flickering)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CACHE_TTL, filterByAllowedVendors } from '@/config/recommendationConfig';
import { getCurrencyForCountry } from '@/data/countryMappings';

interface AIProduct {
  product_id: string;
  name: string;
  price: number;
  currency?: string;
  images: string[];
  promotional_videos?: string[];
  rating: number | null;
  reviews_count?: number | null;
  category_id?: string;
  reason?: string;
  score?: number;
  vendor_id?: string | null;
  vendor_name?: string | null;
  vendor_user_id?: string | null;
}

/**
 * Enrichit les produits IA avec la devise du vendeur quand elle est absente.
 * Nécessaire car l'edge function peut retourner des produits sans currency.
 */
async function enrichWithCurrency(products: AIProduct[]): Promise<AIProduct[]> {
  if (products.length === 0) return products;

  try {
    const ids = products.map(p => p.product_id);
    const { data } = await supabase
      .from('products')
      .select('id, promotional_videos, seller_currency, vendor_id, vendors(id, user_id, business_name, country, shop_currency)')
      .in('id', ids);

    const currencyMap: Record<string, string> = {};
    const videoMap: Record<string, string[]> = {};
    const vendorMap: Record<string, { vendor_id: string | null; vendor_name: string; vendor_user_id: string | null }> = {};
    (data || []).forEach((p: any) => {
      const v = Array.isArray(p.vendors) ? p.vendors[0] : p.vendors;
      // DEVISE = PAYS DU VENDEUR (fiable) : Guinée→GNF, Sénégal→XOF.
      const cur = getCurrencyForCountry(v?.country || '');
      if (cur) currencyMap[p.id] = cur;
      if (Array.isArray(p.promotional_videos) && p.promotional_videos.length > 0) {
        videoMap[p.id] = p.promotional_videos as string[];
      }
      vendorMap[p.id] = {
        vendor_id: p.vendor_id || v?.id || null,
        vendor_name: v?.business_name || '',
        vendor_user_id: v?.user_id || null,
      };
    });

    return products.map(p => ({
      ...p,
      currency: currencyMap[p.product_id] || p.currency || 'GNF',
      promotional_videos: videoMap[p.product_id] || p.promotional_videos || [],
      vendor_id: vendorMap[p.product_id]?.vendor_id ?? p.vendor_id ?? null,
      vendor_name: vendorMap[p.product_id]?.vendor_name ?? p.vendor_name ?? '',
      vendor_user_id: vendorMap[p.product_id]?.vendor_user_id ?? p.vendor_user_id ?? null,
    }));
  } catch {
    return products.map(p => ({ ...p, currency: p.currency || 'GNF' }));
  }
}

interface AIRecommendationResult {
  products: AIProduct[];
  source: 'ai' | 'cache' | 'fallback';
  type: string;
}

type RecoType = 'personalized' | 'contextual' | 'trending' | 'post_purchase';

const AI_RECOMMENDATION_TIMEOUT_MS = 4500;

async function withAITimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), AI_RECOMMENDATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchAIRecommendations(
  type: RecoType,
  productId?: string,
  context?: Record<string, unknown>
): Promise<AIRecommendationResult> {
  const { data, error } = await withAITimeout(
    supabase.functions.invoke('ai-recommend', {
      body: { type, product_id: productId, context: context || {} },
    }),
    'ai_recommend'
  );

  if (error) {
    console.error('[AIRecommendations] Error:', error);
    throw error;
  }

  return data as AIRecommendationResult;
}

/** Recommandations personnalisées par IA (fonctionne aussi sans auth avec fallback) */
export function useAIPersonalized(limit = 20, enabled = true) {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ['ai-recommendations', 'personalized', user?.id ?? 'anon'],
    queryFn: async () => {
      if (user) {
        try {
          const result = await fetchAIRecommendations('personalized');
          if (result.products.length > 0) {
            return await enrichWithCurrency(result.products.slice(0, limit));
          }
        } catch { /* fallback */ }
      }
      // Fallback: produits récents bien notés
      const { data } = await supabase
        .from('products')
        .select('id, name, price, images, promotional_videos, rating, reviews_count, vendor_id, seller_currency, vendors(id, user_id, business_name, business_type, country, shop_currency)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit * 2);

      return filterByAllowedVendors(data || [])
        .slice(0, limit)
        .map(p => {
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
            reviews_count: p.reviews_count,
            reason: 'Nouveauté',
            vendor_id: (p as any).vendor_id || v?.id || null,
            vendor_name: v?.business_name || '',
            vendor_user_id: v?.user_id || null,
          };
        });
    },
    enabled: enabled && !authLoading,
    staleTime: CACHE_TTL.personalized.staleTime,
    gcTime: CACHE_TTL.personalized.gcTime,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}

/** Recommandations contextuelles (localisation, heure, saison) */
export function useAIContextual(context: Record<string, unknown> = {}, limit = 12) {
  const { user, loading: authLoading } = useAuth();

  const enrichedContext = {
    ...context,
    hour: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    month: new Date().getMonth() + 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return useQuery({
    queryKey: ['ai-recommendations', 'contextual', user?.id, JSON.stringify(enrichedContext)],
    queryFn: async () => {
      const result = await fetchAIRecommendations('contextual', undefined, enrichedContext);
      return result.products.slice(0, limit);
    },
    enabled: !authLoading && !!user,
    staleTime: CACHE_TTL.contextual.staleTime,
    gcTime: CACHE_TTL.contextual.gcTime,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** Produits tendances adaptés à l'utilisateur (fonctionne aussi sans auth) */
export function useAITrending(limit = 16, enabled = true) {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ['ai-recommendations', 'trending', user?.id ?? 'anon'],
    queryFn: async () => {
      if (user) {
        try {
          const result = await fetchAIRecommendations('trending');
          if (result.products.length > 0) {
            return await enrichWithCurrency(result.products.slice(0, limit));
          }
        } catch { /* fallback ci-dessous */ }
      }

      // Fallback amélioré : combiner commandes récentes + avis + note
      const { data: orderData } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(200);

      // Compter les commandes par produit
      const orderCounts = new Map<string, number>();
      (orderData || []).forEach(item => {
        orderCounts.set(item.product_id, (orderCounts.get(item.product_id) || 0) + (item.quantity || 1));
      });

      const { data } = await supabase
        .from('products')
        .select('id, name, price, images, promotional_videos, rating, reviews_count, vendor_id, seller_currency, vendors(id, user_id, business_name, business_type, country, shop_currency)')
        .eq('is_active', true)
        .order('reviews_count', { ascending: false })
        .limit(limit * 3);

      const filtered = filterByAllowedVendors(data || []);

      // Score composite : commandes récentes × 3 + avis × 1 + note × 2
      const scored = filtered.map(p => ({
        ...p,
        _score: (orderCounts.get(p.id) || 0) * 3 + (p.reviews_count || 0) * 1 + (p.rating || 0) * 2,
      }));

      scored.sort((a, b) => b._score - a._score);

      return scored
        .slice(0, limit)
        .map(p => {
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
            reviews_count: p.reviews_count,
            vendor_id: (p as any).vendor_id || v?.id || null,
            vendor_name: v?.business_name || '',
            vendor_user_id: v?.user_id || null,
          };
        });
    },
    enabled: enabled && !authLoading,
    staleTime: CACHE_TTL.trending.staleTime,
    gcTime: CACHE_TTL.trending.gcTime,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}

/** Recommandations post-achat */
export function useAIPostPurchase(productId: string | undefined, limit = 10) {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ['ai-recommendations', 'post_purchase', user?.id, productId],
    queryFn: async () => {
      const result = await fetchAIRecommendations('post_purchase', productId);
      return result.products.slice(0, limit);
    },
    enabled: !authLoading && !!user && !!productId,
    staleTime: CACHE_TTL.postPurchase.staleTime,
    gcTime: CACHE_TTL.postPurchase.gcTime,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

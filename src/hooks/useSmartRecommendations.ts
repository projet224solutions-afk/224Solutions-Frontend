/**
 * 🧠 HOOKS DE RECOMMANDATION INTELLIGENTE - 224SOLUTIONS
 * Utilise les nouvelles fonctions DB (product_scores + user_category_preferences)
 * avec fallback automatique pour les nouveaux utilisateurs
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CACHE_TTL } from '@/config/recommendationConfig';

interface SmartProduct {
  product_id: string;
  name: string;
  price: number;
  images: string[];
  rating: number | null;
  vendor_id: string;
  vendor_name: string;
  currency: string;
  score: number;
  reason: string;
}

const SMART_RECO_TIMEOUT_MS = 4500;

async function runRpcWithTimeout<T>(promise: Promise<{ data: T | null; error: any }>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const result = await Promise.race<{ data: T | null; error: any }>([
      promise,
      new Promise<{ data: T | null; error: any }>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), SMART_RECO_TIMEOUT_MS);
      }),
    ]);

    if (result.error) throw result.error;
    return (result.data || []) as T;
  } catch (error) {
    console.warn(`[SmartRecommendations] Fallback ${label}`, error);
    return [] as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ==========================================
// TRACKING UNIFIÉ (non-bloquant)
// ==========================================

let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = sessionStorage.getItem('reco_session_id') || crypto.randomUUID();
    sessionStorage.setItem('reco_session_id', sessionId);
  }
  return sessionId;
}

export async function trackActivity(
  actionType: string,
  options: {
    productId?: string;
    vendorId?: string;
    categoryId?: string;
    query?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await (supabase.from('user_activity') as any).insert({
      user_id: user?.id || null,
      session_id: user ? null : getSessionId(),
      product_id: options.productId || null,
      vendor_id: options.vendorId || null,
      category_id: options.categoryId || null,
      action_type: actionType,
      query: options.query || null,
      metadata: options.metadata || {},
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    });

    // Fire & forget: update user preferences
    if (user?.id && options.productId) {
      Promise.resolve(supabase.rpc('compute_user_preferences', { p_user_id: user.id } as any)).catch(() => {});
    }
  } catch {
    // Ne jamais bloquer l'UI
  }
}

// ==========================================
// HOOKS REACT QUERY
// ==========================================

/** Recommandations personnalisées pour la homepage */
export function useSmartRecommendations(limit = 20, enabled = true) {
  return useQuery<SmartProduct[]>({
    queryKey: ['smart-recommendations', 'home', limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return await runRpcWithTimeout<SmartProduct[]>(
        supabase.rpc('get_smart_recommendations', {
          p_user_id: user?.id || null,
          p_limit: limit,
          p_type: 'home'
        }),
        'home'
      );
    },
    enabled,
    staleTime: CACHE_TTL.personalized.staleTime,
    gcTime: CACHE_TTL.personalized.gcTime,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}

/** Produits tendance / populaires */
export function useTrendingProducts(limit = 16, enabled = true) {
  return useQuery<SmartProduct[]>({
    queryKey: ['smart-recommendations', 'trending', limit],
    queryFn: async () => {
      return await runRpcWithTimeout<SmartProduct[]>(
        supabase.rpc('get_trending_products', { p_limit: limit }),
        'trending'
      );
    },
    enabled,
    staleTime: CACHE_TTL.trending.staleTime,
    gcTime: CACHE_TTL.trending.gcTime,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}

/** Produits similaires */
export function useSmartSimilarProducts(productId: string | null | undefined, limit = 10) {
  return useQuery<SmartProduct[]>({
    queryKey: ['smart-recommendations', 'similar', productId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_smart_similar_products', {
        p_product_id: productId!,
        p_limit: limit
      });
      if (error) throw error;
      return (data || []) as SmartProduct[];
    },
    enabled: !!productId,
    staleTime: CACHE_TTL.contextual.staleTime,
    gcTime: CACHE_TTL.contextual.gcTime,
  });
}

/** Récemment consultés */
export function useRecentlyViewed(limit = 12, enabled = true) {
  return useQuery<SmartProduct[]>({
    queryKey: ['smart-recommendations', 'recently-viewed', limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      return await runRpcWithTimeout<SmartProduct[]>(
        supabase.rpc('get_recently_viewed', {
          p_user_id: user.id,
          p_limit: limit
        }),
        'recently_viewed'
      );
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 min
    gcTime: 5 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}

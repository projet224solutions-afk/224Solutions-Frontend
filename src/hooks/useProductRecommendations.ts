/**
 * 🧠 HOOKS DE RECOMMANDATION PRODUITS - 224SOLUTIONS
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  trackInteraction,
  getSimilarProducts,
  getPersonalizedRecommendations,
  getAlsoBoughtProducts,
  getPopularInCategory
} from '@/services/productRecommendationService';

// ==========================================
// Legacy interface (backward compat)
// ==========================================
export interface ProductRecommendation {
  id: string;
  recommended_product_id: string;
  score: number;
  reason: string;
  product?: {
    id: string;
    name: string;
    price: number;
    images?: string[];
    rating?: number;
    vendors?: { country?: string | null } | { country?: string | null }[] | null;
  };
}

/** Legacy hook - kept for backward compatibility */
export const useProductRecommendations = (limit: number = 10) => {
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setRecommendations([]); return; }

      const { data: existingRecs, error: recsError } = await supabase
        .from('product_recommendations')
        .select(`*, product:products!recommended_product_id(id, name, price, images, rating, vendors(country))`)
        .eq('user_id', user.id)
        .order('score', { ascending: false })
        .limit(limit);

      if (recsError) throw recsError;

      if (!existingRecs || existingRecs.length < 5) {
        await supabase.rpc('generate_recommendations_for_user', { p_user_id: user.id, p_limit: limit });
        const { data: newRecs } = await supabase
          .from('product_recommendations')
          .select(`*, product:products!recommended_product_id(id, name, price, images, rating, vendors(country))`)
          .eq('user_id', user.id)
          .order('score', { ascending: false })
          .limit(limit);
        setRecommendations((newRecs as any) || []);
      } else {
        setRecommendations((existingRecs as any) || []);
      }
    } catch (error: any) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRecommendations(); }, [limit]);
  return { recommendations, loading, reload: loadRecommendations };
};

// ==========================================
// New hooks - React Query based
// ==========================================

/** Track une vue produit (avec déduplication) */
export function useTrackProductView(productId: string | null | undefined) {
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (productId && productId !== tracked.current) {
      tracked.current = productId;
      trackInteraction(productId, 'view');
    }
  }, [productId]);
}

/** Track un ajout au panier */
export function trackCartAdd(productId: string) {
  trackInteraction(productId, 'cart');
}

/** Track un achat */
export function trackPurchase(productId: string) {
  trackInteraction(productId, 'purchase');
}

/** Produits similaires */
export function useSimilarProducts(productId: string | null | undefined, limit = 8) {
  return useQuery({
    queryKey: ['similar-products', productId, limit],
    queryFn: () => getSimilarProducts(productId!, limit),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/** Recommandations personnalisées */
export function usePersonalizedRecommendations(limit = 12) {
  return useQuery({
    queryKey: ['personalized-recommendations', limit],
    queryFn: () => getPersonalizedRecommendations(limit),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/** Produits achetés ensemble */
export function useAlsoBoughtProducts(productId: string | null | undefined, limit = 6) {
  return useQuery({
    queryKey: ['also-bought', productId, limit],
    queryFn: () => getAlsoBoughtProducts(productId!, limit),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Populaires dans la catégorie */
export function usePopularInCategory(categoryId: string | null | undefined, limit = 8, excludeProductId?: string) {
  return useQuery({
    queryKey: ['popular-category', categoryId, limit, excludeProductId],
    queryFn: () => getPopularInCategory(categoryId!, limit, excludeProductId),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });
}

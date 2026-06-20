/**
 * HOOK RECOMMANDATIONS ML - 224SOLUTIONS
 * Hook React pour utiliser les recommandations produits ML
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import MLRecommendationService, {
  ProductRecommendation,
  RecommendationConfig
} from '@/services/ml/MLRecommendationService';

interface UseMLRecommendationsOptions extends RecommendationConfig {
  autoLoad?: boolean;
  refreshInterval?: number; // en ms, 0 = pas de refresh auto
}

interface UseMLRecommendationsReturn {
  recommendations: ProductRecommendation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getForProduct: (productId: string) => Promise<ProductRecommendation[]>;
  trackView: (productId: string) => void;
  trackCartAdd: (productId: string) => void;
  trackPurchase: (productId: string) => void;
}

export function useMLRecommendations(
  options: UseMLRecommendationsOptions = {}
): UseMLRecommendationsReturn {
  const { user } = useAuth();
  const {
    autoLoad = true,
    refreshInterval = 0,
    ...config
  } = options;

  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Charger les recommandations personnalisées
   */
  const loadRecommendations = useCallback(async () => {
    if (!user?.id) {
      // Sans utilisateur connecté, charger les tendances
      setLoading(true);
      try {
        const trending = await MLRecommendationService.getTrendingProducts(
          config.limit || 12
        );
        setRecommendations(trending);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Erreur chargement recommandations');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const recs = await MLRecommendationService.getPersonalizedRecommendations(
        user.id,
        config
      );
      setRecommendations(recs);
    } catch (err: any) {
      console.error('[useMLRecommendations] Error:', err);
      setError(err.message || 'Erreur chargement recommandations');
      // Fallback vers trending
      try {
        const trending = await MLRecommendationService.getTrendingProducts(
          config.limit || 12
        );
        setRecommendations(trending);
      } catch {
        // Ignore fallback error
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, JSON.stringify(config)]);

  /**
   * Rafraîchir les recommandations
   */
  const refresh = useCallback(async () => {
    MLRecommendationService.clearCache();
    await loadRecommendations();
  }, [loadRecommendations]);

  /**
   * Obtenir les recommandations pour un produit spécifique
   */
  const getForProduct = useCallback(async (productId: string): Promise<ProductRecommendation[]> => {
    try {
      const [boughtTogether, viewedTogether] = await Promise.all([
        MLRecommendationService.getFrequentlyBoughtTogether(productId, 4),
        MLRecommendationService.getViewedTogether(productId, 4)
      ]);

      // Fusionner et dédupliquer
      const merged = new Map<string, ProductRecommendation>();
      [...boughtTogether, ...viewedTogether].forEach(rec => {
        const existing = merged.get(rec.product_id);
        if (!existing || rec.score > existing.score) {
          merged.set(rec.product_id, rec);
        }
      });

      return Array.from(merged.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    } catch (err) {
      console.error('[useMLRecommendations] Error getting product recommendations:', err);
      return [];
    }
  }, []);

  /**
   * Tracker une vue produit
   */
  const trackView = useCallback((productId: string) => {
    if (user?.id) {
      MLRecommendationService.trackInteraction(user.id, productId, 'view');
    }
  }, [user?.id]);

  /**
   * Tracker un ajout au panier
   */
  const trackCartAdd = useCallback((productId: string) => {
    if (user?.id) {
      MLRecommendationService.trackInteraction(user.id, productId, 'cart_add');
    }
  }, [user?.id]);

  /**
   * Tracker un achat
   */
  const trackPurchase = useCallback((productId: string) => {
    if (user?.id) {
      MLRecommendationService.trackInteraction(user.id, productId, 'purchase');
    }
  }, [user?.id]);

  // Chargement initial
  useEffect(() => {
    if (autoLoad) {
      loadRecommendations();
    }
  }, [autoLoad, loadRecommendations]);

  // Refresh automatique si configuré
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadRecommendations, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, loadRecommendations]);

  return {
    recommendations,
    loading,
    error,
    refresh,
    getForProduct,
    trackView,
    trackCartAdd,
    trackPurchase
  };
}

export default useMLRecommendations;

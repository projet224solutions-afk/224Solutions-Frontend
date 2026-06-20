/**
 * 🧠 WIDGET COMPLET DE RECOMMANDATIONS - 224SOLUTIONS
 * Combine toutes les sections de recommandation
 */

import { ProductRecommendationSection } from './ProductRecommendationSection';
import { useTranslation } from "@/hooks/useTranslation";
import {
  usePersonalizedRecommendations,
  useSimilarProducts,
  useAlsoBoughtProducts,
  useTrackProductView,
} from '@/hooks/useProductRecommendations';

interface RecommendationsWidgetProps {
  currentProductId?: string | null;
  showPersonalized?: boolean;
  showSimilar?: boolean;
  showAlsoBought?: boolean;
  onProductClick?: (productId: string) => void;
  onAddToCart?: (productId: string) => void;
  className?: string;
}

export function RecommendationsWidget({
  currentProductId,
  showPersonalized = true,
  showSimilar = true,
  showAlsoBought = true,
  onProductClick,
  onAddToCart,
  className
}: RecommendationsWidgetProps) {
  const { t } = useTranslation();
  useTrackProductView(currentProductId);

  const { data: personalized, isLoading: loadingPersonalized, error: personalizedError } = usePersonalizedRecommendations(12);
  const { data: similar, isLoading: loadingSimilar } = useSimilarProducts(currentProductId, 10);
  const { data: alsoBought, isLoading: loadingAlsoBought } = useAlsoBoughtProducts(currentProductId, 8);

  // Debug en dev
  if (personalizedError) {
    console.warn('[RecommendationsWidget] Error:', personalizedError);
  }

  return (
    <div className={className}>
      {showPersonalized && (
        <ProductRecommendationSection
          title={t('recommendationsWidget.selectionPourVous')}
          icon="sparkles"
          products={(personalized || []).map(p => ({ ...p, reason: p.reason }))}
          loading={loadingPersonalized}
          onProductClick={onProductClick}
          onAddToCart={onAddToCart}
        />
      )}

      {showSimilar && currentProductId && (
        <ProductRecommendationSection
          title={t('recommendationsWidget.produitsSimilaires')}
          subtitle={t('recommendationsWidget.vousPourriezAussiAimer')}
          icon="star"
          products={similar || []}
          loading={loadingSimilar}
          onProductClick={onProductClick}
          onAddToCart={onAddToCart}
        />
      )}

      {showAlsoBought && currentProductId && (
        <ProductRecommendationSection
          title={t('recommendationsWidget.lesClientsOntAussiAchete')}
          subtitle={t('recommendationsWidget.souventAchetesEnsemble')}
          icon="shopping"
          products={alsoBought || []}
          loading={loadingAlsoBought}
          onProductClick={onProductClick}
          onAddToCart={onAddToCart}
        />
      )}
    </div>
  );
}

export default RecommendationsWidget;

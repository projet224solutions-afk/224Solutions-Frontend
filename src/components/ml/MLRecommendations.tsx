import { useTranslation } from "@/hooks/useTranslation";
/**
 * COMPOSANT RECOMMANDATIONS ML - 224SOLUTIONS
 * Affiche les produits recommandés basés sur l'IA
 */

import React, { memo } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Crown,
  TrendingUp,
  Users,
  ShoppingCart,
  Eye,
  RefreshCw,
  Star,
  ArrowRight
} from 'lucide-react';
import { useMLRecommendations } from '@/hooks/useMLRecommendations';
import { ProductRecommendation } from '@/services/ml/MLRecommendationService';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface MLRecommendationsProps {
  title?: string;
  subtitle?: string;
  limit?: number;
  showReason?: boolean;
  variant?: 'horizontal' | 'grid';
  productId?: string; // Pour "produits similaires"
  onProductClick?: (productId: string) => void;
}

// Icônes et labels pour les raisons de recommandation
const REASON_CONFIG = {
  similar_users: {
    icon: Users,
    label: 'Utilisateurs similaires',
    color: 'bg-blue-100 text-blue-800'
  },
  similar_products: {
    icon: Crown,
    label: 'Produits similaires',
    color: 'bg-blue-100 text-[#04439e]'
  },
  trending: {
    icon: TrendingUp,
    label: 'Tendance',
    color: 'bg-orange-100 text-[#ff4000]'
  },
  viewed_together: {
    icon: Eye,
    label: 'Souvent vus ensemble',
    color: 'bg-orange-100 text-orange-800'
  },
  bought_together: {
    icon: ShoppingCart,
    label: 'Souvent achetés ensemble',
    color: 'bg-orange-100 text-[#ff4000]'
  },
  personalized: {
    icon: Star,
    label: 'Pour vous',
    color: 'bg-orange-100 text-[#ff4000]'
  }
};

// Composant carte produit recommandé
const RecommendationCard = memo(({
  recommendation,
  showReason,
  onProductClick,
  onAddToCart
}: {
  recommendation: ProductRecommendation;
  showReason: boolean;
  onProductClick?: (productId: string) => void;
  onAddToCart: (rec: ProductRecommendation) => void;
}) => {
  const reasonConfig = REASON_CONFIG[recommendation.reason];
  const ReasonIcon = reasonConfig.icon;

  const formatPrice = (price: number) => formatCurrency(price);

  return (
    <Card
      className="min-w-[180px] max-w-[200px] flex-shrink-0 cursor-pointer hover:shadow-lg transition-all duration-200 group"
      onClick={() => onProductClick?.(recommendation.product_id)}
    >
      <div className="relative aspect-square overflow-hidden rounded-t-lg">
        <img
          src={recommendation.product_image || '/placeholder.svg'}
          alt={recommendation.product_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          loading="lazy"
        />
        {showReason && (
          <Badge
            className={`absolute top-2 left-2 text-xs ${reasonConfig.color}`}
          >
            <ReasonIcon className="w-3 h-3 mr-1" />
            {reasonConfig.label}
          </Badge>
        )}
        {recommendation.confidence > 0.7 && (
          <Badge className="absolute top-2 right-2 bg-[#ff4000] text-white text-xs">
            <Crown className="w-3 h-3 mr-1" />
            Top pick
          </Badge>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2 min-h-[40px]">
          {recommendation.product_name}
        </h3>
        <p className="text-xs text-muted-foreground truncate">
          {recommendation.vendor_name}
        </p>
        <div className="flex items-center justify-between">
          <span className="font-bold text-primary">
            {formatPrice(recommendation.product_price)}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(recommendation);
            }}
          >
            <ShoppingCart className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

RecommendationCard.displayName = 'RecommendationCard';

// Skeleton de chargement
const RecommendationSkeleton = () => (
  <Card className="min-w-[180px] max-w-[200px] flex-shrink-0">
    <Skeleton className="aspect-square rounded-t-lg" />
    <CardContent className="p-3 space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-7 w-7 rounded" />
      </div>
    </CardContent>
  </Card>
);

// Composant principal
export function MLRecommendations({
  title = 'Recommandé pour vous',
  subtitle = 'Basé sur vos préférences',
  limit = 12,
  showReason = true,
  variant = 'horizontal',
  productId,
  onProductClick
}: MLRecommendationsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const {
    recommendations,
    loading,
    error,
    refresh,
    getForProduct
  } = useMLRecommendations({
    limit,
    autoLoad: !productId // Ne pas charger auto si on a un productId
  });

  const [productRecs, setProductRecs] = React.useState<ProductRecommendation[]>([]);
  const [productRecsLoading, setProductRecsLoading] = React.useState(false);

  // Charger les recommandations pour un produit spécifique
  React.useEffect(() => {
    if (productId) {
      setProductRecsLoading(true);
      getForProduct(productId)
        .then(setProductRecs)
        .finally(() => setProductRecsLoading(false));
    }
  }, [productId, getForProduct]);

  const displayRecs = productId ? productRecs : recommendations;
  const isLoading = productId ? productRecsLoading : loading;

  const handleProductClick = (id: string) => {
    if (onProductClick) {
      onProductClick(id);
    } else {
      navigate(`/product/${id}`);
    }
  };

  const handleAddToCart = (rec: ProductRecommendation) => {
    addToCart({
      id: rec.product_id,
      name: rec.product_name,
      price: rec.product_price,
      image: rec.product_image,
      vendor_id: rec.vendor_id
    });
    toast.success(t('mLRecommendations.produitAjouteAuPanier'), {
      description: rec.product_name
    });
  };

  if (error && !isLoading && displayRecs.length === 0) {
    return null; // Ne pas afficher en cas d'erreur sans données
  }

  return (
    <Card className="border-none shadow-sm bg-background">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#04439e]/10">
              <Crown className="w-5 h-5 text-[#04439e]" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/marketplace')}
            >
              Voir tout
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {variant === 'horizontal' ? (
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <RecommendationSkeleton key={i} />
                ))
              ) : displayRecs.length > 0 ? (
                displayRecs.map((rec) => (
                  <RecommendationCard
                    key={rec.product_id}
                    recommendation={rec}
                    showReason={showReason}
                    onProductClick={handleProductClick}
                    onAddToCart={handleAddToCart}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center w-full py-8 text-muted-foreground">
                  <p>{t('mLRecommendations.pasDeRecommandationsDisponibles')}</p>
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {isLoading ? (
              Array.from({ length: limit }).map((_, i) => (
                <RecommendationSkeleton key={i} />
              ))
            ) : displayRecs.length > 0 ? (
              displayRecs.map((rec) => (
                <RecommendationCard
                  key={rec.product_id}
                  recommendation={rec}
                  showReason={showReason}
                  onProductClick={handleProductClick}
                  onAddToCart={handleAddToCart}
                />
              ))
            ) : (
              <div className="col-span-full flex items-center justify-center py-8 text-muted-foreground">
                <p>{t('mLRecommendations.pasDeRecommandationsDisponibles')}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export pour utilisation dans les pages produits
export function ProductRecommendations({
  productId,
  title = 'Vous aimerez aussi',
  ...props
}: MLRecommendationsProps & { productId: string }) {
  const { t } = useTranslation();
  return (
    <MLRecommendations
      productId={productId}
      title={title}
      subtitle="Produits fréquemment achetés ensemble"
      {...props}
    />
  );
}

export default MLRecommendations;

import { useProductRecommendations } from '@/hooks/useProductRecommendations';
import { getCurrencyForCountry } from '@/data/countryMappings';
import { Card, CardContent } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductRecommendationsProps {
  limit?: number;
  title?: string;
}

/**
 * Composant de recommandations personnalisées (style Amazon)
 */
export const ProductRecommendations = ({
  limit = 10,
  title = "Recommandé pour vous"
}: ProductRecommendationsProps) => {
  const { recommendations, loading } = useProductRecommendations(limit);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          {title}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="w-full h-40 mb-2" />
                <Skeleton className="w-full h-4 mb-2" />
                <Skeleton className="w-20 h-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-primary" />
        {title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {recommendations.map((rec) => (
          <Link
            key={rec.id}
            to={`/product/${rec.recommended_product_id}`}
            className="block"
          >
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 space-y-2">
                {rec.product?.images && rec.product.images[0] && (
                  <img
                    src={rec.product.images[0]}
                    alt={rec.product.name}
                    className="w-full h-40 object-cover rounded"
                  />
                )}
                <h3 className="font-semibold text-sm line-clamp-2">
                  {rec.product?.name}
                </h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {rec.product?.rating && (
                    <>
                      <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
                      <span>{rec.product.rating.toFixed(1)}</span>
                    </>
                  )}
                </div>
                <p className="font-bold text-primary">
                  <Money
                    amount={rec.product?.price || 0}
                    from={getCurrencyForCountry((Array.isArray(rec.product?.vendors)
                      ? rec.product?.vendors[0]?.country
                      : rec.product?.vendors?.country) || '')}
                  />
                </p>
                <p className="text-xs text-muted-foreground">
                  {rec.reason}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

import { useTrendingProducts } from '@/hooks/useTrendingProducts';
import { Card, CardContent } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, Star, Eye, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TrendingProductsProps {
  days?: number;
  limit?: number;
  title?: string;
}

/**
 * Composant des produits tendances (style Amazon Best Sellers)
 */
export const TrendingProducts = ({
  days = 7,
  limit = 20,
  title = "Meilleures ventes"
}: TrendingProductsProps) => {
  const { products, loading } = useTrendingProducts(days, limit);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          {title}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="w-full h-48 mb-2" />
                <Skeleton className="w-full h-4 mb-2" />
                <Skeleton className="w-24 h-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">
          Basé sur les {days} derniers jours
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((item, index) => (
          <Link
            key={item.product_id}
            to={`/product/${item.product_id}`}
            className="block"
          >
            <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer relative">
              {index < 3 && (
                <Badge className="absolute top-2 left-2 z-10 bg-gradient-to-r from-[#ff4000] to-orange-500">
                  #{index + 1}
                </Badge>
              )}
              <CardContent className="p-4 space-y-2">
                {item.product?.images && item.product.images[0] && (
                  <div className="relative">
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-full h-48 object-cover rounded"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      {item.trend_score.toFixed(0)}
                    </div>
                  </div>
                )}
                <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
                  {item.product?.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {item.view_count}
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {item.wishlist_count}
                  </div>
                  {item.avg_rating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-[#ff4000] text-[#ff4000]" />
                      {item.avg_rating.toFixed(1)}
                    </div>
                  )}
                </div>
                <p className="font-bold text-lg text-primary">
                  <Money amount={item.product?.price || 0} from={item.product?.sellerCurrency || 'GNF'} />
                </p>
                <Badge variant="secondary" className="text-xs">
                  {item.view_count} vues · {item.review_count} avis
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

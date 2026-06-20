import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { Clock, Laptop, Package, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import {
  clearRecentProducts,
  getRecentProducts,
  type RecentProductEntry,
} from '@/lib/recentProductHistory';

interface RecentlyViewedProductsProps {
  title?: string;
  subtitle?: string;
  maxItems?: number;
  className?: string;
}

export default function RecentlyViewedProducts({
  title = 'Derniers produits visités',
  subtitle = 'Retrouvez rapidement les produits que vous avez consultés',
  maxItems = 8,
  className = '',
}: RecentlyViewedProductsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { convert, loading: priceLoading } = usePriceConverter();
  const [items, setItems] = useState<RecentProductEntry[]>([]);

  const userKey = user?.id || null;

  useEffect(() => {
    const load = () => {
      setItems(getRecentProducts(userKey));
    };

    load();

    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith('recent-products-v1:')) {
        load();
      }
    };

    const onRecentUpdated = () => load();

    window.addEventListener('storage', onStorage);
    window.addEventListener('recent-products-updated', onRecentUpdated);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('recent-products-updated', onRecentUpdated);
    };
  }, [userKey]);

  const visibleItems = useMemo(() => items.slice(0, maxItems), [items, maxItems]);

  if (visibleItems.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              {title}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">{subtitle}</CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            onClick={() => clearRecentProducts(userKey)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Vider
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleItems.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => navigate(item.route)}
              className="text-left rounded-lg border border-border/60 overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="aspect-square bg-muted">
                <img
                  src={item.imageUrl || '/placeholder.svg'}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
              </div>
              <div className="p-2 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                    {item.type === 'digital' ? (
                      <span className="inline-flex items-center gap-1"><Laptop className="w-3 h-3" />Digital</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" />{t('recentlyViewedProducts.produit')}</span>
                    )}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-tight line-clamp-2">{item.title}</p>
                {typeof item.price === 'number' && (
                  <p className="text-xs font-semibold text-primary">
                    {priceLoading
                      ? `${item.price.toLocaleString('fr-FR')} ${item.currency || 'GNF'}`
                      : convert(item.price, item.currency || 'GNF').formatted}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

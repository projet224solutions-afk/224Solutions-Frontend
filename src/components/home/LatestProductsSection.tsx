/**
 * LATEST PRODUCTS SECTION - Ultra Professional Design
 * 224Solutions - Products Grid with Premium Layout
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketplaceGrid } from '@/components/marketplace/MarketplaceGrid';
import { TranslatedProductCard } from '@/components/marketplace/TranslatedProductCard';
import { useTranslation } from '@/hooks/useTranslation';
import { useLoadingTimeout } from '@/hooks/useLoadingTimeout';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  currency?: string;
  images?: string | string[];
  promotional_videos?: string[];
  vendor_id?: string;
  vendor_name?: string;
  vendor_public_id?: string;
  rating?: number;
  reviews_count?: number;
  is_hot?: boolean;
}

interface LatestProductsSectionProps {
  products: Product[];
  loading: boolean;
  onProductClick: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  onRetry?: () => void;
  className?: string;
}

export function LatestProductsSection({
  products,
  loading,
  onProductClick,
  onAddToCart,
  onRetry,
  className,
}: LatestProductsSectionProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { timedOut, resetTimeout } = useLoadingTimeout(loading, 60000);

  return (
    <section className={cn('px-4 py-6 md:px-6', className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-1">
          <h2 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
            {t('home.latestProducts')}
          </h2>
          <p className="text-xs text-muted-foreground hidden md:block">
            {t('home.latestProductsSubtitle') || 'Les dernières nouveautés du marketplace'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/marketplace')}
          className="gap-1 text-accent hover:text-accent hover:bg-accent/10 group no-hover-effect font-semibold"
        >
          {t('home.seeAll')}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      {/* Content */}
      {timedOut ? (
        <div className="rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="flex flex-col items-center text-center gap-3">
            <p className="text-base font-semibold text-foreground">{t('common.productsLoadError')}</p>
            <p className="text-sm text-muted-foreground">
              {t('common.productsLoadErrorDesc')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => {
                  resetTimeout();
                  if (onRetry) {
                    onRetry();
                    return;
                  }
                  window.location.reload();
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Réessayer
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Recharger l'application
              </Button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-muted/50 rounded-full mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">{t('home.noProducts')}</p>
          <Button
            variant="outline"
            onClick={() => navigate('/marketplace')}
            className="gap-2"
          >
            {t('home.exploreMarketplace')}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
          {products.slice(0, 4).map((product, index) => (
            <div
              key={product.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <TranslatedProductCard
                id={product.id}
                image={
                  typeof product.images === 'string'
                    ? product.images
                    : product.images?.[0] ||
                      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop'
                }
                promotionalVideos={product.promotional_videos || []}
                title={product.name}
                price={product.price}
                currency={product.currency || 'GNF'}
                vendor={product.vendor_name}
                vendorPublicId={product.vendor_public_id}
                rating={product.rating}
                reviewCount={product.reviews_count}
                onBuy={() => onProductClick(product.id)}
                onAddToCart={() => onAddToCart(product)}
                onContact={() => product.vendor_id ? navigate(`/messages?vendorId=${product.vendor_id}`) : null}
                isPremium={product.is_hot}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default LatestProductsSection;

/**
 * 🎯 SECTION RECOMMANDATIONS PRODUITS - 224SOLUTIONS
 * Carrousel style Alibaba : grille 2 rangées défilable horizontalement
 */

import { useRef, useState, useEffect, useCallback, type WheelEvent, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, TrendingUp, ShoppingBag, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TranslatedProductCard } from '@/components/marketplace/TranslatedProductCard';
import { cn } from '@/lib/utils';

interface RecommendedProduct {
  product_id: string;
  name: string;
  price: number;
  images: string[];
  rating: number | null;
  reason?: string;
  vendor_id?: string | null;
  vendor_user_id?: string | null;
  vendor_name?: string | null;
}

interface ProductRecommendationSectionProps {
  title: string;
  subtitle?: string;
  products: RecommendedProduct[];
  loading?: boolean;
  icon?: 'sparkles' | 'trending' | 'shopping' | 'star';
  onProductClick?: (productId: string) => void;
  onAddToCart?: (productId: string) => void;
  className?: string;
  currency?: string;
}

const ICONS = {
  sparkles: Sparkles,
  trending: TrendingUp,
  shopping: ShoppingBag,
  star: Star,
};

export function ProductRecommendationSection({
  title,
  subtitle,
  products,
  loading = false,
  icon = 'sparkles',
  onProductClick,
  onAddToCart,
  className
}: ProductRecommendationSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const Icon = ICONS[icon];
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isScrollingRef = useRef(false);

  // Vérifier la position de scroll
  const checkScrollPosition = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScrollPosition();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollPosition, { passive: true });
      const resizeObserver = new ResizeObserver(checkScrollPosition);
      resizeObserver.observe(el);
      return () => {
        el.removeEventListener('scroll', checkScrollPosition);
        resizeObserver.disconnect();
      };
    }
  }, [checkScrollPosition, products]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const cardWidth = 160;
    const scrollAmount = cardWidth * 2;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Gérer le scroll souris pour transformer vertical → horizontal
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      event.stopPropagation();
      scrollRef.current.scrollBy({
        left: event.deltaY * 1.5,
        behavior: 'auto'
      });
    }
  };

  // Touch handlers pour une navigation fluide
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    isScrollingRef.current = false;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || !scrollRef.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);

    // Si le mouvement est majoritairement horizontal, on prend le contrôle
    if (dx > dy && dx > 10) {
      isScrollingRef.current = true;
    }
  };

  if (!loading && products.length === 0) {
    return null;
  }

  // Organiser les produits en 2 rangées pour le style Alibaba
  const rows = products.length > 3 ? 2 : 1;
  const row1 = products.filter((_, i) => i % 2 === 0);
  const row2 = products.filter((_, i) => i % 2 === 1);

  return (
    <section className={cn('py-4', className)}>
      {/* Header style Alibaba */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-foreground truncate">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {products.length > 2 && (
          <div className="flex gap-1 shrink-0 ml-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full transition-opacity",
                !canScrollLeft && "opacity-40 cursor-default"
              )}
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full transition-opacity",
                !canScrollRight && "opacity-40 cursor-default"
              )}
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Carrousel grille 2 rangées - style Alibaba */}
      <div className="relative">
        {/* Gradient fade gauche */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-r from-background to-transparent" />
        )}
        {/* Gradient fade droite */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-l from-background to-transparent" />
        )}

        <div
          ref={scrollRef}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {loading ? (
            <div className="flex gap-2 px-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="min-w-[148px] max-w-[148px] sm:min-w-[170px] sm:max-w-[170px] shrink-0">
                  <Skeleton className="h-[180px] w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
                  <Skeleton className="h-3 w-1/2 mt-1" />
                </div>
              ))}
            </div>
          ) : rows === 1 ? (
            /* Une seule rangée si peu de produits */
            <div className="flex gap-2 px-1 pb-2">
              {products.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  onProductClick={onProductClick}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          ) : (
            /* Grille 2 rangées style Alibaba */
            <div className="flex flex-col gap-2 px-1 pb-2">
              <div className="flex gap-2">
                {row1.map((product) => (
                  <ProductCard
                    key={product.product_id}
                    product={product}
                    onProductClick={onProductClick}
                    onAddToCart={onAddToCart}
                  />
                ))}
              </div>
              {row2.length > 0 && (
                <div className="flex gap-2">
                  {row2.map((product) => (
                    <ProductCard
                      key={product.product_id}
                      product={product}
                      onProductClick={onProductClick}
                      onAddToCart={onAddToCart}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* Carte produit compacte pour le carrousel */
function ProductCard({
  product,
  onProductClick,
  onAddToCart
}: {
  product: RecommendedProduct;
  onProductClick?: (id: string) => void;
  onAddToCart?: (id: string) => void;
}) {
  return (
    <div
      className="min-w-[148px] max-w-[148px] sm:min-w-[170px] sm:max-w-[170px] shrink-0 cursor-pointer"
      onClick={() => onProductClick?.(product.product_id)}
    >
      <TranslatedProductCard
        id={product.product_id}
        image={product.images?.[0] || '/placeholder.svg'}
        title={product.name}
        price={product.price}
        rating={product.rating || 0}
        reviewCount={0}
        vendor={product.vendor_name || ''}
        vendorId={product.vendor_id || undefined}
        vendorUserId={product.vendor_user_id || undefined}
        onAddToCart={() => onAddToCart?.(product.product_id)}
      />
      {product.reason && (
        <div className="mt-1">
          <ReasonBadge reason={product.reason} />
        </div>
      )}
    </div>
  );
}

function ReasonBadge({ reason }: { reason: string }) {
  const labels: Record<string, { text: string; className: string }> = {
    category_affinity: { text: '🎯 Pour vous', className: 'bg-primary/10 text-primary' },
    featured: { text: '⭐ En vedette', className: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
    trending: { text: '🔥 Tendance', className: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
    popular: { text: '📈 Populaire', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  };

  const badge = labels[reason] || labels.popular;

  return (
    <span className={cn('inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full', badge.className)}>
      {badge.text}
    </span>
  );
}

export default ProductRecommendationSection;

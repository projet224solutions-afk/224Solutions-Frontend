/**
 * 🤖 SECTION DE RECOMMANDATIONS IA - Style Alibaba
 * Navigation horizontale fluide avec swipe, flèches et snap
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, TrendingUp, Clock, Gift, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import TranslatedProductCard from "./TranslatedProductCard";
import { HorizontalScrollRow, ScrollItem } from "./HorizontalScrollRow";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsive } from "@/hooks/useResponsive";
import { useCart } from "@/contexts/CartContext";
import { useContactVendor } from "@/hooks/useContactVendor";
import { cn } from "@/lib/utils";

interface AIProduct {
  product_id: string;
  name: string;
  price: number;
  images: string[];
  promotional_videos?: string[];
  rating: number | null;
  reviews_count?: number | null;
  reason?: string;
  score?: number;
  vendor_id?: string;
  vendor_name?: string;
  vendor_user_id?: string;
  currency?: string;
}

interface AIRecommendationSectionProps {
  title: string;
  subtitle?: string;
  products: AIProduct[] | undefined;
  isLoading: boolean;
  icon?: 'sparkles' | 'trending' | 'clock' | 'gift';
  showReason?: boolean;
  seeAllLink?: string;
  maxItems?: number;
  className?: string;
}

const icons = {
  sparkles: Sparkles,
  trending: TrendingUp,
  clock: Clock,
  gift: Gift,
};

export function AIRecommendationSection({
  title,
  subtitle,
  products,
  icon = 'sparkles',
  seeAllLink,
  maxItems = 12,
  className,
}: AIRecommendationSectionProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isMobile, isTablet } = useResponsive();
  const { addToCart } = useCart();
  const contactVendor = useContactVendor();
  const [contactLoadingId, setContactLoadingId] = useState<string | null>(null);
  const Icon = icons[icon];
  const displayProducts = products?.slice(0, maxItems) || [];

  if (displayProducts.length === 0) return null;

  // Responsive card width (cartes agrandies)
  const cardWidth = isMobile ? '47vw' : isTablet ? '230px' : '250px';

  const handleAddToCart = (p: AIProduct) => {
    addToCart({
      id: p.product_id,
      name: p.name,
      price: p.price,
      image: p.images?.[0],
      vendor_id: p.vendor_id || '',
      vendor_name: p.vendor_name,
      currency: p.currency || 'GNF',
    });
  };

  return (
    <div className={cn("py-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Icon className="w-8 h-8 text-[#ff4000] fill-[#ff4000] shrink-0" strokeWidth={1.5} />
          <div>
            <h3 className="font-semibold text-sm text-foreground">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {seeAllLink && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-primary hover:text-primary/80"
            onClick={() => navigate(seeAllLink)}
          >
            {t('marketplace.seeAll') || 'Voir tout'}
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>

      {/* Products - Horizontal Scroll */}
      <HorizontalScrollRow
          showArrows={!isMobile}
          arrowSize={isMobile ? 'sm' : 'md'}
          gap={isMobile ? 8 : 12}
          autoScroll={displayProducts.length > 3}
          autoScrollInterval={5000}
        >
          {displayProducts.map((p) => (
            <ScrollItem key={p.product_id} width={cardWidth} snapAlign="start">
              <TranslatedProductCard
                  id={p.product_id}
                  title={p.name}
                  price={p.price}
                  currency={p.currency || 'GNF'}
                  image={p.images || []}
                  promotionalVideos={p.promotional_videos || []}
                  rating={p.rating || 0}
                  reviewCount={p.reviews_count || 0}
                  vendor={p.vendor_name || ''}
                  vendorId={p.vendor_id}
                  vendorUserId={p.vendor_user_id}
                  onBuy={() => navigate(`/product/${p.product_id}`)}
                  onAddToCart={() => handleAddToCart(p)}
                  onContact={() => contactVendor({
                    vendorId: p.vendor_id,
                    productId: p.product_id,
                    productName: p.name,
                    onLoadingChange: (l) => setContactLoadingId(l ? p.product_id : null),
                  })}
                  contactLoading={contactLoadingId === p.product_id}
                />
            </ScrollItem>
          ))}
        </HorizontalScrollRow>
    </div>
  );
}

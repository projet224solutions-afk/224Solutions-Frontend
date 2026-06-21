/**
 * Carte Universelle Marketplace - 224SOLUTIONS
 * Affiche produits e-commerce et produits numériques (articles des services pro)
 * NOTE: Les services professionnels eux-mêmes sont affichés sur Proximité uniquement
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import {
  Star,
  ShoppingCart,
  Download,
  Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketplaceItem } from '@/hooks/useMarketplaceUniversal';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDisplayCurrency } from './CurrencyIndicator';
import { MediaAutoCarousel } from './MediaAutoCarousel';

interface UniversalMarketplaceCardProps {
  item: MarketplaceItem;
  onAddToCart?: (itemId: string) => void;
  onViewDetails?: (itemId: string) => void;
  className?: string;
}

export function UniversalMarketplaceCard({
  item,
  onAddToCart,
  onViewDetails,
  className
}: UniversalMarketplaceCardProps) {
  const { convert, loading: priceLoading } = usePriceConverter();
  const { t } = useTranslation();
  const { displayCurrency } = useDisplayCurrency();

  // Images par défaut selon le type
  const defaultImage =
    item.item_type === 'digital_product'
      ? 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400'
      : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400';

  // Préparer les images (filtrer les vides)
  const validImages = (item.images || []).filter(img => img && img.trim());
  const displayImages = validImages.length > 0 ? validImages : [defaultImage];

  // Récupérer les vidéos promotionnelles
  const videos = (item.promotional_videos || []).filter((v: string) => v && v.trim());

  // Badge selon le type
  const getTypeBadge = () => {
    if (item.item_type === 'digital_product') {
      // Distinction affiliation vs vente directe
      if (item.license_type === 'Affiliation') {
        return (
          <Badge className="absolute top-2 left-2 bg-[#ff4000] text-white border-0">
            <ExternalLink className="w-3 h-3 mr-1" />
            Affiliation
          </Badge>
        );
      }
      return (
        <Badge className="absolute top-2 left-2 bg-[#04439e] text-white">
          <Download className="w-3 h-3 mr-1" />
          {t('marketplace.card.badge.digital') || 'Numérique'}
        </Badge>
      );
    }
    // Produit e-commerce
    return item.free_shipping ? (
      <Badge className="absolute top-2 left-2 bg-[#ff4000] text-white">
        {t('marketplace.card.badge.freeShipping') || 'Livraison gratuite'}
      </Badge>
    ) : null;
  };

  // Action principale selon le type
  const handleMainAction = () => {
    if (item.item_type === 'digital_product') {
      onViewDetails?.(item.id);
    } else {
      onAddToCart?.(item.id);
    }
  };

  const getMainActionLabel = () => {
    if (item.item_type === 'digital_product') {
      if (item.license_type === 'Affiliation') {
        return 'Voir l\'offre';
      }
      return t('marketplace.card.action.buy') || 'Acheter';
    }
    return t('marketplace.card.action.addToCart') || 'Ajouter au panier';
  };

  const getMainActionIcon = () => {
    if (item.item_type === 'digital_product') {
      if (item.license_type === 'Affiliation') {
        return <ExternalLink className="w-4 h-4" />;
      }
      return <Download className="w-4 h-4" />;
    }
    return <ShoppingCart className="w-4 h-4" />;
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300",
        "border border-border/50 hover:border-primary/50",
        className
      )}
      onClick={() => onViewDetails?.(item.id)}
    >
      {/* Media Carousel - Vidéos + Images */}
      <div className="relative">
        <MediaAutoCarousel
          videos={videos}
          images={displayImages}
          alt={item.name}
          imageDisplayDuration={3000}
          autoPlay={true}
          showControls={true}
          muted={true}
        />

        {/* Badge type */}
        {getTypeBadge()}

        {/* Badge Sponsorisé */}
        {item.is_sponsored && (
          <Badge className="absolute top-2 right-2 bg-[#ff4000] text-white border-0 z-20 shadow-lg">
            <Crown className="w-3 h-3 mr-1" />
            Sponsorisé
          </Badge>
        )}

        {/* Rating badge (si présent et pas sponsorisé pour éviter le chevauchement) */}
        {item.rating > 0 && !item.is_sponsored && (
          <Badge className="absolute top-2 right-2 bg-white/90 text-gray-900 z-20">
            <Star className="w-3 h-3 mr-1 fill-[#ff4000] text-[#ff4000]" />
            {item.rating.toFixed(1)}
          </Badge>
        )}

        {/* Rating en bas si produit sponsorisé */}
        {item.rating > 0 && item.is_sponsored && (
          <Badge className="absolute top-10 right-2 bg-white/90 text-gray-900 z-20">
            <Star className="w-3 h-3 mr-1 fill-[#ff4000] text-[#ff4000]" />
            {item.rating.toFixed(1)}
          </Badge>
        )}

        {/* Prix barré (si promotion) */}
        {item.originalPrice && item.originalPrice > item.price && (
          <Badge className="absolute bottom-10 right-2 bg-[#ff4000] text-white z-20">
            -{Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        {/* Type de produit */}
        <p className="text-xs text-muted-foreground mb-1">
          Type de produit: {item.category_name}
        </p>

        {/* Nom */}
        <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {item.name}
        </h3>

        {/* Informations spécifiques aux produits numériques */}
        {item.item_type === 'digital_product' && (
          <div className="space-y-1 mb-3">
            {item.file_size && (
              <p className="text-xs text-muted-foreground">
                {t('marketplace.card.fileSize') || 'Taille'}: {item.file_size}
              </p>
            )}
            {item.license_type && (
              <Badge variant="outline" className="text-xs">
                {item.license_type}
              </Badge>
            )}
          </div>
        )}

        {/* Prix - Converti automatiquement dans la devise de l'utilisateur */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-primary">
                      {priceLoading ? (
                        formatCurrency(item.price, item.currency || 'GNF')
                      ) : (
                        convert(item.price, item.currency || 'GNF').formatted
                      )}
                    </span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-xs text-muted-foreground line-through">
                        {priceLoading ? (
                          formatCurrency(item.originalPrice, item.currency || 'GNF')
                        ) : (
                          convert(item.originalPrice, item.currency || 'GNF').formatted
                        )}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-semibold">
                      {t('marketplace.card.originalPrice') || 'Prix original'}:
                    </p>
                    <p>{formatCurrency(item.price, item.currency || 'GNF')}</p>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <p className="text-muted-foreground line-through">
                        {formatCurrency(item.originalPrice, item.currency || 'GNF')}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Vendeur et avis */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span className="line-clamp-1 flex items-center gap-1">
            {item.vendor_public_id && (
              <>
                <span className="text-primary font-medium">{item.vendor_public_id}</span>
                <span>•</span>
              </>
            )}
            {t('marketplace.card.soldBy') || 'Vendu par'} {item.vendor_name}
          </span>
          {item.reviews_count > 0 && (
            <span>({item.reviews_count} {t('marketplace.card.reviews') || 'avis'})</span>
          )}
        </div>

        {/* Bouton d'action - Optimisé mobile */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleMainAction();
          }}
          className="w-full h-9 text-xs sm:text-sm font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-background hover:text-foreground border border-transparent hover:border-border"
          size="sm"
        >
          {getMainActionIcon()}
          <span className="truncate">{getMainActionLabel()}</span>
        </Button>
      </CardContent>
    </Card>
  );
}

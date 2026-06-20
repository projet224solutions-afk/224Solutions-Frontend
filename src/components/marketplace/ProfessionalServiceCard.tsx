/**
 * Carte Service Professionnel - Marketplace
 * Affiche les services professionnels (restaurants, salons, etc.) sur le marketplace
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Star,
  MapPin,
  Phone,
  Clock,
  ArrowRight,
  Briefcase,
  Store
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketplaceItem } from '@/hooks/useMarketplaceUniversal';
import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

interface ProfessionalServiceCardProps {
  item: MarketplaceItem;
  onViewDetails?: (itemId: string) => void;
  className?: string;
}

export function ProfessionalServiceCard({
  item,
  onViewDetails,
  className
}: ProfessionalServiceCardProps) {
  const [imageError, setImageError] = useState(false);
  const { t } = useTranslation();

  // Images par défaut selon le type de service
  const getDefaultImage = () => {
    switch (item.service_type) {
      case 'restaurant':
        return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400';
      case 'beaute':
        return 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400';
      case 'sport':
        return 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400';
      case 'ecommerce':
      case 'dropshipping':
        return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400';
      case 'reparation':
        return 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400';
      case 'livraison':
        return 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400';
      default:
        return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400';
    }
  };

  const mainImage = item.images && item.images.length > 0 && !imageError && item.images[0]?.trim()
    ? item.images[0]
    : getDefaultImage();

  // Icône selon le type de service
  const getServiceIcon = () => {
    switch (item.service_type) {
      case 'restaurant':
        return '🍽️';
      case 'beaute':
        return '💇';
      case 'sport':
        return '🏋️';
      case 'ecommerce':
      case 'dropshipping':
        return '🛍️';
      case 'reparation':
        return '🔧';
      case 'livraison':
        return '🚚';
      case 'education':
        return '📚';
      case 'sante':
        return '🏥';
      case 'construction':
        return '🏗️';
      case 'informatique':
        return '💻';
      default:
        return '🏢';
    }
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-300",
        "border-2 border-blue-200 hover:border-blue-400 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background",
        className
      )}
      onClick={() => onViewDetails?.(item.id)}
    >
      {/* Image avec overlay */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={mainImage}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={() => setImageError(true)}
        />

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Badge Service Pro */}
        <Badge className="absolute top-3 left-3 bg-blue-600 text-white shadow-lg">
          <Briefcase className="w-3 h-3 mr-1" />
          Service Pro
        </Badge>

        {/* Type de service avec emoji */}
        <Badge className="absolute top-3 right-3 bg-white/90 text-gray-900 shadow-lg">
          <span className="mr-1">{getServiceIcon()}</span>
          {item.category_name}
        </Badge>

        {/* Nom du service sur l'image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-white text-lg line-clamp-1 drop-shadow-lg">
            {item.business_name || item.name}
          </h3>
          {item.address && (
            <div className="flex items-center gap-1 text-white/90 text-sm mt-1">
              <MapPin className="w-3 h-3" />
              <span className="line-clamp-1">{item.address}</span>
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        {/* Description */}
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {item.description}
          </p>
        )}

        {/* Rating et avis */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {item.rating > 0 ? (
              <div className="flex items-center gap-1 bg-orange-100 dark:bg-[#ff4000]/30 px-2 py-1 rounded-full">
                <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
                <span className="font-semibold text-sm">{item.rating.toFixed(1)}</span>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs">
                Nouveau
              </Badge>
            )}
            {item.reviews_count > 0 && (
              <span className="text-xs text-muted-foreground">
                ({item.reviews_count} avis)
              </span>
            )}
          </div>

          {/* Contact rapide */}
          {item.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>Contact</span>
            </div>
          )}
        </div>

        {/* Bouton d'action */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails?.(item.id);
          }}
          className="w-full bg-[#04439e] text-white"
          size="sm"
        >
          <Store className="w-4 h-4 mr-2" />
          Voir le service
          <ArrowRight className="w-4 h-4 ml-auto" />
        </Button>
      </CardContent>
    </Card>
  );
}
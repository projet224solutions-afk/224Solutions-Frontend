import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin, Eye, Heart, Bed, Bath, Maximize,
  Building2, MoreVertical, Pencil, Trash2, CheckCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import type { Property } from '@/hooks/useRealEstateData';

interface PropertyCardProps {
  property: Property;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onClick?: () => void;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  disponible: { label: 'Disponible', variant: 'default' },
  sous_option: { label: 'Sous option', variant: 'secondary' },
  vendu: { label: 'Vendu', variant: 'destructive' },
  loue: { label: "Loué", variant: 'outline' },
  brouillon: { label: 'Brouillon', variant: 'secondary' },
};

const typeIcons: Record<string, string> = {
  appartement: '🏢',
  maison: '🏠',
  villa: '🏡',
  terrain: '🌍',
  bureau: '🏬',
  boutique: '🏪',
  commerce: '🏪',
};

export function PropertyCard({ property, onStatusChange, onDelete, onClick }: PropertyCardProps) {
  const { t } = useTranslation();
  const formatPrice = useFormatCurrency();
  const coverImage = property.images?.find(img => img.is_cover)?.image_url || property.images?.[0]?.image_url;
  const statusInfo = statusConfig[property.status] || statusConfig.disponible;

  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div className="relative w-full sm:w-56 h-44 sm:h-auto bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          {coverImage ? (
            <img src={coverImage} alt={property.title} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <span className="text-4xl">{typeIcons[property.property_type] || '🏠'}</span>
              <span className="text-xs">{t('propertyCard.pasDePhoto')}</span>
            </div>
          )}
          <Badge variant={statusInfo.variant} className="absolute top-2 left-2 text-xs">
            {statusInfo.label}
          </Badge>
          <Badge variant="outline" className="absolute top-2 right-2 text-xs bg-background/80">
            {property.offer_type === 'vente' ? '🔑 Vente' : '📋 Location'}
          </Badge>
        </div>

        {/* Content */}
        <CardContent className="flex-1 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{property.title}</h3>
              <p className="text-primary font-bold text-lg mt-1">
                {formatPrice(property.price)}
                {property.offer_type === 'location' && <span className="text-sm font-normal text-muted-foreground">/mois</span>}
              </p>

              {/* Specs */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                {property.surface > 0 && (
                  <span className="flex items-center gap-1">
                    <Maximize className="h-3.5 w-3.5" />
                    {property.surface} m²
                  </span>
                )}
                {property.rooms > 0 && (
                  <span className="flex items-center gap-1">
                    <Bed className="h-3.5 w-3.5" />
                    {property.rooms} pièces
                  </span>
                )}
                {property.bathrooms > 0 && (
                  <span className="flex items-center gap-1">
                    <Bath className="h-3.5 w-3.5" />
                    {property.bathrooms} sdb
                  </span>
                )}
              </div>

              {/* Location */}
              {(property.address || property.city) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{property.address || property.city}</span>
                </p>
              )}

              {/* Views & Favorites */}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {property.views_count} vues
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" /> {property.favorites_count} favoris
                </span>
              </div>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {property.status === 'disponible' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'sous_option')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Marquer sous option
                  </DropdownMenuItem>
                )}
                {property.offer_type === 'vente' && property.status !== 'vendu' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'vendu')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Marquer comme vendu
                  </DropdownMenuItem>
                )}
                {property.offer_type === 'location' && property.status !== 'loue' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'loue')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Marquer comme loué
                  </DropdownMenuItem>
                )}
                {property.status !== 'disponible' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'disponible')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Remettre disponible
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onDelete(property.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

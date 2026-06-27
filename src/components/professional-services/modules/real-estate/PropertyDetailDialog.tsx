/**
 * Page détail d'un bien immobilier
 */
import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import type { Property } from '@/hooks/useRealEstateData';
import { PropertyImageUpload } from './PropertyImageUpload';
import {
  MapPin, Bed, Bath, Maximize, Phone, MessageSquare,
  Heart, Share2, ChevronLeft, ChevronRight, Building2, Eye
} from 'lucide-react';

interface PropertyDetailDialogProps {
  property: Property | null;
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  isOwner?: boolean;
}

const typeLabels: Record<string, string> = {
  appartement: '🏢 Appartement',
  maison: '🏠 Maison',
  villa: '🏡 Villa',
  terrain: '🌍 Terrain',
  bureau: '🏬 Bureau',
  boutique: '🏪 Boutique',
  commerce: '🏪 Commerce',
};

const amenityIcons: Record<string, string> = {
  'Parking': '🅿️', 'Piscine': '🏊', 'Jardin': '🌳', 'Balcon': '🏗️',
  'Terrasse': '☀️', 'Ascenseur': '🛗', 'Climatisation': '❄️', 'Meublé': '🪑',
  'Gardien': '💂', 'Caméras': '📹', 'Groupe électrogène': '⚡', 'Eau courante': '💧',
};

export function PropertyDetailDialog({ property, open, onClose, onRefresh, isOwner }: PropertyDetailDialogProps) {
  const { t } = useTranslation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const formatPrice = useFormatCurrency();

  if (!property) return null;

  const images = property.images || [];
  const currentImage = images[currentImageIndex];

  const nextImage = () => setCurrentImageIndex(i => (i + 1) % images.length);
  const prevImage = () => setCurrentImageIndex(i => (i - 1 + images.length) % images.length);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Image Gallery */}
        <div className="relative w-full h-64 sm:h-80 bg-muted">
          {images.length > 0 ? (
            <>
              <img
                src={currentImage?.image_url}
                alt={property.title}
                className="w-full h-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-card rounded-full p-2 hover:bg-card transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-card rounded-full p-2 hover:bg-card transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentImageIndex ? 'bg-primary' : 'bg-card/60'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
              <div className="absolute top-3 right-3 bg-card px-2 py-1 rounded text-xs">
                {currentImageIndex + 1}/{images.length}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Building2 className="h-16 w-16 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t('propertyDetailDialog.aucunePhoto')}</p>
              </div>
            </div>
          )}
          {/* Badges overlaid */}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className="bg-primary text-primary-foreground">
              {property.offer_type === 'vente' ? '🔑 Vente' : '📋 Location'}
            </Badge>
            <Badge variant="secondary">{typeLabels[property.property_type] || property.property_type}</Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Title & Price */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{property.title}</h2>
              {(property.address || property.city) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4" />
                  {[property.address, property.neighborhood, property.city].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-primary">
                {formatPrice(property.price)}
              </p>
              {property.offer_type === 'location' && (
                <span className="text-sm text-muted-foreground">/mois</span>
              )}
            </div>
          </div>

          {/* Quick specs */}
          <div className="flex flex-wrap gap-4 py-3 px-4 bg-muted/50 rounded-xl">
            {property.surface > 0 && (
              <div className="flex items-center gap-2">
                <Maximize className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{property.surface} m²</p>
                  <p className="text-xs text-muted-foreground">Surface</p>
                </div>
              </div>
            )}
            {property.rooms > 0 && (
              <div className="flex items-center gap-2">
                <Bed className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{property.rooms}</p>
                  <p className="text-xs text-muted-foreground">Chambres</p>
                </div>
              </div>
            )}
            {property.bathrooms > 0 && (
              <div className="flex items-center gap-2">
                <Bath className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{property.bathrooms}</p>
                  <p className="text-xs text-muted-foreground">Sdb</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{property.views_count}</p>
                <p className="text-xs text-muted-foreground">Vues</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{property.favorites_count}</p>
                <p className="text-xs text-muted-foreground">Favoris</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {property.description}
              </p>
            </div>
          )}

          {/* Amenities */}
          {property.amenities?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">{t('propertyDetailDialog.equipements')}</h3>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map(a => (
                  <Badge key={a} variant="outline" className="gap-1">
                    {amenityIcons[a] || '✓'} {a}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Owner actions: Upload images */}
          {isOwner && (
            <div>
              <Separator className="my-4" />
              <h3 className="font-semibold mb-3">{t('propertyDetailDialog.photosDuBien')}</h3>
              <PropertyImageUpload
                propertyId={property.id}
                existingImages={images as any}
                onImagesChange={onRefresh}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button className="flex-1 gap-2">
              <Phone className="h-4 w-4" /> Appeler
            </Button>
            <Button variant="outline" className="flex-1 gap-2">
              <MessageSquare className="h-4 w-4" /> Message
            </Button>
            <Button variant="outline" size="icon">
              <Heart className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

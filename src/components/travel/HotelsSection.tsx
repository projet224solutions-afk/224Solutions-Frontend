/**
 * Section Hôtels - Affiche les hôtels partenaires et offres
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Hotel, Star, ExternalLink, MapPin,
  Calendar, Users, Wifi, Car, Coffee
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HotelPartner {
  id: string;
  name: string;
  star_rating: number | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  images: any[];
  commission_rate: number;
  amenities: string[];
  price_range: string | null;
  description: string | null;
  website_url: string | null;
}

interface HotelOffer {
  id: string;
  hotel_id: string;
  room_type: string;
  description: string | null;
  price_per_night: number;
  currency: string;
  max_guests: number;
  offer_type: string;
  discount_percent: number | null;
  affiliate_url: string | null;
}

interface HotelsSectionProps {
  mode: 'api' | 'affiliate' | 'simple';
  isAffiliate?: boolean;
  affiliateCode?: string;
}

export function HotelsSection({ mode, isAffiliate, affiliateCode }: HotelsSectionProps) {
  const { t } = useTranslation();
  const [hotels, setHotels] = useState<HotelPartner[]>([]);
  const [hotelOffers, setHotelOffers] = useState<HotelOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCity, setSearchCity] = useState('');
  const [selectedStars, setSelectedStars] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Charger les hôtels partenaires
      const { data: hotelsData, error: hotelsError } = await (supabase as any)
        .from('hotel_partners')
        .select('*')
        .eq('is_active', true);

      if (hotelsError) throw hotelsError;
      setHotels(hotelsData || []);

      // Charger les offres d'hôtel
      const { data: offersData, error: offersError } = await (supabase as any)
        .from('hotel_offers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (offersError) throw offersError;
      setHotelOffers(offersData || []);
    } catch (error) {
      console.error('Error loading hotels data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openExternalSafely = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleHotelClick = (hotel: HotelPartner) => {
    if (hotel.website_url) {
      let url = hotel.website_url;
      if (affiliateCode) {
        url += `?ref=${affiliateCode}`;
      }
      openExternalSafely(url);
    }
    toast.info(t('hotelsSection.redirectionVersLeSitePartenaire'));
  };

  const handleOfferClick = (offer: HotelOffer) => {
    const hotel = hotels.find(h => h.id === offer.hotel_id);
    if (offer.affiliate_url) {
      let url = offer.affiliate_url;
      if (affiliateCode) {
        url += `&ref=${affiliateCode}`;
      }
      openExternalSafely(url);
    } else if (hotel?.website_url) {
      openExternalSafely(hotel.website_url);
    }
    toast.info(t('hotelsSection.redirectionVersLeSitePartenaire'));
  };

  const formatPrice = useFormatCurrency();

  const renderStars = (count: number | null) => {
    if (!count) return null;
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: count }).map((_, i) => (
          <Star key={i} className="w-3 h-3 fill-[#ff4000] text-[#ff4000]" />
        ))}
      </div>
    );
  };

  const getPriceRangeLabel = (range: string | null) => {
    switch (range) {
      case 'budget': return '€';
      case 'standard': return '€€';
      case 'premium': return '€€€';
      case 'luxury': return '€€€€';
      default: return null;
    }
  };

  const filteredHotels = hotels.filter(hotel => {
    const matchCity = !searchCity ||
      hotel.city?.toLowerCase().includes(searchCity.toLowerCase()) ||
      hotel.country?.toLowerCase().includes(searchCity.toLowerCase());
    const matchStars = !selectedStars || hotel.star_rating === selectedStars;
    return matchCity && matchStars;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barre de recherche */}
      {mode !== 'simple' && (
        <Card>
          <CardContent className="p-4">
            <Input
              placeholder={t('hotelsSection.rechercherUneVille')}
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              className="text-sm mb-3"
            />
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Badge
                variant={selectedStars === null ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setSelectedStars(null)}
              >
                Tous
              </Badge>
              {[5, 4, 3, 2].map((stars) => (
                <Badge
                  key={stars}
                  variant={selectedStars === stars ? "default" : "outline"}
                  className="cursor-pointer whitespace-nowrap flex items-center gap-1"
                  onClick={() => setSelectedStars(stars)}
                >
                  {stars} <Star className="w-3 h-3 fill-current" />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hôtels partenaires */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Hotel className="w-4 h-4" />
          Hôtels Partenaires
        </h3>
        <div className="space-y-3">
          {filteredHotels.map((hotel) => (
            <Card
              key={hotel.id}
              className="cursor-pointer hover:shadow-md transition-all overflow-hidden"
              onClick={() => handleHotelClick(hotel)}
            >
              <CardContent className="p-0">
                <div className="flex">
                  {/* Image */}
                  <div className="w-24 h-24 bg-orange-100 flex items-center justify-center shrink-0">
                    {hotel.images && hotel.images[0] ? (
                      <img
                        src={hotel.images[0]}
                        alt={hotel.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Hotel className="w-8 h-8 text-[#ff4000]" />
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-sm text-foreground">
                          {hotel.name}
                        </h4>
                        {renderStars(hotel.star_rating)}
                      </div>
                      {hotel.price_range && (
                        <Badge variant="secondary" className="text-xs">
                          {getPriceRangeLabel(hotel.price_range)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3" />
                      <span>{hotel.city}, {hotel.country}</span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                      {hotel.description}
                    </p>

                    {isAffiliate && (
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        Commission: {hotel.commission_rate}%
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Offres spéciales */}
      {hotelOffers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Offres Spéciales
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {hotelOffers.map((offer) => {
              const hotel = hotels.find(h => h.id === offer.hotel_id);
              return (
                <Card
                  key={offer.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => handleOfferClick(offer)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={offer.offer_type === 'promo' ? 'default' : 'secondary'}>
                          {offer.offer_type === 'promo' ? 'PROMO' : 'Chambre'}
                        </Badge>
                        {offer.discount_percent && (
                          <Badge variant="destructive" className="text-[10px]">
                            -{offer.discount_percent}%
                          </Badge>
                        )}
                      </div>
                      {hotel && (
                        <span className="text-xs text-muted-foreground">
                          {hotel.name}
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-foreground mb-1">
                      {offer.room_type}
                    </h4>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Max {offer.max_guests} pers.
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-primary">
                          {formatPrice(offer.price_per_night, offer.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">par nuit</p>
                      </div>
                      <Button size="sm">
                        Réserver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {hotels.length === 0 && (
        <div className="text-center py-12">
          <Hotel className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">{t('hotelsSection.aucunHotelPartenaireDisponible')}</p>
        </div>
      )}
    </div>
  );
}

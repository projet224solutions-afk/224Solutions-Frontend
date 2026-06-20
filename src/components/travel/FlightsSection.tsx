/**
 * Section Vols - Affiche les compagnies aériennes et offres
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Plane, Star, ExternalLink, ArrowRight,
  Calendar, Users, Clock, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Airline {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  commission_rate: number;
  description: string | null;
  website_url: string | null;
}

interface FlightOffer {
  id: string;
  airline_id: string;
  origin_city: string;
  origin_code: string | null;
  destination_city: string;
  destination_code: string | null;
  departure_date: string | null;
  return_date: string | null;
  is_round_trip: boolean;
  class_type: string;
  price_adult: number;
  currency: string;
  offer_type: string;
  affiliate_url: string | null;
}

interface FlightsSectionProps {
  mode: 'api' | 'affiliate' | 'simple';
  isAffiliate?: boolean;
  affiliateCode?: string;
}

export function FlightsSection({ mode, isAffiliate, affiliateCode }: FlightsSectionProps) {
  const { t } = useTranslation();
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [flightOffers, setFlightOffers] = useState<FlightOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAirline, setSelectedAirline] = useState<string | null>(null);
  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDest, setSearchDest] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Charger les compagnies aériennes
      const { data: airlinesData, error: airlinesError } = await (supabase as any)
        .from('airline_partners')
        .select('*')
        .eq('is_active', true);

      if (airlinesError) throw airlinesError;
      setAirlines(airlinesData || []);

      // Charger les offres de vol
      const { data: offersData, error: offersError } = await (supabase as any)
        .from('flight_offers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (offersError) throw offersError;
      setFlightOffers(offersData || []);
    } catch (error) {
      console.error('Error loading flights data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAirlineClick = (airline: Airline) => {
    if (airline.website_url) {
      let url = airline.website_url;
      if (affiliateCode) {
        url += `?ref=${affiliateCode}`;
      }
      window.open(url, '_blank');
    }
  };

  const handleOfferClick = (offer: FlightOffer) => {
    const airline = airlines.find(a => a.id === offer.airline_id);
    if (offer.affiliate_url) {
      let url = offer.affiliate_url;
      if (affiliateCode) {
        url += `&ref=${affiliateCode}`;
      }
      window.open(url, '_blank');
    } else if (airline?.website_url) {
      window.open(airline.website_url, '_blank');
    }
    toast.info(t('flightsSection.redirectionVersLeSitePartenaire'));
  };

  const fc = useFormatCurrency();
  const formatPrice = (price: number, currency: string) => fc(price, currency);

  const filteredOffers = flightOffers.filter(offer => {
    const matchOrigin = !searchOrigin ||
      offer.origin_city.toLowerCase().includes(searchOrigin.toLowerCase());
    const matchDest = !searchDest ||
      offer.destination_city.toLowerCase().includes(searchDest.toLowerCase());
    const matchAirline = !selectedAirline || offer.airline_id === selectedAirline;
    return matchOrigin && matchDest && matchAirline;
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
      {/* Barre de recherche (Mode API ou Affiliate) */}
      {mode !== 'simple' && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input
                placeholder={t('flightsSection.villeDeDepart')}
                value={searchOrigin}
                onChange={(e) => setSearchOrigin(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="Destination..."
                value={searchDest}
                onChange={(e) => setSearchDest(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Badge
                variant={selectedAirline === null ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setSelectedAirline(null)}
              >
                Toutes
              </Badge>
              {airlines.map((airline) => (
                <Badge
                  key={airline.id}
                  variant={selectedAirline === airline.id ? "default" : "outline"}
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => setSelectedAirline(airline.id)}
                >
                  {airline.code}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compagnies partenaires */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plane className="w-4 h-4" />
          Compagnies Partenaires
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {airlines.map((airline) => (
            <Card
              key={airline.id}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => handleAirlineClick(airline)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {airline.logo_url ? (
                    <img
                      src={airline.logo_url}
                      alt={airline.name}
                      className="w-10 h-10 object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Plane className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground truncate">
                      {airline.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Code: {airline.code}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
                {isAffiliate && (
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    Commission: {airline.commission_rate}%
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Offres de vol */}
      {filteredOffers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Offres Disponibles
          </h3>
          <div className="space-y-3">
            {filteredOffers.map((offer) => {
              const airline = airlines.find(a => a.id === offer.airline_id);
              return (
                <Card
                  key={offer.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => handleOfferClick(offer)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={offer.offer_type === 'promo' ? 'default' : 'secondary'}>
                          {offer.offer_type === 'promo' ? 'PROMO' : 'Vol'}
                        </Badge>
                        {airline && (
                          <span className="text-xs text-muted-foreground">
                            {airline.name}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {offer.class_type}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-center">
                        <p className="font-bold text-foreground">{offer.origin_code || offer.origin_city.slice(0,3).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[80px]">{offer.origin_city}</p>
                      </div>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                        <Plane className="w-4 h-4 text-primary rotate-90" />
                        <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-foreground">{offer.destination_code || offer.destination_city.slice(0,3).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[80px]">{offer.destination_city}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-primary">
                          {formatPrice(offer.price_adult, offer.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {offer.is_round_trip ? 'Aller-retour' : 'Aller simple'}
                        </p>
                      </div>
                      <Button size="sm" className="gap-1">
                        Réserver
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {airlines.length === 0 && flightOffers.length === 0 && (
        <div className="text-center py-12">
          <Plane className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">{t('flightsSection.aucuneOffreDeVolDisponible')}</p>
        </div>
      )}
    </div>
  );
}

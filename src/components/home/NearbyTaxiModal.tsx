/**
 * NEARBY TAXI MODAL - Premium Design
 * Checks for taxi drivers within 5km radius
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Car, Bike, RefreshCw, AlertCircle, CheckCircle2, Navigation, Phone, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface NearbyDriver {
  driver_id: string;
  user_id: string;
  distance_km: number | null;
  rating?: number;
  vehicle_type?: string;
  vehicle_plate?: string;
  full_name?: string;
  phone?: string | null;
  taxi_category?: 'car' | 'motorcycle';
}

interface NearbyTaxiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_DISTANCE_KM = 5;
const FALLBACK_LOCATION = { lat: 9.509167, lng: -13.712222 }; // Conakry (fallback)
const FALLBACK_RADIUS_KM = 20;
const SEARCH_RADII_KM = [MAX_DISTANCE_KM, 10, FALLBACK_RADIUS_KM] as const;

export function NearbyTaxiModal({ open, onOpenChange }: NearbyTaxiModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noDriversNearby, setNoDriversNearby] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [usingFallbackLocation, setUsingFallbackLocation] = useState(false);
  const [usedRadiusKm, setUsedRadiusKm] = useState<number>(MAX_DISTANCE_KM);

  const runRpcSearch = async (lat: number, lng: number, radiusKm: number) => {
    console.log(`[NearbyTaxi] RPC search: lat=${lat}, lng=${lng}, radius=${radiusKm}km`);

    const { data, error: rpcError } = await supabase.rpc('find_nearby_taxi_drivers', {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
      p_limit: 10,
    });

    if (rpcError) {
      console.error('[NearbyTaxi] RPC error:', rpcError);
      throw rpcError;
    }

    console.log(`[NearbyTaxi] RPC found ${data?.length || 0} drivers`);

    // RPC already filters for online drivers, just sort by distance and limit to 3
    const sortedData = (data || [])
      .sort((a: any, b: any) => {
        const distA = a.distance_km ?? Infinity;
        const distB = b.distance_km ?? Infinity;
        return distA - distB;
      })
      .slice(0, 3);

    return sortedData as any[];
  };

  // Fallback (sans GPS): recherche large via RPC (bypass RLS) autour d'un point par défaut
  const searchAllOnlineDrivers = async () => {
    setLoading(true);
    setError(null);
    setNoDriversNearby(false);

    try {
      setUsingFallbackLocation(true);
      setUsedRadiusKm(FALLBACK_RADIUS_KM);

      const data = await runRpcSearch(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng, FALLBACK_RADIUS_KM);

      if (!data || data.length === 0) {
        setNoDriversNearby(true);
        setDrivers([]);
        return;
      }

      const userIds = data.map((d: any) => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);

      const driversWithNames = data.map((driver: any) => {
        const profile = profiles?.find(p => p.id === driver.user_id);
        return {
          ...driver,
          distance_km: driver.distance_km === null || driver.distance_km === undefined ? null : Number(driver.distance_km),
          full_name: profile?.full_name || 'Chauffeur',
          phone: profile?.phone ?? null,
        };
      });

      setDrivers(driversWithNames);
    } catch (err) {
      console.error('Error finding drivers (fallback):', err);
      setError('Impossible de charger les chauffeurs.');
    } finally {
      setLoading(false);
    }
  };

  const searchNearbyDrivers = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    setNoDriversNearby(false);
    setUsingFallbackLocation(false);

    try {
      let data: any[] = [];
      let radiusUsed: number | null = null;

      for (const radiusKm of SEARCH_RADII_KM) {
        radiusUsed = radiusKm;
        const result = await runRpcSearch(lat, lng, radiusKm);
        if (result.length > 0) {
          data = result;
          break;
        }
      }

      setUsedRadiusKm(radiusUsed ?? MAX_DISTANCE_KM);

      if (!data || data.length === 0) {
        setNoDriversNearby(true);
        setDrivers([]);
        return;
      }

      const userIds = data.map((d: any) => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);

      const driversWithNames = data.map((driver: any) => {
        const profile = profiles?.find(p => p.id === driver.user_id);
        return {
          ...driver,
          distance_km: driver.distance_km === null || driver.distance_km === undefined ? null : Number(driver.distance_km),
          full_name: profile?.full_name || 'Chauffeur',
          phone: profile?.phone ?? null,
        };
      });

      setDrivers(driversWithNames);
    } catch (err) {
      console.error('Error finding nearby drivers:', err);
      // Fallback to large RPC search in Conakry (bypass RLS)
      await searchAllOnlineDrivers();
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    setLoading(true);
    setUsingFallbackLocation(false);

    if (!navigator.geolocation) {
      console.log('[NearbyTaxi] Geolocation not supported, falling back');
      setUserLocation(null);
      setUsingFallbackLocation(true);
      searchAllOnlineDrivers();
      return;
    }

    // Stratégie: essayer haute précision d'abord, puis mode rapide
    const tryHighAccuracy = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log(`[NearbyTaxi] GPS OK (high): lat=${latitude}, lng=${longitude}, accuracy=${accuracy}m`);
          setUserLocation({ lat: latitude, lng: longitude });
          setUsingFallbackLocation(false);
          searchNearbyDrivers(latitude, longitude);
        },
        () => {
          // Haute précision échouée, essayer mode rapide
          console.log('[NearbyTaxi] High accuracy failed, trying fast mode...');
          tryFastMode();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    };

    const tryFastMode = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log(`[NearbyTaxi] GPS OK (fast): lat=${latitude}, lng=${longitude}, accuracy=${accuracy}m`);
          setUserLocation({ lat: latitude, lng: longitude });
          setUsingFallbackLocation(false);
          searchNearbyDrivers(latitude, longitude);
        },
        (err) => {
          console.error('[NearbyTaxi] GPS failed completely:', err.message);
          setUserLocation(null);
          setUsingFallbackLocation(true);
          searchAllOnlineDrivers();
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    };

    tryHighAccuracy();
  };

  useEffect(() => {
    if (open) {
      getUserLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleRefresh = () => {
    if (userLocation) {
      searchNearbyDrivers(userLocation.lat, userLocation.lng);
    } else {
      getUserLocation();
    }
  };

  const handleOrderTaxi = () => {
    onOpenChange(false);
    navigate('/taxi-moto');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-taxi-primary" />
            Taxis disponibles à proximité
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <div className="relative">
                <Car className="w-12 h-12 text-taxi-primary animate-pulse" />
                <div className="absolute inset-0 rounded-full border-4 border-taxi-primary/30 border-t-taxi-primary animate-spin" style={{ animationDuration: '1s' }} />
              </div>
              <p className="text-sm mt-4">{t('taxi.searchingDrivers')}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
            </div>
          ) : noDriversNearby ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-20 h-20 rounded-full bg-[#ff4000]/10 flex items-center justify-center mb-4">
                <Navigation className="w-10 h-10 text-[#ff4000]" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Aucun chauffeur proche
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Il n'y a pas de chauffeur disponible dans un rayon de {usedRadiusKm} km autour de votre position.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button
                  onClick={handleRefresh}
                  className="w-full bg-taxi-primary hover:bg-taxi-primary/90"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Nouvelle recherche
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#ff4000]/10 border border-[#ff4000]/20">
                <CheckCircle2 className="w-5 h-5 text-[#ff4000] flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {drivers.length} chauffeur{drivers.length > 1 ? 's' : ''} disponible{drivers.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {usingFallbackLocation
                      ? `Localisation désactivée : affichage élargi (${usedRadiusKm} km)`
                      : `Dans un rayon de ${usedRadiusKm} km`}
                  </p>
                </div>
              </div>

              {/* Drivers list - Top 3 closest */}
              <div className="space-y-2">
                {drivers.map((driver, index) => {
                  const isCar = driver.taxi_category === 'car';
                  const accentColor = isCar ? 'text-blue-600' : 'text-orange-500';
                  const phone = driver.phone ?? null;

                  return (
                    <div
                      key={driver.driver_id}
                      className={cn(
                        'p-3 rounded-xl bg-card border border-border/40',
                        index === 0 && 'ring-2 ring-taxi-primary/50 bg-taxi-primary/5'
                      )}
                    >
                      {/* Ligne principale : avatar + infos + distance */}
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                          index === 0 ? "bg-taxi-primary text-white" : "bg-taxi-primary/10"
                        )}>
                          {index === 0 ? (
                            <span className="text-sm font-bold">1</span>
                          ) : (
                            isCar
                              ? <Car className="w-5 h-5 text-blue-600" />
                              : <Bike className="w-5 h-5 text-orange-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {driver.full_name}
                            {index === 0 && <span className="ml-2 text-xs text-taxi-primary font-semibold">{t('taxi.closest')}</span>}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {isCar
                              ? <Car className="w-3 h-3 text-blue-500" />
                              : <Bike className="w-3 h-3 text-orange-500" />}
                            <p className="text-xs text-muted-foreground">
                              {isCar ? 'Taxi voiture' : 'Taxi moto'} • {driver.vehicle_plate || '---'}
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          "text-sm font-semibold flex-shrink-0",
                          index === 0 ? "text-taxi-primary" : "text-muted-foreground"
                        )}>
                          {driver.distance_km !== null && Number.isFinite(driver.distance_km)
                            ? `${driver.distance_km.toFixed(1)} km`
                            : 'En ligne'}
                        </span>
                      </div>

                      {/* Boutons téléphone + message */}
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          className={cn(
                            'flex-1 h-8 text-xs',
                            isCar ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'
                          )}
                          disabled={!phone}
                          onClick={() => phone && window.open(`tel:${phone}`)}
                        >
                          <Phone className="w-3 h-3 mr-1" />
                          {phone ? phone : 'Appeler'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            'flex-1 h-8 text-xs',
                            isCar ? 'border-blue-300 text-blue-600 hover:bg-blue-50' : 'border-orange-300 text-orange-500 hover:bg-orange-50'
                          )}
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/messages?recipientId=${driver.user_id}`);
                          }}
                        >
                          <MessageCircle className="w-3 h-3 mr-1" />
                          Message
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action button */}
              <Button
                onClick={handleOrderTaxi}
                className="w-full bg-taxi-primary hover:bg-taxi-primary/90"
                size="lg"
              >
                {drivers.every(d => d.taxi_category === 'motorcycle')
                  ? 'Commander un Taxi Moto'
                  : drivers.every(d => d.taxi_category === 'car')
                  ? 'Commander un Taxi Voiture'
                  : 'Commander un Taxi'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NearbyTaxiModal;

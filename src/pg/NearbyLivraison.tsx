/**
 * NEARBY LIVRAISON PAGE
 * Liste des livreurs disponibles à proximité
 * 224Solutions - Ultra Optimisé v2
 */

import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Package,
  MapPin,
  Star,
  RefreshCw,
  Loader2,
  Truck,
  Clock,
  User,
  Bike,
  Car,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QuickFooter from "@/components/QuickFooter";
import { useGeoDistance } from "@/hooks/useGeoDistance";
import {
  type NearbyDriver,
  processDeliveryDriver,
  processTaxiDriver,
  filterDriversByRadius,
  sortDrivers,
  formatDriverDistance,
  getDriverTotalTrips,
  getDriverDisplayName,
  getVehicleTypeDisplay,
  createProfileMap,
} from '@/lib/drivers';

const RADIUS_KM = 20;
const AUTO_REFRESH_INTERVAL = 20000; // 20 secondes
const MAX_DRIVERS_LIMIT = 100;

// ============================================================================
// Composant mémoïsé pour la carte du livreur
// ============================================================================

interface DriverCardProps {
  driver: NearbyDriver;
  onRequestDelivery: () => void;
}

const DriverCard = memo(function DriverCard({ driver, onRequestDelivery }: DriverCardProps) {
  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'car': return <Car className="w-4 h-4" />;
      case 'moto': return <Bike className="w-4 h-4" />;
      default: return <Truck className="w-4 h-4" />;
    }
  };

  const totalTrips = getDriverTotalTrips(driver);
  const displayName = getDriverDisplayName(driver);
  const vehicleType = getVehicleTypeDisplay(driver);

  return (
    <Card className="border-border/50 hover:border-orange-500/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
              {driver.profile?.avatar_url ? (
                <img
                  src={driver.profile.avatar_url}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <User className="w-6 h-6 text-orange-600" />
              )}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
              driver.is_online ? 'bg-[#ff4000]' : 'bg-gray-400'
            }`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {displayName}
              </h3>
              <Badge variant={driver.is_online ? 'default' : 'secondary'} className="text-xs">
                {driver.is_online ? 'En ligne' : 'Hors ligne'}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {/* Rating - seulement si disponible */}
              {driver.rating !== null && driver.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-[#ff4000] fill-[#ff4000]" />
                  {driver.rating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {totalTrips} livraisons
              </span>
              {driver.distance !== undefined && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {formatDriverDistance(driver.distance)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {getVehicleIcon(driver.vehicle_type)}
              <span className="capitalize">{vehicleType}</span>
            </div>
          </div>

          {/* Action */}
          <Button
            size="sm"
            onClick={onRequestDelivery}
            disabled={!driver.is_online}
            title={!driver.is_online ? 'Livreur hors ligne' : undefined}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Package className="w-4 h-4 mr-1" />
            Envoyer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Composant principal
// ============================================================================

export default function NearbyLivraison() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // ✓ Utiliser useGeoDistance centralisé (fallback: Coyah)
  const { userPosition, positionReady, refreshPosition } = useGeoDistance();

  // ✓ Fonction de chargement optimisée
  const loadDrivers = useCallback(async () => {
    if (!positionReady) return;

    setLoading(true);
    setError(null);

    try {
      const position = { lat: userPosition.latitude, lng: userPosition.longitude };

      // Requêtes parallèles sans join FK (pas dans le schema cache)
      const [deliveryRes, taxiRes] = await Promise.all([
        supabase
          .from('drivers')
          .select(`
            id,
            user_id,
            vehicle_type,
            status,
            is_online,
            current_location,
            rating,
            total_deliveries
          `)
          .eq('status', 'active')
          .eq('is_online', true)
          .limit(MAX_DRIVERS_LIMIT),

        supabase
          .from('taxi_drivers')
          .select(`
            id,
            user_id,
            vehicle_type,
            status,
            is_online,
            last_lat,
            last_lng,
            rating,
            total_rides
          `)
          .eq('is_online', true)
          .limit(MAX_DRIVERS_LIMIT),
      ]);

      if (deliveryRes.error) throw new Error(`Erreur drivers: ${deliveryRes.error.message}`);
      if (taxiRes.error) throw new Error(`Erreur taxi: ${taxiRes.error.message}`);

      const deliveryData = (deliveryRes.data || []) as Array<Record<string, unknown>>;
      const taxiData = (taxiRes.data || []) as Array<Record<string, unknown>>;

      // Récupération des profils séparément pour tous les drivers
      const allUserIds = [
        ...deliveryData.map(d => d.user_id),
        ...taxiData.map(d => d.user_id),
      ].filter(Boolean) as string[];

      let deliveryProfileMap = new Map<string, any>();
      let taxiProfileMap = new Map<string, any>();

      if (allUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone, avatar_url')
          .in('id', allUserIds);
        const globalProfileMap = createProfileMap((profilesData || []) as Array<Record<string, unknown>>);
        deliveryProfileMap = globalProfileMap;
        taxiProfileMap = globalProfileMap;
      }

      // ✓ Traitement des drivers avec la Map globale
      const allDrivers: NearbyDriver[] = [];

      for (const raw of deliveryData) {
        allDrivers.push(processDeliveryDriver(raw, position, deliveryProfileMap));
      }

      for (const raw of taxiData) {
        allDrivers.push(processTaxiDriver(raw, position, taxiProfileMap));
      }

      // ✓ Filtrer par rayon et trier (distance puis rating)
      const filtered = filterDriversByRadius(allDrivers, RADIUS_KM);
      const sorted = sortDrivers(filtered);

      setDrivers(sorted);
    } catch (err) {
      console.error('Error loading drivers:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [positionReady, userPosition]);

  // ✓ Chargement initial
  useEffect(() => {
    if (positionReady) {
      loadDrivers();
    }
  }, [positionReady, loadDrivers]);

  // ✓ Auto-refresh toutes les 20 secondes
  useEffect(() => {
    if (!positionReady) return;

    autoRefreshRef.current = setInterval(() => {
      loadDrivers();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [positionReady, loadDrivers]);

  // Fonction de rafraëchissement manuel
  const handleRefresh = useCallback(async () => {
    await refreshPosition();
    await loadDrivers();
  }, [refreshPosition, loadDrivers]);

  const handleRequestDelivery = useCallback(() => {
    navigate('/delivery-request');
  }, [navigate]);

  // ============================================================================
  // RENDU SIMPLIFIÉ - Sans useMemo complexe
  // ============================================================================

  const renderDriversList = () => {
    // État de chargement
    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-14 h-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    // État d'erreur
    if (error) {
      return (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">{t('nearbyLivraison.erreurDeChargement')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={loadDrivers}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      );
    }

    // Liste vide
    if (drivers.length === 0) {
      return (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">{t('nearbyLivraison.aucunLivreurDisponible')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Réessayez dans quelques instants
            </p>
            <Button variant="outline" onClick={loadDrivers}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </CardContent>
        </Card>
      );
    }

    // Liste des drivers
    return (
      <div className="space-y-3">
        {drivers.map((driver) => (
          <DriverCard
            key={`${driver.source}-${driver.id}`}
            driver={driver}
            onRequestDelivery={handleRequestDelivery}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                Livraison à Proximité
              </h1>
              <p className="text-xs text-muted-foreground">
                {drivers.length} livreur{drivers.length !== 1 ? 's' : ''} dans un rayon de {RADIUS_KM} km
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
              className="rounded-full"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Quick Request Button */}
        <Card className="bg-orange-500 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <h3 className="font-semibold">{t('nearbyLivraison.demanderUneLivraison')}</h3>
                <p className="text-sm opacity-90">{t('nearbyLivraison.envoyezUnColisRapidement')}</p>
              </div>
              <Button
                onClick={handleRequestDelivery}
                className="bg-white text-orange-600 hover:bg-white/90"
              >
                <Truck className="w-4 h-4 mr-2" />
                Commander
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Drivers List */}
        {renderDriversList()}
      </div>

      <QuickFooter />
    </div>
  );
}

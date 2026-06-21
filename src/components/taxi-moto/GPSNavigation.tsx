import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Phone, ExternalLink, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { TaxiMotoGeolocationService } from "@/services/taxi/TaxiMotoGeolocationService";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Location {
  address: string;
  coords: Coordinates;
}

interface ActiveRide {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  pickup: Location;
  destination: Location;
  status: 'accepted' | 'arriving' | 'arrived' | 'picked_up' | 'in_progress' | 'completed';
  estimatedPrice: number;
  estimatedEarnings: number;
  requestedAt: string;
}

interface GPSNavigationProps {
  activeRide: ActiveRide | null;
  currentLocation: Coordinates | null;
  onContactCustomer?: (phone: string) => void;
}

export function GPSNavigation({ activeRide, currentLocation, onContactCustomer }: GPSNavigationProps) {
  const { t } = useTranslation();
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!activeRide || !currentLocation) {
      setDistance(null);
      setDuration(null);
      return;
    }

    // Déterminer la destination selon le statut
    const target = activeRide.status === 'accepted' || activeRide.status === 'arriving'
      ? activeRide.pickup.coords
      : activeRide.destination.coords;

    // Utiliser Mapbox pour obtenir la route réelle
    TaxiMotoGeolocationService.getRoute(
      { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
      { latitude: target.latitude, longitude: target.longitude }
    ).then(routeInfo => {
      setDistance(routeInfo.distance);
      setDuration(routeInfo.duration);
    }).catch(() => {
      // Fallback: calcul simple
      const dist = TaxiMotoGeolocationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        target.latitude,
        target.longitude
      );
      setDistance(dist);
      setDuration(Math.ceil(dist * 3));
    });
  }, [activeRide, currentLocation]);

  const openGoogleMaps = () => {
    if (!activeRide || !currentLocation) {
      toast.error(t('gPSNavigation.impossibleDOuvrirLaNavigation'));
      return;
    }

    const target = activeRide.status === 'accepted' || activeRide.status === 'arriving'
      ? activeRide.pickup.coords
      : activeRide.destination.coords;

    const origin = `${currentLocation.latitude},${currentLocation.longitude}`;
    const destination = `${target.latitude},${target.longitude}`;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    toast.success(t('gPSNavigation.navigationOuverteDansGoogleMaps'));
  };

  if (!activeRide) {
    return (
      <Card className="bg-white/95 backdrop-blur-sm shadow-lg">
        <CardContent className="pt-12 pb-12 text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            Aucune course active
          </h3>
          <p className="text-sm text-gray-500">
            Acceptez une course pour démarrer la navigation
          </p>
        </CardContent>
      </Card>
    );
  }

  const isGoingToPickup = activeRide.status === 'accepted' || activeRide.status === 'arriving';
  const _targetLocation = isGoingToPickup ? activeRide.pickup : activeRide.destination;
  const statusLabel = isGoingToPickup ? "Récupération du client" : "En direction de la destination";

  return (
    <div className="space-y-4">
      {/* Carte de statut */}
      <Card className="bg-[#04439e]/5 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-600 animate-pulse" />
              <span className="text-lg">Navigation active</span>
            </div>
            <Badge className="bg-blue-600 text-white">
              {statusLabel}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Informations client */}
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">{t('gPSNavigation.client')}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onContactCustomer?.(activeRide.customerPhone)}
                className="gap-2"
              >
                <Phone className="w-4 h-4" />
                Appeler
              </Button>
            </div>
            <p className="font-medium text-gray-900">{activeRide.customerName}</p>
            <p className="text-sm text-gray-600">{activeRide.customerPhone}</p>
          </div>

          {/* Itinéraire */}
          <div className="space-y-3">
            {isGoingToPickup && (
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-[#ff4000] mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[#ff4000] uppercase mb-1">{t('gPSNavigation.pointDeDepart')}</p>
                    <p className="text-sm text-gray-900">{activeRide.pickup.address}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-blue-500" />
            </div>

            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-[#ff4000] mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-[#ff4000] uppercase mb-1">Destination</p>
                  <p className="text-sm text-gray-900">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Distance et temps estimé */}
          {distance !== null && duration !== null && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-blue-200 text-center">
                <p className="text-xs text-gray-600 mb-1">Distance</p>
                <p className="text-2xl font-bold text-blue-600">
                  {distance.toFixed(1)} <span className="text-sm">km</span>
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-200 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-gray-600" />
                  <p className="text-xs text-gray-600">{t('gPSNavigation.tempsEstime')}</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {duration} <span className="text-sm">min</span>
                </p>
              </div>
            </div>
          )}

          {/* Position actuelle */}
          {currentLocation && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Ma position actuelle</p>
              <p className="text-xs font-mono text-gray-900">
                📍 {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </p>
            </div>
          )}

          {/* Bouton navigation Google Maps */}
          <Button
            onClick={openGoogleMaps}
            className="w-full bg-[#04439e] text-white gap-2"
            size="lg"
          >
            <ExternalLink className="w-5 h-5" />
            Ouvrir dans Google Maps
          </Button>
        </CardContent>
      </Card>

      {/* Informations supplémentaires */}
      <Card className="bg-white/95 backdrop-blur-sm">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-600 mb-1">{t('gPSNavigation.prixEstime')}</p>
              <p className="text-lg font-bold text-[#ff4000]">
                <Money amount={activeRide.estimatedPrice} from="GNF" />
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Mes gains</p>
              <p className="text-lg font-bold text-blue-600">
                <Money amount={activeRide.estimatedEarnings} from="GNF" />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

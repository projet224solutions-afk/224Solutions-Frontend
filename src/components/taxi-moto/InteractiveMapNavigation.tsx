import { useEffect, useRef, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation, Phone, Clock, MapPin, ArrowRight, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Clé Mapbox depuis les variables d'environnement
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

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

interface InteractiveMapNavigationProps {
  activeRide: ActiveRide | null;
  currentLocation: Coordinates | null;
  onContactCustomer?: (phone: string) => void;
}

export function InteractiveMapNavigation({
  activeRide,
  currentLocation,
  onContactCustomer
}: InteractiveMapNavigationProps) {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: number;
    duration: number;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const pickupMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);

  // Initialiser la carte
  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: currentLocation
        ? [currentLocation.longitude, currentLocation.latitude]
        : [9.5, -13.7], // Conakry par défaut
      zoom: 13,
      pitch: 45
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mettre à jour la position du chauffeur en temps réel
  useEffect(() => {
    if (!map.current || !currentLocation) return;

    if (!driverMarker.current) {
      // Créer le marqueur du chauffeur avec une icône personnalisée
      const el = document.createElement('div');
      el.className = 'driver-marker';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.backgroundImage = 'url(/taxi-icon.png)';
      el.style.backgroundSize = 'cover';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid #04439e';
      el.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.6)';

      driverMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([currentLocation.longitude, currentLocation.latitude])
        .addTo(map.current);
    } else {
      driverMarker.current.setLngLat([currentLocation.longitude, currentLocation.latitude]);
    }

    // Centrer la carte sur la position du chauffeur
    map.current.flyTo({
      center: [currentLocation.longitude, currentLocation.latitude],
      essential: true
    });
  }, [currentLocation]);

  // Afficher les marqueurs et tracer la route
  useEffect(() => {
    if (!map.current || !activeRide || !currentLocation) return;

    const target = activeRide.status === 'accepted' || activeRide.status === 'arriving'
      ? activeRide.pickup.coords
      : activeRide.destination.coords;

    // Marqueur de départ (vert)
    if (!pickupMarker.current && activeRide.pickup) {
      const pickupEl = document.createElement('div');
      pickupEl.style.width = '30px';
      pickupEl.style.height = '30px';
      pickupEl.style.backgroundColor = '#ff4000';
      pickupEl.style.borderRadius = '50%';
      pickupEl.style.border = '3px solid white';
      pickupEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';

      pickupMarker.current = new mapboxgl.Marker({ element: pickupEl })
        .setLngLat([activeRide.pickup.coords.longitude, activeRide.pickup.coords.latitude])
        .setPopup(
          new mapboxgl.Popup().setHTML(`<strong>{t('interactiveMapNavigation.depart')}</strong><br/>${activeRide.pickup.address}`)
        )
        .addTo(map.current);
    }

    // Marqueur de destination (rouge)
    if (!destinationMarker.current && activeRide.destination) {
      const destEl = document.createElement('div');
      destEl.style.width = '30px';
      destEl.style.height = '30px';
      destEl.style.backgroundColor = '#ff4000';
      destEl.style.borderRadius = '50%';
      destEl.style.border = '3px solid white';
      destEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';

      destinationMarker.current = new mapboxgl.Marker({ element: destEl })
        .setLngLat([activeRide.destination.coords.longitude, activeRide.destination.coords.latitude])
        .setPopup(
          new mapboxgl.Popup().setHTML(`<strong>{t('interactiveMapNavigation.arrivee')}</strong><br/>${activeRide.destination.address}`)
        )
        .addTo(map.current);
    }

    // Récupérer la route depuis l'API
    fetchRoute(currentLocation, target);

    // Nettoyer les marqueurs quand il n'y a plus de course
    return () => {
      if (!activeRide) {
        pickupMarker.current?.remove();
        destinationMarker.current?.remove();
        pickupMarker.current = null;
        destinationMarker.current = null;
      }
    };
  }, [activeRide, currentLocation]);

  // Sauvegarder la position en temps réel dans la base de données
  useEffect(() => {
    if (!activeRide || !currentLocation) return;

    const saveLocation = async () => {
      try {
        const { error } = await supabase
          .from('taxi_ride_tracking')
          .insert({
            ride_id: activeRide.id,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
          });

        if (error) {
          console.error('Erreur sauvegarde position:', error);
        }
      } catch (err) {
        console.error('Erreur:', err);
      }
    };

    // Sauvegarder toutes les 10 secondes
    const interval = setInterval(saveLocation, 10000);
    return () => clearInterval(interval);
  }, [activeRide, currentLocation]);

  const fetchRoute = async (from: Coordinates, to: Coordinates) => {
    try {
      const { data, error } = await supabase.functions.invoke('calculate-route', {
        body: {
          origin: { lat: from.latitude, lng: from.longitude },
          destination: { lat: to.latitude, lng: to.longitude }
        }
      });

      if (error) throw error;

      if (data && data.route) {
        setRouteInfo({
          distance: data.distance,
          duration: data.duration
        });

        // Dessiner la route sur la carte
        if (map.current) {
          const routeCoordinates = data.route.map((coord: [number, number]) => coord);

          if (map.current.getSource('route')) {
            (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates
              }
            });
          } else {
            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoordinates
                }
              }
            });

            map.current.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#04439e',
                'line-width': 5,
                'line-opacity': 0.75
              }
            });
          }

          // Ajuster la vue pour voir toute la route
          const bounds = new mapboxgl.LngLatBounds();
          routeCoordinates.forEach((coord: [number, number]) => bounds.extend(coord));
          map.current.fitBounds(bounds, { padding: 50 });
        }
      }
    } catch (error) {
      console.error('Erreur calcul route:', error);
      toast.error(t('interactiveMapNavigation.impossibleDeCalculerLaRoute'));
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (mapContainer.current) {
      if (!isFullscreen) {
        mapContainer.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
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
  const statusLabel = isGoingToPickup ? "Récupération du client" : "En direction de la destination";

  return (
    <div className="space-y-4">
      {/* Carte interactive */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-[#04439e]/5">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-600" />
              <span className="text-lg">Navigation GPS</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600 text-white">
                {statusLabel}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="p-2"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={mapContainer}
            className="w-full h-[400px] relative"
            style={{ minHeight: '400px' }}
          />
        </CardContent>
      </Card>

      {/* Informations de route */}
      {routeInfo && (
        <Card className="bg-[#04439e]/5">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 mb-1">Distance</p>
                <p className="text-2xl font-bold text-blue-600">
                  {routeInfo.distance.toFixed(1)} <span className="text-sm">km</span>
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-gray-600" />
                  <p className="text-xs text-gray-600">{t('interactiveMapNavigation.duree')}</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {routeInfo.duration} <span className="text-sm">min</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informations client et itinéraire */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          {/* Client */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">{t('interactiveMapNavigation.client')}</span>
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
          <div className="space-y-2">
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-[#ff4000] mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#ff4000] uppercase">{t('interactiveMapNavigation.depart')}</p>
                  <p className="text-sm text-gray-900">{activeRide.pickup.address}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-blue-500" />
            </div>

            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-[#ff4000] mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#ff4000] uppercase">{t('interactiveMapNavigation.arrivee')}</p>
                  <p className="text-sm text-gray-900">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Revenus */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Prix course</p>
              <p className="text-lg font-bold text-[#ff4000]">
                <Money amount={activeRide.estimatedPrice} from="GNF" />
              </p>
            </div>
            <div className="text-center">
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

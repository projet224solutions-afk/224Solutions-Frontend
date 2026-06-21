import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation, Phone, Clock, MapPin, ArrowRight, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Mapbox GL requires a non-empty token even for non-Mapbox tile sources
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.placeholder';

const CONAKRY: [number, number] = [-13.7, 9.5];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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

interface GoogleMapsNavigationProps {
  activeRide: ActiveRide | null;
  currentLocation: Coordinates | null;
  onContactCustomer?: (phone: string) => void;
}

function createDriverMarkerEl(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:44px;height:44px;';
  wrapper.innerHTML = `
    <div class="taxi-driver-pulse" style="
      position:absolute;inset:0;
      border-radius:50%;
      background:rgba(59,130,246,0.25);
      animation:taxi-pulse 2s ease-out infinite;
    "></div>
    <div style="
      position:absolute;inset:4px;
      background:#04439e;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 3px 10px rgba(59,130,246,0.55);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
    </div>
  `;
  return wrapper;
}

function createDotMarker(color: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width:16px;height:16px;
    background:${color};
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
  `;
  return el;
}

export function GoogleMapsNavigation({
  activeRide,
  currentLocation,
  onContactCustomer,
}: GoogleMapsNavigationProps) {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const pickupMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const sourceReady = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);

  // Initialiser la carte (une seule fois)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: currentLocation
        ? [currentLocation.longitude, currentLocation.latitude]
        : CONAKRY,
      zoom: 14,
      attributionControl: false,
      pitchWithRotate: false,
    });

    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    m.on('load', () => {
      // Source GeoJSON pour la ligne de trajet
      m.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Ombre de la ligne
      m.addLayer({
        id: 'route-shadow',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#04439e',
          'line-width': 10,
          'line-opacity': 0.25,
          'line-blur': 4,
        },
      });

      // Ligne principale
      m.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#04439e',
          'line-width': 5,
          'line-opacity': 0.9,
          'line-dasharray': [1, 0],
        },
      });

      sourceReady.current = true;
      setMapReady(true);
    });

    m.on('error', (e) => {
      console.warn('Mapbox GL error:', e.error?.message);
    });

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
      sourceReady.current = false;
      driverMarker.current = null;
      pickupMarker.current = null;
      destMarker.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mettre à jour la position du chauffeur
  useEffect(() => {
    if (!map.current || !currentLocation) return;

    const lngLat: [number, number] = [currentLocation.longitude, currentLocation.latitude];

    if (!driverMarker.current) {
      driverMarker.current = new mapboxgl.Marker({
        element: createDriverMarkerEl(),
        anchor: 'center',
      })
        .setLngLat(lngLat)
        .addTo(map.current);
    } else {
      driverMarker.current.setLngLat(lngLat);
    }

    if (!activeRide) {
      map.current.easeTo({ center: lngLat, zoom: 15, duration: 800 });
    }
  }, [currentLocation, activeRide]);

  // Calculer et afficher le trajet (ligne droite + OSRM en fallback)
  const drawRoute = useCallback(async (origin: Coordinates, target: Coordinates) => {
    if (!map.current || !sourceReady.current) return;

    const originLng: [number, number] = [origin.longitude, origin.latitude];
    const targetLng: [number, number] = [target.longitude, target.latitude];

    // Calculer distance à vol d'oiseau (Haversine)
    const R = 6371;
    const dLat = ((target.latitude - origin.latitude) * Math.PI) / 180;
    const dLon = ((target.longitude - origin.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((origin.latitude * Math.PI) / 180) *
        Math.cos((target.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const durationMin = Math.ceil((distanceKm / 30) * 60); // ~30 km/h en ville

    let routeCoords: [number, number][] = [originLng, targetLng];

    // Essayer OSRM pour un tracé routier précis
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${target.longitude},${target.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data.routes?.[0]) {
          routeCoords = data.routes[0].geometry.coordinates;
          const r = data.routes[0];
          setRouteInfo({
            distance: r.legs[0].distance / 1000,
            duration: Math.ceil(r.legs[0].duration / 60),
          });
        }
      }
    } catch {
      // OSRM indisponible → ligne droite avec estimation
      setRouteInfo({ distance: distanceKm, duration: durationMin });
    }

    const source = map.current.getSource('route') as mapboxgl.GeoJSONSource;
    source?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: routeCoords },
    });

    // Ajuster la vue pour montrer tout le trajet
    const bounds = routeCoords.reduce(
      (b, c) => b.extend(c as mapboxgl.LngLatLike),
      new mapboxgl.LngLatBounds(routeCoords[0], routeCoords[0])
    );
    map.current.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 1200 });
  }, []);

  // Gérer les marqueurs et la route selon la course active
  useEffect(() => {
    if (!mapReady || !map.current) return;

    if (!activeRide || !currentLocation) {
      // Effacer la route
      if (sourceReady.current) {
        const src = map.current.getSource('route') as mapboxgl.GeoJSONSource;
        src?.setData({ type: 'FeatureCollection', features: [] });
      }
      pickupMarker.current?.remove();
      pickupMarker.current = null;
      destMarker.current?.remove();
      destMarker.current = null;
      setRouteInfo(null);
      return;
    }

    const pickupLng: [number, number] = [
      activeRide.pickup.coords.longitude,
      activeRide.pickup.coords.latitude,
    ];
    const destLng: [number, number] = [
      activeRide.destination.coords.longitude,
      activeRide.destination.coords.latitude,
    ];

    // Marqueur départ (vert)
    if (!pickupMarker.current) {
      pickupMarker.current = new mapboxgl.Marker({ element: createDotMarker('#ff4000'), anchor: 'center' })
        .setLngLat(pickupLng)
        .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false }).setText('Départ'))
        .addTo(map.current);
    } else {
      pickupMarker.current.setLngLat(pickupLng);
    }

    // Marqueur destination (rouge)
    if (!destMarker.current) {
      destMarker.current = new mapboxgl.Marker({ element: createDotMarker('#ff4000'), anchor: 'center' })
        .setLngLat(destLng)
        .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false }).setText('Destination'))
        .addTo(map.current);
    } else {
      destMarker.current.setLngLat(destLng);
    }

    const target =
      activeRide.status === 'accepted' || activeRide.status === 'arriving'
        ? activeRide.pickup.coords
        : activeRide.destination.coords;

    drawRoute(currentLocation, target);
  }, [mapReady, activeRide, currentLocation, drawRoute]);

  // Sauvegarder la position GPS dans la DB toutes les 10s
  useEffect(() => {
    if (!activeRide || !currentLocation) return;

    const save = async () => {
      const { error } = await supabase.from('taxi_ride_tracking').insert({
        ride_id: activeRide.id,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
      if (error) console.error('Erreur sauvegarde position:', error);
    };

    const interval = setInterval(save, 10000);
    return () => clearInterval(interval);
  }, [activeRide, currentLocation]);

  const toggleFullscreen = () => {
    if (!mapContainer.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      mapContainer.current.requestFullscreen?.();
    }
  };

  const openExternalNavigation = () => {
    if (!currentLocation) {
      toast.error('Position GPS non disponible');
      return;
    }
    if (activeRide) {
      const target =
        activeRide.status === 'accepted' || activeRide.status === 'arriving'
          ? activeRide.pickup.coords
          : activeRide.destination.coords;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${target.latitude},${target.longitude}&travelmode=driving`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.open(
        `https://www.google.com/maps/@${currentLocation.latitude},${currentLocation.longitude},15z`,
        '_blank'
      );
    }
    toast.success(t('googleMapsNavigation.navigationOuverteDansGoogleMaps'));
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    const confirmed = window.confirm(
      '⚠️ Êtes-vous sûr de vouloir annuler cette course ?\n\nLe client sera notifié et vous pourriez recevoir une pénalité.'
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('taxi_trips')
        .update({
          status: 'cancelled',
          cancel_reason: 'Annulée par le conducteur',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeRide.id);

      if (error) throw error;

      toast.success(t('googleMapsNavigation.courseAnnuleeAvecSucces'));
      if (sourceReady.current && map.current) {
        const src = map.current.getSource('route') as mapboxgl.GeoJSONSource;
        src?.setData({ type: 'FeatureCollection', features: [] });
      }
      setRouteInfo(null);
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error(t('googleMapsNavigation.impossibleDAnnulerLaCourse'));
    }
  };

  const hasActiveRide = !!activeRide;

  return (
    <div className="space-y-4">
      {/* Animation pulse CSS */}
      <style>{`
        @keyframes taxi-pulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Carte Mapbox GL */}
      <Card className="overflow-hidden shadow-lg">
        <CardHeader className="pb-3 bg-[#04439e]/5">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-600" />
              <span className="text-lg">Navigation GPS</span>
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 font-normal">
                OpenStreetMap
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveRide && (
                <Badge className="bg-blue-600 text-white text-xs">
                  {activeRide!.status === 'accepted' || activeRide!.status === 'arriving'
                    ? 'Récupération client'
                    : 'Vers destination'}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="p-2 h-8 w-8">
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0 relative">
          <div ref={mapContainer} className="w-full" style={{ height: 420 }} />

          {/* Badge statut */}
          {!hasActiveRide && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <Badge className="bg-gray-800/85 backdrop-blur-sm text-white px-4 py-1.5 text-xs">
                En attente d'une course
              </Badge>
            </div>
          )}

          {/* Coordonnées GPS */}
          {currentLocation && (
            <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
              <div className="bg-white/90 backdrop-blur-sm rounded-md px-2.5 py-1.5 shadow border border-gray-100">
                <p className="text-[11px] font-mono text-gray-500 leading-tight">
                  {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Infos de route */}
      {hasActiveRide && routeInfo && (
        <Card className="bg-[#04439e]/5 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Distance</p>
                <p className="text-2xl font-bold text-blue-600">
                  {routeInfo.distance.toFixed(1)}{' '}
                  <span className="text-sm font-normal">km</span>
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <p className="text-xs text-gray-500">{t('googleMapsNavigation.dureeEstimee')}</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {routeInfo.duration}{' '}
                  <span className="text-sm font-normal">min</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Position actuelle sans course */}
      {currentLocation && !hasActiveRide && (
        <Card className="bg-[#ff4000]/5 shadow-sm">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 rounded-full p-2.5">
                <MapPin className="w-5 h-5 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Position GPS active</p>
                <p className="text-xs text-gray-500">{t('googleMapsNavigation.suiviEnTempsReelActive')}</p>
              </div>
            </div>
            <Button
              onClick={openExternalNavigation}
              className="w-full bg-[#ff4000] hover:bg-[#ce3d11] text-white"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Ouvrir Google Maps
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Détails de la course active */}
      {hasActiveRide && activeRide && (
        <Card className="shadow-sm">
          <CardContent className="pt-4 space-y-3">
            {/* Client */}
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">{t('googleMapsNavigation.client')}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onContactCustomer?.(activeRide.customerPhone)}
                  className="gap-2 h-8"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Appeler
                </Button>
              </div>
              <p className="font-semibold text-gray-900">{activeRide.customerName}</p>
              <p className="text-sm text-gray-500">{activeRide.customerPhone}</p>
            </div>

            {/* Itinéraire */}
            <div className="space-y-2">
              <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 bg-[#ff4000] rounded-full mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-[#ff4000] uppercase tracking-wider mb-0.5">
                      Départ
                    </p>
                    <p className="text-sm text-gray-800">{activeRide.pickup.address}</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <ArrowRight className="w-5 h-5 text-blue-400" />
              </div>
              <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 bg-[#ff4000] rounded-full mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-[#ff4000] uppercase tracking-wider mb-0.5">
                      Destination
                    </p>
                    <p className="text-sm text-gray-800">{activeRide.destination.address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation externe */}
            <Button
              onClick={openExternalNavigation}
              className="w-full bg-[#04439e] text-white"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Navigation précise Google Maps
            </Button>

            {/* Annuler */}
            <Button
              onClick={cancelRide}
              variant="outline"
              className="w-full border-orange-200 text-[#ff4000] hover:bg-orange-50"
            >
              Annuler la course
            </Button>

            {/* Gains */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Prix course</p>
                <p className="text-lg font-bold text-[#ff4000]">
                  <Money amount={activeRide.estimatedPrice || 0} from="GNF" />
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Mes gains</p>
                <p className="text-lg font-bold text-blue-600">
                  <Money amount={activeRide.estimatedEarnings || 0} from="GNF" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pas de course active */}
      {!hasActiveRide && (
        <Card className="bg-white/95 shadow-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="bg-gray-100 rounded-full p-5 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-600 mb-1">{t('googleMapsNavigation.aucuneCourseActive')}</h3>
            <p className="text-sm text-gray-400">
              Acceptez une course pour démarrer la navigation
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

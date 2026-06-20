/**
 * SUIVI EN TEMPS RÉEL POUR LE CLIENT
 * Affiche la position du livreur et l'itinéraire en temps réel
 */

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, Phone, User, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { subscribeLivePosition, deliveryPositionTopic } from '@/lib/realtime/livePositions';
import { Button } from '@/components/ui/button';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { toast } from 'sonner';

// Clé Mapbox depuis les variables d'environnement
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface ClientDeliveryTrackingProps {
  deliveryId: string;
}

export function ClientDeliveryTracking({ deliveryId }: ClientDeliveryTrackingProps) {
  const { t } = useTranslation();
  const [delivery, setDelivery] = useState<any>(null);
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const [hasNotifiedTwoMinutes, setHasNotifiedTwoMinutes] = useState(false);

  // Charger les détails de la livraison + s'abonner (en récupérant les nettoyages, sinon
  // les canaux postgres_changes ET broadcast n'étaient jamais fermés → fuite de souscriptions).
  useEffect(() => {
    loadDelivery();
    const unsubDelivery = subscribeToDelivery();
    const unsubTracking = subscribeToTracking();
    return () => {
      unsubDelivery?.();
      unsubTracking?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId]);

  // Initialiser la carte
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-13.7122, 9.5091], // Conakry par défaut
      zoom: 12
    });

    map.current.addControl(new mapboxgl.NavigationControl());
  }, []);

  // Mettre à jour la carte quand on a les données
  useEffect(() => {
    if (!map.current || !delivery) return;

    // Coordonnées : colonnes top-level (livraisons e-commerce) OU jsonb pickup_address/delivery_address
    // (livraisons restaurant). Repli Conakry si rien.
    const pLng = delivery.pickup_lng ?? delivery.pickup_address?.lng ?? null;
    const pLat = delivery.pickup_lat ?? delivery.pickup_address?.lat ?? null;
    const dLng = delivery.delivery_lng ?? delivery.delivery_address?.lng ?? null;
    const dLat = delivery.delivery_lat ?? delivery.delivery_address?.lat ?? null;

    // Ajouter le marqueur de destination (client)
    const deliveryAddr = typeof delivery.delivery_address === 'string'
      ? delivery.delivery_address
      : delivery.delivery_address?.address || delivery.delivery_address?.text || 'Destination';

    new mapboxgl.Marker({ color: '#ff4000' })
      .setLngLat([dLng ?? -13.7122, dLat ?? 9.5091])
      .setPopup(new mapboxgl.Popup().setHTML(`<strong>Destination</strong><br/>${deliveryAddr}`))
      .addTo(map.current);

    // Ajouter le marqueur de départ (pickup)
    const pickupAddr = typeof delivery.pickup_address === 'string'
      ? delivery.pickup_address
      : delivery.pickup_address?.address || delivery.pickup_address?.name || 'Point de départ';

    new mapboxgl.Marker({ color: '#f97316' })
      .setLngLat([pLng ?? -13.7122, pLat ?? 9.5091])
      .setPopup(new mapboxgl.Popup().setHTML(`<strong>${t('clientDeliveryTracking.pointDeRetrait')}</strong><br/>${pickupAddr}`))
      .addTo(map.current);

    // Centrer sur les deux points
    if (pLng && dLng) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pLng, pLat]);
      bounds.extend([dLng, dLat]);
      map.current.fitBounds(bounds, { padding: 50 });
    } else if (pLng) {
      map.current.setCenter([pLng, pLat]); map.current.setZoom(13);
    }
  }, [delivery]);

  // Mettre à jour la position du livreur
  useEffect(() => {
    if (!map.current || !driverPosition) return;

    if (driverMarker.current) {
      driverMarker.current.setLngLat([driverPosition.lng, driverPosition.lat]);
    } else {
      driverMarker.current = new mapboxgl.Marker({ color: '#04439e' })
        .setLngLat([driverPosition.lng, driverPosition.lat])
        .setPopup(new mapboxgl.Popup().setHTML('<strong>🚴 Livreur</strong>'))
        .addTo(map.current);
    }

    // Calculer la distance et le temps estimé — coords top-level (e-commerce) OU jsonb
    // delivery_address (restaurant), même repli que le tracé carte.
    const destLat = delivery?.delivery_lat ?? delivery?.delivery_address?.lat ?? null;
    const destLng = delivery?.delivery_lng ?? delivery?.delivery_address?.lng ?? null;
    if (destLat != null && destLng != null) {
      const dist = calculateDistance(
        driverPosition.lat,
        driverPosition.lng,
        destLat,
        destLng
      );
      setDistance(dist);

      // Estimation du temps (30 km/h en moyenne pour un livreur moto)
      const estimatedMinutes = Math.ceil((dist / 30) * 60);
      setEstimatedTime(estimatedMinutes);

      // Notification à 2 minutes
      if (estimatedMinutes <= 2 && !hasNotifiedTwoMinutes && delivery.status === 'in_transit') {
        sendArrivingSoonNotification(estimatedMinutes);
        setHasNotifiedTwoMinutes(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverPosition, delivery]);

  const loadDelivery = async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single();

    if (error) {
      console.error('Error loading delivery:', error);
      return;
    }

    setDelivery(data);
  };

  const subscribeToDelivery = () => {
    const channel = supabase
      .channel(`delivery:${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`
        },
        (payload) => {
          setDelivery(payload.new);

          // Notifier le client selon le statut
          if (payload.new.status === 'picked_up' && payload.old?.status !== 'picked_up') {
            toast.success(t('clientDeliveryTracking.leLivreurARecupereVotre'));
          } else if (payload.new.status === 'delivered') {
            toast.success(t('clientDeliveryTracking.votreColisAEteLivre'));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToTracking = () => {
    const channel = supabase
      .channel(`delivery-tracking-pg:${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_tracking',
          filter: `delivery_id=eq.${deliveryId}`
        },
        (payload) => {
          const newPosition = {
            lat: payload.new.latitude,
            lng: payload.new.longitude
          };
          setDriverPosition(newPosition);
        }
      )
      .subscribe();

    // 📡 DUAL-MODE scalabilité : on écoute AUSSI la position en broadcast (hors WAL,
    // provider-agnostique → Ably/AWS par flag). Les deux mettent à jour le même état
    // (idempotent). Quand le broadcast est validé, on pourra retirer le postgres_changes.
    const unsubBroadcast = subscribeLivePosition(
      deliveryPositionTopic(deliveryId),
      (p) => setDriverPosition({ lat: p.lat, lng: p.lng })
    );

    return () => {
      supabase.removeChannel(channel);
      unsubBroadcast();
    };
  };

  const sendArrivingSoonNotification = async (minutes: number) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase.functions.invoke('send-delivery-notification', {
        body: {
          deliveryId,
          clientId: user.user.id,
          type: 'arriving_soon',
          estimatedMinutes: minutes
        }
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      case 'picked_up':
        return <Badge className="bg-blue-500">{t('clientDeliveryTracking.colisRecupere')}</Badge>;
      case 'in_transit':
        return <Badge className="bg-[#04439e]">{t('clientDeliveryTracking.enLivraison')}</Badge>;
      case 'delivered':
        return <Badge className="bg-[#ff4000]">{t('clientDeliveryTracking.livre')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (!delivery) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">{t('clientDeliveryTracking.chargementDuSuivi')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Informations de livraison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              Suivi de livraison
            </span>
            {getStatusBadge(delivery.status)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Temps estimé */}
          {estimatedTime !== null && driverPosition && delivery.status === 'in_transit' && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-bold text-2xl text-blue-900">
                    {estimatedTime} min
                  </p>
                  <p className="text-sm text-blue-700">{t('clientDeliveryTracking.tempsEstimeDArrivee')}</p>
                  {distance !== null && (
                    <p className="text-xs text-muted-foreground">
                      Distance: {distance.toFixed(1)} km
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Informations livreur */}
          {delivery.driver_id && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <User className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">{t('clientDeliveryTracking.votreLivreur')}</p>
                <p className="text-sm text-muted-foreground">ID: {delivery.driver_id.slice(0, 8)}</p>
              </div>
              <Button variant="outline" size="sm">
                <Phone className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Adresses */}
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Retrait</p>
                <p className="text-muted-foreground">
                  {typeof delivery.pickup_address === 'string'
                    ? delivery.pickup_address
                    : delivery.pickup_address?.address || 'Adresse de retrait'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-[#ff4000] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('clientDeliveryTracking.livraison')}</p>
                <p className="text-muted-foreground">
                  {typeof delivery.delivery_address === 'string'
                    ? delivery.delivery_address
                    : delivery.delivery_address?.address || 'Adresse de livraison'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carte */}
      <Card>
        <CardContent className="p-0">
          <div ref={mapContainer} className="h-[500px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

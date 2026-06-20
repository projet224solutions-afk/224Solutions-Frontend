/**
 * HOOK DE SUIVI EN TEMPS RÉEL DU CONDUCTEUR (côté client)
 * Abonne le client aux mises à jour de position du chauffeur
 * et déclenche des notifications ETA à 5, 2 et 1 minute.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { subscribeLivePosition, driverPositionTopic, ridePositionTopic } from '@/lib/realtime/livePositions';

export interface DriverPosition {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** ETA en minutes à 30 km/h (0.5 km/min) */
function calcEta(distKm: number): number {
  return Math.max(1, Math.ceil(distKm / 0.5));
}

/**
 * Hook client : suit la position du chauffeur assigné à une course
 * et envoie des notifications à 5, 2 et 1 minute.
 *
 * @param rideId   - ID de la course active
 * @param pickupCoords - Coordonnées du point de rendez-vous client
 * @param driverId - ID du conducteur dans taxi_drivers (pas user_id)
 */
export function useDriverTracking(
  rideId: string | undefined,
  pickupCoords: { latitude: number; longitude: number } | null,
  driverId: string | undefined
) {
  const [driverPosition, setDriverPosition] = useState<DriverPosition | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Flags pour éviter de répéter les notifications
  const notifiedMoving = useRef(false);
  const notified5min = useRef(false);
  const notified2min = useRef(false);
  const notified1min = useRef(false);
  const initialPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // Réinitialiser quand la course change
  useEffect(() => {
    notifiedMoving.current = false;
    notified5min.current = false;
    notified2min.current = false;
    notified1min.current = false;
    initialPositionRef.current = null;
    setDriverPosition(null);
    setEtaMinutes(null);
    setIsMoving(false);
  }, [rideId]);

  const processPosition = useCallback(
    (lat: number, lng: number, heading?: number, speed?: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const position: DriverPosition = {
        latitude: lat,
        longitude: lng,
        heading,
        speed,
        timestamp: new Date().toISOString()
      };

      setDriverPosition(position);

      // Stocker la position initiale
      if (!initialPositionRef.current) {
        initialPositionRef.current = { lat, lng };
      }

      // Détecter le mouvement : > 30 m depuis la position initiale
      if (!notifiedMoving.current && initialPositionRef.current) {
        const movedKm = haversineKm(
          initialPositionRef.current.lat,
          initialPositionRef.current.lng,
          lat,
          lng
        );
        if (movedKm > 0.03) {
          notifiedMoving.current = true;
          setIsMoving(true);
          toast.info('🏍️ Le conducteur est en mouvement !', {
            description: 'Il se dirige vers votre point de rendez-vous',
            duration: 5000
          });
        }
      }

      // Calcul ETA
      if (!pickupCoords) return;
      const distKm = haversineKm(lat, lng, pickupCoords.latitude, pickupCoords.longitude);
      const eta = calcEta(distKm);
      setEtaMinutes(eta);

      // Notifications de proximité (une seule fois chacune)
      if (eta <= 5 && eta > 2 && !notified5min.current) {
        notified5min.current = true;
        toast.info('⏱️ Votre conducteur arrive dans 5 minutes !', {
          description: 'Préparez-vous à monter',
          duration: 7000
        });
      }
      if (eta <= 2 && eta > 1 && !notified2min.current) {
        notified2min.current = true;
        toast.warning('⚡ Votre conducteur est à 2 minutes !', {
          description: 'Dirigez-vous vers le point de rendez-vous',
          duration: 7000
        });
      }
      if (eta <= 1 && !notified1min.current) {
        notified1min.current = true;
        toast.success('🎯 Votre conducteur est presque là !', {
          description: 'Moins d\'une minute — restez au point de rendez-vous',
          duration: 10000
        });
      }
    },
    [pickupCoords]
  );

  // Charger la position actuelle du chauffeur dès qu'on connaît son ID
  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;

    const fetchInitial = async () => {
      const { data } = await supabase
        .from('taxi_drivers')
        .select('last_lat, last_lng, last_heading, last_speed')
        .eq('id', driverId)
        .single();

      if (!cancelled && data?.last_lat && data?.last_lng) {
        processPosition(
          Number(data.last_lat),
          Number(data.last_lng),
          data.last_heading ?? undefined,
          data.last_speed ?? undefined
        );
      }
    };

    void fetchInitial();
    return () => { cancelled = true; };
  }, [driverId, processPosition]);

  // Abonnement realtime : UPDATE sur taxi_drivers → position GPS publiée par le chauffeur
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`client-driver-pos-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'taxi_drivers',
          filter: `id=eq.${driverId}`
        },
        (payload) => {
          const d = payload.new as any;
          if (d.last_lat && d.last_lng) {
            processPosition(
              Number(d.last_lat),
              Number(d.last_lng),
              d.last_heading ?? undefined,
              d.last_speed ?? undefined
            );
          }
        }
      )
      .subscribe();

    // 📡 DUAL-MODE scalabilité : écoute AUSSI la position en broadcast (hors WAL,
    // Ably/AWS par flag). Idempotent avec le postgres_changes ci-dessus.
    const unsubBroadcast = subscribeLivePosition(
      driverPositionTopic(driverId),
      (p) => processPosition(p.lat, p.lng, p.heading, p.speed)
    );

    return () => { supabase.removeChannel(channel); unsubBroadcast(); };
  }, [driverId, processPosition]);

  // Abonnement realtime : INSERT sur taxi_ride_tracking → tracé de course détaillé
  useEffect(() => {
    if (!rideId) return;

    const channel = supabase
      .channel(`client-ride-track-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'taxi_ride_tracking',
          filter: `ride_id=eq.${rideId}`
        },
        (payload) => {
          const pt = payload.new as any;
          if (pt.latitude && pt.longitude) {
            processPosition(Number(pt.latitude), Number(pt.longitude));
          }
        }
      )
      .subscribe();

    // 📡 DUAL-MODE : tracé de course aussi en broadcast (hors WAL).
    const unsubBroadcast = subscribeLivePosition(
      ridePositionTopic(rideId),
      (p) => processPosition(p.lat, p.lng, p.heading, p.speed)
    );

    return () => { supabase.removeChannel(channel); unsubBroadcast(); };
  }, [rideId, processPosition]);

  return { driverPosition, etaMinutes, isMoving };
}

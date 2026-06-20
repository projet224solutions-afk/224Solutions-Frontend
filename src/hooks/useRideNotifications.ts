/**
 * HOOK DE NOTIFICATIONS TEMPS RÉEL - CHANGEMENTS DE STATUT DE COURSE
 * Écoute les changements de statut de taxi_trips pour le client.
 * Les notifications de position (ETA) sont gérées par useDriverTracking.
 * 224Solutions - Taxi-Moto System
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RideNotification {
  type: 'ride_accepted' | 'driver_arriving' | 'ride_started' | 'ride_completed' | 'ride_cancelled';
  rideId: string;
  message: string;
  data?: any;
}

export function useRideNotifications(userId: string | undefined, onNotification?: (notification: RideNotification) => void) {
  // Éviter les notifications dupliquées si le même statut est reçu deux fois
  const lastStatusRef = useRef<Record<string, string>>({});

  const handleRideUpdate = useCallback((payload: any) => {
    if (!payload.new) return;

    const ride = payload.new;

    // Déduplique : ignorer si le statut n'a pas changé
    if (lastStatusRef.current[ride.id] === ride.status) return;
    lastStatusRef.current[ride.id] = ride.status;

    let notification: RideNotification | null = null;

    switch (ride.status) {
      case 'accepted':
        notification = {
          type: 'ride_accepted',
          rideId: ride.id,
          message: '🚗 Un conducteur a accepté votre course !',
          data: ride
        };
        toast.success('🚗 Un conducteur a accepté votre course !', {
          description: 'Il arrive vers vous'
        });
        break;

      case 'driver_arriving':
        notification = {
          type: 'driver_arriving',
          rideId: ride.id,
          message: '🏍️ Le conducteur est en route vers vous',
          data: ride
        };
        toast.info('🏍️ Le conducteur est en route', {
          description: 'Il sera bientôt là'
        });
        break;

      case 'picked_up':
      case 'in_progress':
        notification = {
          type: 'ride_started',
          rideId: ride.id,
          message: '✅ Course démarrée !',
          data: ride
        };
        toast.success('✅ Course démarrée — Bon voyage !');
        break;

      case 'completed':
        notification = {
          type: 'ride_completed',
          rideId: ride.id,
          message: '🎉 Course terminée !',
          data: ride
        };
        toast.success('🎉 Course terminée !', {
          description: 'Merci d\'avoir utilisé 224Solutions'
        });
        break;

      case 'cancelled':
        notification = {
          type: 'ride_cancelled',
          rideId: ride.id,
          message: '❌ Course annulée',
          data: ride
        };
        toast.error('❌ Course annulée', {
          description: 'Vous pouvez en réserver une nouvelle'
        });
        break;
    }

    if (notification && onNotification) {
      onNotification(notification);
    }
  }, [onNotification]);

  useEffect(() => {
    if (!userId) return;

    // Un seul canal : changements de statut sur les courses du client
    // (la position du chauffeur est gérée par useDriverTracking)
    const tripsChannel = supabase
      .channel(`user_rides_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'taxi_trips',
          filter: `customer_id=eq.${userId}`
        },
        handleRideUpdate
      )
      .subscribe();

    return () => {
      tripsChannel.unsubscribe();
    };
  }, [userId, handleRideUpdate]);

  return {};
}

/**
 * SERVICE TEMPS RÉEL TAXI MOTO - 224SOLUTIONS
 * Gestion de toutes les fonctionnalités temps réel
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { publishLivePosition, driverPositionTopic } from "@/lib/realtime/livePositions";

export interface DriverLocation {
  driver_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
  is_available: boolean;
}

export interface RideUpdate {
  ride_id: string;
  status: string;
  driver_location?: { lat: number; lng: number };
  estimated_arrival?: number;
}

export class TaxiMotoRealtimeService {
  private static channels: Map<string, RealtimeChannel> = new Map();

  /**
   * Écouter les mises à jour de position d'un chauffeur
   */
  static subscribeToDriverLocation(
    driverId: string,
    onUpdate: (location: DriverLocation) => void
  ): () => void {
    const channelName = `driver-location:${driverId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'taxi_drivers',
          filter: `id=eq.${driverId}`
        },
        (payload) => {
          const driver = payload.new as any;
          onUpdate({
            driver_id: driver.id,
            latitude: driver.last_lat,
            longitude: driver.last_lng,
            heading: driver.last_heading,
            speed: driver.last_speed,
            timestamp: new Date().toISOString(),
            is_available: driver.status === 'available'
          });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  /**
   * Écouter les nouvelles demandes de courses (pour chauffeurs)
   * Note: On écoute tous les INSERT/UPDATE et on filtre côté client
   */
  static subscribeToNewRides(
    onNewRide: (ride: any) => void,
    onStatusChange?: (status: string) => void
  ): () => void {
    console.log('🔔 [TaxiMotoRealtimeService] Configuration subscription nouvelles courses');

    const channel = supabase
      .channel('new-ride-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'taxi_trips'
        },
        (payload) => {
          console.log('✅ [TaxiMotoRealtimeService] INSERT taxi_trips reçu:', payload.new);
          const ride = payload.new as any;

          // Filtrer côté client pour les courses "requested"
          if (ride.status === 'requested') {
            console.log('🚗 [TaxiMotoRealtimeService] Nouvelle course REQUESTED détectée:', {
              id: ride.id,
              ride_code: ride.ride_code,
              pickup: ride.pickup_address,
              dropoff: ride.dropoff_address,
              price: ride.price_total
            });
            onNewRide(ride);
          } else {
            console.log('⚠️ [TaxiMotoRealtimeService] Course reçue mais status ≠ requested:', ride.status);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'taxi_trips'
        },
        (payload) => {
          console.log('📝 [TaxiMotoRealtimeService] UPDATE taxi_trips reçu:', payload.new);
          const ride = payload.new as any;

          // Notifier aussi si une course passe en "requested"
          if (ride.status === 'requested') {
            console.log('🚗 [TaxiMotoRealtimeService] Course UPDATE vers REQUESTED:', ride.id);
            onNewRide(ride);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [TaxiMotoRealtimeService] Status subscription:', status);

        // Notifier le composant parent du changement de status
        if (onStatusChange) {
          onStatusChange(status);
        }

        // Gérer les différents statuts
        if (status === 'SUBSCRIBED') {
          console.log('✅ [TaxiMotoRealtimeService] ABONNÉ avec succès aux nouvelles courses');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [TaxiMotoRealtimeService] ERREUR canal Realtime - Vérifier configuration Supabase');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [TaxiMotoRealtimeService] TIMEOUT subscription - Connexion trop lente');
        } else if (status === 'CLOSED') {
          console.warn('⚠️ [TaxiMotoRealtimeService] Canal fermé');
        }
      });

    this.channels.set('new-ride-requests', channel);

    return () => {
      console.log('🔕 [TaxiMotoRealtimeService] Désabonnement nouvelles courses');
      supabase.removeChannel(channel);
      this.channels.delete('new-ride-requests');
    };
  }

  /**
   * Écouter les mises à jour d'une course spécifique
   */
  static subscribeToRideUpdates(
    rideId: string,
    onUpdate: (ride: any) => void
  ): () => void {
    const channelName = `ride-updates:${rideId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'taxi_trips',
          filter: `id=eq.${rideId}`
        },
        (payload) => {
          console.log('[Realtime] Mise à jour de la course:', payload);
          if (payload.new) {
            onUpdate(payload.new);
          }
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  /**
   * Écouter le tracking en temps réel d'une course
   */
  static subscribeToRideTracking(
    rideId: string,
    onLocationUpdate: (location: { lat: number; lng: number; timestamp: string }) => void
  ): () => void {
    const channelName = `ride-tracking:${rideId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'taxi_ride_tracking',
          filter: `ride_id=eq.${rideId}`
        },
        (payload) => {
          const point = payload.new as any;
          onLocationUpdate({
            lat: point.latitude,
            lng: point.longitude,
            timestamp: point.timestamp
          });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  /**
   * Publier la position du chauffeur (toutes les 5 secondes)
   */
  static async publishDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number,
    heading?: number,
    speed?: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('taxi_drivers')
        .update({
          last_lat: latitude,
          last_lng: longitude,
          last_heading: heading,
          last_speed: speed,
          last_seen: new Date().toISOString()
        })
        .eq('id', driverId);

      if (error) {
        console.error('[Realtime] Error publishing location:', error);
      }

      // 📡 DUAL-MODE scalabilité : diffuse aussi la position en broadcast (hors WAL),
      // À CÔTÉ de l'update ci-dessus. Best-effort → n'impacte jamais l'écriture en base.
      publishLivePosition(driverPositionTopic(driverId), {
        lat: latitude, lng: longitude, heading, speed, at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Realtime] Error publishing location:', err);
    }
  }

  /**
   * Notifier tous les chauffeurs à proximité d'une nouvelle course
   */
  static async notifyNearbyDrivers(
    rideId: string,
    pickupLat: number,
    pickupLng: number,
    radiusKm: number = 5
  ): Promise<void> {
    try {
      // Trouver les chauffeurs à proximité
      const { data: drivers } = await supabase.rpc('find_nearby_drivers' as any, {
        p_lat: pickupLat,
        p_lng: pickupLng,
        p_radius_km: radiusKm
      });

      if (!drivers || drivers.length === 0) {
        console.log('[Realtime] Aucun chauffeur à proximité');
        return;
      }

      // Créer des notifications pour chaque chauffeur
      for (const driver of drivers.slice(0, 10)) {
        await supabase.rpc('create_taxi_notification' as any, {
          p_user_id: driver.id,
          p_ride_id: rideId,
          p_type: 'ride_request',
          p_title: '🏍️ Nouvelle course disponible',
          p_body: `Course à ${Math.round(driver.distance_km * 10) / 10} km de vous`,
          p_data: { ride_id: rideId, distance: driver.distance_km }
        });
      }

      console.log(`[Realtime] ${drivers.length} chauffeurs notifiés`);
    } catch (err) {
      console.error('[Realtime] Error notifying drivers:', err);
    }
  }

  /**
   * Nettoyer tous les channels
   */
  static cleanup(): void {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}

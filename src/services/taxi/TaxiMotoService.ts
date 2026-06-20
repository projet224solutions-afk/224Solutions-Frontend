/**
 * SERVICE TAXI MOTO - 224SOLUTIONS
 * Service centralisé pour toutes les opérations Taxi Moto
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { publishLivePosition, ridePositionTopic } from "@/lib/realtime/livePositions";
import { supabaseCall, withRetry, handleApiError } from "@/utils/apiErrorHandler";

type TaxiTrip = Database['public']['Tables']['taxi_trips']['Row'];

export interface NearbyDriver {
  id: string;
  driver_code: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  current_lat: number;
  current_lng: number;
  rating: number;
  total_trips: number;
  distance_km: number;
}

export type TaxiRide = TaxiTrip;

export interface FareCalculation {
  base_fare: number;
  distance_cost: number;
  time_cost: number;
  subtotal: number;
  surge_multiplier: number;
  surge_amount: number;
  total: number;
  commission: number;
  driver_earnings: number;
  currency: string;
}

export interface TrackingPoint {
  id: string;
  ride_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export class TaxiMotoService {
  /**
   * Trouver les chauffeurs à proximité
   */
  static async findNearbyDrivers(
    lat: number,
    lng: number,
    radiusKm: number = 5
  ): Promise<NearbyDriver[]> {
    try {
      // Essayer d'abord la fonction RPC si elle existe
      try {
        const data = await supabaseCall(
          async () => {
            const { data, error } = await supabase.rpc('find_nearby_taxi_drivers' as any, {
              p_lat: lat,
              p_lng: lng,
              p_radius_km: radiusKm
            });
            return { data, error };
          },
          { context: 'Recherche de chauffeurs', timeout: 10000 }
        );

        if (data && Array.isArray(data) && data.length > 0) {
          return data as any;
        }
      } catch (_rpcError) {
        console.log('[TaxiMotoService] RPC fallback to direct query');
      }

      // Fallback: requête directe vers taxi_drivers avec les colonnes qui existent
      const { data: drivers, error } = await supabase
        .from('taxi_drivers')
        .select('id, user_id, vehicle_type, vehicle_plate, rating, total_rides, total_earnings, status, is_online, last_lat, last_lng, last_seen')
        .eq('status', 'available')
        .eq('is_online', true)
        .limit(20);

      if (error) {
        console.error('[TaxiMotoService] Error fetching drivers:', error);
        return [];
      }

      // Récupérer TOUS les profils en UNE seule requête (évite le N+1 à grande échelle)
      const userIds = [...new Set((drivers || []).map((d: any) => d.user_id).filter(Boolean))];
      const profileMap: Record<string, { full_name?: string; phone?: string }> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', userIds);
        (profilesData || []).forEach((p: any) => {
          profileMap[p.id] = { full_name: p.full_name, phone: p.phone };
        });
      }

      const driversWithProfiles = (drivers || []).map((d: any) => {
        const profile = (d.user_id && profileMap[d.user_id]) || { full_name: 'Conducteur', phone: '' };
        return {
          id: d.user_id || d.id,
          driver_code: `DRV${d.id?.slice(0, 4) || '0000'}`,
          full_name: profile.full_name || 'Conducteur',
          phone: profile.phone || '',
          current_lat: d.last_lat || 0,
          current_lng: d.last_lng || 0,
          vehicle_type: d.vehicle_type || 'moto',
          vehicle_plate: d.vehicle_plate,
          rating: d.rating || 4.5,
          total_trips: d.total_rides || 0,
          distance_km: 0
        };
      });

      return driversWithProfiles;
    } catch (error) {
      console.error('[TaxiMotoService] Error finding nearby drivers:', error);
      return [];
    }
  }

  /**
   * Calculer le tarif d'une course
   */
  static async calculateFare(
    distanceKm: number,
    durationMin: number,
    surgeMultiplier: number = 1.0
  ): Promise<FareCalculation> {
    const data = await supabaseCall(
      async () => {
        const { data, error } = await supabase.rpc('calculate_taxi_fare' as any, {
          p_distance_km: distanceKm,
          p_duration_min: durationMin,
          p_surge_multiplier: surgeMultiplier
        });
        return { data, error };
      },
      { context: 'Calcul du tarif', timeout: 10000 }
    );

    return data as any;
  }

  /**
   * Créer une demande de course
   */
  static async createRide(params: {
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    dropoffAddress: string;
    distanceKm: number;
    durationMin: number;
    estimatedPrice: number;
    paymentMethod?: 'wallet' | 'card' | 'orange_money' | 'cash';
    phoneNumber?: string;
  }): Promise<TaxiRide> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    // Générer un ride code
    const { data: rideCode } = await supabase.rpc('generate_taxi_code' as any, {
      p_prefix: 'TMR'
    });

    // Calculer driver_share (85%) et platform_fee (15%)
    const driverShare = Math.round(params.estimatedPrice * 0.85);
    const platformFee = params.estimatedPrice - driverShare;

    const { data, error } = await supabase
      .from('taxi_trips')
      .insert({
        ride_code: rideCode as any,
        customer_id: user.user.id,
        pickup_lat: params.pickupLat as any,
        pickup_lng: params.pickupLng as any,
        pickup_address: params.pickupAddress,
        dropoff_lat: params.dropoffLat as any,
        dropoff_lng: params.dropoffLng as any,
        dropoff_address: params.dropoffAddress,
        distance_km: params.distanceKm as any,
        duration_min: params.durationMin as any,
        price_total: params.estimatedPrice as any,
        driver_share: driverShare as any,
        platform_fee: platformFee as any,
        status: 'requested',
        payment_status: 'pending',
        payment_method: params.paymentMethod || 'cash',
        metadata: params.phoneNumber ? { orange_money_phone: params.phoneNumber } : null
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[TaxiMotoService] Error creating ride:', error);
      throw error;
    }

    // Notifier les chauffeurs à proximité
    console.log(`[TaxiMotoService] 🔍 Recherche de chauffeurs à proximité de [${params.pickupLat}, ${params.pickupLng}]`);
    const drivers = await this.findNearbyDrivers(params.pickupLat, params.pickupLng, 10); // Augmenté à 10km
    console.log(`[TaxiMotoService] 👥 ${drivers.length} chauffeurs trouvés`);

    // Notifier jusqu'à 10 chauffeurs (élargi)
    const notifiedDrivers = drivers.slice(0, 10);
    console.log(`[TaxiMotoService] 📢 Notification de ${notifiedDrivers.length} chauffeurs...`);

    for (const driver of notifiedDrivers) {
      try {
        console.log(`[TaxiMotoService] 📲 Envoi notification à ${driver.full_name} (${driver.id})`);
        const { data: _notifData, error: notifError } = await supabase.rpc('create_taxi_notification' as any, {
          p_user_id: driver.id,
          p_ride_id: data.id,
          p_type: 'ride_request',
          p_title: 'Nouvelle course disponible',
          p_body: `Course de ${params.pickupAddress} à ${params.dropoffAddress} - ${params.estimatedPrice} GNF`,
          p_data: { distance_km: params.distanceKm, price_total: params.estimatedPrice, driver_share: driverShare }
        });

        if (notifError) {
          console.error(`[TaxiMotoService] ❌ Erreur notification pour ${driver.id}:`, notifError);
        } else {
          console.log(`[TaxiMotoService] ✅ Notification envoyée à ${driver.full_name}`);
        }
      } catch (err) {
        console.error(`[TaxiMotoService] ❌ Erreur lors de l'envoi notification:`, err);
      }
    }

    console.log(`[TaxiMotoService] ✅ Course créée avec succès: ${data.ride_code} (ID: ${data.id})`);

    return data as TaxiRide;
  }

  /**
   * Accepter une course (chauffeur)
   */
  static async acceptRide(rideId: string, driverId: string): Promise<void> {
    await withRetry(
      async () => {
        const { data, error } = await supabase.functions.invoke('taxi-accept-ride', {
          body: { rideId, driverId }
        });

        if (error) {
          // Gestion spécifique des erreurs de verrouillage
          if (error.message?.includes('LOCKED') || error.message?.includes('déjà en cours')) {
            const lockError = new Error('Cette course est déjà en cours d\'attribution');
            (lockError as any).code = 'LOCKED';
            throw lockError;
          }
          if (error.message?.includes('ALREADY_ASSIGNED') || error.message?.includes('déjà attribuée')) {
            const assignedError = new Error('Cette course a déjà été attribuée');
            (assignedError as any).code = 'ALREADY_ASSIGNED';
            throw assignedError;
          }
          throw error;
        }
        return { data, error: null };
      },
      {
        maxRetries: 1, // Réduire les tentatives pour les erreurs de verrouillage
        timeout: 20000,
        onRetry: (attempt) => {
          console.log(`[TaxiMotoService] Retry accepting ride (attempt ${attempt})`);
        }
      }
    ).catch((error) => {
      // Ne pas traiter l'erreur si c'est une erreur de verrouillage
      if (error.code === 'LOCKED' || error.code === 'ALREADY_ASSIGNED') {
        throw error;
      }
      handleApiError(error, 'Acceptation de la course');
      throw error;
    });
  }

  /**
   * Refuser une course (chauffeur)
   */
  static async refuseRide(rideId: string, driverId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('taxi-refuse-ride', {
      body: { rideId, driverId }
    });

    if (error) {
      console.error('[TaxiMotoService] Error refusing ride:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le statut d'une course
   */
  static async updateRideStatus(
    rideId: string,
    status: string,
    additionalData?: Partial<TaxiRide>
  ): Promise<void> {
    const updateData: any = { status, ...additionalData };

    // Mettre à jour les timestamps selon le statut
    if (status === 'accepted') {
      updateData.accepted_at = new Date().toISOString();
    } else if (status === 'arriving') {
      updateData.arriving_at = new Date().toISOString();
    } else if (status === 'started') {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'in_progress') {
      updateData.in_progress_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (status.includes('cancelled')) {
      updateData.cancelled_at = updateData.cancelled_at || new Date().toISOString();
    }

    await supabaseCall(
      async () => {
        const { data, error } = await supabase
          .from('taxi_trips')
          .update(updateData)
          .eq('id', rideId);
        return { data, error };
      },
      {
        context: 'Mise à jour du statut',
        timeout: 15000,
        maxRetries: 2
      }
    );

    // Logger l'action
    try {
      await supabase.rpc('log_taxi_action' as any, {
        p_action_type: `ride_status_${status}`,
        p_actor_id: (await supabase.auth.getUser()).data.user?.id,
        p_actor_type: 'driver',
        p_resource_type: 'ride',
        p_resource_id: rideId,
        p_details: { status, ...additionalData }
      });
    } catch (err) {
      console.warn('[TaxiMotoService] Could not log action:', err);
    }
  }

  /**
   * Enregistrer un point de tracking
   */
  static async trackPosition(
    rideId: string,
    driverId: string,
    lat: number,
    lng: number,
    _speed?: number,
    _heading?: number,
    _accuracy?: number
  ): Promise<void> {
    const { error } = await supabase
      .from('taxi_ride_tracking')
      .insert({
        ride_id: rideId,
        driver_id: driverId,
        latitude: lat as any,
        longitude: lng as any,
        timestamp: new Date().toISOString()
      } as any);

    if (error) {
      console.error('[TaxiMotoService] Error tracking position:', error);
      throw error;
    }

    // 📡 DUAL-MODE scalabilité : diffuse aussi le point en broadcast (hors WAL),
    // À CÔTÉ de l'insert. Best-effort → n'impacte pas l'écriture en base.
    publishLivePosition(ridePositionTopic(rideId), {
      lat, lng, speed: _speed, heading: _heading, accuracy: _accuracy, at: new Date().toISOString(),
    });
  }

  /**
   * Récupérer les points de tracking d'une course
   */
  static async getRideTracking(rideId: string): Promise<TrackingPoint[]> {
    const { data, error } = await supabase
      .from('taxi_ride_tracking')
      .select('*')
      .eq('ride_id', rideId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('[TaxiMotoService] Error fetching tracking:', error);
      throw error;
    }

    return (data as any) || [];
  }

  /**
   * Récupérer les détails d'une course
   */
  static async getRideDetails(rideId: string): Promise<TaxiRide | null> {
    const { data, error } = await supabase
      .from('taxi_trips')
      .select('*')
      .eq('id', rideId)
      .single();

    if (error) {
      console.error('[TaxiMotoService] Error fetching ride details:', error);
      return null;
    }

    return data as TaxiRide;
  }

  /**
   * Récupérer l'historique des courses d'un client
   */
  static async getCustomerRides(limit: number = 50): Promise<TaxiRide[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('taxi_trips')
      .select('*')
      .eq('customer_id', user.user.id)
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[TaxiMotoService] Error fetching customer rides:', error);
      throw error;
    }

    return (data as TaxiRide[]) || [];
  }

  /**
   * Récupérer l'historique des courses d'un chauffeur
   */
  static async getDriverRides(driverId: string, limit: number = 50): Promise<TaxiRide[]> {
    const { data, error } = await supabase
      .from('taxi_trips')
      .select('*')
      .eq('driver_id', driverId)
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[TaxiMotoService] Error fetching driver rides:', error);
      throw error;
    }

    return (data as TaxiRide[]) || [];
  }

  /**
   * Traiter le paiement d'une course
   */
  static async processPayment(
    rideId: string,
    paymentMethod: string,
    idempotencyKey?: string
  ): Promise<any> {
    const { data, error } = await supabase.functions.invoke('taxi-payment', {
      body: {
        rideId,
        paymentMethod,
        idempotencyKey: idempotencyKey || `${rideId}-${Date.now()}`
      }
    });

    if (error) {
      console.error('[TaxiMotoService] Error processing payment:', error);
      throw error;
    }

    return data;
  }

  /**
   * Mettre à jour le statut en ligne d'un chauffeur
   */
  static async updateDriverStatus(
    driverId: string,
    isOnline: boolean,
    isAvailable: boolean,
    currentLat?: number,
    currentLng?: number
  ): Promise<void> {
    const updateData: any = {
      is_online: isOnline,
      status: isOnline ? (isAvailable ? 'available' : 'busy') : 'offline',
      last_seen: new Date().toISOString(),
    };

    // Quand le chauffeur passe hors ligne, on efface la dernière position.
    // Objectif: éviter toute apparition “fantôme” dans les recherches proximité.
    if (!isOnline) {
      updateData.last_lat = null;
      updateData.last_lng = null;
      updateData.last_heading = null;
      updateData.last_speed = null;
    } else if (typeof currentLat === 'number' && typeof currentLng === 'number') {
      updateData.last_lat = currentLat;
      updateData.last_lng = currentLng;
    }

    // IMPORTANT: ne pas avaler les erreurs. Si l'update échoue (RLS, session, mauvais id),
    // le conducteur pourrait rester “en ligne” côté DB.
    const updated = await supabaseCall(
      async () => {
        // D'abord essayer avec id direct
        let { data, error } = await supabase
          .from('taxi_drivers')
          .update(updateData)
          .eq('id', driverId)
          .select('id');

        // Si pas trouvé, essayer avec user_id
        if ((!data || data.length === 0) && !error) {
          const result = await supabase
            .from('taxi_drivers')
            .update(updateData)
            .eq('user_id', driverId)
            .select('id');
          data = result.data;
          error = result.error;
        }

        return { data, error };
      },
      {
        context: 'Mise à jour du statut chauffeur',
        silent: true,
        timeout: 10000,
        maxRetries: 1,
      }
    );

    if (!updated || (Array.isArray(updated) && updated.length === 0)) {
      throw new Error('Mise à jour statut échouée: conducteur introuvable');
    }
  }

  /**
   * S'abonner aux mises à jour d'une course
   */
  static subscribeToRide(rideId: string, callback: (ride: TaxiRide) => void) {
    const channel = supabase
      .channel(`ride:${rideId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'taxi_trips',
          filter: `id=eq.${rideId}`
        },
        (payload) => {
          console.log('[TaxiMotoService] Ride updated:', payload);
          callback(payload.new as TaxiRide);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * S'abonner au tracking d'une course
   */
  static subscribeToTracking(rideId: string, callback: (point: TrackingPoint) => void) {
    const channel = supabase
      .channel(`tracking:${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'taxi_ride_tracking',
          filter: `ride_id=eq.${rideId}`
        },
        (payload) => {
          console.log('[TaxiMotoService] New tracking point:', payload);
          callback(payload.new as TrackingPoint);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Détecter la fraude
   */
  static async detectFraud(userId: string, driverId?: string, rideId?: string): Promise<void> {
    await supabase.rpc('detect_taxi_fraud' as any, {
      p_user_id: userId,
      p_driver_id: driverId,
      p_ride_id: rideId
    });
  }
}

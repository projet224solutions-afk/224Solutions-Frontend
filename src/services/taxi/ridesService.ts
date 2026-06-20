/**
 * SERVICE TAXI-MOTO: Gestion des courses
 * Centralise toute la logique métier des courses
 */

import { supabase } from "@/integrations/supabase/client";

export interface CreateRideParams {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  durationMin: number;
  estimatedPrice: number;
  vehicleType?: string;
}

export interface RideDetails {
  id: string;
  status: string;
  customer_id: string;
  driver_id?: string;
  pickup_address: string;
  dropoff_address: string;
  price_total: number;
  payment_status: string;
  payment_method?: string;
  requested_at: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
}

export class RidesService {
  /**
   * Crée une nouvelle demande de course
   */
  static async createRide(params: CreateRideParams, idempotencyKey?: string): Promise<RideDetails> {
    console.log('[RidesService] Creating ride', params);

    const { data, error } = await supabase
      .from('taxi_trips')
      .insert({
        customer_id: (await supabase.auth.getUser()).data.user?.id,
        pickup_lat: params.pickupLat,
        pickup_lng: params.pickupLng,
        dropoff_lat: params.dropoffLat,
        dropoff_lng: params.dropoffLng,
        pickup_address: params.pickupAddress,
        dropoff_address: params.dropoffAddress,
        distance_km: params.distanceKm,
        duration_min: params.durationMin,
        price_total: params.estimatedPrice,
        status: 'requested',
        idempotency_key: idempotencyKey,
        metadata: { vehicle_type: params.vehicleType || 'moto' }
      })
      .select()
      .single();

    if (error) {
      console.error('[RidesService] Error creating ride:', error);
      throw error;
    }

    console.log('[RidesService] Ride created', { rideId: data.id });

    // Notify nearby drivers
    await this.notifyNearbyDrivers(
      params.pickupLat,
      params.pickupLng,
      data.id,
      params.estimatedPrice
    );

    return data as unknown as RideDetails;
  }

  /**
   * Trouve et notifie les conducteurs proches
   */
  private static async notifyNearbyDrivers(
    lat: number,
    lng: number,
    rideId: string,
    estimatedPrice: number
  ) {
    const { data: drivers } = await supabase.rpc('find_nearby_taxi_drivers', {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: 5,
      p_limit: 10
    });

    if (!drivers || drivers.length === 0) {
      console.log('[RidesService] No drivers found nearby');
      return;
    }

    console.log(`[RidesService] Notifying ${drivers.length} drivers`);

    // Créer notifications pour chaque conducteur
    for (const driver of drivers) {
      await supabase.rpc('create_taxi_notification', {
        p_user_id: driver.user_id,
        p_type: 'new_ride_request',
        p_title: 'Nouvelle course disponible',
        p_body: `Course à ${driver.distance_km.toFixed(1)}km - ${estimatedPrice} GNF`,
        p_data: { rideId, distance: driver.distance_km, price: estimatedPrice },
        p_ride_id: rideId
      });
    }
  }

  /**
   * Accepte une course
   */
  static async acceptRide(rideId: string, driverId: string) {
    console.log('[RidesService] Accepting ride', { rideId, driverId });

    const { data, error } = await supabase.functions.invoke('taxi-accept-ride', {
      body: { rideId, driverId }
    });

    if (error) {
      console.error('[RidesService] Error accepting ride:', error);
      throw error;
    }

    return data;
  }

  /**
   * Refuse une course
   */
  static async refuseRide(rideId: string, driverId: string) {
    console.log('[RidesService] Refusing ride', { rideId, driverId });

    const { data, error } = await supabase.functions.invoke('taxi-refuse-ride', {
      body: { rideId, driverId }
    });

    if (error) {
      console.error('[RidesService] Error refusing ride:', error);
      throw error;
    }

    return data;
  }

  /**
   * Met à jour le statut d'une course
   */
  static async updateRideStatus(
    rideId: string,
    newStatus: string
  ) {
    console.log('[RidesService] Updating ride status', { rideId, newStatus });

    const updates: Record<string, unknown> = { status: newStatus };

    if (newStatus === 'picked_up') {
      updates.started_at = new Date().toISOString();
    } else if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else if (newStatus === 'cancelled' || newStatus === 'cancelled_by_customer') {
      updates.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('taxi_trips')
      .update(updates)
      .eq('id', rideId)
      .select()
      .maybeSingle();

    if (error) throw error;

    // Audit log
    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      await supabase.rpc('log_taxi_action', {
        p_action_type: 'ride_status_updated',
        p_actor_id: user.id,
        p_actor_type: 'customer',
        p_resource_type: 'ride',
        p_resource_id: rideId,
        p_details: { newStatus }
      });
    }

    return data;
  }

  /**
   * Récupère les détails d'une course
   */
  static async getRideDetails(rideId: string): Promise<RideDetails> {
    const { data, error } = await supabase
      .from('taxi_trips')
      .select('*')
      .eq('id', rideId)
      .single();

    if (error) throw error;
    return data as unknown as RideDetails;
  }

  /**
   * Récupère l'historique des courses d'un utilisateur
   */
  static async getUserRides(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('taxi_trips')
      .select('*')
      .eq('customer_id', userId)
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Récupère les courses d'un conducteur
   */
  static async getDriverRides(driverId: string, limit = 20) {
    const { data, error } = await supabase
      .from('taxi_trips')
      .select('*')
      .eq('driver_id', driverId)
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Track position en temps réel
   */
  static async trackPosition(
    rideId: string,
    driverId: string,
    latitude: number,
    longitude: number
  ) {
    const { error } = await supabase
      .from('taxi_ride_tracking')
      .insert({
        ride_id: rideId,
        driver_id: driverId,
        latitude,
        longitude
      });

    if (error) {
      console.error('[RidesService] Error tracking position:', error);
    }
  }
}
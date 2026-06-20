/**
 * HOOK TAXI MOTO - 224SOLUTIONS
 * Hook React pour gérer l'état et les opérations Taxi Moto
 */

import { useState, useEffect, useCallback } from 'react';
import { TaxiMotoService, type TaxiRide, type NearbyDriver, type TrackingPoint } from '@/services/taxi/TaxiMotoService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useTaxiMoto() {
  const [currentRide, setCurrentRide] = useState<TaxiRide | null>(null);
  const [rideHistory, setRideHistory] = useState<TaxiRide[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [trackingPoints, setTrackingPoints] = useState<TrackingPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Charger la course en cours
   */
  const loadCurrentRide = useCallback(async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error: err } = await supabase
        .from('taxi_trips')
        .select('*')
        .eq('customer_id', user.user.id)
        .not('status', 'in', '(completed,cancelled,cancelled_by_customer,cancelled_by_driver)')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) throw err;
      setCurrentRide(data as TaxiRide);

      // S'abonner aux mises à jour si une course est en cours
      if (data) {
        const unsubscribe = TaxiMotoService.subscribeToRide(data.id, (updatedRide) => {
          setCurrentRide(updatedRide as TaxiRide);
        });
        return unsubscribe;
      }
    } catch (err) {
      console.error('[useTaxiMoto] Error loading current ride:', err);
      setError(err instanceof Error ? err.message : 'Error loading current ride');
    }
  }, []);

  /**
   * Charger l'historique des courses
   */
  const loadRideHistory = useCallback(async (limit: number = 50) => {
    try {
      setLoading(true);
      const rides = await TaxiMotoService.getCustomerRides(limit);
      setRideHistory(rides);
    } catch (err) {
      console.error('[useTaxiMoto] Error loading ride history:', err);
      setError(err instanceof Error ? err.message : 'Error loading ride history');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Trouver les chauffeurs à proximité
   */
  const findNearbyDrivers = useCallback(async (lat: number, lng: number, radiusKm: number = 5) => {
    try {
      setLoading(true);
      const drivers = await TaxiMotoService.findNearbyDrivers(lat, lng, radiusKm);
      setNearbyDrivers(drivers);
      return drivers;
    } catch (err) {
      console.error('[useTaxiMoto] Error finding nearby drivers:', err);
      setError(err instanceof Error ? err.message : 'Error finding nearby drivers');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Créer une demande de course
   */
  const createRide = useCallback(async (params: {
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    dropoffAddress: string;
    distanceKm: number;
    durationMin: number;
    estimatedPrice: number;
  }) => {
    try {
      setLoading(true);
      const ride = await TaxiMotoService.createRide(params);
      setCurrentRide(ride);
      toast.success('Course créée avec succès!');
      return ride;
    } catch (err) {
      console.error('[useTaxiMoto] Error creating ride:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la création de la course';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Annuler une course
   */
  const cancelRide = useCallback(async (rideId: string, reason: string) => {
    try {
      setLoading(true);
      const { data: _user } = await supabase.auth.getUser();

      await TaxiMotoService.updateRideStatus(rideId, 'cancelled_by_customer', {
        cancel_reason: reason,
        cancelled_at: new Date().toISOString()
      } as any);

      setCurrentRide(null);
      toast.success('Course annulée');
    } catch (err) {
      console.error('[useTaxiMoto] Error cancelling ride:', err);
      toast.error('Erreur lors de l\'annulation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Charger les points de tracking
   */
  const loadTracking = useCallback(async (rideId: string) => {
    try {
      const points = await TaxiMotoService.getRideTracking(rideId);
      setTrackingPoints(points);
      return points;
    } catch (err) {
      console.error('[useTaxiMoto] Error loading tracking:', err);
      return [];
    }
  }, []);

  /**
   * S'abonner au tracking en temps réel
   */
  const subscribeToTracking = useCallback((rideId: string) => {
    const unsubscribe = TaxiMotoService.subscribeToTracking(rideId, (point) => {
      setTrackingPoints((prev) => [...prev, point]);
    });
    return unsubscribe;
  }, []);

  /**
   * Traiter le paiement
   */
  const processPayment = useCallback(async (
    rideId: string,
    paymentMethod: string
  ) => {
    try {
      setLoading(true);
      const result = await TaxiMotoService.processPayment(rideId, paymentMethod);

      if (result.success) {
        toast.success('Paiement effectué avec succès!');
        await loadRideHistory();
        setCurrentRide(null);
      } else {
        toast.error(result.error || 'Erreur lors du paiement');
      }

      return result;
    } catch (err) {
      console.error('[useTaxiMoto] Error processing payment:', err);
      toast.error('Erreur lors du paiement');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadRideHistory]);

  // Charger la course en cours au montage
  useEffect(() => {
    loadCurrentRide();
    loadRideHistory();
  }, [loadCurrentRide, loadRideHistory]);

  return {
    currentRide,
    rideHistory,
    nearbyDrivers,
    trackingPoints,
    loading,
    error,
    findNearbyDrivers,
    createRide,
    cancelRide,
    loadTracking,
    subscribeToTracking,
    processPayment,
    loadRideHistory,
    loadCurrentRide
  };
}

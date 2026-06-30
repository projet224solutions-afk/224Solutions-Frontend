/**
 * HOOK TAXI RIDES - 224SOLUTIONS
 * Hook React pour gérer l'état et les opérations de courses taxi-moto
 */

import { useState, useEffect, useCallback } from 'react';
import { TaxiMotoService, type NearbyDriver } from '@/services/taxi/TaxiMotoService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TaxiTrip = Database['public']['Tables']['taxi_trips']['Row'];

export function useTaxiRides() {
  const [currentRide, setCurrentRide] = useState<TaxiTrip | null>(null);
  const [rideHistory, setRideHistory] = useState<TaxiTrip[]>([]);
  const [nearbyDrivers, _setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Charger la course en cours pour le conducteur
   */
  const loadCurrentRide = useCallback(async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error: err } = await supabase
        .from('taxi_trips')
        .select('*')
        .eq('driver_id', user.user.id)
        .not('status', 'in', '(completed,cancelled,cancelled_by_customer,cancelled_by_driver)')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) throw err;
      setCurrentRide(data as TaxiTrip);

      // S'abonner aux mises à jour si une course est en cours
      if (data) {
        const unsubscribe = TaxiMotoService.subscribeToRide(data.id, (updatedRide) => {
          setCurrentRide(updatedRide as TaxiTrip);
        });
        return unsubscribe;
      }
    } catch (err) {
      console.error('[useTaxiRides] Error loading current ride:', err);
      setError(err instanceof Error ? err.message : 'Error loading current ride');
    }
  }, []);

  /**
   * Charger l'historique des courses
   */
  const loadRideHistory = useCallback(async (limit: number = 50) => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const rides = await TaxiMotoService.getDriverRides(user.user.id, limit);
      setRideHistory(rides);
    } catch (err) {
      console.error('[useTaxiRides] Error loading ride history:', err);
      setError(err instanceof Error ? err.message : 'Error loading ride history');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Accepter une course
   */
  const acceptRide = useCallback(async (rideId: string) => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Non authentifié');

      await TaxiMotoService.acceptRide(rideId, user.user.id);
      await loadCurrentRide();
      toast.success('Course acceptée avec succès!');
    } catch (err) {
      console.error('[useTaxiRides] Error accepting ride:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'acceptation';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadCurrentRide]);

  /**
   * Refuser une course
   */
  const refuseRide = useCallback(async (rideId: string) => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Non authentifié');

      await TaxiMotoService.refuseRide(rideId, user.user.id);
      toast.success('Course refusée');
    } catch (err) {
      console.error('[useTaxiRides] Error refusing ride:', err);
      toast.error('Erreur lors du refus');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Démarrer une course (client récupéré)
   */
  const startRide = useCallback(async (rideId: string) => {
    try {
      setLoading(true);
      await TaxiMotoService.updateRideStatus(rideId, 'picked_up');
      toast.success('Client récupéré! Course démarrée!');
    } catch (err) {
      console.error('[useTaxiRides] Error starting ride:', err);
      toast.error('Erreur lors du démarrage');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Terminer une course
   */
  const completeRide = useCallback(async (rideId: string) => {
    try {
      setLoading(true);
      await TaxiMotoService.updateRideStatus(rideId, 'completed');
      setCurrentRide(null);
      toast.success('Course terminée!');
      await loadRideHistory();
    } catch (err) {
      console.error('[useTaxiRides] Error completing ride:', err);
      toast.error('Erreur lors de la complétion');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadRideHistory]);

  /**
   * Annuler une course
   */
  const cancelRide = useCallback(async (rideId: string) => {
    try {
      setLoading(true);
      await TaxiMotoService.updateRideStatus(rideId, 'cancelled');
      setCurrentRide(null);
      toast.success('Course annulée');
    } catch (err) {
      console.error('[useTaxiRides] Error cancelling ride:', err);
      toast.error('Erreur lors de l\'annulation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Enregistrer la position du conducteur
   */
  const trackPosition = useCallback(async (
    rideId: string,
    lat: number,
    lng: number,
    speed?: number,
    heading?: number
  ) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await TaxiMotoService.trackPosition(rideId, user.user.id, lat, lng, speed, heading);
    } catch (err) {
      console.error('[useTaxiRides] Error tracking position:', err);
    }
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
      console.error('[useTaxiRides] Error processing payment:', err);
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
    loading,
    error,
    acceptRide,
    refuseRide,
    startRide,
    completeRide,
    cancelRide,
    trackPosition,
    processPayment,
    loadRideHistory,
    loadCurrentRide
  };
}

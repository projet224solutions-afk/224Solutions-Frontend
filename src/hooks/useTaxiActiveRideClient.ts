/**
 * Hook pour vérifier si le client a une course taxi active
 * Permet la redirection automatique vers la page de tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ClientActiveRide {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  driver_id: string | null;
  requested_at: string;
}

interface UseTaxiActiveRideClientReturn {
  activeRide: ClientActiveRide | null;
  loading: boolean;
  hasActiveRide: boolean;
  redirectToTracking: () => void;
  refresh: () => Promise<void>;
}

// Statuts DB réels de taxi_trips (pas les statuts frontend)
const ACTIVE_STATUSES = ['pending', 'accepted', 'arriving', 'started', 'in_progress'];

export function useTaxiActiveRideClient(): UseTaxiActiveRideClientReturn {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeRide, setActiveRide] = useState<ClientActiveRide | null>(null);
  const [loading, setLoading] = useState(true);

  const checkActiveRide = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('taxi_trips')
        .select('id, status, pickup_address, dropoff_address, driver_id, requested_at')
        .eq('customer_id', user.id)
        .in('status', ACTIVE_STATUSES)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[useTaxiActiveRideClient] Error:', error);
        setActiveRide(null);
        return;
      }

      if (data) {
        setActiveRide({
          id: data.id,
          status: data.status || '',
          pickup_address: data.pickup_address || '',
          dropoff_address: data.dropoff_address || '',
          driver_id: data.driver_id,
          requested_at: data.requested_at || '',
        });
      } else {
        setActiveRide(null);
      }
    } catch (err) {
      console.error('[useTaxiActiveRideClient] Unexpected error:', err);
      setActiveRide(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    checkActiveRide();
  }, [checkActiveRide]);

  // Realtime subscription pour les mises à jour de statut
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`client_ride_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'taxi_trips',
          filter: `customer_id=eq.${user.id}`,
        },
        () => {
          checkActiveRide();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, checkActiveRide]);

  const redirectToTracking = useCallback(() => {
    if (activeRide) {
      navigate(`/taxi/tracking/${activeRide.id}`);
    }
  }, [activeRide, navigate]);

  return {
    activeRide,
    loading,
    hasActiveRide: activeRide !== null,
    redirectToTracking,
    refresh: checkActiveRide,
  };
}

import { useEffect, useRef } from 'react';
import { TaxiMotoService } from '@/services/taxi/TaxiMotoService';
import type { TaxiRide } from '@/services/taxi/TaxiMotoService';

interface UseRealtimeRideProps {
  rideId: string | null;
  isOnline: boolean;
  hasAccess: boolean;
  onRideUpdate: (ride: TaxiRide) => void;
}

/**
 * Hook with automatic cleanup and guards for realtime ride subscription
 */
export function useRealtimeRide({ rideId, isOnline, hasAccess, onRideUpdate }: UseRealtimeRideProps) {
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Guard: only subscribe if conditions are met
    if (!rideId || !isOnline || !hasAccess) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    console.log('[useRealtimeRide] Subscribing to ride:', rideId);
    unsubscribeRef.current = TaxiMotoService.subscribeToRide(rideId, onRideUpdate);

    // Auto-cleanup on unmount or dependency change
    return () => {
      if (unsubscribeRef.current) {
        console.log('[useRealtimeRide] Unsubscribing from ride:', rideId);
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [rideId, isOnline, hasAccess, onRideUpdate]);
}

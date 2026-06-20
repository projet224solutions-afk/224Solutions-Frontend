import { useEffect, useRef } from 'react';
import { TaxiMotoService } from '@/services/taxi/TaxiMotoService';
import type { TrackingPoint } from '@/services/taxi/TaxiMotoService';

interface UseRealtimeTrackingProps {
  rideId: string | null;
  isOnline: boolean;
  hasAccess: boolean;
  onTrackingUpdate: (point: TrackingPoint) => void;
}

/**
 * Hook with automatic cleanup and guards for realtime tracking subscription
 */
export function useRealtimeTracking({ rideId, isOnline, hasAccess, onTrackingUpdate }: UseRealtimeTrackingProps) {
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

    console.log('[useRealtimeTracking] Subscribing to tracking:', rideId);
    unsubscribeRef.current = TaxiMotoService.subscribeToTracking(rideId, onTrackingUpdate);

    // Auto-cleanup on unmount or dependency change
    return () => {
      if (unsubscribeRef.current) {
        console.log('[useRealtimeTracking] Unsubscribing from tracking:', rideId);
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [rideId, isOnline, hasAccess, onTrackingUpdate]);
}

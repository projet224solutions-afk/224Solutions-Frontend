/**
 * Hook pour gérer l'abonnement realtime aux livraisons
 * Avec guards et auto-cleanup pour éviter les fuites mémoire
 */

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeDeliveryProps {
  deliveryId: string | null;
  isOnline: boolean;
  hasAccess: boolean;
  onDeliveryUpdate?: (delivery: any) => void;
}

export function useRealtimeDelivery({
  deliveryId,
  isOnline,
  hasAccess,
  onDeliveryUpdate,
}: UseRealtimeDeliveryProps) {
  useEffect(() => {
    // Guards: ne pas s'abonner si conditions non remplies
    if (!deliveryId || !isOnline || !hasAccess) {
      return;
    }

    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      channel = supabase
        .channel(`delivery-${deliveryId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'deliveries',
            filter: `id=eq.${deliveryId}`,
          },
          (payload) => {
            console.log('[useRealtimeDelivery] Delivery updated:', payload.new);
            onDeliveryUpdate?.(payload.new);
          }
        )
        .subscribe();
    };

    setupSubscription();

    // Auto-cleanup
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        console.log('[useRealtimeDelivery] Unsubscribed from delivery channel');
      }
    };
  }, [deliveryId, isOnline, hasAccess, onDeliveryUpdate]);
}

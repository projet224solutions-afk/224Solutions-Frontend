/**
 * ÉCOUTEUR DE LIVRAISONS À PROXIMITÉ - Temps réel
 * S'abonne aux nouvelles livraisons via Supabase Realtime
 */

import { useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NearbyDeliveriesListenerProps {
  onNewDelivery: () => void;
  enabled: boolean;
}

export function NearbyDeliveriesListener({ onNewDelivery, enabled }: NearbyDeliveriesListenerProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!enabled) return;

    console.log('[NearbyDeliveriesListener] Subscribing to new deliveries');

    const channel = supabase
      .channel('deliveries-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deliveries',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('[NearbyDeliveriesListener] New delivery:', payload);
          toast.info(t('nearbyDeliveriesListener.nouvelleLivraisonDisponible'), {
            description: 'Consultez l\'onglet Missions'
          });
          onNewDelivery();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('[NearbyDeliveriesListener] Delivery updated:', payload);
          onNewDelivery();
        }
      )
      .subscribe();

    return () => {
      console.log('[NearbyDeliveriesListener] Unsubscribing');
      supabase.removeChannel(channel);
    };
  }, [enabled, onNewDelivery]);

  return null;
}

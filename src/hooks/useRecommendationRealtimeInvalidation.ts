/**
 * 🔄 Hook d'invalidation temps réel des recommandations
 * Écoute les changements sur la table products via Supabase Realtime
 * et invalide automatiquement les caches React Query
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRecommendationRealtimeInvalidation(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('product-changes-for-reco')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
      }, () => {
        // Invalider tous les caches de recommandation
        queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
        queryClient.invalidateQueries({ queryKey: ['discovery-products'] });
        console.log('[RecoRealtime] Products changed → invalidated recommendation caches');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}

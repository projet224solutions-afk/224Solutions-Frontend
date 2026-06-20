/**
 * 🚀 HOOK DE PREFETCHING & CACHE INTELLIGENT
 * Précharge les données critiques au démarrage pour UX instantanée
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { smartCache, CACHE_TTL, CACHE_TAGS } from '@/lib/smartCache';

/**
 * Précharge les données les plus demandées au montage de l'app
 * Élimine le temps de chargement pour les écrans principaux
 */
export function usePrefetchCriticalData() {
  const queryClient = useQueryClient();
  const prefetched = useRef(false);

  useEffect(() => {
    if (prefetched.current) return;
    prefetched.current = true;

    // Prefetch en arrière-plan avec priorité
    const prefetch = async () => {
      try {
        // Priorité 1 : Données affichées sur la page d'accueil
        await Promise.allSettled([
          // Vendeurs actifs (carte + listings)
          queryClient.prefetchQuery({
            queryKey: ['vendors-active-cached'],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('vendors')
                .select('id, business_name, logo_url, latitude, longitude, business_type, rating, city')
                .eq('is_active', true)
                .limit(100);
              if (error) throw error;
              if (data) smartCache.set('vendors:active', data, CACHE_TTL.STANDARD, [CACHE_TAGS.VENDORS]);
              return data;
            },
            staleTime: CACHE_TTL.STANDARD,
          }),

          // Produits récents
          queryClient.prefetchQuery({
            queryKey: ['products-recent-cached'],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('products')
                .select('id, name, price, images, vendor_id, category_id, rating')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(20);
              if (error) throw error;
              if (data) smartCache.set('products:recent', data, CACHE_TTL.STANDARD, [CACHE_TAGS.PRODUCTS]);
              return data;
            },
            staleTime: CACHE_TTL.STANDARD,
          }),
        ]);

        // Priorité 2 : Données secondaires (avec délai pour ne pas bloquer)
        setTimeout(async () => {
          await Promise.allSettled([
            // Types de services
            queryClient.prefetchQuery({
              queryKey: ['service-types-cached'],
              queryFn: async () => {
                const { data } = await supabase
                  .from('service_types')
                  .select('id, name, code, icon, description')
                  .eq('is_active', true);
                if (data) smartCache.set('service_types:all', data, CACHE_TTL.STATIC, [CACHE_TAGS.CONFIG]);
                return data;
              },
              staleTime: CACHE_TTL.STATIC,
            }),

            // Restaurants (pour la carte)
            queryClient.prefetchQuery({
              queryKey: ['restaurants-cached'],
              queryFn: async () => {
                const { data } = await supabase
                  .from('professional_services')
                  .select('id, latitude, longitude, service_types!inner(code)')
                  .eq('status', 'active')
                  .not('latitude', 'is', null);
                return data;
              },
              staleTime: CACHE_TTL.STANDARD,
            }),
          ]);
        }, 2000);

        console.log('🚀 [Prefetch] Données critiques préchargées');
      } catch (e) {
        console.warn('⚠️ [Prefetch] Erreur non bloquante:', e);
      }
    };

    // Lancer le prefetch après que l'app soit interactive
    if (document.readyState === 'complete') {
      prefetch();
    } else {
      window.addEventListener('load', prefetch, { once: true });
    }
  }, [queryClient]);
}

/**
 * Hook pour obtenir les métriques de performance du cache
 */
export function useCacheMetrics() {
  const getMetrics = () => {
    const cacheMetrics = smartCache.getMetrics();
    return {
      cache: cacheMetrics,
      summary: {
        hitRate: `${cacheMetrics.hitRate}%`,
        entries: cacheMetrics.entriesCount,
        memory: `${cacheMetrics.memoryUsageMB}MB`,
        savedRequests: cacheMetrics.savedRequests,
      },
    };
  };

  return { getMetrics };
}

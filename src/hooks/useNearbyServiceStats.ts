/**
 * Hook: useNearbyServiceStats
 * Compte les services à proximité (rayon 20km) avec la MÊME position fallback que useGeoDistance.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeoDistance } from '@/hooks/useGeoDistance';

const RADIUS_KM = 20;

interface NearbyStats {
  boutiques: number;
  taxi: number;
  livraison: number;
  restaurants: number;
}

interface GeoPosition {
  latitude: number;
  longitude: number;
}

const statsCache = {
  data: null as NearbyStats | null,
  positionKey: '' as string,
  timestamp: 0,
  TTL: 60000,
};

function keyFromPosition(pos: GeoPosition) {
  // Arrondir pour éviter de recalculer à cause des micro-variations GPS
  return `${pos.latitude.toFixed(3)}:${pos.longitude.toFixed(3)}`;
}

export function useNearbyServiceStats() {
  const { userPosition, positionReady, DEFAULT_POSITION } = useGeoDistance();

  const [stats, setStats] = useState<NearbyStats>(() =>
    statsCache.data || { boutiques: 0, taxi: 0, livraison: 0, restaurants: 0 }
  );
  const [loading, setLoading] = useState(true);
  const isLoading = useRef(false);

  const loadNearbyStats = useCallback(async (origin: GeoPosition) => {
    const posKey = keyFromPosition(origin);

    if (statsCache.data && statsCache.positionKey === posKey && Date.now() - statsCache.timestamp < statsCache.TTL) {
      setStats(statsCache.data);
      setLoading(false);
      return;
    }

    if (isLoading.current) return;
    isLoading.current = true;
    setLoading(true);

    try {
      // ✅ 1 RPC (4 COUNT côté serveur) au lieu de 4 requêtes non limitées
      const { data, error } = await supabase.rpc('count_nearby_services' as any, {
        p_lat: origin.latitude,
        p_lng: origin.longitude,
        p_radius_km: RADIUS_KM,
      });
      if (error) throw error;

      const d = data as any;
      const newStats: NearbyStats = {
        boutiques: Number(d?.boutiques ?? 0),
        taxi: Number(d?.taxi ?? 0),
        livraison: Number(d?.livraison ?? 0),
        restaurants: Number(d?.restaurants ?? 0),
      };

      // Cache
      statsCache.data = newStats;
      statsCache.positionKey = posKey;
      statsCache.timestamp = Date.now();

      setStats(newStats);
    } catch (error) {
      console.error('[NearbyServiceStats] Error:', error);
    } finally {
      isLoading.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const origin = positionReady ? userPosition : DEFAULT_POSITION;
    void loadNearbyStats(origin);
  }, [positionReady, userPosition, DEFAULT_POSITION, loadNearbyStats]);

  // Refresh silencieux toutes les 60s (même TTL)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const origin = positionReady ? userPosition : DEFAULT_POSITION;
      void loadNearbyStats(origin);
    }, 60000);

    return () => window.clearInterval(interval);
  }, [positionReady, userPosition, DEFAULT_POSITION, loadNearbyStats]);

  return { stats, loading };
}

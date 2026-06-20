/**
 * Hook: useNearbyServiceStats
 * Compte les services à proximité (rayon 20km) avec la MÊME position fallback que useGeoDistance.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeoDistance, calculateDistance as calcDistanceFn } from '@/hooks/useGeoDistance';

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
      const [vendorsResult, taxiDriversResult, deliveryDriversResult, restaurantsResult] = await Promise.all([
        supabase
          .from('vendors')
          .select('id, latitude, longitude')
          .eq('is_active', true),
        supabase
          .from('taxi_drivers')
          .select('id, last_lat, last_lng')
          .eq('is_online', true)
          .in('status', ['online', 'available']),
        supabase
          .from('drivers')
          .select('id, current_location, last_location, is_online, status')
          .or('is_online.eq.true,status.eq.active,status.eq.online,status.eq.on_trip'),
        // Compter les restaurants actifs (professional_services avec service_type = restaurant)
        // Ne récupérer QUE ceux qui ont des coordonnées GPS valides
        supabase
          .from('professional_services')
          .select('id, latitude, longitude, service_types!inner(code)')
          .eq('status', 'active')
          .eq('service_types.code', 'restaurant')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
      ]);

      const parsePoint = (value: unknown): { lat: number; lng: number } | null => {
        if (!value) return null;
        const s = String(value);
        const match = s.match(/\(([^,]+),([^)]+)\)/);
        if (!match) return null;
        const lng = Number(match[1]);
        const lat = Number(match[2]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
      };

      const countInRadius = (items: any[] | null | undefined, getCoords: (item: any) => { lat: number; lng: number } | null) => {
        if (!items?.length) return 0;
        return items
          .map((item) => {
            const coords = getCoords(item);
            if (!coords) return null;
            const dist = calcDistanceFn(origin.latitude, origin.longitude, coords.lat, coords.lng);
            if (!Number.isFinite(dist)) return null;
            return dist;
          })
          .filter((dist) => dist !== null && dist <= RADIUS_KM).length;
      };

      const newStats: NearbyStats = {
        boutiques: countInRadius(vendorsResult.data, (v) => {
          const lat = v?.latitude;
          const lng = v?.longitude;
          if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
          return { lat: Number(lat), lng: Number(lng) };
        }),
        taxi: countInRadius(taxiDriversResult.data, (t) => {
          const lat = t?.last_lat;
          const lng = t?.last_lng;
          if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
          return { lat: Number(lat), lng: Number(lng) };
        }),
        livraison: countInRadius(deliveryDriversResult.data, (d) => parsePoint(d?.current_location) || parsePoint(d?.last_location)),
        restaurants: countInRadius(restaurantsResult.data, (r) => {
          const lat = r?.latitude;
          const lng = r?.longitude;
          if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
          return { lat: Number(lat), lng: Number(lng) };
        }),
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

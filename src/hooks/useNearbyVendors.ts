/**
 * HOOK: useNearbyVendors
 * Fetches vendors with proximity sorting and geolocation
 *
 * ✅ Utilise useGeoDistance pour la géolocalisation et le calcul de distance (centralisé)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance, useGeoDistance } from '@/hooks/useGeoDistance';

export interface NearbyVendor {
  id: string;
  business_name: string;
  description?: string | null;
  address?: string | null;
  logo_url?: string | null;
  rating?: number | null;
  city?: string | null;
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  business_type?: 'physical' | 'digital' | 'hybrid' | null;
  service_type?: 'wholesale' | 'retail' | 'mixed' | null;
  is_verified?: boolean | null;
  distance?: number; // Distance in km (calculated client-side)
}

interface UseNearbyVendorsOptions {
  enabled?: boolean;
  limit?: number;
  searchQuery?: string;
  businessTypeFilter?: 'physical' | 'digital' | 'hybrid' | 'all';
  serviceTypeFilter?: 'wholesale' | 'retail' | 'mixed' | 'all';
}

export function useNearbyVendors(options: UseNearbyVendorsOptions = {}) {
  const {
    enabled = true,
    limit = 50,
    searchQuery = '',
    businessTypeFilter = 'all',
    serviceTypeFilter = 'all',
  } = options;

  // ✅ Utiliser useGeoDistance pour la géolocalisation centralisée
  const { userPosition, positionReady, usingRealLocation, refreshPosition } = useGeoDistance();

  const [vendors, setVendors] = useState<NearbyVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Message d'erreur de localisation si GPS non disponible
  const locationError = useMemo(() => {
    if (!positionReady) return null;
    if (usingRealLocation) return null;
    return 'Position par défaut utilisée (Coyah)';
  }, [positionReady, usingRealLocation]);

  // Fetch vendors from database
  const fetchVendors = useCallback(async () => {
    if (!positionReady) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('vendors')
        .select(`
          id,
          business_name,
          description,
          address,
          logo_url,
          rating,
          city,
          neighborhood,
          latitude,
          longitude,
          business_type,
          service_type,
          is_verified
        `)
        .eq('is_active', true)
        .limit(limit);

      // Apply business type filter
      if (businessTypeFilter !== 'all') {
        query = query.eq('business_type', businessTypeFilter);
      }

      // Apply service type filter
      if (serviceTypeFilter !== 'all') {
        query = query.eq('service_type', serviceTypeFilter);
      }

      const { data, error: dbError } = await query;

      if (dbError) throw dbError;

      let vendorList: NearbyVendor[] = (data || []).map((vendor) => ({
        ...vendor,
        business_type: vendor.business_type as NearbyVendor['business_type'],
        service_type: vendor.service_type as NearbyVendor['service_type'],
      }));

      // Calculate distance using centralized calculateDistance function
      vendorList = vendorList.map((vendor) => {
        if (vendor.latitude && vendor.longitude) {
          const distance = calculateDistance(
            userPosition.latitude,
            userPosition.longitude,
            vendor.latitude,
            vendor.longitude
          );
          return { ...vendor, distance };
        }
        return { ...vendor, distance: undefined };
      });

      // Sort by distance (closest first), vendors without location go to end
      vendorList.sort((a, b) => {
        if (a.distance === undefined && b.distance === undefined) {
          // Both without location: sort by rating
          return (b.rating || 0) - (a.rating || 0);
        }
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      });

      // Apply search filter client-side (for reactivity)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        vendorList = vendorList.filter(
          (v) =>
            v.business_name.toLowerCase().includes(q) ||
            v.city?.toLowerCase().includes(q) ||
            v.neighborhood?.toLowerCase().includes(q) ||
            v.description?.toLowerCase().includes(q)
        );
      }

      setVendors(vendorList);
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError('Erreur lors du chargement des boutiques');
    } finally {
      setLoading(false);
    }
  }, [positionReady, userPosition, limit, businessTypeFilter, serviceTypeFilter, searchQuery]);

  // Fetch vendors when position is ready or filters change
  useEffect(() => {
    if (enabled && positionReady) {
      fetchVendors();
    }
  }, [enabled, positionReady, fetchVendors]);

  const refresh = useCallback(async () => {
    await refreshPosition();
    await fetchVendors();
  }, [refreshPosition, fetchVendors]);

  return {
    vendors,
    loading,
    error,
    userPosition,
    locationError,
    refresh,
    usingRealLocation,
  };
}

export default useNearbyVendors;

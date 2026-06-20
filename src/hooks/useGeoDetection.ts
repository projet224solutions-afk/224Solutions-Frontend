import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  COUNTRY_TO_CURRENCY,
  COUNTRY_TO_LANGUAGE,
  getCurrencyForCountry,
  getLanguageForCountry
} from '@/data/countryMappings';

interface GeoInfo {
  country: string;
  currency: string;
  language: string;
  detectionMethod: string;
  latitude?: number;
  longitude?: number;
}

interface UseGeoDetectionResult {
  geoInfo: GeoInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Demander la localisation GPS (avec consentement) */
  requestGpsLocation: () => Promise<boolean>;
  /** Forcer un rafraîchissement complet (ignore le cache) */
  forceRefresh: () => Promise<void>;
}

// Cache pour éviter les appels répétés
const GEO_CACHE_KEY = 'geo_detection_cache';
const GEO_CACHE_VERSION = 'v3'; // v3: force invalidation des caches fallback périmés
const GEO_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (réduit pour meilleure réactivité)

interface CachedGeo {
  data: GeoInfo;
  timestamp: number;
  version?: string;
}

let inFlightGeoDetectRequest: Promise<{ data: any; error: any }> | null = null;

function getCachedGeoRaw(): CachedGeo | null {
  try {
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedGeo = JSON.parse(cached);

    // Vérifier version ET expiration
    if (parsed.version === GEO_CACHE_VERSION && Date.now() - parsed.timestamp < GEO_CACHE_DURATION) {
      return parsed;
    }

    // Cache expiré ou ancienne version, le supprimer
    localStorage.removeItem(GEO_CACHE_KEY);
    localStorage.removeItem('user_country');
    localStorage.removeItem('marketplace_display_currency');
  } catch {}

  return null;
}

function getCachedGeo(): GeoInfo | null {
  return getCachedGeoRaw()?.data ?? null;
}

function setCachedGeo(data: GeoInfo) {
  // IMPORTANT: ne pas “figer” un fallback GN/GNF/FR dans le cache.
  // Si l'Edge Function échoue temporairement, on préfère retenter au prochain chargement.
  if (data.detectionMethod === 'fallback') return;

  try {
    localStorage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify({
        data,
        timestamp: Date.now(),
        version: GEO_CACHE_VERSION,
      })
    );
  } catch {}
}

function clearGeoCache() {
  try {
    localStorage.removeItem(GEO_CACHE_KEY);
  } catch {}
}

async function invokeGeoDetect(
  body: Record<string, unknown>,
  dedupe: boolean
): Promise<{ data: any; error: any }> {
  if (!dedupe) {
    return supabase.functions.invoke('geo-detect', { body });
  }

  if (!inFlightGeoDetectRequest) {
    inFlightGeoDetectRequest = supabase.functions
      .invoke('geo-detect', { body })
      .finally(() => {
        inFlightGeoDetectRequest = null;
      });
  }

  return inFlightGeoDetectRequest;
}

// Helper pour obtenir la position GPS
const getGpsPosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000, // Cache 5 minutes
    });
  });
};

export function useGeoDetection(): UseGeoDetectionResult {
  const { user } = useAuth();
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(getCachedGeo);
  const [loading, setLoading] = useState(!getCachedGeo());
  const [error, setError] = useState<string | null>(null);

  const detectGeo = useCallback(async (gpsCoords?: { lat: number; lng: number }, forceRefresh = false) => {
    try {
      setError(null);

      // Vérifier le cache d'abord (sauf si GPS fourni ou force refresh)
      // - Cache normal: on l'utilise et on s'arrête
      // - Cache fallback: on l'affiche mais on relance une détection réseau pour corriger
      if (!gpsCoords && !forceRefresh) {
        const cachedRaw = getCachedGeoRaw();
        const cached = cachedRaw?.data;

        if (cached) {
          // Geo cache hit (log suppressed to avoid spam)
          setGeoInfo(cached);

          const shouldRevalidate = cached.detectionMethod === 'fallback';
          if (!shouldRevalidate) {
            setLoading(false);
            return;
          }
        }
      }

      setLoading(true);

      // Si force refresh, vider le cache
      if (forceRefresh) {
        clearGeoCache();
      }

      // Pour utilisateur connecté, vérifier en base (sauf force refresh)
      if (user?.id && !gpsCoords && !forceRefresh) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('detected_country, detected_currency, detected_language, geo_detection_method')
          .eq('id', user.id)
          .single();

        if (profile?.detected_country && profile?.detected_currency) {
          const info: GeoInfo = {
            country: profile.detected_country,
            currency: profile.detected_currency,
            language: profile.detected_language || getLanguageForCountry(profile.detected_country),
            detectionMethod: profile.geo_detection_method || 'cached',
          };
          setGeoInfo(info);
          setCachedGeo(info);
          setLoading(false);
          return;
        }
      }

      // Utiliser l'Edge Function geo-detect (fonctionne pour tous, connectés ou non)
      try {
        const shouldDedupe = !gpsCoords && !forceRefresh;
        const { data, error: fnError } = await invokeGeoDetect(
          {
            user_id: user?.id || null,
            update_profile: !!user?.id, // Mettre à jour le profil seulement si connecté
            ...(gpsCoords && {
              gps_latitude: gpsCoords.lat,
              gps_longitude: gpsCoords.lng,
            }),
          },
          shouldDedupe
        );

        if (!fnError && data?.success) {
          const info: GeoInfo = {
            country: data.country,
            currency: data.currency,
            language: data.language || getLanguageForCountry(data.country),
            detectionMethod: data.detection_method,
            ...(gpsCoords && {
              latitude: gpsCoords.lat,
              longitude: gpsCoords.lng,
            }),
          };
          console.log(`🌍 Geo via edge function: pays=${info.country}, devise=${info.currency}, langue=${info.language}`);
          setGeoInfo(info);
          setCachedGeo(info);
          setLoading(false);
          return;
        }
      } catch (edgeError) {
        console.warn('Edge function geo-detect failed:', edgeError);
      }

      // Fallback: utiliser notre mapping côté client (si l'Edge Function échoue)
      // Note: ipapi.co ne fonctionne pas côté client à cause de CORS
      const fallbackInfo: GeoInfo = {
        country: 'GN',
        currency: 'GNF',
        language: 'fr',
        detectionMethod: 'fallback',
      };
      console.log('🌍 Geo fallback: pays=GN, devise=GNF');
      setGeoInfo(fallbackInfo);
      setCachedGeo(fallbackInfo);
    } catch (err) {
      console.error('Geo detection error:', err);
      setError(err instanceof Error ? err.message : 'Detection failed');
      const fallback: GeoInfo = {
        country: 'GN',
        currency: 'GNF',
        language: 'fr',
        detectionMethod: 'fallback',
      };
      setGeoInfo(fallback);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Demander la localisation GPS avec consentement
  const requestGpsLocation = useCallback(async (): Promise<boolean> => {
    try {
      const position = await getGpsPosition();
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      await detectGeo(coords, true); // Force refresh avec GPS
      return true;
    } catch (err) {
      console.warn('GPS location denied or failed:', err);
      return false;
    }
  }, [detectGeo]);

  // Forcer un rafraîchissement complet (ignore le cache)
  const forceRefresh = useCallback(async () => {
    await detectGeo(undefined, true);
  }, [detectGeo]);

  useEffect(() => {
    detectGeo();
  }, [detectGeo]);

  return {
    geoInfo,
    loading,
    error,
    refresh: () => detectGeo(),
    requestGpsLocation,
    forceRefresh,
  };
}

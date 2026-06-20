import { useState, useEffect, useCallback, useRef } from 'react';
import { getSafeBrowserGeo } from '@/lib/safeGeo';

const DEFAULT_POSITION = { latitude: 9.7085, longitude: -13.3856 }; // Coyah centre (zone des commerces)
const LOCATION_CACHE_KEY = '224solutions:geo-distance:last-good-position';
const LOCATION_CACHE_TTL_MS = 30 * 60_000;
const REAL_GPS_MAX_ACCURACY_METERS = 1500;
const ACCEPTABLE_GPS_MAX_ACCURACY_METERS = 8000;
const SIGNIFICANT_MOVE_KM = 0.05;
const SUSPICIOUS_JUMP_KM = 80;

type PositionSource = 'gps' | 'cache' | 'ip' | 'default';

interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: number;
  source?: PositionSource;
}

function isValidGeoPosition(position: Partial<GeoPosition> | null | undefined): position is GeoPosition {
  if (!position) return false;
  return Number.isFinite(Number(position.latitude)) && Number.isFinite(Number(position.longitude));
}

function readCachedPosition(): GeoPosition | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as GeoPosition;
    const age = Date.now() - Number(parsed?.timestamp || 0);
    if (!isValidGeoPosition(parsed) || age > LOCATION_CACHE_TTL_MS) {
      localStorage.removeItem(LOCATION_CACHE_KEY);
      return null;
    }

    return { ...parsed, source: 'cache' };
  } catch {
    return null;
  }
}

function persistCachedPosition(position: GeoPosition) {
  if (typeof window === 'undefined') return;
  if (!isValidGeoPosition(position)) return;

  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy ?? null,
      timestamp: position.timestamp ?? Date.now(),
    }));
  } catch {
    // Ignore cache errors silently
  }
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(distance: number | null | undefined): string {
  if (distance === null || distance === undefined) return 'Pas de GPS';
  if (!Number.isFinite(distance)) return 'Pas de GPS';
  if (distance < 0.05) return 'Ici';
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(1)} km`;
}

async function getIpFallbackPosition(): Promise<GeoPosition | null> {
  try {
    const data = getSafeBrowserGeo();
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
      accuracy: data.source === 'fallback' ? null : 5000,
      timestamp: Date.now(),
      source: data.source === 'fallback' ? 'default' : 'ip',
    };
  } catch {
    return null;
  }
}

export function useGeoDistance() {
  const cachedPosition = readCachedPosition();
  const initialPosition = cachedPosition || { ...DEFAULT_POSITION, accuracy: null, timestamp: Date.now(), source: 'default' as const };

  const [userPosition, setUserPosition] = useState<GeoPosition>(initialPosition);
  const [positionReady, setPositionReady] = useState(false);
  const [usingRealLocation, setUsingRealLocation] = useState(Boolean(cachedPosition));
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(cachedPosition?.accuracy ?? null);
  const [locationSource, setLocationSource] = useState<PositionSource>(cachedPosition?.source || 'default');

  const hasRealLocationRef = useRef(Boolean(cachedPosition));
  const lastKnownPositionRef = useRef<GeoPosition>(initialPosition);
  const watchIdRef = useRef<number | null>(null);

  const commitPosition = useCallback((position: GeoPosition) => {
    if (!isValidGeoPosition(position)) return;

    const normalized: GeoPosition = {
      latitude: Number(position.latitude),
      longitude: Number(position.longitude),
      accuracy: typeof position.accuracy === 'number' ? position.accuracy : null,
      timestamp: position.timestamp ?? Date.now(),
      source: position.source ?? 'default',
    };

    const isPreciseGps = normalized.source === 'cache' || (typeof normalized.accuracy === 'number' && normalized.accuracy <= REAL_GPS_MAX_ACCURACY_METERS);

    lastKnownPositionRef.current = normalized;
    if (isPreciseGps) {
      hasRealLocationRef.current = true;
      persistCachedPosition(normalized);
    }

    setUserPosition(normalized);
    setAccuracyMeters(normalized.accuracy ?? null);
    setLocationSource(normalized.source || 'default');
    setUsingRealLocation(isPreciseGps);
    setPositionReady(true);
  }, []);

  const resolveFallbackPosition = useCallback(async (): Promise<GeoPosition> => {
    const cached = readCachedPosition();
    if (cached) {
      return cached;
    }

    // N'utiliser le fallback "IP" que s'il s'agit d'une vraie position détectée (source 'ip').
    // Sinon (source 'default' = simple constante codée en dur côté safeGeo, hors zone des
    // commerces) on retombe sur DEFAULT_POSITION (Coyah) pour que la proximité reste pertinente.
    const ipFallback = await getIpFallbackPosition();
    if (ipFallback && ipFallback.source === 'ip') {
      return ipFallback;
    }

    return {
      ...DEFAULT_POSITION,
      accuracy: null,
      timestamp: Date.now(),
      source: 'default',
    };
  }, []);

  const requestPosition = useCallback((opts?: { force?: boolean }) => {
    return new Promise<GeoPosition>((resolve) => {
      if (!navigator.geolocation) {
        void resolveFallbackPosition().then((fallback) => {
          commitPosition(fallback);
          resolve(fallback);
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const candidate: GeoPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: Date.now(),
            source: 'gps',
          };

          const previous = lastKnownPositionRef.current;
          const movedKm = calculateDistance(previous.latitude, previous.longitude, candidate.latitude, candidate.longitude);
          const candidateAccuracy = typeof candidate.accuracy === 'number' ? candidate.accuracy : Number.POSITIVE_INFINITY;

          // Ignorer les sauts GPS très suspects quand la précision est mauvaise.
          if (hasRealLocationRef.current && movedKm > SUSPICIOUS_JUMP_KM && candidateAccuracy > REAL_GPS_MAX_ACCURACY_METERS) {
            setPositionReady(true);
            setUsingRealLocation(true);
            resolve(previous);
            return;
          }

          // Si la nouvelle mesure est très grossière mais qu'on a déjà une bonne position, garder la meilleure.
          if (hasRealLocationRef.current && candidateAccuracy > ACCEPTABLE_GPS_MAX_ACCURACY_METERS) {
            setPositionReady(true);
            setUsingRealLocation(true);
            resolve(previous);
            return;
          }

          commitPosition(candidate);
          resolve(candidate);
        },
        () => {
          void resolveFallbackPosition().then((fallback) => {
            commitPosition(fallback);
            resolve(fallback);
          });
        },
        {
          enableHighAccuracy: true,
          timeout: opts?.force ? 20000 : 12000,
          maximumAge: opts?.force ? 0 : 30000,
        }
      );
    });
  }, [commitPosition, resolveFallbackPosition]);

  useEffect(() => {
    void requestPosition();

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const candidate: GeoPosition = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now(),
          source: 'gps',
        };

        const prev = lastKnownPositionRef.current;
        const movedKm = calculateDistance(prev.latitude, prev.longitude, candidate.latitude, candidate.longitude);
        const candidateAccuracy = typeof candidate.accuracy === 'number' ? candidate.accuracy : Number.POSITIVE_INFINITY;

        // Ne pas remplacer une bonne position par une lecture trop imprécise.
        if (hasRealLocationRef.current && candidateAccuracy > ACCEPTABLE_GPS_MAX_ACCURACY_METERS) {
          setPositionReady(true);
          setUsingRealLocation(true);
          return;
        }

        // Ignorer les gros bonds quand la précision est faible.
        if (hasRealLocationRef.current && movedKm > SUSPICIOUS_JUMP_KM && candidateAccuracy > REAL_GPS_MAX_ACCURACY_METERS) {
          return;
        }

        commitPosition(candidate);

        if (movedKm <= SIGNIFICANT_MOVE_KM && positionReady) {
          return;
        }
      },
      () => {
        if (!hasRealLocationRef.current) {
          setUsingRealLocation(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [commitPosition, positionReady, requestPosition]);

  const refreshPosition = useCallback(() => requestPosition({ force: true }), [requestPosition]);

  const getDistanceTo = useCallback(
    (latitude: number | null | undefined, longitude: number | null | undefined): number | null => {
      if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
      return calculateDistance(userPosition.latitude, userPosition.longitude, Number(latitude), Number(longitude));
    },
    [userPosition.latitude, userPosition.longitude]
  );

  return {
    userPosition,
    positionReady,
    usingRealLocation,
    accuracyMeters,
    locationSource,
    refreshPosition,
    getDistanceTo,
    calculateDistance,
    formatDistance,
    DEFAULT_POSITION,
  };
}

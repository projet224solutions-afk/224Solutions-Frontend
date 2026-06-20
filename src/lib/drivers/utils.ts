/**
 * Utilitaires pour le traitement des drivers
 * 224Solutions - Optimisé
 */

import { calculateDistance } from '@/hooks/useGeoDistance';
import type { DriverPosition, NearbyDriver, DeliveryDriver, TaxiDriver, DriverProfile } from './types';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Vérifie si un driver est un DeliveryDriver
 */
export function isDeliveryDriver(driver: NearbyDriver): driver is DeliveryDriver {
  return driver.source === 'drivers';
}

/**
 * Vérifie si un driver est un TaxiDriver
 */
export function isTaxiDriver(driver: NearbyDriver): driver is TaxiDriver {
  return driver.source === 'taxi_drivers';
}

// ============================================================================
// Parsing des coordonnées
// ============================================================================

/**
 * Parse les coordonnées PostGIS POINT format: POINT(lng lat) ou (lng,lat)
 * @returns Position ou null si invalide
 */
export function parsePostGISPoint(value: unknown): DriverPosition | null {
  if (!value) return null;

  const str = String(value);

  // Format POINT(lng lat)
  const pointMatch = str.match(/POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/i);
  if (pointMatch) {
    const lng = parseFloat(pointMatch[1]);
    const lat = parseFloat(pointMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }

  // Format (lng,lat) - Supabase geography
  const parenMatch = str.match(/\(\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*\)/);
  if (parenMatch) {
    const lng = parseFloat(parenMatch[1]);
    const lat = parseFloat(parenMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Vérifie si les coordonnées sont valides
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Parse les coordonnées lat/lng directes
 */
export function parseDirectCoordinates(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined
): DriverPosition | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }

  const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;

  if (isValidCoordinate(parsedLat, parsedLng)) {
    return { lat: parsedLat, lng: parsedLng };
  }

  return null;
}

// ============================================================================
// Calculs de distance
// ============================================================================

/**
 * Calcule la distance entre deux positions
 * @returns Distance en km ou undefined si non calculable
 */
export function getDriverDistance(
  userPosition: DriverPosition,
  driverPosition: DriverPosition | null
): number | undefined {
  if (!driverPosition) return undefined;

  const distance = calculateDistance(
    userPosition.lat,
    userPosition.lng,
    driverPosition.lat,
    driverPosition.lng
  );

  return Number.isFinite(distance) ? distance : undefined;
}

/**
 * Formate la distance pour l'affichage
 */
export function formatDriverDistance(distance: number | undefined): string {
  if (distance === undefined) return '';
  if (distance < 1) return `${Math.round(distance * 1000)}m`;
  return `${distance.toFixed(1)}km`;
}

// ============================================================================
// Helpers pour NearbyDriver
// ============================================================================

/**
 * Obtient le nombre total de courses/livraisons d'un driver
 */
export function getDriverTotalTrips(driver: NearbyDriver): number {
  if (isDeliveryDriver(driver)) {
    return driver.total_deliveries ?? 0;
  }
  return driver.total_rides ?? 0;
}

/**
 * Obtient le nom complet du driver avec fallback
 */
export function getDriverDisplayName(driver: NearbyDriver): string {
  const firstName = driver.profile?.first_name;
  const lastName = driver.profile?.last_name;

  if (!firstName) return 'Livreur';

  const lastInitial = lastName ? ` ${lastName.charAt(0)}.` : '';
  return `${firstName}${lastInitial}`;
}

/**
 * Obtient le type de véhicule avec fallback
 */
export function getVehicleTypeDisplay(driver: NearbyDriver): string {
  return driver.vehicle_type || 'véhicule';
}

/**
 * Obtient la plaque du véhicule avec fallback (pour TaxiDriver)
 */
export function getVehiclePlateDisplay(driver: NearbyDriver): string {
  if (isTaxiDriver(driver)) {
    return driver.vehicle_plate || 'Plaque inconnue';
  }
  return '';
}

// ============================================================================
// Traitement des données brutes
// ============================================================================

/**
 * Transforme les données brutes de delivery driver en DeliveryDriver
 */
export function processDeliveryDriver(
  raw: Record<string, unknown>,
  userPosition: DriverPosition,
  profileMap: Map<string, DriverProfile>
): DeliveryDriver {
  const position = parsePostGISPoint(raw.current_location);
  const distance = getDriverDistance(userPosition, position);

  return {
    id: String(raw.id || ''),
    user_id: String(raw.user_id || ''),
    vehicle_type: String(raw.vehicle_type || 'moto'),
    status: String(raw.status || 'inactive'),
    is_online: Boolean(raw.is_online),
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    total_deliveries: typeof raw.total_deliveries === 'number' ? raw.total_deliveries : 0,
    current_lat: position?.lat,
    current_lng: position?.lng,
    distance,
    profile: profileMap.get(String(raw.user_id || '')) ?? null,
    source: 'drivers',
  };
}

/**
 * Transforme les données brutes de taxi driver en TaxiDriver
 */
export function processTaxiDriver(
  raw: Record<string, unknown>,
  userPosition: DriverPosition,
  profileMap: Map<string, DriverProfile>
): TaxiDriver {
  const position = parseDirectCoordinates(
    raw.last_lat as number | string | null | undefined,
    raw.last_lng as number | string | null | undefined
  );
  const distance = getDriverDistance(userPosition, position);

  const rawCategory = raw.taxi_category;
  const taxiCategory: 'car' | 'motorcycle' | null =
    rawCategory === 'car' ? 'car' : rawCategory === 'motorcycle' ? 'motorcycle' : null;

  return {
    id: String(raw.id || ''),
    user_id: String(raw.user_id || ''),
    vehicle_type: String(raw.vehicle_type || 'moto'),
    vehicle_plate: String(raw.vehicle_plate || ''),
    status: String(raw.status || 'inactive'),
    is_online: Boolean(raw.is_online),
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    total_rides: typeof raw.total_rides === 'number' ? raw.total_rides : 0,
    last_lat: position?.lat ?? null,
    last_lng: position?.lng ?? null,
    taxi_category: taxiCategory,
    distance,
    profile: profileMap.get(String(raw.user_id || '')) ?? null,
    source: 'taxi_drivers',
  };
}

// ============================================================================
// Filtrage et tri
// ============================================================================

/**
 * Filtre les drivers par rayon
 */
export function filterDriversByRadius<T extends { distance?: number }>(
  drivers: T[],
  radiusKm: number
): T[] {
  return drivers.filter(d => d.distance !== undefined && d.distance <= radiusKm);
}

/**
 * Trie les drivers par disponibilité, distance, puis rating
 */
export function sortDrivers<T extends { is_online: boolean; status: string; distance?: number; rating: number | null }>(
  drivers: T[]
): T[] {
  return [...drivers].sort((a, b) => {
    // Online first
    if (a.is_online && !b.is_online) return -1;
    if (!a.is_online && b.is_online) return 1;

    // Available first (pour taxi)
    if (a.status === 'available' && b.status !== 'available') return -1;
    if (b.status === 'available' && a.status !== 'available') return 1;

    // Then by distance
    if (a.distance !== undefined && b.distance !== undefined) {
      const distanceDiff = a.distance - b.distance;
      if (Math.abs(distanceDiff) > 0.1) {
        return distanceDiff;
      }
      // Si distances similaires, trier par rating
      const ratingA = a.rating ?? 0;
      const ratingB = b.rating ?? 0;
      return ratingB - ratingA;
    }
    if (a.distance !== undefined) return -1;
    if (b.distance !== undefined) return 1;

    // Si pas de distance, trier par rating
    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;
    return ratingB - ratingA;
  });
}

/**
 * Crée une map de profils à partir des données brutes
 */
export function createProfileMap(profiles: Array<Record<string, unknown>> | null): Map<string, DriverProfile> {
  const map = new Map<string, DriverProfile>();
  if (!profiles) return map;

  for (const p of profiles) {
    const id = p?.id;
    if (id) {
      map.set(String(id), {
        id: String(id),
        first_name: typeof p.first_name === 'string' ? p.first_name : null,
        last_name: typeof p.last_name === 'string' ? p.last_name : null,
        phone: typeof p.phone === 'string' ? p.phone : null,
        avatar_url: typeof p.avatar_url === 'string' ? p.avatar_url : null,
      });
    }
  }

  return map;
}

/**
 * Extrait les profils d'une liste de drivers avec jointure
 */
export function extractProfilesFromJoinedData(
  data: Array<Record<string, unknown>>
): Map<string, DriverProfile> {
  const map = new Map<string, DriverProfile>();

  for (const item of data) {
    const userId = item.user_id;
    const profiles = item.profiles as Record<string, unknown> | null;

    if (userId && profiles && profiles.id) {
      map.set(String(userId), {
        id: String(profiles.id),
        first_name: typeof profiles.first_name === 'string' ? profiles.first_name : null,
        last_name: typeof profiles.last_name === 'string' ? profiles.last_name : null,
        phone: typeof profiles.phone === 'string' ? profiles.phone : null,
        avatar_url: typeof profiles.avatar_url === 'string' ? profiles.avatar_url : null,
      });
    }
  }

  return map;
}

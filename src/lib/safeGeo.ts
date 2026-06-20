export interface SafeGeoInfo {
  countryCode: string;
  countryName: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  ip: string;
  source: 'cache' | 'fallback';
}

const DEFAULT_SAFE_GEO: SafeGeoInfo = {
  countryCode: 'GN',
  countryName: 'Guinée',
  city: 'Conakry',
  region: 'Conakry',
  latitude: 9.509167,
  longitude: -13.712222,
  ip: '0.0.0.0',
  source: 'fallback',
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function readJsonStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function normalizeCountryName(countryCode: string, fallback?: string): string {
  if (fallback?.trim()) return fallback.trim();
  if (countryCode === 'GN') return 'Guinée';
  return countryCode;
}

export function getSafeBrowserGeo(): SafeGeoInfo {
  const geoDetectionCache = readJsonStorage<{ data?: { country?: string; detectionMethod?: string } }>('geo_detection_cache');
  const locationCache = readJsonStorage<{ data?: { latitude?: number; longitude?: number; address?: string } }>('user_location_cache');

  const countryCode = geoDetectionCache?.data?.country?.trim()?.toUpperCase() || DEFAULT_SAFE_GEO.countryCode;
  const address = locationCache?.data?.address?.trim() || '';
  const [cityFromAddress, regionFromAddress] = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    countryCode,
    countryName: normalizeCountryName(countryCode),
    city: cityFromAddress ? toTitleCase(cityFromAddress) : DEFAULT_SAFE_GEO.city,
    region: regionFromAddress ? toTitleCase(regionFromAddress) : DEFAULT_SAFE_GEO.region,
    latitude: Number(locationCache?.data?.latitude) || DEFAULT_SAFE_GEO.latitude,
    longitude: Number(locationCache?.data?.longitude) || DEFAULT_SAFE_GEO.longitude,
    ip: DEFAULT_SAFE_GEO.ip,
    source: geoDetectionCache?.data?.country ? 'cache' : 'fallback',
  };
}

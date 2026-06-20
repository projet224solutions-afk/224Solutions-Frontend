/**
 * Hook pour détecter automatiquement la localisation de l'utilisateur
 * Utilise GPS + reverse geocoding via Google Maps API
 */

import { useState, useEffect, useCallback } from 'react';
import { mapService } from '@/services/mapService';
import { getSafeBrowserGeo } from '@/lib/safeGeo';

interface UserLocation {
  latitude: number;
  longitude: number;
  address: string;
  accuracy?: number;
}

interface UseUserLocationResult {
  location: UserLocation | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Cache de localisation
const LOCATION_CACHE_KEY = 'user_location_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function getCachedLocation(): UserLocation | null {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (e) {
    console.warn('Erreur lecture cache localisation:', e);
  }
  return null;
}

function setCachedLocation(location: UserLocation): void {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
      data: location,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Erreur écriture cache localisation:', e);
  }
}

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(getCachedLocation);
  const [loading, setLoading] = useState(!getCachedLocation());
  const [error, setError] = useState<string | null>(null);

  const detectLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Obtenir la position GPS
      const position = await mapService.getCurrentPosition();

      // 2. Reverse geocoding pour obtenir l'adresse
      const address = await mapService.reverseGeocode(position.latitude, position.longitude);

      // 3. Formater l'adresse (prendre seulement ville/quartier)
      const formattedAddress = formatAddress(address);

      const userLocation: UserLocation = {
        latitude: position.latitude,
        longitude: position.longitude,
        address: formattedAddress,
        accuracy: undefined
      };

      setLocation(userLocation);
      setCachedLocation(userLocation);

      console.log('📍 Localisation détectée:', userLocation);
    } catch (err: any) {
      console.error('❌ Erreur détection localisation:', err);

      // Fallback: essayer la géolocalisation IP
      try {
        const ipLocation = await detectLocationByIP();
        setLocation(ipLocation);
        setCachedLocation(ipLocation);
      } catch (_ipErr) {
        setError(err.message || 'Impossible de détecter la localisation');
        // Garder la localisation par défaut
        setLocation({
          latitude: 9.509167,
          longitude: -13.712222,
          address: 'Conakry, Guinée'
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Détecter la localisation au montage
  useEffect(() => {
    if (!getCachedLocation()) {
      detectLocation();
    }
  }, [detectLocation]);

  return {
    location,
    loading,
    error,
    refresh: detectLocation
  };
}

// Formater l'adresse pour n'afficher que les infos pertinentes
function formatAddress(fullAddress: string): string {
  if (!fullAddress || fullAddress === 'Adresse inconnue') {
    return 'Conakry, Guinée';
  }

  // Extraire les parties importantes de l'adresse
  const parts = fullAddress.split(',').map(p => p.trim());

  // Prendre les 2 premières parties significatives (quartier, ville)
  const relevantParts = parts.slice(0, 2).filter(p => p.length > 0);

  if (relevantParts.length === 0) {
    return 'Conakry, Guinée';
  }

  return relevantParts.join(', ');
}

// Fallback: détection par IP
async function detectLocationByIP(): Promise<UserLocation> {
  const data = getSafeBrowserGeo();

  return {
    latitude: data.latitude || 9.509167,
    longitude: data.longitude || -13.712222,
    address: `${data.city || 'Conakry'}, ${data.countryName || 'Guinée'}`,
    accuracy: data.source === 'fallback' ? undefined : 5000,
  };
}

export default useUserLocation;

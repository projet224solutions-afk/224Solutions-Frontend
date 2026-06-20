/**
 * PRECISION GEOLOCATION SERVICE
 * Service centralisé pour GPS ultra-précis et géocodage Google Maps
 * 224Solutions - Taxi-Moto & Livraison
 */

import { supabase } from '@/integrations/supabase/client';

// Types
export interface PreciseLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  formattedAddress?: string;
  placeId?: string;
}

export interface AddressSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string;
  name?: string;
  latitude: number;
  longitude: number;
  types: string[];
  addressComponents: {
    streetNumber: string;
    street: string;
    neighborhood: string;
    city: string;
    region: string;
    country: string;
    postalCode: string;
  };
}

export interface RouteInfo {
  distance: {
    value: number; // meters
    text: string;
  };
  duration: {
    value: number; // seconds
    text: string;
  };
  startAddress: string;
  endAddress: string;
  polyline: string;
}

// Configuration GPS - Plus tolérant pour éviter les déconnexions intempestives
export const GPS_CONFIG = {
  MIN_ACCURACY_METERS: 500, // Précision minimale très tolérante (mètres)
  ACCEPTABLE_ACCURACY_METERS: 100, // Précision acceptable pour navigation
  HIGH_ACCURACY_METERS: 30, // Haute précision souhaitée
  TIMEOUT_MS: 30000, // Timeout pour acquisition GPS
  MAX_AGE_MS: 120000, // Âge maximum de la position en cache (2 min)
  HEARTBEAT_INTERVAL_MS: 15000, // Intervalle mise à jour conducteur (15s)
  STALE_THRESHOLD_MS: 600000, // 10 minutes - seuil position obsolète
};

/**
 * Service de géolocalisation de précision
 */
class PrecisionGeolocationService {
  private sessionToken: string;
  private watchId: number | null = null;

  constructor() {
    this.sessionToken = this.generateSessionToken();
  }

  /**
   * Génère un token de session unique pour Google Places API
   */
  private generateSessionToken(): string {
    return crypto.randomUUID();
  }

  /**
   * Renouvelle le token de session (à appeler après chaque sélection)
   */
  renewSessionToken(): void {
    this.sessionToken = this.generateSessionToken();
  }

  /**
   * Obtient la position GPS avec haute précision
   */
  async getCurrentPosition(requireHighAccuracy = true): Promise<PreciseLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée'));
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: requireHighAccuracy,
        timeout: GPS_CONFIG.TIMEOUT_MS,
        maximumAge: requireHighAccuracy ? 0 : GPS_CONFIG.MAX_AGE_MS,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: PreciseLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          };

          // Vérifier la précision
          if (requireHighAccuracy && position.coords.accuracy > GPS_CONFIG.MIN_ACCURACY_METERS) {
            console.warn(`[GPS] Précision insuffisante: ${position.coords.accuracy}m > ${GPS_CONFIG.MIN_ACCURACY_METERS}m`);
          }

          console.log('[GPS] Position obtenue:', {
            lat: location.latitude.toFixed(6),
            lng: location.longitude.toFixed(6),
            accuracy: `${location.accuracy.toFixed(1)}m`,
          });

          resolve(location);
        },
        (error) => {
          const errorMessages: Record<number, string> = {
            1: 'Permission GPS refusée. Veuillez autoriser l\'accès à la localisation.',
            2: 'Position GPS indisponible. Vérifiez que le GPS est activé.',
            3: 'Délai GPS dépassé. Veuillez réessayer.',
          };
          reject(new Error(errorMessages[error.code] || 'Erreur GPS inconnue'));
        },
        options
      );
    });
  }

  /**
   * Démarre le suivi GPS continu
   */
  startWatching(
    onUpdate: (location: PreciseLocation) => void,
    onError?: (error: Error) => void
  ): number {
    if (!navigator.geolocation) {
      onError?.(new Error('Géolocalisation non supportée'));
      return -1;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: PreciseLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        };
        onUpdate(location);
      },
      (error) => {
        const errorMessages: Record<number, string> = {
          1: 'Permission GPS refusée',
          2: 'Position GPS indisponible',
          3: 'Délai GPS dépassé',
        };
        onError?.(new Error(errorMessages[error.code] || 'Erreur GPS'));
      },
      {
        enableHighAccuracy: true,
        timeout: GPS_CONFIG.TIMEOUT_MS,
        maximumAge: GPS_CONFIG.HEARTBEAT_INTERVAL_MS,
      }
    );

    return this.watchId;
  }

  /**
   * Arrête le suivi GPS
   */
  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Vérifie si la précision GPS est suffisante
   */
  isAccuracySufficient(accuracy: number): boolean {
    return accuracy <= GPS_CONFIG.MIN_ACCURACY_METERS;
  }

  /**
   * Vérifie si la précision GPS est haute
   */
  isHighAccuracy(accuracy: number): boolean {
    return accuracy <= GPS_CONFIG.HIGH_ACCURACY_METERS;
  }

  /**
   * Recherche d'adresses avec autocomplétion Google Places
   */
  async searchAddresses(
    query: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<AddressSuggestion[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          action: 'autocomplete',
          query: query.trim(),
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          sessionToken: this.sessionToken,
        },
      });

      if (error) throw error;

      return data?.predictions || [];
    } catch (error) {
      console.error('[PrecisionGeo] Erreur autocomplete:', error);
      return [];
    }
  }

  /**
   * Obtient les détails d'un lieu (coordonnées précises)
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    if (!placeId) return null;

    try {
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          action: 'details',
          placeId,
          sessionToken: this.sessionToken,
        },
      });

      if (error) throw error;

      // Renouveler le token après sélection
      this.renewSessionToken();

      return data?.place || null;
    } catch (error) {
      console.error('[PrecisionGeo] Erreur place details:', error);
      return null;
    }
  }

  /**
   * Géocodage inverse (coordonnées → adresse)
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<PlaceDetails | null> {
    try {
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          action: 'reverse',
          latitude,
          longitude,
        },
      });

      if (error) throw error;

      return data?.place || null;
    } catch (error) {
      console.error('[PrecisionGeo] Erreur reverse geocode:', error);
      return null;
    }
  }

  /**
   * Calcule l'itinéraire entre deux points (routes réelles)
   */
  async calculateRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<RouteInfo | null> {
    try {
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          action: 'directions',
          origin,
          destination,
        },
      });

      if (error) throw error;

      if (data?.status === 'OK') {
        return {
          distance: data.distance,
          duration: data.duration,
          startAddress: data.startAddress,
          endAddress: data.endAddress,
          polyline: data.polyline,
        };
      }

      return null;
    } catch (error) {
      console.error('[PrecisionGeo] Erreur calcul route:', error);

      // Fallback: calcul à vol d'oiseau (Haversine)
      const distance = this.calculateHaversineDistance(
        origin.latitude, origin.longitude,
        destination.latitude, destination.longitude
      );

      return {
        distance: {
          value: Math.round(distance * 1000),
          text: `${distance.toFixed(1)} km (estimé)`,
        },
        duration: {
          value: Math.round(distance * 2.5 * 60), // ~24 km/h en ville
          text: `${Math.round(distance * 2.5)} min (estimé)`,
        },
        startAddress: `${origin.latitude.toFixed(6)}, ${origin.longitude.toFixed(6)}`,
        endAddress: `${destination.latitude.toFixed(6)}, ${destination.longitude.toFixed(6)}`,
        polyline: '',
      };
    }
  }

  /**
   * Calcul distance Haversine (fallback)
   */
  calculateHaversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Rayon Terre en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Ouvre Google Maps pour la navigation
   */
  openGoogleMapsNavigation(
    destination: { latitude: number; longitude: number },
    destinationName?: string
  ): void {
    const url = destinationName
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationName)}&destination_place_id=&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;

    window.open(url, '_blank');
  }

  /**
   * Ouvre Google Maps avec itinéraire complet
   */
  openGoogleMapsRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): void {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    window.open(url, '_blank');
  }
}

// Export singleton
export const precisionGeoService = new PrecisionGeolocationService();
export default precisionGeoService;

// Service de gestion des cartes (Maps) pour 224Solutions
// Utilise Mapbox pour les calculs de routes réelles

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Route {
  distance: number;
  duration: number;
  coordinates: Location[];
}

export interface GeocodeResult {
  address: string;
  coordinates: Location;
}

class MapService {
  // Calculer la distance entre deux points (formule de Haversine)
  calculateDistance(point1: Location, point2: Location): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.latitude)) * Math.cos(this.toRad(point2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Obtenir la position actuelle de l'utilisateur
  async getCurrentPosition(): Promise<Location> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  // Calculer un itinéraire via Google Directions API
  async calculateRoute(start: Location, end: Location): Promise<Route> {
    try {
      console.log('[MapService] Calculating route from', start, 'to', end);

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          origin: { lat: start.latitude, lng: start.longitude },
          destination: { lat: end.latitude, lng: end.longitude },
          mode: 'driving'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[MapService] Route data received:', data);

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        distance: data.distance, // déjà en km
        duration: data.duration, // déjà en minutes
        coordinates: [start, end]
      };
    } catch (error) {
      console.error('Erreur Google Directions API, utilisation du fallback:', error);
      // Fallback: calcul simple
      const distance = this.calculateDistance(start, end);
      return {
        distance,
        duration: distance * 3,
        coordinates: [start, end]
      };
    }
  }

  // Géocode une adresse via Google Geocoding API
  async geocodeAddress(address: string): Promise<GeocodeResult[]> {
    try {
      console.log('[MapService] Geocoding address:', address);

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(`${SUPABASE_URL}/functions/v1/geocode-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          address,
          type: 'geocode'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[MapService] Geocoding results:', data);

      // Gérer le cas où aucun résultat n'est trouvé
      if (data.status === 'ZERO_RESULTS') {
        console.warn('[MapService] No geocoding results:', data.message);
        return [];
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.results && data.results.length > 0) {
        return data.results.map((result: any) => ({
          address: result.formatted_address,
          coordinates: {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng
          }
        }));
      }

      return [];
    } catch (error) {
      console.error('Erreur géocodage Google:', error);
      return [{
        address: address,
        coordinates: { latitude: 0, longitude: 0 }
      }];
    }
  }

  // Reverse geocoding: coordonnées → adresse
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(`${SUPABASE_URL}/functions/v1/geocode-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          lat: latitude,
          lng: longitude,
          type: 'reverse'
        })
      });

      const data = await response.json();

      // Gérer le cas où aucun résultat n'est trouvé
      if (data.status === 'ZERO_RESULTS') {
        console.warn('[MapService] No reverse geocoding results:', data.message);
        return 'Adresse inconnue';
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }

      return 'Adresse inconnue';
    } catch (error) {
      console.error('Erreur reverse geocoding Google:', error);
      return 'Adresse inconnue';
    }
  }

  // Obtenir un itinéraire (alias de calculateRoute)
  async getRoute(origin: Location, destination: Location): Promise<Route> {
    return this.calculateRoute(origin, destination);
  }
}

export const mapService = new MapService();

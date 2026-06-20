/**
 * HOOK GPS LOCATION UNIVERSEL - 224SOLUTIONS
 * Hook réutilisable pour géolocalisation avec fallback et error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GPSError {
  code: number;
  message: string;
  userMessage: string;
  suggestions: string[];
}

interface UseGPSLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watchPosition?: boolean;
  onLocationChange?: (location: GPSLocation) => void;
  onError?: (error: GPSError) => void;
}

export function useGPSLocation(options: UseGPSLocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 10000,
    watchPosition = false,
    onLocationChange,
    onError
  } = options;

  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GPSError | null>(null);
  const [isWatching, setIsWatching] = useState(false);

  const watchIdRef = useRef<number | null>(null);

  /**
   * Convertir GeolocationPositionError en GPSError avec messages user-friendly
   */
  const handleGeolocationError = useCallback((err: GeolocationPositionError): GPSError => {
    let userMessage = '';
    let suggestions: string[] = [];

    switch (err.code) {
      case 1: // PERMISSION_DENIED
        userMessage = 'Permission GPS refusée';
        suggestions = [
          'Autorisez l\'accès GPS dans les paramètres de votre navigateur',
          'Vérifiez les paramètres de confidentialité de votre appareil',
          'Sur mobile, activez la localisation dans les paramètres système'
        ];
        break;
      case 2: // POSITION_UNAVAILABLE
        userMessage = 'Position GPS indisponible';
        suggestions = [
          'Activez le GPS sur votre appareil',
          'Vérifiez votre connexion internet',
          'Déplacez-vous dans un endroit avec meilleur signal'
        ];
        break;
      case 3: // TIMEOUT
        userMessage = 'Délai GPS dépassé';
        suggestions = [
          'Allez à l\'extérieur pour un meilleur signal',
          'Activez le WiFi pour une localisation plus rapide',
          'Patientez quelques secondes et réessayez'
        ];
        break;
      default:
        userMessage = 'Erreur GPS inconnue';
        suggestions = [
          'Rechargez la page et réessayez',
          'Vérifiez vos paramètres de localisation'
        ];
    }

    return {
      code: err.code,
      message: err.message,
      userMessage,
      suggestions
    };
  }, []);

  /**
   * Obtenir la position actuelle (single shot)
   */
  const getCurrentLocation = useCallback(async (): Promise<GPSLocation> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const error: GPSError = {
          code: 0,
          message: 'Geolocation not supported',
          userMessage: 'GPS non disponible sur cet appareil',
          suggestions: ['Utilisez un appareil avec GPS', 'Essayez un autre navigateur']
        };
        setError(error);
        if (onError) onError(error);
        reject(error);
        return;
      }

      setLoading(true);
      setError(null);

      // Stratégie avec fallback: essayer haute précision d'abord, puis mode rapide
      const tryGetPosition = (highAccuracy: boolean, timeoutMs: number) => {
        return new Promise<GeolocationPosition>((resolvePos, rejectPos) => {
          navigator.geolocation.getCurrentPosition(
            resolvePos,
            rejectPos,
            {
              enableHighAccuracy: highAccuracy,
              timeout: timeoutMs,
              maximumAge
            }
          );
        });
      };

      // Essayer haute précision d'abord
      tryGetPosition(enableHighAccuracy, timeout)
        .then(position => {
          const loc: GPSLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };

          setLocation(loc);
          setLoading(false);

          if (onLocationChange) onLocationChange(loc);
          resolve(loc);
        })
        .catch(_err => {
          // Si haute précision échoue, essayer mode rapide
          console.warn('[useGPSLocation] High accuracy failed, trying fast mode...');

          tryGetPosition(false, 5000)
            .then(position => {
              const loc: GPSLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
              };

              setLocation(loc);
              setLoading(false);

              toast.warning('Position obtenue en mode rapide (précision réduite)');

              if (onLocationChange) onLocationChange(loc);
              resolve(loc);
            })
            .catch(fallbackErr => {
              const gpsError = handleGeolocationError(fallbackErr);
              setError(gpsError);
              setLoading(false);

              if (onError) onError(gpsError);
              reject(gpsError);
            });
        });
    });
  }, [enableHighAccuracy, timeout, maximumAge, onLocationChange, onError, handleGeolocationError]);

  /**
   * Démarrer le suivi de position en continu
   */
  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      const error: GPSError = {
        code: 0,
        message: 'Geolocation not supported',
        userMessage: 'GPS non disponible',
        suggestions: []
      };
      setError(error);
      if (onError) onError(error);
      return;
    }

    if (watchIdRef.current !== null) {
      console.warn('[useGPSLocation] Already watching position');
      return;
    }

    setIsWatching(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const loc: GPSLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        setLocation(loc);
        setError(null); // Effacer les erreurs précédentes quand on a une position
        if (onLocationChange) onLocationChange(loc);
      },
      (err) => {
        const gpsError = handleGeolocationError(err);
        // Ne pas effacer la dernière position connue même si erreur
        // Juste logger l'erreur sans bloquer
        console.warn('[useGPSLocation] Watch error (continuing with last known position):', gpsError.userMessage);
        setError(gpsError);
        // Seulement notifier l'erreur si callback fourni, mais ne pas arrêter le suivi
        if (onError) onError(gpsError);
      },
      {
        enableHighAccuracy,
        timeout: 30000, // Timeout plus long pour le suivi continu
        maximumAge: 60000 // Accepter des positions plus anciennes
      }
    );

    console.log('[useGPSLocation] Started watching position:', watchIdRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableHighAccuracy, timeout, maximumAge, onLocationChange, onError, handleGeolocationError]);

  /**
   * Arrêter le suivi de position
   */
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      console.log('[useGPSLocation] Stopped watching position:', watchIdRef.current);
      watchIdRef.current = null;
      setIsWatching(false);
    }
  }, []);

  /**
   * Cleanup automatique au démontage du composant
   */
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        console.log('[useGPSLocation] Cleanup: stopped watching position');
      }
    };
  }, []);

  /**
   * Démarrer le watch automatiquement si l'option est activée
   */
  useEffect(() => {
    if (watchPosition && !isWatching) {
      startWatching();
    }
  }, [watchPosition, isWatching, startWatching]);

  /**
   * Recharger la position (force refresh)
   */
  const refreshLocation = useCallback(async () => {
    if (isWatching) {
      stopWatching();
      await new Promise(resolve => setTimeout(resolve, 100));
      startWatching();
    } else {
      await getCurrentLocation();
    }
  }, [isWatching, stopWatching, startWatching, getCurrentLocation]);

  return {
    location,
    loading,
    error,
    isWatching,
    getCurrentLocation,
    startWatching,
    stopWatching,
    refreshLocation
  };
}

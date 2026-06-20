/**
 * HOOK GPS HAUTE PRÉCISION
 * Gestion GPS ultra-précise pour conducteurs et livreurs
 * 224Solutions - Taxi-Moto & Livraison
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  precisionGeoService,
  PreciseLocation,
  GPS_CONFIG
} from '@/services/gps/PrecisionGeolocationService';

export interface PrecisionGPSState {
  location: PreciseLocation | null;
  isTracking: boolean;
  isHighAccuracy: boolean;
  isSufficientAccuracy: boolean;
  accuracy: number | null;
  error: string | null;
  lastUpdate: number | null;
}

export interface UsePrecisionGPSOptions {
  autoStart?: boolean;
  requireHighAccuracy?: boolean;
  onLocationUpdate?: (location: PreciseLocation) => void;
  onAccuracyInsufficient?: () => void;
  onError?: (error: string) => void;
}

/**
 * Hook pour GPS haute précision (conducteurs/livreurs)
 */
export function usePrecisionGPS(options: UsePrecisionGPSOptions = {}) {
  const {
    autoStart = false,
    requireHighAccuracy = true,
    onLocationUpdate,
    onAccuracyInsufficient,
    onError,
  } = options;

  const [state, setState] = useState<PrecisionGPSState>({
    location: null,
    isTracking: false,
    isHighAccuracy: false,
    isSufficientAccuracy: false,
    accuracy: null,
    error: null,
    lastUpdate: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const accuracyWarningShownRef = useRef(false);

  /**
   * Obtient la position actuelle une fois
   */
  const getCurrentLocation = useCallback(async (): Promise<PreciseLocation | null> => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const location = await precisionGeoService.getCurrentPosition(requireHighAccuracy);

      const isHighAccuracy = precisionGeoService.isHighAccuracy(location.accuracy);
      const isSufficientAccuracy = precisionGeoService.isAccuracySufficient(location.accuracy);

      setState(prev => ({
        ...prev,
        location,
        accuracy: location.accuracy,
        isHighAccuracy,
        isSufficientAccuracy,
        lastUpdate: Date.now(),
        error: null,
      }));

      // Avertir si précision insuffisante
      if (requireHighAccuracy && !isSufficientAccuracy) {
        onAccuracyInsufficient?.();
        if (!accuracyWarningShownRef.current) {
          toast.warning(`Précision GPS: ${location.accuracy.toFixed(0)}m - Déplacez-vous vers un espace dégagé`, {
            duration: 5000,
          });
          accuracyWarningShownRef.current = true;
        }
      }

      onLocationUpdate?.(location);
      return location;
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur GPS';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
      return null;
    }
  }, [requireHighAccuracy, onLocationUpdate, onAccuracyInsufficient, onError]);

  /**
   * Démarre le suivi GPS continu
   */
  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) return;

    setState(prev => ({ ...prev, isTracking: true, error: null }));
    accuracyWarningShownRef.current = false;

    watchIdRef.current = precisionGeoService.startWatching(
      (location) => {
        const isHighAccuracy = precisionGeoService.isHighAccuracy(location.accuracy);
        const isSufficientAccuracy = precisionGeoService.isAccuracySufficient(location.accuracy);

        setState(prev => ({
          ...prev,
          location,
          accuracy: location.accuracy,
          isHighAccuracy,
          isSufficientAccuracy,
          lastUpdate: Date.now(),
          error: null,
        }));

        // Avertir si précision devient insuffisante
        if (requireHighAccuracy && !isSufficientAccuracy) {
          onAccuracyInsufficient?.();
        }

        onLocationUpdate?.(location);
      },
      (error) => {
        const errorMessage = error.message;
        setState(prev => ({ ...prev, error: errorMessage }));
        onError?.(errorMessage);
      }
    );

    console.log('[usePrecisionGPS] Suivi GPS démarré');
  }, [requireHighAccuracy, onLocationUpdate, onAccuracyInsufficient, onError]);

  /**
   * Arrête le suivi GPS
   */
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      precisionGeoService.stopWatching();
      watchIdRef.current = null;
    }

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isTracking: false,
    }));

    console.log('[usePrecisionGPS] Suivi GPS arrêté');
  }, []);

  /**
   * Démarre le heartbeat GPS (mise à jour périodique serveur)
   */
  const startHeartbeat = useCallback((
    updateCallback: (location: PreciseLocation) => Promise<void>
  ) => {
    if (heartbeatRef.current) return;

    heartbeatRef.current = setInterval(async () => {
      const { location, isSufficientAccuracy } = state;

      if (location && isSufficientAccuracy) {
        try {
          await updateCallback(location);
        } catch (error) {
          console.error('[usePrecisionGPS] Erreur heartbeat:', error);
        }
      }
    }, GPS_CONFIG.HEARTBEAT_INTERVAL_MS);

    console.log('[usePrecisionGPS] Heartbeat démarré');
  }, [state]);

  /**
   * Arrête le heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      console.log('[usePrecisionGPS] Heartbeat arrêté');
    }
  }, []);

  /**
   * Vérifie si le GPS est disponible
   */
  const checkGPSAvailability = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée par votre navigateur');
      return false;
    }

    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (permission.state === 'denied') {
          toast.error('Permission GPS refusée. Veuillez l\'autoriser dans les paramètres.');
          return false;
        }
      }
      return true;
    } catch {
      return true; // Supposer disponible si impossible de vérifier
    }
  }, []);

  // Auto-start si configuré
  useEffect(() => {
    if (autoStart) {
      getCurrentLocation();
    }
  }, [autoStart, getCurrentLocation]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      stopTracking();
      stopHeartbeat();
    };
  }, [stopTracking, stopHeartbeat]);

  return {
    ...state,
    getCurrentLocation,
    startTracking,
    stopTracking,
    startHeartbeat,
    stopHeartbeat,
    checkGPSAvailability,
  };
}

export default usePrecisionGPS;

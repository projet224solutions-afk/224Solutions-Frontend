/**
 * HOOK GÉOLOCALISATION
 * Gestion de la géolocalisation pour les taxis-motos
 * 224Solutions - Bureau Syndicat System
 */

import { useState, useEffect, useCallback } from 'react';

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
    address?: string;
}

export interface GeolocationState {
    location: LocationData | null;
    loading: boolean;
    error: string | null;
    permission: PermissionState | null;
}

export function useCurrentLocation() {
    const [state, setState] = useState<GeolocationState>({
        location: null,
        loading: false,
        error: null,
        permission: null
    });

    const getCurrentLocation = useCallback((): Promise<LocationData> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                const error = new Error('Géolocalisation non supportée par votre navigateur');
                setState(prev => ({ ...prev, error: error.message }));
                reject(error);
                return;
            }

            setState(prev => ({ ...prev, loading: true, error: null }));

            // Détecter si on est sur mobile ou desktop
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // Stratégie adaptée: desktop = moins précis mais plus rapide, mobile = GPS précis
            const tryGetPosition = (highAccuracy: boolean, timeout: number, maxAge: number): Promise<LocationData> => {
                return new Promise((res, rej) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const locationData: LocationData = {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                accuracy: position.coords.accuracy,
                                timestamp: Date.now()
                            };
                            res(locationData);
                        },
                        (error) => rej(error),
                        {
                            enableHighAccuracy: highAccuracy,
                            timeout: timeout,
                            maximumAge: maxAge
                        }
                    );
                });
            };

            // Sur desktop: essayer d'abord avec basse précision (IP-based, plus rapide)
            // Sur mobile: essayer avec haute précision (GPS)
            const attemptLocation = async () => {
                try {
                    let locationData: LocationData;

                    if (isMobile) {
                        // Mobile: GPS haute précision
                        try {
                            locationData = await tryGetPosition(true, 30000, 60000);
                        } catch {
                            // Fallback basse précision sur mobile
                            locationData = await tryGetPosition(false, 20000, 120000);
                        }
                    } else {
                        // Desktop: basse précision d'abord (géolocalisation IP)
                        try {
                            locationData = await tryGetPosition(false, 15000, 300000);
                        } catch {
                            // Fallback: essayer haute précision avec long timeout
                            locationData = await tryGetPosition(true, 30000, 60000);
                        }
                    }

                    setState(prev => ({
                        ...prev,
                        location: locationData,
                        loading: false,
                        error: null
                    }));

                    console.log('📍 [GPS] Position obtenue:', {
                        lat: locationData.latitude,
                        lng: locationData.longitude,
                        accuracy: locationData.accuracy,
                        device: isMobile ? 'mobile' : 'desktop'
                    });

                    resolve(locationData);
                } catch (error: any) {
                    let errorMessage = 'Impossible d\'obtenir votre position GPS';

                    if (error.code) {
                        switch (error.code) {
                            case 1: // PERMISSION_DENIED
                                errorMessage = 'Permission GPS refusée. Autorisez l\'accès dans les paramètres du navigateur.';
                                break;
                            case 2: // POSITION_UNAVAILABLE
                                errorMessage = isMobile
                                    ? 'Position GPS indisponible. Activez votre GPS et vérifiez votre connexion.'
                                    : 'Géolocalisation indisponible. Vérifiez les paramètres de localisation de votre navigateur.';
                                break;
                            case 3: // TIMEOUT
                                errorMessage = isMobile
                                    ? 'Délai GPS dépassé. Vérifiez que votre GPS est activé et réessayez.'
                                    : 'Délai d\'attente dépassé. Sur ordinateur, la géolocalisation peut être limitée. Essayez de saisir votre adresse manuellement.';
                                break;
                            default:
                                errorMessage = `Erreur GPS: ${error.message || 'Erreur inconnue'}`;
                        }
                    }

                    console.error('📍 [GPS] Erreur:', error, { device: isMobile ? 'mobile' : 'desktop' });

                    setState(prev => ({
                        ...prev,
                        loading: false,
                        error: errorMessage
                    }));
                    reject(new Error(errorMessage));
                }
            };

            attemptLocation();
        });
    }, []);

    const watchLocation = useCallback(() => {
        if (!navigator.geolocation) {
            const error = 'Géolocalisation non supportée par votre navigateur';
            setState(prev => ({ ...prev, error }));
            return null;
        }

        setState(prev => ({ ...prev, loading: true, error: null }));

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const locationData: LocationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: Date.now()
                };

                setState(prev => ({
                    ...prev,
                    location: locationData,
                    loading: false,
                    error: null
                }));
            },
            (error) => {
                let errorMessage = 'Erreur de suivi GPS';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Permission GPS refusée';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Position GPS indisponible';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Délai GPS dépassé';
                        break;
                }

                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: errorMessage
                }));
            },
            {
                enableHighAccuracy: false, // Désactivé pour réponse plus rapide
                timeout: 60000, // 60 secondes
                maximumAge: 30000 // 30 secondes pour le tracking continu
            }
        );

        return watchId;
    }, []);

    const stopWatching = useCallback((watchId: number) => {
        navigator.geolocation.clearWatch(watchId);
    }, []);

    const checkPermission = useCallback(async () => {
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
                setState(prev => ({ ...prev, permission: permission.state }));
                return permission.state;
            } catch (error) {
                console.warn('Erreur vérification permission:', error);
                return 'unknown';
            }
        }
        return 'unknown';
    }, []);

    const requestPermission = useCallback(async () => {
        try {
            await getCurrentLocation();
            return true;
        } catch (_error) {
            return false;
        }
    }, [getCurrentLocation]);

    useEffect(() => {
        checkPermission();
    }, [checkPermission]);

    const _getGeolocationErrorMessage = (code: number): string => {
        switch (code) {
            case 1:
                return 'Permission de géolocalisation refusée';
            case 2:
                return 'Position indisponible';
            case 3:
                return 'Délai d\'attente dépassé';
            default:
                return 'Erreur de géolocalisation inconnue';
        }
    };

    return {
        ...state,
        getCurrentLocation,
        watchLocation,
        stopWatching,
        checkPermission,
        requestPermission
    };
}

export default useCurrentLocation;
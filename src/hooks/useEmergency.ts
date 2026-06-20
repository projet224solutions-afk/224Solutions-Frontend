/**
 * EMERGENCY HOOKS - Custom React Hooks
 * 224Solutions - Hooks pour gérer les alertes d'urgence
 */

import { useState, useEffect, useCallback } from 'react';
import { emergencyService } from '@/services/emergencyService';
import { emergencyNotifications } from '@/services/emergencyNotifications';
import type { EmergencyAlert, EmergencyStats, EmergencyGPSTracking } from '@/types/emergency';

/**
 * Hook pour gérer les alertes actives
 */
export function useActiveEmergencyAlerts(bureauId?: string) {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = bureauId
        ? await emergencyService.getBureauAlerts(bureauId)
        : await emergencyService.getActiveAlerts();

      // Filtrer uniquement les alertes actives ou en cours
      const activeAlerts = data.filter(
        (alert) => alert.status === 'active' || alert.status === 'in_progress'
      );

      setAlerts(activeAlerts);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('❌ Erreur chargement alertes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [bureauId]);

  useEffect(() => {
    loadAlerts();

    // S'abonner aux nouvelles alertes en temps réel
    const unsubscribe = emergencyService.subscribeToActiveAlerts((newAlert) => {
      setAlerts((prev) => {
        const exists = prev.find((a) => a.id === newAlert.id);
        if (exists) {
          // Mettre à jour l'alerte existante
          return prev.map((a) => (a.id === newAlert.id ? newAlert : a));
        } else {
          // Ajouter la nouvelle alerte
          return [newAlert, ...prev];
        }
      });

      // Notification
      if (newAlert.status === 'active') {
        emergencyNotifications.sendPushNotification({
          type: 'emergency_alert',
          alert_id: newAlert.id,
          driver_name: newAlert.driver_name || 'Conducteur',
          driver_code: newAlert.driver_code || 'N/A',
          latitude: newAlert.initial_latitude,
          longitude: newAlert.initial_longitude,
          message: `${newAlert.driver_name || 'Un conducteur'} signale une urgence`,
          priority: 'critical',
          sound: 'emergency',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadAlerts, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [loadAlerts]);

  return {
    alerts,
    isLoading,
    error,
    refresh: loadAlerts,
    count: alerts.length
  };
}

/**
 * Hook pour obtenir une alerte spécifique avec suivi en temps réel
 */
export function useEmergencyAlert(alertId: string | null) {
  const [alert, setAlert] = useState<EmergencyAlert | null>(null);
  const [gpsHistory, setGpsHistory] = useState<EmergencyGPSTracking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!alertId) {
      setAlert(null);
      setGpsHistory([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadAlert = async () => {
      try {
        setIsLoading(true);
        const [alertData, gpsData] = await Promise.all([
          emergencyService.getAlert(alertId),
          emergencyService.getGPSTracking(alertId, 50)
        ]);

        if (isMounted) {
          setAlert(alertData);
          setGpsHistory(gpsData);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          console.error('❌ Erreur chargement alerte:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAlert();

    // S'abonner aux mises à jour de l'alerte
    const unsubscribeAlert = emergencyService.subscribeToAlert(alertId, (updatedAlert) => {
      if (isMounted) {
        setAlert(updatedAlert);
      }
    });

    // S'abonner aux mises à jour GPS
    const unsubscribeGPS = emergencyService.subscribeToGPSTracking(alertId, (newPoint) => {
      if (isMounted) {
        setGpsHistory((prev) => [newPoint, ...prev].slice(0, 50));
      }
    });

    return () => {
      isMounted = false;
      unsubscribeAlert();
      unsubscribeGPS();
    };
  }, [alertId]);

  return {
    alert,
    gpsHistory,
    isLoading,
    error
  };
}

/**
 * Hook pour obtenir les statistiques d'urgence
 */
export function useEmergencyStats(bureauId?: string, refreshInterval: number = 30000) {
  const [stats, setStats] = useState<EmergencyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await emergencyService.getStats(bureauId);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('❌ Erreur chargement stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [bureauId]);

  useEffect(() => {
    loadStats();

    // Rafraîchir automatiquement
    if (refreshInterval > 0) {
      const interval = setInterval(loadStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadStats, refreshInterval]);

  return {
    stats,
    isLoading,
    error,
    refresh: loadStats,
    activeAlerts: stats?.active_alerts || 0,
    resolvedAlerts: stats?.resolved_alerts || 0,
    falseAlerts: stats?.false_alerts || 0,
    totalAlerts: stats?.total_alerts || 0
  };
}

/**
 * Hook pour gérer les actions d'une alerte
 */
export function useEmergencyActions(alertId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createAction = useCallback(
    async (
      actionType: 'call_driver' | 'send_message' | 'notify_police' | 'mark_safe' | 'note',
      userId: string,
      userName?: string,
      notes?: string,
      actionDetails?: Record<string, any>
    ) => {
      if (!alertId) {
        throw new Error('Alert ID is required');
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await emergencyService.createAction({
          alert_id: alertId,
          action_type: actionType,
          performed_by: userId,
          performed_by_name: userName,
          action_details: actionDetails,
          notes
        });
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [alertId]
  );

  const resolveAlert = useCallback(
    async (userId: string, notes?: string) => {
      if (!alertId) {
        throw new Error('Alert ID is required');
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await emergencyService.resolveAlert(alertId, userId, notes);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [alertId]
  );

  const markAsFalseAlert = useCallback(
    async (userId: string, notes?: string) => {
      if (!alertId) {
        throw new Error('Alert ID is required');
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await emergencyService.markAsFalseAlert(alertId, userId, notes);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [alertId]
  );

  const markAsInProgress = useCallback(
    async (userId: string) => {
      if (!alertId) {
        throw new Error('Alert ID is required');
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await emergencyService.markAsInProgress(alertId, userId);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [alertId]
  );

  return {
    createAction,
    resolveAlert,
    markAsFalseAlert,
    markAsInProgress,
    isSubmitting,
    error
  };
}

/**
 * Hook pour gérer le tracking GPS d'une alerte
 */
export function useEmergencyGPSTracking(alertId: string | null) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastPosition, setLastPosition] = useState<EmergencyGPSTracking | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const startTracking = useCallback(async () => {
    if (!alertId) {
      console.error('Alert ID is required to start tracking');
      return;
    }

    setIsTracking(true);
    setError(null);

    try {
      // Obtenir la position initiale via le navigateur
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const tracking = await emergencyService.addGPSTracking({
        alert_id: alertId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed || 0,
        direction: position.coords.heading || null,
        altitude: position.coords.altitude || null
      });

      setLastPosition(tracking);
    } catch (err) {
      setError(err as Error);
      console.error('❌ Erreur démarrage tracking:', err);
    }
  }, [alertId]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
  }, []);

  return {
    isTracking,
    lastPosition,
    error,
    startTracking,
    stopTracking
  };
}

/**
 * Hook pour vérifier si le conducteur a une alerte active
 */
export function useDriverActiveAlert(driverId: string | undefined) {
  const [activeAlert, setActiveAlert] = useState<EmergencyAlert | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!driverId) {
      setActiveAlert(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const checkActiveAlert = async () => {
      try {
        setIsLoading(true);
        const alerts = await emergencyService.getDriverAlerts(driverId, 1);

        // Chercher une alerte active
        const active = alerts.find(
          (alert) => alert.status === 'active' || alert.status === 'in_progress'
        );

        if (isMounted) {
          setActiveAlert(active || null);
        }
      } catch (err) {
        console.error('❌ Erreur vérification alerte:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkActiveAlert();

    return () => {
      isMounted = false;
    };
  }, [driverId]);

  return {
    activeAlert,
    hasActiveAlert: !!activeAlert,
    isLoading
  };
}

/**
 * Hook pour gérer les notifications d'urgence
 */
export function useEmergencyNotifications() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(emergencyNotifications.isSupported());
    setHasPermission(emergencyNotifications.getPermissionStatus() === 'granted');
  }, []);

  const requestPermission = useCallback(async () => {
    const granted = await emergencyNotifications.requestPermission();
    setHasPermission(granted);
    return granted;
  }, []);

  const sendTestNotification = useCallback(async () => {
    await emergencyNotifications.testNotification();
  }, []);

  return {
    isSupported,
    hasPermission,
    requestPermission,
    sendTestNotification
  };
}

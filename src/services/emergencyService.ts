/**
 * EMERGENCY SOS SERVICE
 * 224Solutions - Gestion des alertes d'urgence
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  EmergencyAlert,
  EmergencyGPSTracking,
  EmergencyAction,
  EmergencyStats,
  CreateEmergencyAlertPayload,
  UpdateEmergencyAlertPayload,
  CreateGPSTrackingPayload,
  CreateEmergencyActionPayload,
  GPSPosition,
  EmergencyStatus
} from '@/types/emergency';

/**
 * Service principal pour la gestion des alertes d'urgence
 */
export const emergencyService = {
  /**
   * Créer une nouvelle alerte d'urgence
   */
  async createAlert(payload: CreateEmergencyAlertPayload): Promise<EmergencyAlert> {
    const { data, error } = await (supabase as any)
      .from('emergency_alerts')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur création alerte urgence:', error);
      throw new Error(`Impossible de créer l'alerte d'urgence: ${error.message}`);
    }

    console.log('✅ Alerte d\'urgence créée:', data.id);
    return data;
  },

  /**
   * Mettre à jour une alerte existante
   */
  async updateAlert(alertId: string, payload: UpdateEmergencyAlertPayload): Promise<EmergencyAlert> {
    const { data, error } = await (supabase as any)
      .from('emergency_alerts')
      .update(payload)
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur mise à jour alerte:', error);
      throw new Error(`Impossible de mettre à jour l'alerte: ${error.message}`);
    }

    return data;
  },

  /**
   * Obtenir une alerte par ID
   */
  async getAlert(alertId: string): Promise<EmergencyAlert | null> {
    const { data, error } = await (supabase as any)
      .from('emergency_alerts')
      .select('*')
      .eq('id', alertId)
      .single();

    if (error) {
      console.error('❌ Erreur récupération alerte:', error);
      return null;
    }

    return data;
  },

  /**
   * Obtenir toutes les alertes actives
   */
  async getActiveAlerts(): Promise<EmergencyAlert[]> {
    const { data, error } = await (supabase as any)
      .from('active_emergency_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération alertes actives:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Obtenir les alertes d'un conducteur spécifique
   */
  async getDriverAlerts(driverId: string, limit: number = 10): Promise<EmergencyAlert[]> {
    const { data, error } = await (supabase as any)
      .from('emergency_alerts')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Erreur récupération alertes conducteur:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Obtenir les alertes d'un bureau syndicat
   */
  async getBureauAlerts(bureauId: string): Promise<EmergencyAlert[]> {
    const { data, error } = await (supabase as any)
      .from('emergency_alerts')
      .select('*')
      .eq('bureau_syndicat_id', bureauId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération alertes bureau:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Ajouter un point GPS à l'historique de tracking
   */
  async addGPSTracking(payload: CreateGPSTrackingPayload): Promise<EmergencyGPSTracking> {
    const { data, error } = await (supabase as any)
      .from('emergency_gps_tracking')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur ajout tracking GPS:', error);
      throw new Error(`Impossible d'ajouter le point GPS: ${error.message}`);
    }

    return data;
  },

  /**
   * Obtenir l'historique GPS d'une alerte
   */
  async getGPSTracking(alertId: string, limit: number = 100): Promise<EmergencyGPSTracking[]> {
    const { data, error } = await (supabase as any)
      .from('emergency_gps_tracking')
      .select('*')
      .eq('alert_id', alertId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Erreur récupération tracking GPS:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Obtenir les 30 dernières secondes de tracking
   */
  async getRecentGPSTracking(alertId: string): Promise<EmergencyGPSTracking[]> {
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

    const { data, error } = await (supabase as any)
      .from('emergency_gps_tracking')
      .select('*')
      .eq('alert_id', alertId)
      .gte('timestamp', thirtySecondsAgo)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération tracking récent:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Créer une action syndicat
   */
  async createAction(payload: CreateEmergencyActionPayload): Promise<EmergencyAction> {
    const { data, error } = await (supabase as any)
      .from('emergency_actions')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur création action:', error);
      throw new Error(`Impossible de créer l'action: ${error.message}`);
    }

    return data;
  },

  /**
   * Obtenir les actions d'une alerte
   */
  async getAlertActions(alertId: string): Promise<EmergencyAction[]> {
    const { data, error } = await (supabase as any)
      .from('emergency_actions')
      .select('*')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération actions:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Résoudre une alerte (marquer comme résolue)
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    notes?: string,
    status: EmergencyStatus = 'resolved'
  ): Promise<EmergencyAlert> {
    const payload: UpdateEmergencyAlertPayload = {
      status,
      handled_by: resolvedBy,
      handled_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      resolution_notes: notes
    };

    return this.updateAlert(alertId, payload);
  },

  /**
   * Marquer une alerte comme fausse alerte
   */
  async markAsFalseAlert(alertId: string, handledBy: string, notes?: string): Promise<EmergencyAlert> {
    return this.resolveAlert(alertId, handledBy, notes, 'false_alert');
  },

  /**
   * Passer une alerte en "en cours de traitement"
   */
  async markAsInProgress(alertId: string, handledBy: string): Promise<EmergencyAlert> {
    return this.updateAlert(alertId, {
      status: 'in_progress',
      handled_by: handledBy,
      handled_at: new Date().toISOString()
    });
  },

  /**
   * Obtenir les statistiques d'urgence
   */
  async getStats(bureauId?: string): Promise<EmergencyStats | null> {
    if (bureauId) {
      const { data, error } = await (supabase.rpc as any)('get_emergency_stats_by_bureau', { p_bureau_id: bureauId });

      if (error) {
        console.error('❌ Erreur récupération stats bureau:', error);
        return null;
      }

      return data?.[0] || null;
    } else {
      const { data, error } = await (supabase as any)
        .from('emergency_global_stats')
        .select('*')
        .single();

      if (error) {
        console.error('❌ Erreur récupération stats globales:', error);
        return null;
      }

      return data;
    }
  },

  /**
   * S'abonner aux changements d'une alerte spécifique
   */
  subscribeToAlert(alertId: string, callback: (alert: EmergencyAlert) => void) {
    const channel = supabase
      .channel(`emergency_alert_${alertId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_alerts',
          filter: `id=eq.${alertId}`
        },
        (payload) => {
          console.log('📡 Mise à jour alerte:', payload);
          callback(payload.new as EmergencyAlert);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * S'abonner à toutes les alertes actives
   */
  subscribeToActiveAlerts(callback: (alert: EmergencyAlert) => void) {
    const channel = supabase
      .channel('active_emergency_alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_alerts',
          filter: 'status=in.(active,in_progress)'
        },
        (payload) => {
          console.log('📡 Nouvelle alerte active:', payload);
          callback(payload.new as EmergencyAlert);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * S'abonner aux mises à jour GPS d'une alerte
   */
  subscribeToGPSTracking(alertId: string, callback: (tracking: EmergencyGPSTracking) => void) {
    const channel = supabase
      .channel(`gps_tracking_${alertId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emergency_gps_tracking',
          filter: `alert_id=eq.${alertId}`
        },
        (payload) => {
          console.log('📍 Nouveau point GPS:', payload);
          callback(payload.new as EmergencyGPSTracking);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * S'abonner aux actions d'une alerte
   */
  subscribeToActions(alertId: string, callback: (action: EmergencyAction) => void) {
    const channel = supabase
      .channel(`emergency_actions_${alertId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emergency_actions',
          filter: `alert_id=eq.${alertId}`
        },
        (payload) => {
          console.log('📝 Nouvelle action:', payload);
          callback(payload.new as EmergencyAction);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};

/**
 * Service de tracking GPS en temps réel
 */
export const gpsTrackingService = {
  /**
   * Obtenir la position GPS actuelle du navigateur
   */
  async getCurrentPosition(): Promise<GPSPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            direction: position.coords.heading || undefined,
            altitude: position.coords.altitude || undefined,
            timestamp: new Date(position.timestamp).toISOString()
          });
        },
        (error) => {
          console.error('❌ Erreur géolocalisation:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  },

  /**
   * Surveiller la position GPS en continu
   * @param callback Fonction appelée à chaque mise à jour
   * @param intervalMs Intervalle en millisecondes (défaut: 2000ms)
   */
  watchPosition(callback: (position: GPSPosition) => void, intervalMs: number = 2000): number {
    if (!navigator.geolocation) {
      console.error('❌ Géolocalisation non supportée');
      return -1;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          direction: position.coords.heading || undefined,
          altitude: position.coords.altitude || undefined,
          timestamp: new Date(position.timestamp).toISOString()
        });
      },
      (error) => {
        console.error('❌ Erreur suivi position:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: intervalMs,
        maximumAge: 0
      }
    );

    return watchId;
  },

  /**
   * Arrêter le suivi de position
   */
  clearWatch(watchId: number): void {
    if (navigator.geolocation && watchId >= 0) {
      navigator.geolocation.clearWatch(watchId);
    }
  }
};

export default emergencyService;

/**
 * Service de gestion des alertes SOS pour Taxi Moto
 * Permet aux conducteurs d'envoyer des alertes d'urgence au Bureau Syndicat
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SecureStorage } from '@/lib/secureStorage';
import { sosMediaRecorder } from './SOSMediaRecorder';
import type { GPSPosition, SOSAlert, SOSResponse, SOSStatus } from '@/types/sos.types';

class TaxiMotoSOSService {
  private static instance: TaxiMotoSOSService;
  private watchId: number | null = null;
  private gpsHistory: GPSPosition[] = [];
  private maxHistorySize = 5;
  private lastSOSTime: number = 0;
  private cooldownPeriod = 60000; // 60 secondes

  private constructor() {
    // Démarrer le suivi GPS automatiquement
    this.startGPSTracking();
  }

  public static getInstance(): TaxiMotoSOSService {
    if (!TaxiMotoSOSService.instance) {
      TaxiMotoSOSService.instance = new TaxiMotoSOSService();
    }
    return TaxiMotoSOSService.instance;
  }

  /**
   * Démarre le suivi GPS en arrière-plan
   */
  private startGPSTracking(): void {
    if (!navigator.geolocation) {
      console.warn('Géolocalisation non disponible');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const gpsPoint: GPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          direction: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: position.timestamp
        };

        // Ajouter au début et garder seulement les N derniers points
        this.gpsHistory.unshift(gpsPoint);
        if (this.gpsHistory.length > this.maxHistorySize) {
          this.gpsHistory = this.gpsHistory.slice(0, this.maxHistorySize);
        }
      },
      (error) => {
        console.error('Erreur GPS tracking:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  /**
   * Obtient la position GPS actuelle
   */
  private async getCurrentPosition(): Promise<GPSPosition | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            direction: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: position.timestamp
          });
        },
        (error) => {
          console.error('Erreur position actuelle:', error);
          // Fallback: utiliser la dernière position connue
          resolve(this.gpsHistory[0] || null);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Vérifie si un SOS peut être déclenché (cooldown)
   */
  public canTriggerSOS(): boolean {
    const now = Date.now();
    return (now - this.lastSOSTime) >= this.cooldownPeriod;
  }

  /**
   * Obtient le temps restant avant de pouvoir déclencher un nouveau SOS
   */
  public getCooldownRemaining(): number {
    const now = Date.now();
    const elapsed = now - this.lastSOSTime;
    const remaining = Math.max(0, this.cooldownPeriod - elapsed);
    return Math.ceil(remaining / 1000); // en secondes
  }

  /**
   * Déclenche une alerte SOS
   */
  public async triggerSOS(
    taxiId: string,
    driverName: string,
    driverPhone: string,
    bureauSyndicatId?: string,
    description?: string
  ): Promise<SOSResponse> {
    try {
      // Vérifier le cooldown
      if (!this.canTriggerSOS()) {
        const remaining = this.getCooldownRemaining();
        return {
          success: false,
          message: `Veuillez attendre ${remaining}s avant de déclencher un nouveau SOS`,
          error: 'COOLDOWN'
        };
      }

      // Obtenir position actuelle (ne pas bloquer si GPS indisponible)
      const currentPosition = await this.getCurrentPosition();
      if (!currentPosition) {
        console.warn('⚠️ SOS envoyé sans position GPS');
      }

      // Créer l'objet SOS dans Supabase
      console.log('🚨 Création alerte SOS dans Supabase...');

      const { data: sosRecord, error: insertError } = await supabase
        .from('sos_alerts')
        .insert({
          taxi_driver_id: taxiId,
          driver_name: driverName,
          driver_phone: driverPhone,
          latitude: currentPosition?.latitude ?? 0,
          longitude: currentPosition?.longitude ?? 0,
          accuracy: currentPosition?.accuracy ?? null,
          speed: currentPosition?.speed ?? null,
          status: 'active',
          severity: 'critical',
          alert_type: 'emergency',
          bureau_id: bureauSyndicatId,
          description: description || 'Alerte SOS d\'urgence'
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erreur insertion SOS:', insertError);
        throw new Error(`Impossible de créer l'alerte SOS: ${insertError.message}`);
      }

      console.log('✅ Alerte SOS créée avec ID:', sosRecord.id);

      // 🎬 DÉMARRER ENREGISTREMENT AUTOMATIQUE IMMÉDIATEMENT
      console.log('🎥 Démarrage enregistrement automatique SOS...');
      const recordingStarted = await sosMediaRecorder.startSOSRecording(sosRecord.id, {
        audio: true,
        video: true
      });

      if (recordingStarted) {
        console.log('✅ Enregistrement automatique démarré');

        // Mettre à jour sos_alerts avec le timestamp de début d'enregistrement
        await supabase
          .from('sos_alerts')
          .update({
            recording_started_at: new Date().toISOString()
          })
          .eq('id', sosRecord.id);

        toast.info('🎥 Enregistrement en cours', {
          description: 'Audio et vidéo enregistrés automatiquement'
        });
      } else {
        console.warn('⚠️ Impossible de démarrer enregistrement automatique');
      }

      // Mettre à jour le temps du dernier SOS
      this.lastSOSTime = Date.now();

      // Sauvegarder aussi en localStorage en backup
      const sosData: SOSAlert = {
        id: sosRecord.id,
        taxi_driver_id: taxiId,
        driver_name: driverName,
        driver_phone: driverPhone,
        // currentPosition peut être null (GPS indisponible) → ne pas déréférencer
        latitude: currentPosition?.latitude ?? sosRecord.latitude ?? 0,
        longitude: currentPosition?.longitude ?? sosRecord.longitude ?? 0,
        accuracy: currentPosition?.accuracy ?? sosRecord.accuracy ?? undefined,
        direction: currentPosition?.direction,
        speed: currentPosition?.speed ?? sosRecord.speed ?? undefined,
        gps_history: this.gpsHistory,
        status: 'DANGER' as SOSStatus,
        bureau_syndicat_id: bureauSyndicatId,
        description: description,
        triggered_at: sosRecord.created_at
      };

      const existingAlerts = await this.getLocalSOSAlerts();
      existingAlerts.push(sosData);
      // 🔒 Stockage chiffré des alertes SOS (contient position GPS sensible)
      await SecureStorage.setItem('taxi_sos_alerts', existingAlerts);

      // Envoyer notification au Bureau Syndicat
      await this.notifyBureauSyndicat(sosData);

      toast.success('🚨 SOS envoyé avec succès!', {
        description: 'Le Bureau Syndicat a été notifié'
      });

      return {
        success: true,
        sos_id: sosData.id,
        message: 'SOS envoyé au Bureau Syndicat'
      };

    } catch (error: any) {
      console.error('Erreur déclenchement SOS:', error);
      toast.error('Erreur lors de l\'envoi du SOS');
      return {
        success: false,
        message: 'Erreur lors de l\'envoi du SOS',
        error: error.message
      };
    }
  }

  /**
   * Récupère les alertes SOS depuis localStorage (déchiffré)
   */
  private async getLocalSOSAlerts(): Promise<SOSAlert[]> {
    try {
      const stored = await SecureStorage.getItem<SOSAlert[]>('taxi_sos_alerts');
      return stored || [];
    } catch {
      return [];
    }
  }

  /**
   * Notifie le Bureau Syndicat d'une nouvelle alerte
   */
  private async notifyBureauSyndicat(sosAlert: SOSAlert): Promise<void> {
    try {
      console.log('📢 Envoi notification Bureau Syndicat...');

      // 1. Notification système native
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('🚨 ALERTE SOS TAXI MOTO', {
            body: `${sosAlert.driver_name} a déclenché un SOS!\nPosition: ${sosAlert.latitude.toFixed(4)}, ${sosAlert.longitude.toFixed(4)}`,
            icon: '/taxi-icon.png',
            tag: `sos-${sosAlert.id}`,
            requireInteraction: true
          });
          console.log('✅ Notification système envoyée');
        } else if (Notification.permission === 'default') {
          // Demander permission
          await Notification.requestPermission();
        }
      }

      // 2. BroadcastChannel pour communication inter-onglets
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('taxi-sos-alerts');
        channel.postMessage({
          type: 'NEW_SOS',
          alert: sosAlert,
          timestamp: Date.now()
        });
        channel.close();
        console.log('✅ BroadcastChannel envoyé');
      }

      // 3. Créer notification dans la table notifications Supabase
      // UNIQUEMENT si on a un bureau_syndicat_id valide (UUID)
      try {
        if (sosAlert.bureau_syndicat_id && sosAlert.bureau_syndicat_id.length === 36) {
          // Récupérer le president_email du bureau pour trouver son user_id
          const { data: bureauData } = await supabase
            .from('bureaus')
            .select('president_email')
            .eq('id', sosAlert.bureau_syndicat_id)
            .single();

          if (bureauData?.president_email) {
            // Chercher le profile avec cet email
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', bureauData.president_email)
              .single();

            if (profileData?.id) {
              await supabase.from('notifications').insert({
                user_id: profileData.id,
                type: 'sos_alert',
                title: '🚨 ALERTE SOS URGENTE',
                message: `${sosAlert.driver_name} (${sosAlert.driver_phone}) a déclenché un SOS!`,
                data: {
                  sos_id: sosAlert.id,
                  driver_id: sosAlert.taxi_driver_id,
                  driver_name: sosAlert.driver_name,
                  driver_phone: sosAlert.driver_phone,
                  latitude: sosAlert.latitude,
                  longitude: sosAlert.longitude,
                  accuracy: sosAlert.accuracy,
                  triggered_at: sosAlert.triggered_at
                },
                priority: 'urgent',
                read: false
              });
              console.log('✅ Notification DB créée pour bureau');
            }
          }
        } else {
          console.log('⚠️ Pas de bureau_syndicat_id valide, notification DB ignorée');
        }
      } catch (dbError) {
        console.error('⚠️ Erreur notification DB:', dbError);
      }

      // 4. Jouer son d'alerte
      try {
        const audio = new Audio('/notification-urgent.mp3');
        audio.volume = 1.0;
        await audio.play();
      } catch (audioError) {
        console.warn('⚠️ Son alerte non joué:', audioError);
      }

      console.log('✅ Bureau Syndicat notifié pour SOS:', sosAlert.id);
    } catch (error) {
      console.error('❌ Erreur notification Bureau:', error);
      throw error;
    }
  }

  /**
   * Met à jour le statut d'une alerte SOS dans Supabase
   */
  public async updateSOSStatus(
    sosId: string,
    newStatus: SOSStatus,
    resolvedBy?: string
  ): Promise<boolean> {
    try {
      console.log(`🔄 Mise à jour SOS ${sosId} vers statut: ${newStatus}`);

      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'RESOLU') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = resolvedBy;
      }

      const { error } = await supabase
        .from('sos_alerts')
        .update(updateData)
        .eq('id', sosId);

      if (error) {
        console.error('❌ Erreur mise à jour SOS Supabase:', error);
        return false;
      }

      // 🎬 ARRÊTER ENREGISTREMENT SI SOS RÉSOLU
      if (newStatus === 'RESOLU' || newStatus === 'ANNULE') {
        console.log('⏹️ Arrêt enregistrement automatique...');
        sosMediaRecorder.stopSOSRecording(sosId);
        toast.success('⏹️ Enregistrement terminé', {
          description: 'Vidéo sauvegardée et uploadée automatiquement'
        });
      }

      // Mettre à jour aussi localStorage en backup
      try {
        const alerts = await this.getLocalSOSAlerts();
        const index = alerts.findIndex(a => a.id === sosId);

        if (index !== -1) {
          alerts[index].status = newStatus;
          alerts[index].updated_at = updateData.updated_at;

          if (newStatus === 'RESOLU') {
            alerts[index].resolved_at = updateData.resolved_at;
            alerts[index].resolved_by = resolvedBy;
          }

          // 🔒 Stockage chiffré
          await SecureStorage.setItem('taxi_sos_alerts', alerts);
        }
      } catch (localError) {
        console.warn('⚠️ Erreur localStorage:', localError);
      }

      console.log('✅ SOS mis à jour avec succès');
      toast.success(`Statut mis à jour: ${newStatus}`);
      return true;
    } catch (error) {
      console.error('❌ Exception updateSOSStatus:', error);
      toast.error('Erreur mise à jour statut SOS');
      return false;
    }
  }

  /**
   * Récupère toutes les alertes SOS actives depuis Supabase
   */
  public async getActiveSOSAlerts(): Promise<SOSAlert[]> {
    try {
      console.log('🔍 Chargement alertes SOS actives depuis Supabase...');

      // Statuts actifs: 'active' (nouveau format DB) + 'DANGER', 'EN_INTERVENTION' (ancien format)
      const { data, error } = await supabase
        .from('sos_alerts')
        .select('*')
        .in('status', ['active', 'DANGER', 'EN_INTERVENTION', 'pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Erreur chargement SOS Supabase:', error);
        // Fallback vers localStorage
        const alerts = await this.getLocalSOSAlerts();
        return alerts.filter(a => ['active', 'DANGER', 'EN_INTERVENTION'].includes(a.status));
      }

      console.log(`✅ ${data?.length || 0} alertes SOS actives chargées`);

      // Mapper les données Supabase vers le format SOSAlert
      // Normaliser les statuts: 'active' -> 'DANGER' pour l'affichage
      return (data as any[])?.map((record: any) => {
        // Normaliser le statut pour l'interface
        let normalizedStatus = record.status;
        if (record.status === 'active' || record.status === 'pending') {
          normalizedStatus = 'DANGER';
        } else if (record.status === 'in_progress') {
          normalizedStatus = 'EN_INTERVENTION';
        }

        return {
          id: record.id,
          taxi_driver_id: record.taxi_driver_id,
          driver_name: record.driver_name,
          driver_phone: record.driver_phone,
          latitude: record.latitude,
          longitude: record.longitude,
          accuracy: record.accuracy,
          direction: record.direction,
          speed: record.speed,
          gps_history: record.gps_history || [],
          status: normalizedStatus as SOSStatus,
          bureau_syndicat_id: record.bureau_id,
          description: record.description,
          triggered_at: record.created_at,
          resolved_at: record.resolved_at,
          resolved_by: record.resolved_by
        };
      }) || [];
    } catch (error) {
      console.error('❌ Exception getActiveSOSAlerts:', error);
      // Fallback vers localStorage
      const alerts = await this.getLocalSOSAlerts();
      return alerts.filter(a => a.status === 'DANGER' || a.status === 'EN_INTERVENTION');
    }
  }

  /**
   * Récupère toutes les alertes SOS (y compris résolues)
   */
  public async getAllSOSAlerts(): Promise<SOSAlert[]> {
    return await this.getLocalSOSAlerts();
  }

  /**
   * Obtient l'historique GPS
   */
  public getGPSHistory(): GPSPosition[] {
    return [...this.gpsHistory];
  }

  /**
   * Arrête le suivi GPS
   */
  public stopGPSTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

// Export singleton
export const taxiMotoSOSService = TaxiMotoSOSService.getInstance();

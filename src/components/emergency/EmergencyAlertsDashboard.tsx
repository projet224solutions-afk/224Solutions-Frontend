import { useTranslation } from "@/hooks/useTranslation";
/**
 * EMERGENCY ALERTS DASHBOARD - Bureau Syndicat
 * 224Solutions - Tableau de bord de gestion des alertes d'urgence
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  MapPin,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { emergencyService } from '@/services/emergencyService';
import { EmergencyMapView } from './EmergencyMapView';
import { EmergencyAlertCard } from './EmergencyAlertCard';
import { EmergencyActionsPanel } from './EmergencyActionsPanel';
import type { EmergencyAlert, EmergencyStats } from '@/types/emergency';

interface EmergencyAlertsDashboardProps {
  bureauId?: string;
  userRole: 'admin' | 'syndicat' | 'pdg';
  userId: string;
  userName?: string;
}

export const EmergencyAlertsDashboard: React.FC<EmergencyAlertsDashboardProps> = ({
  bureauId,
  userRole,
  userId,
  userName
}) => {
  const { t } = useTranslation();
  const [activeAlerts, setActiveAlerts] = useState<EmergencyAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<EmergencyAlert | null>(null);
  const [stats, setStats] = useState<EmergencyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alertSound, setAlertSound] = useState<HTMLAudioElement | null>(null);

  /**
   * Charger les alertes actives
   */
  const loadActiveAlerts = useCallback(async () => {
    try {
      const alerts = bureauId
        ? await emergencyService.getBureauAlerts(bureauId)
        : await emergencyService.getActiveAlerts();

      // Filtrer uniquement les alertes actives ou en cours
      const filteredAlerts = alerts.filter(
        (a) => a.status === 'active' || a.status === 'in_progress'
      );

      setActiveAlerts(filteredAlerts);

      // Sélectionner automatiquement la première alerte si rien n'est sélectionné
      if (filteredAlerts.length > 0 && !selectedAlert) {
        setSelectedAlert(filteredAlerts[0]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement alertes:', error);
      toast.error(t('emergencyAlertsDashboard.impossibleDeChargerLesAlertes'));
    }
  }, [bureauId, selectedAlert]);

  /**
   * Charger les statistiques
   */
  const loadStats = useCallback(async () => {
    try {
      const stats = await emergencyService.getStats(bureauId);
      setStats(stats);
    } catch (error) {
      console.error('❌ Erreur chargement stats:', error);
    }
  }, [bureauId]);

  /**
   * Initialisation
   */
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadActiveAlerts(), loadStats()]);
      setIsLoading(false);
    };

    init();

    // Précharger le son d'alerte
    const audio = new Audio('/sounds/emergency-alert.mp3');
    audio.volume = 0.7;
    setAlertSound(audio);
  }, [loadActiveAlerts, loadStats]);

  /**
   * S'abonner aux nouvelles alertes en temps réel
   */
  useEffect(() => {
    const unsubscribe = emergencyService.subscribeToActiveAlerts((newAlert) => {
      console.log('🚨 NOUVELLE ALERTE REÇUE:', newAlert);

      // Jouer le son d'urgence
      if (alertSound && !newAlert.silent_mode) {
        alertSound.play().catch(() => console.log('Son non disponible'));
      }

      // Ajouter l'alerte à la liste
      setActiveAlerts((prev) => {
        const exists = prev.find((a) => a.id === newAlert.id);
        if (exists) {
          // Mettre à jour l'alerte existante
          return prev.map((a) => (a.id === newAlert.id ? newAlert : a));
        } else {
          // Ajouter la nouvelle alerte
          return [newAlert, ...prev];
        }
      });

      // Notification visuelle
      toast.error(t('emergencyAlertsDashboard.nouvelleUrgenceTaxiMoto'), {
        description: `${newAlert.driver_name || 'Conducteur'} (${newAlert.driver_code || 'N/A'}) signale une urgence`,
        duration: 10000,
        action: {
          label: 'Voir',
          onClick: () => setSelectedAlert(newAlert)
        }
      });

      // Sélectionner automatiquement si aucune alerte sélectionnée
      if (!selectedAlert) {
        setSelectedAlert(newAlert);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [alertSound, selectedAlert]);

  /**
   * Actions rapides
   */
  const handleMarkAsInProgress = async (alert: EmergencyAlert) => {
    try {
      await emergencyService.markAsInProgress(alert.id, userId);
      await emergencyService.createAction({
        alert_id: alert.id,
        action_type: 'note',
        performed_by: userId,
        performed_by_name: userName,
        notes: 'Alerte prise en charge'
      });

      toast.success('Alerte prise en charge');
      loadActiveAlerts();
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error(t('emergencyAlertsDashboard.erreurLorsDeLaPrise'));
    }
  };

  const handleResolve = async (alert: EmergencyAlert, notes?: string) => {
    try {
      await emergencyService.resolveAlert(alert.id, userId, notes);
      await emergencyService.createAction({
        alert_id: alert.id,
        action_type: 'mark_safe',
        performed_by: userId,
        performed_by_name: userName,
        notes: notes || 'Situation résolue'
      });

      toast.success(t('emergencyAlertsDashboard.alerteResolueAvecSucces'));
      setSelectedAlert(null);
      loadActiveAlerts();
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error(t('emergencyAlertsDashboard.erreurLorsDeLaResolution'));
    }
  };

  const handleMarkAsFalseAlert = async (alert: EmergencyAlert) => {
    try {
      await emergencyService.markAsFalseAlert(alert.id, userId, 'Marqué comme fausse alerte');
      toast.success(t('emergencyAlertsDashboard.marqueCommeFausseAlerte'));
      setSelectedAlert(null);
      loadActiveAlerts();
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error(t('emergencyAlertsDashboard.erreurLorsDuMarquage'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#ff4000] text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Alertes Actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.active_alerts || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#ff4000]" />
              Résolues Aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#ff4000]">{stats?.resolved_alerts || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-orange-600" />
              Fausses Alertes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{stats?.false_alerts || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Temps Moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {stats?.avg_resolution_time
                ? `${Math.round(parseInt(stats.avg_resolution_time) / 60)}min`
                : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contenu principal */}
      {activeAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 text-[#ff4000] mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t('emergencyAlertsDashboard.aucuneAlerteActive')}</h3>
            <p className="text-muted-foreground">
              Tous les conducteurs sont en sécurité. Le système surveille en temps réel.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des alertes */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-[#ff4000]" />
                  Alertes en Cours ({activeAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                {activeAlerts.map((alert) => (
                  <EmergencyAlertCard
                    key={alert.id}
                    alert={alert}
                    isSelected={selectedAlert?.id === alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    onTakeAction={() => handleMarkAsInProgress(alert)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Détails de l'alerte sélectionnée */}
          <div className="lg:col-span-2">
            {selectedAlert ? (
              <Tabs defaultValue="map" className="space-y-4">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="map">
                    <MapPin className="h-4 w-4 mr-2" />
                    Carte
                  </TabsTrigger>
                  <TabsTrigger value="details">
                    <Activity className="h-4 w-4 mr-2" />
                    Détails
                  </TabsTrigger>
                  <TabsTrigger value="actions">
                    <Shield className="h-4 w-4 mr-2" />
                    Actions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="map">
                  <EmergencyMapView
                    alert={selectedAlert}
                    onResolve={handleResolve}
                    onMarkAsFalse={handleMarkAsFalseAlert}
                  />
                </TabsContent>

                <TabsContent value="details">
                  <Card>
                    <CardHeader>
                      <CardTitle>Informations Conducteur</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Nom</label>
                          <p className="text-lg font-semibold">{selectedAlert.driver_name || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Code</label>
                          <p className="text-lg font-semibold">{selectedAlert.driver_code || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">{t('emergencyAlertsDashboard.telephone')}</label>
                          <p className="text-lg font-semibold">{selectedAlert.driver_phone || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Statut</label>
                          <Badge variant={selectedAlert.status === 'active' ? 'destructive' : 'default'}>
                            {selectedAlert.status === 'active' ? 'URGENCE' : 'EN COURS'}
                          </Badge>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <label className="text-sm font-medium text-muted-foreground">Vitesse Actuelle</label>
                        <p className="text-2xl font-bold">
                          {selectedAlert.current_speed?.toFixed(1) || '0'} km/h
                        </p>
                      </div>

                      <div className="border-t pt-4">
                        <label className="text-sm font-medium text-muted-foreground">{t('emergencyAlertsDashboard.tempsEcoule')}</label>
                        <p className="text-xl font-semibold text-[#ff4000]">
                          {Math.floor((selectedAlert.seconds_since_alert || 0) / 60)} min {Math.floor((selectedAlert.seconds_since_alert || 0) % 60)} sec
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="actions">
                  <EmergencyActionsPanel
                    alert={selectedAlert}
                    userId={userId}
                    userName={userName}
                    onActionComplete={loadActiveAlerts}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t('emergencyAlertsDashboard.selectionnezUneAlertePourVoir')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyAlertsDashboard;

/**
 * Dashboard Bureau Syndicat pour gestion alertes SOS
 * Affichage temps réel des alertes d'urgence avec Supabase Realtime
 * Inclut lecteur de médias SOS
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Phone, Map, Navigation, CheckCircle, MapPin } from 'lucide-react';
import { taxiMotoSOSService } from '@/services/taxi/TaxiMotoSOSService';
import { supabase } from '@/integrations/supabase/client';
import type { SOSAlert } from '@/types/sos.types';
import { toast } from 'sonner';
import { SOSMediaPlayer } from './SOSMediaPlayer';

interface BureauSyndicatSOSDashboardProps {
  bureauId: string;
}

export function BureauSyndicatSOSDashboard({ bureauId }: BureauSyndicatSOSDashboardProps) {
  const { t } = useTranslation();
  const [sosAlerts, setSosAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh] = useState(true); // Toujours actif pour sécurité - pas de toggle

  // Charger les alertes depuis Supabase
  const loadSOSAlerts = async () => {
    try {
      // Charger TOUTES les alertes SOS actives (sans filtrer par bureau_id)
      const alerts = await taxiMotoSOSService.getActiveSOSAlerts();
      setSosAlerts(alerts);
      console.log('📢 Alertes SOS chargées:', alerts.length, alerts);
    } catch (error) {
      console.error('Erreur chargement SOS:', error);
      toast.error(t('bureauSyndicatSOSDashboard.erreurDeChargementDesAlertes'));
    } finally {
      setLoading(false);
    }
  };

  // Charger au montage et rafraîchir périodiquement
  useEffect(() => {
    loadSOSAlerts();

    // Rafraîchissement automatique toutes les 5 secondes
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadSOSAlerts();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [bureauId, autoRefresh]);

  // Écouter les nouvelles alertes SOS en temps réel via Supabase
  useEffect(() => {
    console.log('🔔 Configuration Realtime SOS...');

    const channel = supabase
      .channel('sos-alerts-realtime-' + Date.now())
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sos_alerts'
        },
        (payload) => {
          console.log('🚨 NOUVELLE ALERTE SOS REÇUE EN TEMPS RÉEL:', payload);

          // Notification sonore et visuelle IMPORTANTE
          toast.error('🚨 ALERTE SOS D\'URGENCE!', {
            description: `${payload.new.driver_name || 'Un conducteur'} a besoin d'aide immédiate!`,
            duration: 30000,
            action: {
              label: '🧭 Localiser',
              onClick: () => {
                if (payload.new.latitude && payload.new.longitude) {
                  window.open(`https://www.google.com/maps?q=${payload.new.latitude},${payload.new.longitude}`, '_blank', 'noopener,noreferrer');
                }
                loadSOSAlerts();
              }
            }
          });

          // Jouer un son d'alerte fort
          playAlertSound();

          // Recharger les alertes immédiatement
          loadSOSAlerts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sos_alerts'
        },
        (payload) => {
          console.log('📝 Alerte SOS mise à jour:', payload);
          loadSOSAlerts();
        }
      )
      .subscribe((status) => {
        console.log('🔔 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connecté au temps réel SOS!');
        }
      });

    return () => {
      console.log('🔕 Déconnexion temps réel SOS');
      supabase.removeChannel(channel);
    };
  }, []);

  // Jouer un son d'alerte
  const playAlertSound = () => {
    try {
      const audio = new Audio('/alert-sound.mp3');
      audio.volume = 0.8;
      audio.play().catch(() => {
        // Fallback: utiliser l'API Web Audio
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();
        setTimeout(() => oscillator.stop(), 500);
      });
    } catch (_error) {
      console.log('Son non disponible');
    }
  };

  const handleCallDriver = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleOpenMap = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer');
  };

  const handleNavigateToDriver = (lat: number, lng: number, driverName: string) => {
    // Essayer d'obtenir la position actuelle du bureau pour navigation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const origin = `${position.coords.latitude},${position.coords.longitude}`;
          const destination = `${lat},${lng}`;
          // Ouvrir Google Maps avec la navigation turn-by-turn
          const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving&dir_action=navigate`;
          window.open(url, '_blank', 'noopener,noreferrer');
          toast.success(`Navigation vers ${driverName} démarrée!`);
        },
        (error) => {
          console.error('Erreur GPS:', error);
          // Fallback: navigation sans position d'origine
          const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;
          window.open(url, '_blank', 'noopener,noreferrer');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      // Fallback: navigation simple
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleStartIntervention = async (sosId: string) => {
    const success = await taxiMotoSOSService.updateSOSStatus(sosId, 'EN_INTERVENTION');
    if (success) {
      loadSOSAlerts();
      toast.success(t('bureauSyndicatSOSDashboard.interventionDemarree'));
    }
  };

  const handleResolveSOS = async (sosId: string) => {
    const success = await taxiMotoSOSService.updateSOSStatus(sosId, 'RESOLU', bureauId);
    if (success) {
      loadSOSAlerts();
      toast.success(t('bureauSyndicatSOSDashboard.sosResoluAvecSucces'));
    }
  };

  const getStatusBadge = (status: string) => {
    // Normaliser les statuts pour l'affichage
    if (['DANGER', 'active', 'pending'].includes(status)) {
      return (
        <Badge className="bg-[#ff4000] text-white animate-pulse">
          🚨 DANGER ACTIF
        </Badge>
      );
    }
    if (['EN_INTERVENTION', 'in_progress'].includes(status)) {
      return (
        <Badge className="bg-orange-500 text-white">
          🚑 EN INTERVENTION
        </Badge>
      );
    }
    if (['RESOLU', 'resolved'].includes(status)) {
      return (
        <Badge className="bg-[#ff4000] text-white">
          ✅ RÉSOLU
        </Badge>
      );
    }
    return <Badge>{status}</Badge>;
  };

  const formatTimeSince = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins === 1) return 'Il y a 1 min';
    if (diffMins < 60) return `Il y a ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return 'Il y a 1 heure';
    if (diffHours < 24) return `Il y a ${diffHours} heures`;

    return then.toLocaleDateString('fr-FR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff4000] mx-auto" />
          <p className="text-muted-foreground">{t('bureauSyndicatSOSDashboard.chargementDesAlertesSos')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-[#ff4000]" />
            Alertes SOS
          </h2>
          <p className="text-muted-foreground mt-1">
            Gestion des alertes d'urgence en temps réel
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={autoRefresh ? 'default' : 'outline'} className="h-8">
            {autoRefresh ? '🟢 Temps réel actif' : '⏸️ Pause'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSOSAlerts}
          >
            🔄 Actualiser
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-orange-200 bg-orange-50 dark:bg-[#ff4000]/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#ff4000]">
                {sosAlerts.filter(a => ['DANGER', 'active', 'pending'].includes(a.status)).length}
              </div>
              <div className="text-sm text-muted-foreground mt-1">SOS Actifs</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600">
                {sosAlerts.filter(a => ['EN_INTERVENTION', 'in_progress'].includes(a.status)).length}
              </div>
              <div className="text-sm text-muted-foreground mt-1">En Intervention</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50 dark:bg-[#ff4000]/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Statut Realtime</div>
              <div className="text-2xl font-bold text-[#ff4000] mt-1">
                🟢 CONNECTÉ
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des alertes */}
      {sosAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-[#ff4000]" />
              <p className="text-lg font-medium">{t('bureauSyndicatSOSDashboard.aucuneAlerteSosActive')}</p>
              <p className="text-sm mt-2">{t('bureauSyndicatSOSDashboard.tousLesConducteursSontEn')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sosAlerts.map((sos) => (
            <Card key={sos.id} className="border-2 border-orange-200 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
                      {sos.driver_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      ID: {sos.taxi_driver_id?.substring(0, 8) || 'N/A'}
                    </p>
                  </div>
                  {getStatusBadge(sos.status)}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Informations */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">{t('bureauSyndicatSOSDashboard.telephone')}</span>
                    <p className="text-foreground">{sos.driver_phone || 'Non renseigné'}</p>
                  </div>
                  <div>
                    <span className="font-medium">{t('bureauSyndicatSOSDashboard.declenche')}</span>
                    <p className="text-foreground">{formatTimeSince(sos.triggered_at)}</p>
                  </div>
                  <div>
                    <span className="font-medium">📍 Position:</span>
                    <p className="text-foreground font-mono text-xs">
                      {sos.latitude?.toFixed(6) || 0}, {sos.longitude?.toFixed(6) || 0}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">{t('bureauSyndicatSOSDashboard.precision')}</span>
                    <p className="text-foreground">
                      {sos.accuracy ? `${Math.round(sos.accuracy)}m` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Historique GPS */}
                {sos.gps_history && sos.gps_history.length > 0 && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium text-sm mb-2">📍 Historique GPS ({sos.gps_history.length} points):</p>
                    <div className="flex flex-wrap gap-2">
                      {sos.gps_history.slice(0, 5).map((point, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {point.latitude?.toFixed(4)}, {point.longitude?.toFixed(4)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {sos.description && (
                  <div className="bg-orange-50 dark:bg-[#ff4000]/20 p-3 rounded-lg border border-orange-200">
                    <p className="text-sm text-foreground">{sos.description}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleCallDriver(sos.driver_phone)}
                    className="flex-1 min-w-[140px]"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Appeler
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenMap(sos.latitude, sos.longitude)}
                    className="flex-1 min-w-[140px]"
                  >
                    <Map className="w-4 h-4 mr-2" />
                    Voir carte
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleNavigateToDriver(sos.latitude, sos.longitude, sos.driver_name)}
                    className="flex-1 min-w-[160px] bg-[#04439e] text-white shadow-lg"
                  >
                    <Navigation className="w-4 h-4 mr-2 animate-pulse" />
                    🧭 Naviguer GPS
                  </Button>

                  {['DANGER', 'active', 'pending'].includes(sos.status) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStartIntervention(sos.id)}
                      className="flex-1 min-w-[140px] bg-orange-600 hover:bg-orange-700"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Intervenir
                    </Button>
                  )}

                  {['DANGER', 'active', 'pending', 'EN_INTERVENTION', 'in_progress'].includes(sos.status) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleResolveSOS(sos.id)}
                      className="flex-1 min-w-[140px] bg-[#ff4000] hover:bg-[#ff4000]"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Résoudre
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Section Médias SOS reçus */}
      <div className="mt-8">
        <SOSMediaPlayer />
      </div>
    </div>
  );
}

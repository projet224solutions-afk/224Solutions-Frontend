/**
 * EMERGENCY SOS BUTTON - Composant Conducteur
 * 224Solutions - Bouton d'urgence pour taxi-moto
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { emergencyService, gpsTrackingService } from '@/services/emergencyService';
import { useAuth } from '@/hooks/useAuth';
import type { EmergencyAlert } from '@/types/emergency';

interface EmergencySOSButtonProps {
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverCode?: string;
  bureauSyndicatId?: string;
  className?: string;
  variant?: 'floating' | 'inline';
  silentMode?: boolean;
}

export const EmergencySOSButton: React.FC<EmergencySOSButtonProps> = ({
  driverId: propDriverId,
  driverName,
  driverPhone,
  driverCode,
  bureauSyndicatId,
  className = '',
  variant = 'floating',
  silentMode = false
}) => {
  const { user } = useAuth();
  const driverId = propDriverId || user?.id;

  const [isActivated, setIsActivated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [activeAlert, setActiveAlert] = useState<EmergencyAlert | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<number>(-1);

  // Cooldown pour éviter les fausses touches (5 secondes)
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(cooldownSeconds - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Nettoyage du tracking GPS à la désactivation
  useEffect(() => {
    return () => {
      if (gpsWatchId >= 0) {
        gpsTrackingService.clearWatch(gpsWatchId);
      }
    };
  }, [gpsWatchId]);

  /**
   * Activer l'alerte d'urgence
   */
  const handleActivateEmergency = useCallback(async () => {
    if (!driverId) {
      toast.error('Erreur: Conducteur non identifié');
      return;
    }

    if (cooldownSeconds > 0) {
      toast.warning(`Veuillez attendre ${cooldownSeconds}s`);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Obtenir la position GPS actuelle
      const position = await gpsTrackingService.getCurrentPosition();

      // 2. Créer l'alerte d'urgence
      const alert = await emergencyService.createAlert({
        driver_id: driverId,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_code: driverCode,
        initial_latitude: position.latitude,
        initial_longitude: position.longitude,
        initial_accuracy: position.accuracy,
        silent_mode: silentMode,
        bureau_syndicat_id: bureauSyndicatId
      });

      setActiveAlert(alert);
      setIsActivated(true);

      // 3. Ajouter le point GPS initial
      await emergencyService.addGPSTracking({
        alert_id: alert.id,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        speed: position.speed,
        direction: position.direction,
        altitude: position.altitude
      });

      // 4. Démarrer le suivi GPS toutes les 2 secondes
      const watchId = gpsTrackingService.watchPosition(async (pos) => {
        try {
          // Ajouter le point à l'historique
          await emergencyService.addGPSTracking({
            alert_id: alert.id,
            latitude: pos.latitude,
            longitude: pos.longitude,
            accuracy: pos.accuracy,
            speed: pos.speed,
            direction: pos.direction,
            altitude: pos.altitude
          });

          // Mettre à jour la position actuelle dans l'alerte
          await emergencyService.updateAlert(alert.id, {
            current_latitude: pos.latitude,
            current_longitude: pos.longitude,
            current_accuracy: pos.accuracy,
            current_speed: pos.speed,
            current_direction: pos.direction
          });
        } catch (error) {
          console.error('❌ Erreur mise à jour GPS:', error);
        }
      }, 2000);

      setGpsWatchId(watchId);

      // 5. Notification selon le mode
      if (silentMode) {
        // Mode silencieux: toast discret
        toast.success('🚨 Alerte envoyée (mode silencieux)', {
          duration: 2000
        });
      } else {
        // Mode normal: notification sonore + visuelle
        toast.success('🚨 ALERTE D\'URGENCE ENVOYÉE!', {
          description: 'Le Bureau Syndicat a été notifié. Votre position est suivie en temps réel.',
          duration: 5000
        });

        // Son d'urgence (si supporté)
        try {
          const audio = new Audio('/sounds/emergency-alert.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => console.log('Son non disponible'));
        } catch (_error) {
          console.log('Son d\'urgence non disponible');
        }
      }

      // 6. Activer le cooldown
      setCooldownSeconds(5);

    } catch (error) {
      console.error('❌ Erreur activation urgence:', error);
      toast.error('Impossible d\'activer l\'alerte d\'urgence', {
        description: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    } finally {
      setIsLoading(false);
    }
  }, [driverId, driverName, driverPhone, driverCode, bureauSyndicatId, silentMode, cooldownSeconds]);

  /**
   * Désactiver l'alerte (uniquement par le conducteur, avant que le syndicat ne prenne en charge)
   */
  const handleDeactivateEmergency = useCallback(async () => {
    if (!activeAlert) return;

    try {
      // Marquer comme fausse alerte
      await emergencyService.markAsFalseAlert(
        activeAlert.id,
        driverId!,
        'Désactivé par le conducteur'
      );

      // Arrêter le tracking GPS
      if (gpsWatchId >= 0) {
        gpsTrackingService.clearWatch(gpsWatchId);
        setGpsWatchId(-1);
      }

      setIsActivated(false);
      setActiveAlert(null);

      toast.success('Alerte désactivée');
    } catch (error) {
      console.error('❌ Erreur désactivation:', error);
      toast.error('Erreur lors de la désactivation');
    }
  }, [activeAlert, driverId, gpsWatchId]);

  // Style selon le variant
  const buttonClasses = variant === 'floating'
    ? `fixed bottom-6 right-6 z-50 h-20 w-20 rounded-full shadow-2xl ${className}`
    : `h-14 w-full ${className}`;

  return (
    <div className={variant === 'floating' ? 'fixed bottom-6 right-6 z-50' : ''}>
      {!isActivated ? (
        <Button
          onClick={handleActivateEmergency}
          disabled={isLoading || cooldownSeconds > 0}
          className={`${buttonClasses} bg-[#ff4000] hover:bg-[#ff4000] text-white font-bold transition-all ${
            isLoading || cooldownSeconds > 0 ? 'opacity-50 cursor-not-allowed' : 'animate-pulse hover:scale-110'
          }`}
          style={{
            boxShadow: isActivated ? 'none' : '0 0 30px rgba(239, 68, 68, 0.6)'
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              {variant === 'inline' && <span className="ml-2">Activation...</span>}
            </>
          ) : cooldownSeconds > 0 ? (
            <>
              <span className="text-2xl font-bold">{cooldownSeconds}</span>
              {variant === 'inline' && <span className="ml-2">Veuillez patienter</span>}
            </>
          ) : (
            <>
              <AlertTriangle className={variant === 'floating' ? 'h-8 w-8' : 'h-6 w-6'} />
              {variant === 'inline' && <span className="ml-2">SOS URGENCE</span>}
            </>
          )}
        </Button>
      ) : (
        <div className={variant === 'floating' ? 'flex flex-col items-end gap-2' : 'flex flex-col gap-2'}>
          <div className="bg-[#ff4000] text-white px-4 py-3 rounded-lg shadow-lg animate-pulse flex items-center gap-3">
            <div className="h-3 w-3 bg-white rounded-full animate-ping" />
            <div>
              <p className="font-bold">🚨 ALERTE ACTIVE</p>
              <p className="text-xs opacity-90">Position suivie en temps réel</p>
            </div>
          </div>

          {activeAlert?.status === 'active' && (
            <Button
              onClick={handleDeactivateEmergency}
              variant="outline"
              className="bg-white"
              size={variant === 'floating' ? 'sm' : 'default'}
            >
              <Check className="h-4 w-4 mr-2" />
              Je suis en sécurité
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmergencySOSButton;

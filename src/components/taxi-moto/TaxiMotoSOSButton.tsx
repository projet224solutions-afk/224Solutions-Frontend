/**
 * Bouton SOS d'urgence pour conducteurs Taxi Moto
 * Pression longue 1.5s → SOS + enregistrement auto → envoi automatique au bureau syndicat
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { AlertTriangle, Square, Mic, CheckCircle } from 'lucide-react';
import { taxiMotoSOSService } from '@/services/taxi/TaxiMotoSOSService';
import { sosMediaRecorder } from '@/services/taxi/SOSMediaRecorder';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const AUTO_STOP_SECONDS = 60;

interface TaxiMotoSOSButtonProps {
  taxiId: string;
  driverName: string;
  driverPhone: string;
  bureauSyndicatId?: string;
  className?: string;
  variant?: 'default' | 'compact' | 'floating';
}

export function TaxiMotoSOSButton({
  taxiId,
  driverName,
  driverPhone,
  bureauSyndicatId,
  className,
  variant = 'default'
}: TaxiMotoSOSButtonProps) {
  const { t } = useTranslation();
  const [isPressed, setIsPressed] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [activeSOSId, setActiveSOSId] = useState<string | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [sending, setSending] = useState(false);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const cooldownTimer = useRef<NodeJS.Timeout | null>(null);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!taxiMotoSOSService.canTriggerSOS()) {
      setCooldownRemaining(taxiMotoSOSService.getCooldownRemaining());
      startCooldownTimer();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
      if (recordingTimer.current) clearInterval(recordingTimer.current);
    };
  }, []);

  // Compteur temps d'enregistrement
  useEffect(() => {
    if (!isActive || sending) {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      return;
    }
    setRecordingElapsed(0);
    recordingTimer.current = setInterval(() => {
      setRecordingElapsed(prev => prev + 1);
    }, 1000);
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
    };
  }, [isActive, sending]);

  const startCooldownTimer = () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      const remaining = taxiMotoSOSService.getCooldownRemaining();
      setCooldownRemaining(remaining);
      if (remaining === 0 && cooldownTimer.current) clearInterval(cooldownTimer.current);
    }, 1000);
  };

  const handlePressStart = () => {
    if (!taxiMotoSOSService.canTriggerSOS()) {
      toast.warning(`Attendez ${cooldownRemaining}s avant de réutiliser le SOS`);
      return;
    }
    setIsPressed(true);
    pressTimer.current = setTimeout(async () => {
      setIsPressed(false);
      await triggerSOS();
    }, 1500);
  };

  const handlePressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    setIsPressed(false);
  };

  const triggerSOS = async () => {
    try {
      setIsActive(true);
      setSending(false);

      const result = await taxiMotoSOSService.triggerSOS(
        taxiId,
        driverName,
        driverPhone,
        bureauSyndicatId,
        'Alerte SOS déclenchée par le conducteur'
      );

      if (result.success && result.sos_id) {
        setActiveSOSId(result.sos_id);
        startCooldownTimer();
        toast.success(t('taxiMotoSOSButton.sosEnvoyeEnregistrementDemarre'), {
          description: t('taxiMotoSOSButton.audioVideoEnregistresEnvoiAutomatique'),
          duration: 8000
        });
      } else {
        setIsActive(false);
        toast.error('Erreur SOS', { description: result.message });
      }
    } catch (error) {
      console.error('Erreur SOS:', error);
      setIsActive(false);
      toast.error(t('taxiMotoSOSButton.erreurLorsDeLEnvoi'));
    }
  };

  // Arrêt manuel → envoi automatique quand même
  const stopRecording = () => {
    if (!activeSOSId) return;
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    setSending(true);
    sosMediaRecorder.stopSOSRecording(activeSOSId);
    toast.info(t('taxiMotoSOSButton.enregistrementArreteEnvoiAuBureau'), {
      duration: 4000
    });
    // Fermer le panneau après l'envoi
    setTimeout(() => {
      setIsActive(false);
      setActiveSOSId(null);
      setSending(false);
    }, 4000);
  };

  const timeLeft = Math.max(0, AUTO_STOP_SECONDS - recordingElapsed);
  const progressPct = Math.min(100, (recordingElapsed / AUTO_STOP_SECONDS) * 100);

  const buttonClasses = cn(
    'font-bold transition-all duration-300',
    variant === 'floating' && 'fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-2xl',
    variant === 'compact' && 'h-9 px-3',
    variant === 'default' && 'w-full h-14',
    isPressed && 'scale-95',
    isActive ? 'bg-[#ff4000] hover:bg-[#ff4000]' : 'bg-[#ff4000] hover:bg-[#ff4000]',
    cooldownRemaining > 0 && !isActive && 'opacity-50 cursor-not-allowed',
    className
  );

  return (
    <>
      {/* Bouton principal SOS */}
      <Button
        className={buttonClasses}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        disabled={cooldownRemaining > 0 && !isActive}
        variant="destructive"
        size={variant === 'compact' ? 'sm' : 'default'}
      >
        <div className="flex items-center gap-2">
          {isActive ? (
            <>
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              {variant !== 'floating' && <span>SOS ACTIF</span>}
            </>
          ) : isPressed ? (
            <>
              <AlertTriangle className="w-5 h-5 animate-spin" />
              {variant !== 'floating' && <span>Maintenir...</span>}
            </>
          ) : cooldownRemaining > 0 ? (
            <>
              <AlertTriangle className="w-5 h-5" />
              {variant !== 'floating' && <span>⏱️ {cooldownRemaining}s</span>}
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5" />
              {variant !== 'floating' && <span>SOS</span>}
            </>
          )}
        </div>
      </Button>

      {/* Panneau enregistrement — affiché au-dessus de la barre de navigation */}
      {isActive && activeSOSId && (
        <div className="fixed bottom-20 left-3 right-3 z-50 bg-gray-950/97 backdrop-blur-sm rounded-2xl border border-[#ff4000]/40 shadow-2xl overflow-hidden">

          {/* En-tête statut */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
            {sending ? (
              <CheckCircle className="w-4 h-4 text-[#ff4000] shrink-0" />
            ) : (
              <div className="w-3 h-3 bg-[#ff4000] rounded-full animate-pulse shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("font-bold text-sm", sending ? "text-[#ff4000]" : "text-[#ff4000]")}>
                {sending ? 'Envoi en cours...' : 'SOS ACTIF'}
              </p>
              <p className="text-gray-400 text-xs flex items-center gap-1">
                <Mic className="w-3 h-3" />
                {sending
                  ? 'Transmission au Bureau Syndicat'
                  : 'Enregistrement audio & vidéo en cours'}
              </p>
            </div>
            {!sending && (
              <span className="text-gray-400 text-xs font-mono shrink-0">
                {String(Math.floor(recordingElapsed / 60)).padStart(2, '0')}:
                {String(recordingElapsed % 60).padStart(2, '0')}
              </span>
            )}
          </div>

          {/* Barre de progression */}
          {!sending && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                <span>Enregistrement</span>
                <span className={cn(timeLeft <= 10 && 'text-[#ff4000] font-bold animate-pulse')}>
                  Envoi auto dans {timeLeft}s
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    timeLeft <= 10 ? 'bg-[#ff4000]' : 'bg-[#ff4000]'
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Bouton arrêter */}
          {!sending && (
            <div className="p-4">
              <Button
                onClick={stopRecording}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold"
                size="sm"
              >
                <Square className="w-4 h-4 mr-2" />
                Arrêter l'enregistrement
              </Button>
              <p className="text-center text-gray-500 text-[10px] mt-2">
                L'enregistrement sera envoyé automatiquement au Bureau Syndicat
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

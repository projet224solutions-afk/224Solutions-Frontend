/**
 * PIN Prompt - Interface de saisie du code PIN pour authentification offline
 * 224SOLUTIONS - Mode Offline Avancé
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authenticateWithPIN, getRemainingAttempts, canAuthenticate } from '@/lib/offline/auth/offlineAuth';
import { authenticateWithBiometric, isBiometricAvailable, isBiometricConfigured } from '@/lib/offline/auth/biometric';
import { toast } from 'sonner';

interface PINPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
  userId: string;
  title?: string;
  description?: string;
  pinLength?: number;
  allowBiometric?: boolean;
}

export function PINPrompt({
  isOpen,
  onClose,
  onSuccess,
  userId,
  title = 'Authentification requise',
  description = 'Veuillez entrer votre code PIN pour continuer',
  pinLength = 4,
  allowBiometric = true
}: PINPromptProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Vérifier la disponibilité de la biométrie
  useEffect(() => {
    if (allowBiometric) {
      checkBiometric();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowBiometric, userId]);

  const checkBiometric = async () => {
    const { available } = await isBiometricAvailable();
    const configured = isBiometricConfigured(userId);
    setBiometricAvailable(available && configured);
  };

  // Focus automatique sur le premier input
  useEffect(() => {
    if (isOpen) {
      inputRefs.current[0]?.focus();
      setPin('');
      setError(null);
      setRemainingAttempts(null);
    }
  }, [isOpen]);

  // Gérer la saisie
  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Seulement des chiffres

    const newPin = pin.split('');
    newPin[index] = value.slice(-1); // Prendre seulement le dernier caractère
    const updatedPin = newPin.join('');

    setPin(updatedPin);
    setError(null);

    // Focus sur le prochain input
    if (value && index < pinLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit si PIN complet
    if (updatedPin.length === pinLength) {
      handleSubmit(updatedPin);
    }
  };

  // Gérer le backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Authentifier avec PIN
  const handleSubmit = async (pinValue: string = pin) => {
    if (pinValue.length !== pinLength) {
      setError(`Le PIN doit contenir ${pinLength} chiffres`);
      return;
    }

    // Vérifier si l'utilisateur peut s'authentifier
    const authCheck = canAuthenticate(userId);
    if (!authCheck.allowed) {
      setError(authCheck.reason || 'Authentification bloquée');
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const result = await authenticateWithPIN(userId, pinValue);

      if (result.success && result.sessionId) {
        toast.success(t('pINPrompt.authentificationReussie'));
        onSuccess(result.sessionId);
        onClose();
      } else {
        setError(result.error || 'Authentification échouée');
        setRemainingAttempts(result.attemptsRemaining ?? null);
        setPin('');
        inputRefs.current[0]?.focus();

        if (result.lockedUntil) {
          toast.error(`Compte verrouillé jusqu'à ${result.lockedUntil.toLocaleTimeString()}`);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de l\'authentification');
      setPin('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Authentifier avec biométrie
  const handleBiometric = async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const result = await authenticateWithBiometric(userId);

      if (result.success && result.sessionId) {
        toast.success(t('pINPrompt.authentificationBiometriqueReussie'));
        onSuccess(result.sessionId);
        onClose();
      } else {
        setError(result.error || 'Authentification biométrique échouée');
        toast.error(result.error || 'Authentification échouée');
      }
    } catch (error: any) {
      setError(error.message || 'Erreur biométrique');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Inputs PIN */}
          <div className="space-y-4">
            <div className="flex justify-center gap-3">
              {Array.from({ length: pinLength }).map((_, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={1}
                  value={pin[index] || ''}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={isAuthenticating}
                  className={cn(
                    'w-12 h-14 text-center text-2xl font-bold rounded-lg border-2',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
                    'transition-all',
                    error
                      ? 'border-[#ff4000] bg-orange-50 dark:bg-[#ff4000]/20'
                      : 'border-gray-300 dark:border-gray-600',
                    pin[index] && 'border-primary bg-primary/5'
                  )}
                />
              ))}
            </div>

            {/* Toggle affichage PIN */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
              >
                {showPin ? (
                  <>
                    <EyeOff className="w-3 h-3" />
                    <span>{t('pINPrompt.masquerLePin')}</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    <span>{t('pINPrompt.afficherLePin')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Message d'erreur */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg">
              <AlertCircle className="w-4 h-4 text-[#ff4000] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#ff4000] dark:text-[#ff4000]">{error}</p>
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <p className="text-xs text-[#ff4000] dark:text-[#ff4000] mt-1">
                    {remainingAttempts} tentative(s) restante(s)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Message de succès (PIN complet) */}
          {pin.length === pinLength && !error && !isAuthenticating && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg">
              <CheckCircle className="w-4 h-4 text-[#ff4000]" />
              <p className="text-sm text-[#ff4000] dark:text-[#ff4000]">{t('pINPrompt.verificationEnCours')}</p>
            </div>
          )}

          {/* Bouton biométrie */}
          {biometricAvailable && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-gray-800 px-2 text-gray-500">{t('pINPrompt.ou')}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBiometric}
                disabled={isAuthenticating}
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                Utiliser la biométrie
              </Button>
            </>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isAuthenticating}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => handleSubmit()}
              disabled={pin.length !== pinLength || isAuthenticating}
            >
              {isAuthenticating ? 'Vérification...' : 'Valider'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PINPrompt;

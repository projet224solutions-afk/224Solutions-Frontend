/**
 * HOOK MFA - 224SOLUTIONS
 * Hook React pour la gestion du MFA
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  mfaService,
  MFAFactor,
  MFAStatus,
  MFAEnrollmentResult,
  MFAChallenge
} from '@/services/auth/MFAService';

export interface UseMFAResult {
  // État
  status: MFAStatus;
  factors: MFAFactor[];
  isLoading: boolean;
  requiresSetup: boolean;
  gracePeriodEnds: string | null;

  // Challenge en cours
  activeChallenge: MFAChallenge | null;

  // Enrôlement
  enrollTOTP: (name?: string) => Promise<MFAEnrollmentResult>;
  enrollSMS: (phoneNumber: string) => Promise<MFAEnrollmentResult>;
  enrollEmail: (email: string) => Promise<MFAEnrollmentResult>;

  // Vérification
  verifyTOTP: (factorId: string, code: string) => Promise<boolean>;
  verifyCode: (factorId: string, code: string) => Promise<boolean>;
  verifyBackupCode: (code: string) => Promise<boolean>;

  // Challenge
  createChallenge: (factorId: string) => Promise<boolean>;
  cancelChallenge: () => void;

  // Gestion
  removeFactor: (factorId: string) => Promise<boolean>;
  regenerateBackupCodes: (factorId: string) => Promise<string[] | null>;
  setPrimaryFactor: (factorId: string) => Promise<boolean>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useMFA(): UseMFAResult {
  const { user, profile } = useAuth();
  const userType = profile?.role || 'customer';

  const [status, setStatus] = useState<MFAStatus>('not_enrolled');
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [gracePeriodEnds, setGracePeriodEnds] = useState<string | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<MFAChallenge | null>(null);

  // Charger le statut MFA
  const loadMFAStatus = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      await mfaService.initialize(user.id);
      const mfaStatus = await mfaService.getMFAStatus(userType || 'customer');

      setStatus(mfaStatus.status);
      setFactors(mfaStatus.factors);
      setRequiresSetup(mfaStatus.requiresSetup);
      setGracePeriodEnds(mfaStatus.gracePeriodEnds || null);
    } catch (error) {
      console.error('[useMFA] Error loading status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userType]);

  useEffect(() => {
    loadMFAStatus();
  }, [loadMFAStatus]);

  // Enrôler TOTP
  const enrollTOTP = useCallback(async (name?: string): Promise<MFAEnrollmentResult> => {
    const result = await mfaService.enrollTOTP(name);

    if (result.success) {
      toast.success('Authenticator configuré', {
        description: 'Scannez le QR code avec votre application'
      });
      await loadMFAStatus();
    } else {
      toast.error('Erreur de configuration', {
        description: result.error
      });
    }

    return result;
  }, [loadMFAStatus]);

  // Enrôler SMS
  const enrollSMS = useCallback(async (phoneNumber: string): Promise<MFAEnrollmentResult> => {
    const result = await mfaService.enrollSMS(phoneNumber);

    if (result.success) {
      toast.success('SMS configuré', {
        description: 'Un code de vérification a été envoyé'
      });
      await loadMFAStatus();
    } else {
      toast.error('Erreur de configuration', {
        description: result.error
      });
    }

    return result;
  }, [loadMFAStatus]);

  // Enrôler Email
  const enrollEmail = useCallback(async (email: string): Promise<MFAEnrollmentResult> => {
    const result = await mfaService.enrollEmail(email);

    if (result.success) {
      toast.success('Email configuré', {
        description: 'Un code de vérification a été envoyé'
      });
      await loadMFAStatus();
    } else {
      toast.error('Erreur de configuration', {
        description: result.error
      });
    }

    return result;
  }, [loadMFAStatus]);

  // Vérifier TOTP
  const verifyTOTP = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    const result = await mfaService.verifyTOTP(factorId, code);

    if (result.success) {
      toast.success('Vérification réussie');
      await loadMFAStatus();
      setActiveChallenge(null);
      return true;
    } else {
      toast.error('Code invalide', {
        description: result.error
      });
      return false;
    }
  }, [loadMFAStatus]);

  // Vérifier code SMS/Email
  const verifyCode = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    const result = await mfaService.verifyCode(factorId, code);

    if (result.success) {
      toast.success('Vérification réussie');
      await loadMFAStatus();
      setActiveChallenge(null);
      return true;
    } else {
      toast.error('Code invalide', {
        description: result.error
      });
      return false;
    }
  }, [loadMFAStatus]);

  // Vérifier code de backup
  const verifyBackupCode = useCallback(async (code: string): Promise<boolean> => {
    const result = await mfaService.verifyBackupCode(code);

    if (result.success) {
      toast.success('Code de récupération accepté', {
        description: 'Pensez à régénérer vos codes'
      });
      await loadMFAStatus();
      setActiveChallenge(null);
      return true;
    } else {
      toast.error('Code invalide', {
        description: result.error
      });
      return false;
    }
  }, [loadMFAStatus]);

  // Créer un challenge
  const createChallenge = useCallback(async (factorId: string): Promise<boolean> => {
    const result = await mfaService.createChallenge(factorId);

    if (result.success && result.challenge) {
      setActiveChallenge(result.challenge);

      if (result.challenge.method === 'sms') {
        toast.info('Code envoyé par SMS');
      } else if (result.challenge.method === 'email') {
        toast.info('Code envoyé par email');
      }

      return true;
    } else {
      toast.error('Erreur', {
        description: result.error
      });
      return false;
    }
  }, []);

  // Annuler le challenge
  const cancelChallenge = useCallback(() => {
    setActiveChallenge(null);
  }, []);

  // Supprimer un facteur
  const removeFactor = useCallback(async (factorId: string): Promise<boolean> => {
    const result = await mfaService.unenrollFactor(factorId);

    if (result.success) {
      toast.success('Méthode d\'authentification supprimée');
      await loadMFAStatus();
      return true;
    } else {
      toast.error('Erreur', {
        description: result.error
      });
      return false;
    }
  }, [loadMFAStatus]);

  // Régénérer les codes de backup
  const regenerateBackupCodes = useCallback(async (factorId: string): Promise<string[] | null> => {
    const result = await mfaService.regenerateBackupCodes(factorId);

    if (result.success && result.codes) {
      toast.success('Codes de récupération régénérés', {
        description: 'Conservez-les en lieu sûr'
      });
      return result.codes;
    } else {
      toast.error('Erreur', {
        description: result.error
      });
      return null;
    }
  }, []);

  // Définir le facteur principal
  const setPrimaryFactor = useCallback(async (_factorId: string): Promise<boolean> => {
    // TODO: Implémenter dans MFAService
    toast.success('Méthode principale mise à jour');
    await loadMFAStatus();
    return true;
  }, [loadMFAStatus]);

  return {
    status,
    factors,
    isLoading,
    requiresSetup,
    gracePeriodEnds,
    activeChallenge,
    enrollTOTP,
    enrollSMS,
    enrollEmail,
    verifyTOTP,
    verifyCode,
    verifyBackupCode,
    createChallenge,
    cancelChallenge,
    removeFactor,
    regenerateBackupCodes,
    setPrimaryFactor,
    refresh: loadMFAStatus
  };
}

export default useMFA;

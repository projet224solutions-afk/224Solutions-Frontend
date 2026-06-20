import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { bureauFetch } from '@/lib/bureauApi';
import {
  isAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
  formatRemainingTime
} from '@/lib/security/accountLockout';

interface BureauLoginResponse {
  success: boolean;
  message: string;
  requires_otp?: boolean;
  identifier?: string;
  otp_expires_at?: string;
  error?: string;
  attempts_remaining?: number;
}

interface VerifyOTPResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    bureau_code: string;
    president_email: string;
    president_phone: string;
    prefecture: string;
    commune: string;
  };
  user_type?: string;
  session_token?: string;
  redirect_url?: string;
  error?: string;
  attempts_remaining?: number;
}

export const useBureauAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [requiresOTP, setRequiresOTP] = useState(false);
  const [identifier, setIdentifier] = useState<string>('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<string>('');

  /**
   * Étape 1: Login avec identifiant (email/phone) + mot de passe
   */
  const login = async (identifierValue: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      // Vérifier verrouillage
      const lockStatus = isAccountLocked(identifierValue);
      if (lockStatus.locked && lockStatus.remainingTime) {
        const timeStr = formatRemainingTime(lockStatus.remainingTime);
        toast.error(
          `🔒 Compte verrouillé pour ${timeStr} suite à trop de tentatives échouées`,
          { duration: 6000 }
        );
        setIsLoading(false);
        return false;
      }

      const { data, error } = await supabase.functions.invoke<BureauLoginResponse>(
        'auth-bureau-login',
        {
          body: {
            identifier: identifierValue,
            password: password
          }
        }
      );

      if (error) {
        console.error('[useBureauAuth] Erreur invocation:', error);
        toast.error('Erreur de connexion. Veuillez réessayer.');
        return false;
      }

      if (!data) {
        toast.error('Réponse vide du serveur');
        return false;
      }

      if (!data.success) {
        // Enregistrer échec
        const lockResult = recordFailedAttempt(identifierValue);

        if (lockResult.locked && lockResult.lockoutDuration) {
          const lockMinutes = Math.ceil(lockResult.lockoutDuration / 60);
          toast.error(
            `🔒 Trop de tentatives échouées. Compte verrouillé pour ${lockMinutes} minutes.`,
            { duration: 8000 }
          );
        } else {
          toast.error(data.error || 'Identifiant ou mot de passe incorrect');

          if (lockResult.remainingAttempts !== undefined) {
            toast.warning(
              `⚠️ ${lockResult.remainingAttempts} tentative(s) restante(s) avant verrouillage`,
              { duration: 5000 }
            );
          }
        }

        return false;
      }

      // Succès → Réinitialiser compteur
      resetFailedAttempts(identifierValue);

      // Succès étape 1 → OTP envoyé
      if (data.requires_otp) {
        setRequiresOTP(true);
        setIdentifier(data.identifier || identifierValue);
        setOtpExpiresAt(data.otp_expires_at || '');

        toast.success(data.message || 'Code de sécurité envoyé à votre email');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[useBureauAuth] Erreur login:', error);
      toast.error('Erreur lors de la connexion');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Étape 2: Vérification OTP
   */
  const verifyOTP = async (otp: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      // Vérification OTP + émission du JWT bureau SIGNÉ côté backend (auth réelle).
      const data = await bureauFetch<any>('/api/v2/bureau/auth/verify-otp', {
        method: 'POST', auth: false, body: { identifier, otp },
      });

      if (!data.success) {
        toast.error(data.error || 'Code incorrect');
        const remaining = (data as any).attempts_remaining;
        if (remaining !== undefined) {
          if (remaining === 0) { toast.error('Trop de tentatives. Demandez un nouveau code.'); setRequiresOTP(false); }
          else toast.warning(`⚠️ ${remaining} tentative(s) restante(s)`);
        }
        return false;
      }

      const token = (data as any).token;
      const bureau = (data as any).bureau;
      if (token && bureau?.id) {
        const sessionData = {
          token, // JWT signé serveur (validé par /api/v2/bureau/*)
          bureauId: bureau.id,
          bureauCode: bureau.bureau_code,
          commune: bureau.commune,
          prefecture: bureau.prefecture,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        sessionStorage.setItem('bureau_session', JSON.stringify(sessionData));
        toast.success(`Bienvenue Bureau ${bureau.bureau_code} - ${bureau.commune} !`);
        setTimeout(() => { window.location.href = '/bureau'; }, 500);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[useBureauAuth] Erreur vérification OTP:', error);
      toast.error('Erreur lors de la vérification');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renvoyer OTP
   */
  const resendOTP = async (): Promise<void> => {
    setIsLoading(true);

    try {
      toast.info('Nouveau code en cours d\'envoi...');

      // Pour simplifier, on réinitialise et demande de ressaisir mot de passe
      toast.warning('Veuillez vous reconnecter pour recevoir un nouveau code');
      setRequiresOTP(false);
      setIdentifier('');
      setOtpExpiresAt('');

    } catch (error) {
      console.error('[useBureauAuth] Erreur renvoi OTP:', error);
      toast.error('Erreur lors du renvoi du code');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout
   */
  const logout = () => {
    // Nettoyer toutes les sessions possibles
    sessionStorage.removeItem('bureau_session');
    localStorage.removeItem('bureau_session');
    // Anciens formats pour rétrocompatibilité
    localStorage.removeItem('bureau_user');
    sessionStorage.removeItem('bureau_user');
    toast.success('Déconnexion réussie');
    window.location.href = '/';
  };

  /**
   * Vérifier si bureau connecté (vérifie aussi l'expiration)
   */
  const isAuthenticated = (): boolean => {
    const sessionStr = sessionStorage.getItem('bureau_session') || localStorage.getItem('bureau_session');
    if (!sessionStr) return false;

    try {
      const session = JSON.parse(sessionStr);
      // Vérifier expiration
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        // Session expirée, nettoyer
        logout();
        return false;
      }
      return !!session.token && !!session.bureauId;
    } catch {
      return false;
    }
  };

  /**
   * Obtenir bureau connecté
   */
  const getCurrentBureau = () => {
    const sessionStr = sessionStorage.getItem('bureau_session') || localStorage.getItem('bureau_session');
    if (!sessionStr) return null;

    try {
      const session = JSON.parse(sessionStr);
      // Vérifier expiration
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        return null;
      }
      return {
        id: session.bureauId,
        bureau_code: session.bureauCode,
        commune: session.commune,
        prefecture: session.prefecture
      };
    } catch {
      return null;
    }
  };

  return {
    login,
    verifyOTP,
    resendOTP,
    logout,
    isAuthenticated,
    getCurrentBureau,
    isLoading,
    requiresOTP,
    identifier,
    otpExpiresAt
  };
};

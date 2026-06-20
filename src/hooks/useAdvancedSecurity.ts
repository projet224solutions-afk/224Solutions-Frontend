import { useState } from 'react';
import { RateLimiter } from '@/lib/security/rateLimit';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SecurityStatus {
  rateLimitExceeded: boolean;
  bruteForceDetected: boolean;
  isBlocked: boolean;
  lastActivity: Date | null;
}

export const useAdvancedSecurity = (_userId?: string) => {
  const [status, setStatus] = useState<SecurityStatus>({
    rateLimitExceeded: false,
    bruteForceDetected: false,
    isBlocked: false,
    lastActivity: null
  });

  /**
   * Vérifie si l'utilisateur n'est pas bloqué
   */
  const checkIfBlocked = async (identifier: string) => {
    try {
      const { data, error } = await supabase
        .from('failed_login_attempts')
        .select('*')
        .eq('identifier', identifier)
        .gte('blocked_until', new Date().toISOString())
        .single();

      if (data) {
        setStatus(prev => ({ ...prev, isBlocked: true }));
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  /**
   * Vérifie le rate limit avant une action
   */
  const checkRateLimit = async (
    identifier: string,
    action: string,
    maxRequests?: number,
    windowMinutes?: number
  ) => {
    const result = await RateLimiter.checkLimit(
      identifier,
      action,
      maxRequests,
      windowMinutes
    );

    if (!result.allowed) {
      setStatus(prev => ({ ...prev, rateLimitExceeded: true }));
      toast.error(`Trop de requêtes. Réessayez dans ${Math.ceil((result.resetAt.getTime() - Date.now()) / 60000)} minutes`);
      return false;
    }

    return true;
  };

  /**
   * Enregistre une tentative de connexion échouée
   */
  const recordFailedLogin = async (identifier: string, ipAddress?: string) => {
    try {
      const { data: existing } = await supabase
        .from('failed_login_attempts')
        .select('*')
        .eq('identifier', identifier)
        .single();

      if (existing) {
        const newCount = (existing.attempt_count || 0) + 1;
        const blockedUntil = newCount >= 5
          ? new Date(Date.now() + 30 * 60 * 1000) // Bloqué 30 min après 5 tentatives
          : null;

        await supabase
          .from('failed_login_attempts')
          .update({
            attempt_count: newCount,
            last_attempt: new Date().toISOString(),
            blocked_until: blockedUntil?.toISOString(),
            ip_address: ipAddress
          })
          .eq('identifier', identifier);

        if (blockedUntil) {
          setStatus(prev => ({ ...prev, bruteForceDetected: true, isBlocked: true }));
          toast.error('Compte temporairement bloqué suite à trop de tentatives échouées');
        }
      } else {
        await supabase
          .from('failed_login_attempts')
          .insert({
            identifier,
            ip_address: ipAddress,
            attempt_count: 1
          });
      }
    } catch (error) {
      console.error('Failed to record failed login:', error);
    }
  };

  /**
   * Réinitialise les tentatives de connexion échouées après succès
   */
  const resetFailedAttempts = async (identifier: string) => {
    try {
      await supabase
        .from('failed_login_attempts')
        .delete()
        .eq('identifier', identifier);

      setStatus(prev => ({
        ...prev,
        bruteForceDetected: false,
        isBlocked: false
      }));
    } catch (error) {
      console.error('Failed to reset failed attempts:', error);
    }
  };

  return {
    status,
    checkIfBlocked,
    checkRateLimit,
    recordFailedLogin,
    resetFailedAttempts
  };
};

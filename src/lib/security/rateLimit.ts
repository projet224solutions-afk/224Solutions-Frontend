import { supabase } from '@/integrations/supabase/client';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export class RateLimiter {
  /**
   * Vérifie si une action est autorisée selon le rate limit
   * @param identifier - Identifiant unique (user_id, IP, etc.)
   * @param action - Type d'action (login, api_call, etc.)
   * @param maxRequests - Nombre max de requêtes
   * @param windowMinutes - Fenêtre temporelle en minutes
   */
  static async checkLimit(
    identifier: string,
    action: string,
    maxRequests: number = 10,
    windowMinutes: number = 1
  ): Promise<RateLimitResult> {
    try {
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_identifier: identifier,
        p_action: action,
        p_max_requests: maxRequests,
        p_window_minutes: windowMinutes
      });

      if (error) throw error;

      const resetAt = new Date();
      resetAt.setMinutes(resetAt.getMinutes() + windowMinutes);

      return {
        allowed: data as boolean,
        remaining: data ? maxRequests - 1 : 0,
        resetAt
      };
    } catch (error) {
      console.error('🔴 Rate limit check failed - BLOCKING for security:', error);
      // Fail CLOSED pour sécurité: bloquer en cas d'erreur
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + windowMinutes * 60000)
      };
    }
  }

  /**
   * Rate limits prédéfinis pour différentes actions
   */
  static readonly LIMITS = {
    // Authentification
    LOGIN: { max: 5, window: 15 },
    REGISTER: { max: 3, window: 60 },
    PASSWORD_RESET: { max: 3, window: 60 },

    // Transactions financières
    WALLET_TRANSFER: { max: 10, window: 5 },
    CARD_TRANSACTION: { max: 20, window: 10 },

    // API calls
    API_CALL: { max: 100, window: 1 },
    HEAVY_API_CALL: { max: 10, window: 1 },

    // Actions utilisateur
    CREATE_ORDER: { max: 50, window: 5 },
    SEND_MESSAGE: { max: 30, window: 1 },
    UPLOAD_FILE: { max: 10, window: 5 }
  };
}

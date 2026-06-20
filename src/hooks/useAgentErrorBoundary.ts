/**
 * AGENT ERROR BOUNDARY HOOK - 224SOLUTIONS
 * Gestion centralisée des erreurs pour l'interface agent
 */

import { useState, useCallback } from 'react';

export type AgentErrorType =
  | 'user'          // Création/gestion utilisateurs
  | 'sub_agent'     // Gestion sous-agents
  | 'commission'    // Calcul/retrait commissions
  | 'payment'       // Transactions wallet
  | 'network'       // Erreurs réseau/Supabase
  | 'permission'    // Erreurs permissions
  | 'kyc'           // Vérification KYC
  | 'validation'    // Validation formulaires
  | 'stats'         // Chargement statistiques
  | 'wallet'        // Opérations wallet
  | 'unknown';      // Erreur non catégorisée

interface AgentError {
  type: AgentErrorType;
  message: string;
}

export const useAgentErrorBoundary = () => {
  const [error, setError] = useState<AgentError | null>(null);

  const captureError = useCallback((
    type: AgentErrorType,
    message: string,
    originalError?: any
  ) => {
    console.error(`[AgentError:${type}]`, message, originalError);
    setError({ type, message });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    captureError,
    clearError
  };
};

/**
 * Hook pour gérer les erreurs de l'interface livreur
 * Capture centralisée des erreurs GPS, réseau, paiement, etc.
 */

import { useState, useCallback } from 'react';

export type LivreurErrorType =
  | 'gps'
  | 'env'
  | 'permission'
  | 'payment'
  | 'network'
  | 'kyc'
  | 'subscription'
  | 'unknown';

interface LivreurError {
  type: LivreurErrorType;
  message: string;
}

export function useLivreurErrorBoundary() {
  const [error, setError] = useState<LivreurError | null>(null);

  const captureError = useCallback((
    type: LivreurErrorType,
    message: string,
    originalError?: any
  ) => {
    console.error(`[LivreurError] ${type}:`, message, originalError);
    setError({ type, message });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    captureError,
    clearError,
  };
}

/**
 * Hook de gestion d'erreurs centralisée pour l'interface Bureau Syndicat
 * Capture et stocke les erreurs pour affichage persistant
 */

import { useState, useCallback } from 'react';

export type BureauErrorType =
  | 'member_error'           // Erreur gestion membres
  | 'worker_error'           // Erreur travailleurs bureau
  | 'vehicle_error'          // Erreur véhicules/motos
  | 'wallet_error'           // Erreur wallet bureau
  | 'sync_error'             // Erreur synchronisation offline
  | 'validation_error'       // Validation données
  | 'network_error'          // Problème réseau
  | 'security_alert_error'   // Erreur alertes sécurité
  | 'permission_error'       // Accès refusé
  | 'unknown_error';         // Erreur inconnue

export interface BureauError {
  type: BureauErrorType;
  message: string;
}

export function useBureauErrorBoundary() {
  const [error, setError] = useState<BureauError | null>(null);

  const captureError = useCallback((type: BureauErrorType, message: string, originalError?: any) => {
    console.error(`[Bureau Error - ${type}]:`, message, originalError);
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

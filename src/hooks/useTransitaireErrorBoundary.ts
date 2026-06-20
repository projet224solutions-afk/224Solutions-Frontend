/**
 * TRANSITAIRE ERROR BOUNDARY HOOK - 224SOLUTIONS
 * Gestion centralisée des erreurs pour l'interface transitaire international
 */

import { useState, useCallback } from 'react';

export type TransitaireErrorType =
  | 'shipment_error'      // Erreurs création/gestion expéditions
  | 'customs_error'       // Erreurs traitement douanier
  | 'tracking_error'      // Erreurs suivi en temps réel
  | 'document_error'      // Erreurs génération documents
  | 'payment_error'       // Erreurs paiement frais
  | 'network_error'       // Erreurs réseau/Supabase
  | 'validation_error'    // Erreurs validation formulaires
  | 'permission_error'    // Erreurs permissions
  | 'sync_error'          // Erreurs synchronisation données
  | 'unknown_error';      // Erreur non catégorisée

interface TransitaireError {
  type: TransitaireErrorType;
  message: string;
}

export const useTransitaireErrorBoundary = () => {
  const [error, setError] = useState<TransitaireError | null>(null);

  const captureError = useCallback((
    type: TransitaireErrorType,
    message: string,
    originalError?: any
  ) => {
    console.error(`[Transitaire Error - ${type}]:`, message, originalError);
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
};

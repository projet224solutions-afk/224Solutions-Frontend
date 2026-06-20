/**
 * HOOK ERROR BOUNDARY CLIENT - 224SOLUTIONS
 * Gestion centralisée des erreurs pour l'interface Client
 * 10 types d'erreurs spécifiques au contexte client e-commerce
 */

import { useState, useCallback } from 'react';

export type ClientErrorType =
  | 'ORDER_ERROR'
  | 'PAYMENT_ERROR'
  | 'CART_ERROR'
  | 'FAVORITES_ERROR'
  | 'PRODUCT_ERROR'
  | 'COMMUNICATION_ERROR'
  | 'WALLET_ERROR'
  | 'PROFILE_ERROR'
  | 'SHIPPING_ERROR'
  | 'GENERAL_ERROR';

export interface ClientError {
  type: ClientErrorType;
  message: string;
  details?: string;
  timestamp: Date;
  action?: string;
}

export function useClientErrorBoundary() {
  const [error, setError] = useState<ClientError | null>(null);

  const captureError = useCallback((
    type: ClientErrorType,
    message: string,
    details?: string,
    action?: string
  ) => {
    const clientError: ClientError = {
      type,
      message,
      details,
      timestamp: new Date(),
      action
    };

    setError(clientError);

    // Log l'erreur pour debugging
    console.error(`[CLIENT ${type}]`, {
      message,
      details,
      action,
      timestamp: clientError.timestamp
    });

    return clientError;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    captureError,
    clearError,
    hasError: error !== null
  };
}

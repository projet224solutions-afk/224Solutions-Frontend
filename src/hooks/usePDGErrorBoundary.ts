import { useState, useCallback } from 'react';

export type PDGErrorType =
  | 'stats_loading'
  | 'agent_management'
  | 'syndicat_management'
  | 'finance'
  | 'api'
  | 'permission'
  | 'mfa'
  | 'validation'
  | 'network'
  | 'unknown';

interface PDGError {
  type: PDGErrorType;
  message: string;
}

export function usePDGErrorBoundary() {
  const [error, setError] = useState<PDGError | null>(null);

  const captureError = useCallback((
    type: PDGErrorType,
    message: string,
    originalError?: any
  ) => {
    console.error(`[PDG Error - ${type}]:`, message, originalError);
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
}

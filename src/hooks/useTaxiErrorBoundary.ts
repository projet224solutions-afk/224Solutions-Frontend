import { useCallback, useState } from 'react';

export type TaxiErrorType = 'gps' | 'env' | 'permission' | 'payment' | 'network' | 'unknown';

export function useTaxiErrorBoundary() {
  const [error, setError] = useState<{ type: TaxiErrorType; message: string } | null>(null);

  const capture = useCallback((type: TaxiErrorType, message: string, err?: unknown) => {
    console.error(`[TaxiErrorBoundary] ${type}:`, message, err);
    setError({ type, message });
  }, []);

  const clear = useCallback(() => setError(null), []);

  return { error, capture, clear };
}

import { useCallback, useEffect, useRef, useState } from 'react';

export function useLoadingTimeout(isLoading: boolean, timeoutMs = 8000) {
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      console.error('[TIMEOUT TRIGGERED]', {
        timeoutMs,
        scope: 'useLoadingTimeout',
      });
      setTimedOut(true);
    }, timeoutMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading, timeoutMs]);

  const resetTimeout = useCallback(() => {
    setTimedOut(false);
  }, []);

  return {
    timedOut,
    resetTimeout,
  };
}

export default useLoadingTimeout;

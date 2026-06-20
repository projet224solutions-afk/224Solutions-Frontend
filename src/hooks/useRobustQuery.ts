/**
 * USE ROBUST QUERY - 224Solutions Enterprise
 * Hook universel pour requêtes robustes avec Circuit Breaker, Retry, et Fallback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { circuitBreaker, CircuitState } from '@/lib/circuitBreaker';
import { retryWithBackoff, RetryConfig, retryPresets } from '@/lib/retryWithBackoff';
import { requestQueue, RequestPriority } from '@/lib/requestQueue';

export interface RobustQueryOptions<T> {
  // Identification
  key: string;                          // Clé unique pour le circuit breaker

  // Retry configuration
  retry?: Partial<RetryConfig>;

  // Circuit breaker
  circuitBreaker?: {
    enabled?: boolean;
    failureThreshold?: number;
    timeout?: number;
  };

  // Request queue
  queue?: {
    enabled?: boolean;
    priority?: RequestPriority;
    dedupe?: boolean;
  };

  // Fallback
  fallback?: T | (() => T | Promise<T>);

  // Stale-while-revalidate
  staleTime?: number;                   // Temps avant que les données soient stale (ms)
  cacheTime?: number;                   // Temps de cache (ms)

  // Callbacks
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  onRetry?: (attempt: number, error: any) => void;
  onCircuitOpen?: () => void;

  // Comportement
  enabled?: boolean;                    // Activer/désactiver la requête
  refetchOnMount?: boolean;
  refetchOnFocus?: boolean;
  refetchInterval?: number | false;
}

interface RobustQueryState<T> {
  data: T | undefined;
  error: any | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isFetching: boolean;
  isStale: boolean;
  circuitState: CircuitState;
  retryCount: number;
  lastUpdated: number | null;
}

interface RobustQueryReturn<T> extends RobustQueryState<T> {
  refetch: () => Promise<T | undefined>;
  reset: () => void;
  setData: (data: T | ((prev: T | undefined) => T)) => void;
}

// Cache global pour stale-while-revalidate
const cache = new Map<string, { data: any; timestamp: number }>();

export function useRobustQuery<T>(
  queryFn: () => Promise<T>,
  options: RobustQueryOptions<T>
): RobustQueryReturn<T> {
  const {
    key,
    retry = retryPresets.api,
    circuitBreaker: cbOptions = { enabled: true },
    queue: queueOptions = { enabled: false },
    fallback,
    staleTime = 5 * 60 * 1000, // 5 minutes par défaut
    cacheTime = 30 * 60 * 1000, // 30 minutes par défaut
    onSuccess,
    onError,
    onRetry,
    onCircuitOpen,
    enabled = true,
    refetchOnMount = true,
    refetchOnFocus = false,
    refetchInterval = false
  } = options;

  const [state, setState] = useState<RobustQueryState<T>>(() => {
    // Initialiser avec les données en cache si disponibles
    const cached = cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < cacheTime) {
      return {
        data: cached.data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
        isFetching: false,
        isStale: now - cached.timestamp > staleTime,
        circuitState: circuitBreaker.getState(key),
        retryCount: 0,
        lastUpdated: cached.timestamp
      };
    }

    return {
      data: undefined,
      error: null,
      isLoading: enabled,
      isError: false,
      isSuccess: false,
      isFetching: false,
      isStale: false,
      circuitState: circuitBreaker.getState(key),
      retryCount: 0,
      lastUpdated: null
    };
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const refetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Exécuter la requête avec toutes les protections
   */
  const executeQuery = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return undefined;

    // Annuler la requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Mettre à jour l'état
    setState(prev => ({
      ...prev,
      isFetching: true,
      isLoading: !prev.data,
      isError: false,
      error: null
    }));

    // Fonction wrapper pour la requête
    const wrappedQuery = async (): Promise<T> => {
      // Vérifier si aborté
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Query aborted');
      }

      return queryFn();
    };

    // Fonction avec retry
    const queryWithRetry = async (): Promise<T> => {
      return retryWithBackoff(wrappedQuery, {
        ...retry,
        onRetry: (attempt, error, _nextDelay) => {
          if (isMountedRef.current) {
            setState(prev => ({ ...prev, retryCount: attempt }));
          }
          onRetry?.(attempt, error);
        }
      });
    };

    // Fonction avec queue si activée
    const queryWithQueue = queueOptions.enabled
      ? () => requestQueue.enqueue(queryWithRetry, {
          priority: queueOptions.priority || 'normal',
          dedupeKey: queueOptions.dedupe ? key : undefined
        })
      : queryWithRetry;

    // Préparer le fallback
    const getFallback = (): T | Promise<T> => {
      if (typeof fallback === 'function') {
        return (fallback as () => T | Promise<T>)();
      }
      return fallback as T;
    };

    try {
      let result: T;

      // Exécuter avec ou sans circuit breaker
      if (cbOptions.enabled !== false) {
        result = await circuitBreaker.execute(
          key,
          queryWithQueue,
          fallback !== undefined ? getFallback : undefined,
          {
            failureThreshold: cbOptions.failureThreshold,
            timeout: cbOptions.timeout
          }
        );
      } else {
        result = await queryWithQueue();
      }

      // Mettre en cache
      const now = Date.now();
      cache.set(key, { data: result, timestamp: now });

      // Mettre à jour l'état
      if (isMountedRef.current) {
        setState({
          data: result,
          error: null,
          isLoading: false,
          isError: false,
          isSuccess: true,
          isFetching: false,
          isStale: false,
          circuitState: circuitBreaker.getState(key),
          retryCount: 0,
          lastUpdated: now
        });
      }

      onSuccess?.(result);
      return result;

    } catch (error: any) {
      // Vérifier si c'est une annulation
      if (error.message === 'Query aborted') {
        return undefined;
      }

      const circuitState = circuitBreaker.getState(key);

      if (circuitState === 'OPEN') {
        onCircuitOpen?.();
      }

      // Mettre à jour l'état d'erreur
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          error,
          isLoading: false,
          isError: true,
          isFetching: false,
          circuitState
        }));
      }

      onError?.(error);
      return undefined;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, queryFn, enabled, retry, cbOptions, queueOptions, fallback, staleTime, onSuccess, onError, onRetry, onCircuitOpen]);

  /**
   * Refetch manuel
   */
  const refetch = useCallback(async (): Promise<T | undefined> => {
    return executeQuery();
  }, [executeQuery]);

  /**
   * Reset l'état
   */
  const reset = useCallback(() => {
    cache.delete(key);
    circuitBreaker.reset(key);

    setState({
      data: undefined,
      error: null,
      isLoading: false,
      isError: false,
      isSuccess: false,
      isFetching: false,
      isStale: false,
      circuitState: 'CLOSED',
      retryCount: 0,
      lastUpdated: null
    });
  }, [key]);

  /**
   * Mettre à jour les données manuellement
   */
  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setState(prev => {
      const newData = typeof updater === 'function'
        ? (updater as (prev: T | undefined) => T)(prev.data)
        : updater;

      const now = Date.now();
      cache.set(key, { data: newData, timestamp: now });

      return {
        ...prev,
        data: newData,
        isSuccess: true,
        lastUpdated: now
      };
    });
  }, [key]);

  // Effect: Fetch initial
  useEffect(() => {
    if (enabled && refetchOnMount) {
      executeQuery();
    }
  }, [enabled, refetchOnMount, executeQuery]);

  // Effect: Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handleFocus = () => {
      if (state.isStale || !state.lastUpdated) {
        executeQuery();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnFocus, state.isStale, state.lastUpdated, executeQuery]);

  // Effect: Refetch interval
  useEffect(() => {
    if (!refetchInterval) return;

    refetchIntervalRef.current = setInterval(() => {
      executeQuery();
    }, refetchInterval);

    return () => {
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, [refetchInterval, executeQuery]);

  // Effect: Souscrire aux changements du circuit breaker
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(key, (newState) => {
      setState(prev => ({ ...prev, circuitState: newState }));
    });

    return unsubscribe;
  }, [key]);

  // Effect: Cleanup
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, []);

  // Vérifier si les données sont stale
  useEffect(() => {
    if (!state.lastUpdated) return;

    const checkStale = () => {
      const isStale = Date.now() - state.lastUpdated! > staleTime;
      if (isStale !== state.isStale) {
        setState(prev => ({ ...prev, isStale }));
      }
    };

    const interval = setInterval(checkStale, 10000); // Vérifier toutes les 10s
    return () => clearInterval(interval);
  }, [state.lastUpdated, staleTime, state.isStale]);

  return {
    ...state,
    refetch,
    reset,
    setData
  };
}

/**
 * Hook simplifié pour mutations robustes
 */
export function useRobustMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: Omit<RobustQueryOptions<TData>, 'enabled' | 'refetchOnMount' | 'refetchOnFocus' | 'refetchInterval'> = { key: 'mutation' }
) {
  const [state, setState] = useState({
    data: undefined as TData | undefined,
    error: null as any,
    isLoading: false,
    isError: false,
    isSuccess: false
  });

  const mutate = useCallback(async (variables: TVariables): Promise<TData | undefined> => {
    setState(prev => ({ ...prev, isLoading: true, isError: false, error: null }));

    const mutationWithRetry = () => retryWithBackoff(
      () => mutationFn(variables),
      options.retry || retryPresets.api
    );

    try {
      let result: TData;

      if (options.circuitBreaker?.enabled !== false) {
        result = await circuitBreaker.execute(
          options.key,
          mutationWithRetry,
          options.fallback !== undefined
            ? () => (typeof options.fallback === 'function'
                ? (options.fallback as () => TData)()
                : options.fallback as TData)
            : undefined
        );
      } else {
        result = await mutationWithRetry();
      }

      setState({
        data: result,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true
      });

      options.onSuccess?.(result);
      return result;

    } catch (error) {
      setState(prev => ({
        ...prev,
        error,
        isLoading: false,
        isError: true
      }));

      options.onError?.(error);
      return undefined;
    }
  }, [mutationFn, options]);

  const reset = useCallback(() => {
    setState({
      data: undefined,
      error: null,
      isLoading: false,
      isError: false,
      isSuccess: false
    });
  }, []);

  return {
    ...state,
    mutate,
    mutateAsync: mutate,
    reset
  };
}

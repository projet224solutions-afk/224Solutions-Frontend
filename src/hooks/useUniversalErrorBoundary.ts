/**
 * USE ERROR BOUNDARY - 224Solutions Enterprise
 * Hook universel de gestion d'erreurs avec recovery automatique
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { autoErrorRecovery, ErrorPattern } from '@/services/AutoErrorRecoveryService';
import { circuitBreaker } from '@/lib/circuitBreaker';

export interface ErrorInfo {
  type: string;
  message: string;
  code?: string;
  timestamp: Date;
  recovered: boolean;
  recoveryAttempts: number;
  context?: Record<string, any>;
}

export interface UseErrorBoundaryOptions {
  /** Identifiant unique pour le circuit breaker */
  context: string;
  /** Activer la récupération automatique */
  autoRecover?: boolean;
  /** Nombre max de tentatives de récupération */
  maxRecoveryAttempts?: number;
  /** Callback sur erreur */
  onError?: (error: ErrorInfo) => void;
  /** Callback sur récupération réussie */
  onRecovery?: () => void;
  /** Fallback personnalisé */
  fallback?: () => void;
}

interface UseErrorBoundaryReturn {
  error: ErrorInfo | null;
  hasError: boolean;
  isRecovering: boolean;
  recoveryAttempts: number;
  capture: (error: any, context?: Record<string, any>) => void;
  clear: () => void;
  retry: () => Promise<boolean>;
  withErrorHandling: <T>(fn: () => Promise<T>, fallback?: T) => Promise<T | undefined>;
}

/**
 * Extraire les informations d'une erreur
 */
function extractErrorInfo(error: any): Partial<ErrorInfo> {
  if (!error) {
    return { type: 'unknown', message: 'Unknown error' };
  }

  // Erreur standard
  if (error instanceof Error) {
    return {
      type: error.name || 'Error',
      message: error.message,
      code: (error as any).code
    };
  }

  // Erreur Supabase
  if (error.code && error.message) {
    return {
      type: 'supabase',
      message: error.message,
      code: error.code
    };
  }

  // Erreur HTTP
  if (error.status || error.statusCode) {
    return {
      type: 'http',
      message: error.message || error.statusText || 'HTTP Error',
      code: String(error.status || error.statusCode)
    };
  }

  // String simple
  if (typeof error === 'string') {
    return {
      type: 'string',
      message: error
    };
  }

  return {
    type: 'unknown',
    message: String(error)
  };
}

/**
 * Mapper une erreur vers un pattern de récupération
 */
function mapToErrorPattern(error: any): ErrorPattern {
  const message = error?.message?.toLowerCase() || String(error).toLowerCase();

  if (message.includes('dynamically imported module') || message.includes('importing a module')) {
    return 'dynamic_import_failed';
  }
  if (message.includes('failed to load') || message.includes('failed to fetch')) {
    return 'resource_load_error';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'network_timeout';
  }
  if (message.includes('cannot read property') || message.includes('undefined is not')) {
    return 'undefined_property';
  }
  if (message.includes('violates row-level security') || message.includes('rls')) {
    return 'rls_violation';
  }

  return 'generic_error';
}

export function useErrorBoundary(options: UseErrorBoundaryOptions): UseErrorBoundaryReturn {
  const {
    context,
    autoRecover = true,
    maxRecoveryAttempts = 3,
    onError,
    onRecovery,
    fallback
  } = options;

  const [error, setError] = useState<ErrorInfo | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  /**
   * Capturer une erreur
   */
  const capture = useCallback((err: any, errorContext?: Record<string, any>) => {
    const info = extractErrorInfo(err);

    const errorInfo: ErrorInfo = {
      type: info.type || 'unknown',
      message: info.message || 'Unknown error',
      code: info.code,
      timestamp: new Date(),
      recovered: false,
      recoveryAttempts: recoveryAttemptsRef.current,
      context: errorContext
    };

    console.error(`❌ [${context}] Error captured:`, errorInfo);

    setError(errorInfo);
    onError?.(errorInfo);

    // Tenter la récupération automatique
    if (autoRecover && recoveryAttemptsRef.current < maxRecoveryAttempts) {
      const pattern = mapToErrorPattern(err);
      autoErrorRecovery.handleError(pattern, errorInfo.message, context);
    }
  }, [context, autoRecover, maxRecoveryAttempts, onError]);

  /**
   * Effacer l'erreur
   */
  const clear = useCallback(() => {
    setError(null);
    recoveryAttemptsRef.current = 0;
    setIsRecovering(false);
  }, []);

  /**
   * Réessayer après une erreur
   */
  const retry = useCallback(async (): Promise<boolean> => {
    if (recoveryAttemptsRef.current >= maxRecoveryAttempts) {
      console.warn(`⚠️ [${context}] Max recovery attempts reached`);
      return false;
    }

    setIsRecovering(true);
    recoveryAttemptsRef.current++;

    try {
      // Vérifier le circuit breaker
      const circuitState = circuitBreaker.getState(context);
      if (circuitState === 'OPEN') {
        console.warn(`⚠️ [${context}] Circuit is OPEN, using fallback`);
        fallback?.();
        return false;
      }

      // Tentative de récupération
      if (error) {
        const pattern = mapToErrorPattern({ message: error.message });
        const recovered = await autoErrorRecovery.handleError(pattern, error.message, context);

        if (recovered && isMountedRef.current) {
          setError(prev => prev ? { ...prev, recovered: true } : null);
          onRecovery?.();
          clear();
          return true;
        }
      }

      return false;
    } catch (retryError) {
      console.error(`❌ [${context}] Recovery failed:`, retryError);
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsRecovering(false);
      }
    }
  }, [context, maxRecoveryAttempts, error, fallback, onRecovery, clear]);

  /**
   * Wrapper pour exécuter une fonction avec gestion d'erreur
   */
  const withErrorHandling = useCallback(async <T>(
    fn: () => Promise<T>,
    fallbackValue?: T
  ): Promise<T | undefined> => {
    try {
      clear();
      const result = await fn();
      return result;
    } catch (err) {
      capture(err);

      if (fallbackValue !== undefined) {
        return fallbackValue;
      }

      return undefined;
    }
  }, [capture, clear]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    error,
    hasError: error !== null,
    isRecovering,
    recoveryAttempts: recoveryAttemptsRef.current,
    capture,
    clear,
    retry,
    withErrorHandling
  };
}

/**
 * Hook simplifié pour contextes spécifiques
 */
export function useModuleErrorBoundary(moduleName: string) {
  return useErrorBoundary({
    context: moduleName,
    autoRecover: true,
    maxRecoveryAttempts: 3
  });
}

/**
 * Types d'erreurs prédéfinis pour les différents modules
 */
export type VendorErrorType =
  | 'product_error'
  | 'inventory_error'
  | 'order_error'
  | 'payment_error'
  | 'api_error'
  | 'network_error'
  | 'validation_error';

export type PDGErrorType =
  | 'stats_loading'
  | 'agent_management'
  | 'syndicat_management'
  | 'finance'
  | 'api'
  | 'permission'
  | 'network';

export type ClientErrorType =
  | 'cart_error'
  | 'checkout_error'
  | 'payment_error'
  | 'delivery_error'
  | 'network_error';

export type TaxiErrorType =
  | 'gps'
  | 'ride_request'
  | 'payment'
  | 'driver_error'
  | 'network';

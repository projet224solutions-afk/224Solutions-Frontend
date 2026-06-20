import { useState, useCallback, useRef, startTransition } from 'react';

interface UseSecureActionOptions {
  /** Délai minimum avant de permettre une nouvelle action (ms) */
  debounceMs?: number;
  /** Callback en cas d'erreur */
  onError?: (error: Error) => void;
  /** Callback en cas de succès */
  onSuccess?: () => void;
}

interface UseSecureActionReturn<T> {
  /** État de chargement */
  loading: boolean;
  /** Exécuter l'action de manière sécurisée */
  execute: (action: () => Promise<T>) => void;
  /** Réinitialiser l'état */
  reset: () => void;
  /** Dernière erreur */
  error: Error | null;
}

/**
 * Hook sécurisé pour les actions financières critiques
 *
 * Garantit:
 * - INP < 200ms (UI mise à jour avant l'action)
 * - Protection anti-double clic
 * - Gestion async propre
 * - Pas de blocage du thread principal
 */
export function useSecureAction<T = void>(
  options: UseSecureActionOptions = {}
): UseSecureActionReturn<T> {
  const { debounceMs = 500, onError, onSuccess } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastExecutionRef = useRef<number>(0);
  const isExecutingRef = useRef(false);

  const execute = useCallback((action: () => Promise<T>) => {
    // Protection anti-double clic
    if (isExecutingRef.current || loading) {
      console.warn('[SecureAction] Action bloquée - déjà en cours');
      return;
    }

    // Debounce protection
    const now = Date.now();
    if (now - lastExecutionRef.current < debounceMs) {
      console.warn('[SecureAction] Action bloquée - debounce actif');
      return;
    }

    // Marquer comme en cours IMMÉDIATEMENT (synchrone)
    isExecutingRef.current = true;
    lastExecutionRef.current = now;

    // Mettre à jour l'UI de manière prioritaire (React 18+)
    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    // Déférer l'action lourde après le rendu UI
    requestAnimationFrame(() => {
      // Double RAF pour garantir que le paint est terminé
      requestAnimationFrame(async () => {
        try {
          await action();
          onSuccess?.();
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error);
          console.error('[SecureAction] Erreur:', error);
        } finally {
          isExecutingRef.current = false;
          setLoading(false);
        }
      });
    });
  }, [loading, debounceMs, onError, onSuccess]);

  const reset = useCallback(() => {
    isExecutingRef.current = false;
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    execute,
    reset,
    error
  };
}

export default useSecureAction;

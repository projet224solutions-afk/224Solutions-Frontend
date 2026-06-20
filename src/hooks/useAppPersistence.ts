/**
 * SYSTÈME DE PERSISTANCE UNIVERSEL
 * Hook réutilisable pour sauvegarder automatiquement l'état des composants
 * Fonctionne sur Windows (desktop) et Android (mobile/PWA)
 * 224SOLUTIONS
 */

import { useEffect, useCallback, useRef, useState } from 'react';

const APP_STORAGE_PREFIX = '224solutions_state_';
const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 heures

export interface PersistenceConfig<T> {
  /** Clé unique pour identifier les données persistées */
  key: string;
  /** État initial par défaut */
  defaultState: T;
  /** Durée max de validité des données (ms) */
  maxAge?: number;
  /** Délai avant sauvegarde (ms) */
  debounceMs?: number;
  /** Active/désactive la persistence */
  enabled?: boolean;
  /** Callback après restauration */
  onRestore?: (state: T) => void;
  /** Valider les données avant restauration */
  validate?: (state: T) => boolean;
  /** Transformer les données avant sauvegarde */
  serialize?: (state: T) => any;
  /** Transformer les données après chargement */
  deserialize?: (data: any) => T;
}

interface PersistedData<T> {
  state: T;
  timestamp: number;
  version: number;
}

const PERSISTENCE_VERSION = 1;

/**
 * Sauvegarde des données dans localStorage
 */
function saveToStorage<T>(key: string, state: T, serialize?: (s: T) => any): void {
  try {
    const data: PersistedData<T> = {
      state: serialize ? serialize(state) : state,
      timestamp: Date.now(),
      version: PERSISTENCE_VERSION,
    };
    localStorage.setItem(`${APP_STORAGE_PREFIX}${key}`, JSON.stringify(data));
  } catch (error) {
    console.error(`[Persistence] Erreur sauvegarde ${key}:`, error);
  }
}

/**
 * Chargement des données depuis localStorage
 */
function loadFromStorage<T>(
  key: string,
  maxAge: number,
  validate?: (s: T) => boolean,
  deserialize?: (d: any) => T
): T | null {
  try {
    const stored = localStorage.getItem(`${APP_STORAGE_PREFIX}${key}`);
    if (!stored) return null;

    const data: PersistedData<T> = JSON.parse(stored);

    // Vérifier la version
    if (data.version !== PERSISTENCE_VERSION) {
      clearFromStorage(key);
      return null;
    }

    // Vérifier l'âge
    if (Date.now() - data.timestamp > maxAge) {
      clearFromStorage(key);
      return null;
    }

    const state = deserialize ? deserialize(data.state) : data.state;

    // Valider si une fonction est fournie
    if (validate && !validate(state)) {
      clearFromStorage(key);
      return null;
    }

    return state;
  } catch (error) {
    console.error(`[Persistence] Erreur chargement ${key}:`, error);
    return null;
  }
}

/**
 * Supprime les données persistées
 */
function clearFromStorage(key: string): void {
  try {
    localStorage.removeItem(`${APP_STORAGE_PREFIX}${key}`);
  } catch (error) {
    console.error(`[Persistence] Erreur suppression ${key}:`, error);
  }
}

/**
 * Hook universel de persistance avec sauvegarde automatique
 */
export function useAppPersistence<T>(config: PersistenceConfig<T>) {
  const {
    key,
    defaultState,
    maxAge = DEFAULT_MAX_AGE_MS,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    enabled = true,
    onRestore,
    validate,
    serialize,
    deserialize,
  } = config;

  const [state, setState] = useState<T>(defaultState);
  const [isRestored, setIsRestored] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);
  const stateRef = useRef(state);

  // Refs stables pour les callbacks - évite les re-renders
  const onRestoreRef = useRef(onRestore);
  const validateRef = useRef(validate);
  const serializeRef = useRef(serialize);
  const deserializeRef = useRef(deserialize);

  // Mise à jour des refs sans déclencher de re-render
  useEffect(() => {
    onRestoreRef.current = onRestore;
    validateRef.current = validate;
    serializeRef.current = serialize;
    deserializeRef.current = deserialize;
  });

  // Garder la référence d'état à jour
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Sauvegarde immédiate - stable car utilise des refs
  const saveImmediately = useCallback(() => {
    if (!enabled || isRestoringRef.current) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    saveToStorage(key, stateRef.current, serializeRef.current);
  }, [key, enabled]);

  // Sauvegarde avec debounce
  const saveLater = useCallback(() => {
    if (!enabled || isRestoringRef.current) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(key, stateRef.current, serializeRef.current);
    }, debounceMs);
  }, [key, enabled, debounceMs]);

  // Restauration initiale - s'exécute une seule fois
  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const savedState = loadFromStorage<T>(key, maxAge, validateRef.current, deserializeRef.current);
    if (savedState !== null) {
      isRestoringRef.current = true;
      setState(savedState);
      setIsRestored(true);

      // Appeler onRestore de manière asynchrone pour éviter les mises à jour en cascade
      setTimeout(() => {
        onRestoreRef.current?.(savedState);
        isRestoringRef.current = false;
      }, 0);

      console.log(`[Persistence] ${key} restauré`);
    } else {
      setIsRestored(true);
    }
  }, [key, enabled, maxAge]); // Dépendances stables uniquement

  // Sauvegarde automatique lors des changements d'état
  useEffect(() => {
    if (!enabled || isRestoringRef.current || !isRestored) return;
    saveLater();
  }, [state, saveLater, enabled, isRestored]);

  // Sauvegarde sur événements critiques (visibilitychange, beforeunload, etc.)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveImmediately();
      }
    };

    const handleBeforeUnload = () => {
      saveImmediately();
    };

    const handlePageHide = () => {
      saveImmediately();
    };

    const handleBlur = () => {
      saveImmediately();
    };

    // Événements desktop
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Événements mobile/PWA
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('blur', handleBlur);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, saveImmediately]);

  // Fonction pour effacer les données
  const clear = useCallback(() => {
    clearFromStorage(key);
    setState(defaultState);
  }, [key, defaultState]);

  // Fonction pour forcer la sauvegarde
  const save = useCallback(() => {
    saveImmediately();
  }, [saveImmediately]);

  return {
    state,
    setState,
    clear,
    save,
    isRestored,
  };
}

/**
 * Hook simplifié pour formulaires
 */
export function useFormPersistence<T extends Record<string, any>>(
  formKey: string,
  initialValues: T,
  options?: {
    enabled?: boolean;
    maxAge?: number;
    onRestore?: (values: T) => void;
  }
) {
  const { state, setState, clear, save, isRestored } = useAppPersistence<T>({
    key: `form_${formKey}`,
    defaultState: initialValues,
    enabled: options?.enabled ?? true,
    maxAge: options?.maxAge ?? 30 * 60 * 1000, // 30 minutes pour les formulaires
    onRestore: options?.onRestore,
  });

  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    [setState]
  );

  const resetForm = useCallback(() => {
    clear();
  }, [clear]);

  return {
    values: state,
    setValues: setState,
    updateField,
    resetForm,
    save,
    isRestored,
  };
}

/**
 * Hook pour persistence de panier/liste avec items
 */
export function useListPersistence<T extends { id: string }>(
  listKey: string,
  options?: {
    enabled?: boolean;
    maxAge?: number;
    onRestore?: (items: T[]) => void;
  }
) {
  const { state, setState, clear, save, isRestored } = useAppPersistence<T[]>({
    key: `list_${listKey}`,
    defaultState: [],
    enabled: options?.enabled ?? true,
    maxAge: options?.maxAge ?? 4 * 60 * 60 * 1000,
    onRestore: options?.onRestore,
  });

  const addItem = useCallback(
    (item: T) => {
      setState((prev) => {
        const exists = prev.find((i) => i.id === item.id);
        if (exists) {
          return prev.map((i) => (i.id === item.id ? item : i));
        }
        return [...prev, item];
      });
    },
    [setState]
  );

  const removeItem = useCallback(
    (id: string) => {
      setState((prev) => prev.filter((i) => i.id !== id));
    },
    [setState]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<T>) => {
      setState((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
      );
    },
    [setState]
  );

  const clearList = useCallback(() => {
    clear();
  }, [clear]);

  return {
    items: state,
    setItems: setState,
    addItem,
    removeItem,
    updateItem,
    clearList,
    save,
    isRestored,
    count: state.length,
  };
}

/**
 * Nettoie toutes les données de persistence expirées
 */
export function cleanupExpiredPersistence(maxAge: number = DEFAULT_MAX_AGE_MS): number {
  let cleaned = 0;
  try {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(APP_STORAGE_PREFIX)
    );

    for (const key of keys) {
      try {
        const stored = localStorage.getItem(key);
        if (!stored) continue;

        const data = JSON.parse(stored);
        if (Date.now() - data.timestamp > maxAge) {
          localStorage.removeItem(key);
          cleaned++;
        }
      } catch {
        // Supprimer les entrées corrompues
        localStorage.removeItem(key);
        cleaned++;
      }
    }
  } catch (error) {
    console.error('[Persistence] Erreur nettoyage:', error);
  }
  return cleaned;
}

export default useAppPersistence;

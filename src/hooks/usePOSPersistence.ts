/**
 * HOOK DE PERSISTANCE POS
 * Sauvegarde automatiquement l'état du panier et les données POS
 * pour éviter la perte de données lors de la navigation ou mise en arrière-plan
 */

import { useEffect, useCallback, useRef } from 'react';

const POS_STORAGE_KEY = '224solutions_pos_state';
const SAVE_DEBOUNCE_MS = 500;

export interface POSPersistedState {
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    saleType?: 'unit' | 'carton';
    displayQuantity?: string;
    categoryId?: string | null;
    stock: number;
    barcode?: string;
    images?: string[];
    sell_by_carton?: boolean;
    units_per_carton?: number;
    price_carton?: number;
  }>;
  selectedCustomer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  } | null;
  paymentMethod: 'cash' | 'mobile_money' | 'card';
  mobileMoneyPhone: string;
  mobileMoneyProvider: 'orange' | 'mtn';
  receivedAmount: number;
  discountPercent: number;
  discountAmount: number;
  discountMode: 'percent' | 'amount';
  recentlySelected: string[];
  timestamp: number;
  vendorId: string | null;
}

// Durée max de validité des données persistées (4 heures)
const MAX_PERSISTENCE_AGE_MS = 4 * 60 * 60 * 1000;

/**
 * Sauvegarde l'état POS dans localStorage
 */
export function savePOSState(state: Partial<POSPersistedState>): void {
  try {
    const existingData = loadPOSState();
    const newState: POSPersistedState = {
      cart: state.cart ?? existingData?.cart ?? [],
      selectedCustomer: state.selectedCustomer ?? existingData?.selectedCustomer ?? null,
      paymentMethod: state.paymentMethod ?? existingData?.paymentMethod ?? 'cash',
      mobileMoneyPhone: state.mobileMoneyPhone ?? existingData?.mobileMoneyPhone ?? '',
      mobileMoneyProvider: state.mobileMoneyProvider ?? existingData?.mobileMoneyProvider ?? 'orange',
      receivedAmount: state.receivedAmount ?? existingData?.receivedAmount ?? 0,
      discountPercent: state.discountPercent ?? existingData?.discountPercent ?? 0,
      discountAmount: state.discountAmount ?? existingData?.discountAmount ?? 0,
      discountMode: state.discountMode ?? existingData?.discountMode ?? 'percent',
      recentlySelected: state.recentlySelected ?? existingData?.recentlySelected ?? [],
      vendorId: state.vendorId ?? existingData?.vendorId ?? null,
      timestamp: Date.now(),
    };

    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(newState));
  } catch (error) {
    console.error('[POS Persistence] Erreur sauvegarde:', error);
  }
}

/**
 * Charge l'état POS depuis localStorage
 */
export function loadPOSState(): POSPersistedState | null {
  try {
    const stored = localStorage.getItem(POS_STORAGE_KEY);
    if (!stored) return null;

    const state: POSPersistedState = JSON.parse(stored);

    // Vérifier si les données ne sont pas trop anciennes
    if (Date.now() - state.timestamp > MAX_PERSISTENCE_AGE_MS) {
      clearPOSState();
      return null;
    }

    return state;
  } catch (error) {
    console.error('[POS Persistence] Erreur chargement:', error);
    return null;
  }
}

/**
 * Efface l'état POS persisté
 */
export function clearPOSState(): void {
  try {
    localStorage.removeItem(POS_STORAGE_KEY);
  } catch (error) {
    console.error('[POS Persistence] Erreur suppression:', error);
  }
}

/**
 * Hook pour la persistance automatique de l'état POS
 */
export function usePOSPersistence(
  state: Partial<POSPersistedState>,
  options?: {
    enabled?: boolean;
    onRestore?: (state: POSPersistedState) => void;
  }
) {
  const { enabled = true, onRestore } = options ?? {};
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);

  // Refs stables pour éviter les re-renders
  const stateRef = useRef(state);
  const onRestoreRef = useRef(onRestore);

  // Mise à jour des refs sans déclencher de re-render
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  });

  // Sauvegarde avec debounce
  const debouncedSave = useCallback((newState: Partial<POSPersistedState>) => {
    if (!enabled || isRestoringRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      savePOSState(newState);
    }, SAVE_DEBOUNCE_MS);
  }, [enabled]);

  // Sauvegarde immédiate (pour événements critiques) - utilise stateRef
  const saveImmediately = useCallback(() => {
    if (!enabled) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    savePOSState(stateRef.current);
  }, [enabled]);

  // Restaurer l'état au montage - s'exécute une seule fois
  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const savedState = loadPOSState();
    if (savedState && savedState.cart.length > 0) {
      isRestoringRef.current = true;

      // Appeler onRestore de manière asynchrone
      setTimeout(() => {
        onRestoreRef.current?.(savedState);
        isRestoringRef.current = false;
      }, 0);

      console.log('[POS Persistence] État restauré:', {
        cartItems: savedState.cart.length,
        timestamp: new Date(savedState.timestamp).toLocaleString()
      });
    }
  }, [enabled]); // Dépendances stables uniquement

  // Sauvegarder lors des changements d'état
  useEffect(() => {
    if (!enabled || isRestoringRef.current) return;
    debouncedSave(state);
  }, [state, debouncedSave, enabled]);

  // Sauvegarder immédiatement quand l'utilisateur quitte l'onglet/app
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

    // Événements pour desktop
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Événements pour mobile (PWA)
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

  return {
    save: debouncedSave,
    saveImmediately,
    clear: clearPOSState,
    load: loadPOSState,
  };
}

export default usePOSPersistence;

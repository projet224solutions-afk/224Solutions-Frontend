/**
 * HOOK DE SYNCHRONISATION DUAL
 * Hook React pour gérer la synchronisation Firestore ↔ Supabase
 * 224SOLUTIONS - Système hybride
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import dualSyncManager from '@/lib/dualSyncManager';

export interface DualSyncStatus {
  isFirestoreConnected: boolean;
  isSupabaseConnected: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  syncErrors: string[];
  stats: {
    firestore: number;
    supabase: number;
    synced: number;
    failed: number;
  };
}

export function useDualSync() {
  const [status, setStatus] = useState<DualSyncStatus>({
    isFirestoreConnected: false,
    isSupabaseConnected: true, // Supabase toujours connecté
    isSyncing: false,
    lastSync: null,
    syncErrors: [],
    stats: {
      firestore: 0,
      supabase: 0,
      synced: 0,
      failed: 0
    }
  });

  const unsubscribersRef = useRef<Array<() => void>>([]);

  /**
   * Vérifie la connectivité Firestore
   */
  const checkFirestoreConnection = useCallback(async () => {
    try {
      // Tenter une requête simple vers Firestore
      await dualSyncManager.checkFirestoreExists('motos', 'test');
      setStatus(prev => ({ ...prev, isFirestoreConnected: true }));
      return true;
    } catch (error) {
      console.warn('Firestore non disponible:', error);
      setStatus(prev => ({ ...prev, isFirestoreConnected: false }));
      return false;
    }
  }, []);

  /**
   * Synchronise toutes les données
   */
  const syncAll = useCallback(async (
    direction: 'firestore-to-supabase' | 'supabase-to-firestore' = 'supabase-to-firestore'
  ) => {
    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      const result = await dualSyncManager.fullSync(direction);

      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSync: new Date(),
        stats: {
          ...prev.stats,
          synced: result.success,
          failed: result.failed
        }
      }));

      if (result.failed > 0) {
        toast.warning(`Synchronisation partielle: ${result.failed} erreurs`);
      } else {
        toast.success(`✅ ${result.success} éléments synchronisés`);
      }

      return result;
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncErrors: [...prev.syncErrors, error.message]
      }));
      toast.error('Erreur lors de la synchronisation');
      return { success: 0, failed: 0 };
    }
  }, []);

  /**
   * Synchronise une donnée unique
   */
  const syncOne = useCallback(async (
    configKey: string,
    data: any,
    source: 'firestore' | 'supabase'
  ) => {
    try {
      const result = await dualSyncManager.syncBidirectional(configKey, data, source);

      if (result.success) {
        setStatus(prev => ({
          ...prev,
          stats: {
            ...prev.stats,
            synced: prev.stats.synced + 1
          }
        }));
      } else {
        setStatus(prev => ({
          ...prev,
          stats: {
            ...prev.stats,
            failed: prev.stats.failed + 1
          },
          syncErrors: [...prev.syncErrors, result.error || 'Erreur inconnue']
        }));
      }

      return result;
    } catch (error: any) {
      toast.error('Erreur de synchronisation');
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Active la synchronisation en temps réel
   */
  const enableRealTimeSync = useCallback(() => {
    // Nettoyer les anciens listeners
    unsubscribersRef.current.forEach(unsub => unsub());
    unsubscribersRef.current = [];

    // Initialiser les nouveaux listeners
    const cleanup = dualSyncManager.initializeDualSync();
    unsubscribersRef.current.push(cleanup);

    toast.success('🔄 Synchronisation en temps réel activée');
  }, []);

  /**
   * Désactive la synchronisation en temps réel
   */
  const disableRealTimeSync = useCallback(() => {
    unsubscribersRef.current.forEach(unsub => unsub());
    unsubscribersRef.current = [];
    toast.info('Synchronisation en temps réel désactivée');
  }, []);

  /**
   * Efface les erreurs
   */
  const clearErrors = useCallback(() => {
    setStatus(prev => ({ ...prev, syncErrors: [] }));
  }, []);

  /**
   * Obtient les statistiques
   */
  const getStats = useCallback(() => {
    return status.stats;
  }, [status.stats]);

  // Vérifier la connexion Firestore au montage
  useEffect(() => {
    checkFirestoreConnection();
  }, [checkFirestoreConnection]);

  // Nettoyer les listeners au démontage
  useEffect(() => {
    return () => {
      unsubscribersRef.current.forEach(unsub => unsub());
    };
  }, []);

  return {
    status,
    syncAll,
    syncOne,
    enableRealTimeSync,
    disableRealTimeSync,
    clearErrors,
    getStats,
    checkFirestoreConnection,
    // États dérivés
    isConnected: status.isFirestoreConnected && status.isSupabaseConnected,
    hasErrors: status.syncErrors.length > 0,
    isSyncing: status.isSyncing
  };
}

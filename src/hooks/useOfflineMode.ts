/**
 * HOOK OFFLINE MODE - 224SOLUTIONS
 * Hook React complet pour la gestion du mode offline
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import offlineQueueManager, {
  QueuedOperation,
  getQueueStats,
  processQueue,
  setupConnectivityListener
} from '@/lib/offlineQueueManager';
import { offlineSyncService, SyncableEntity } from '@/lib/offlineSyncService';

export interface OfflineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnline: Date | null;
  offlineDuration: number | null; // en secondes
}

export interface QueueStatus {
  total: number;
  pending: number;
  processing: number;
  failed: number;
  completed: number;
}

export interface SyncStatus {
  syncInProgress: boolean;
  lastSync: Date | null;
  pendingUploads: number;
  conflicts: number;
}

export interface UseOfflineModeResult {
  // Statut de connectivité
  offlineStatus: OfflineStatus;
  isOnline: boolean;

  // File d'attente des opérations
  queueStatus: QueueStatus;
  pendingOperations: QueuedOperation[];

  // Synchronisation
  syncStatus: SyncStatus;

  // Actions
  processQueue: () => Promise<void>;
  syncAll: () => Promise<void>;
  syncEntity: (entity: SyncableEntity) => Promise<void>;
  retryFailedOperations: () => Promise<void>;
  clearFailedOperations: () => Promise<void>;

  // État UI
  showOfflineBanner: boolean;
  showSyncIndicator: boolean;
  dismissOfflineBanner: () => void;
}

export function useOfflineMode(): UseOfflineModeResult {
  // États
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    wasOffline: false,
    lastOnline: navigator.onLine ? new Date() : null,
    offlineDuration: null
  });

  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    total: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    completed: 0
  });

  const [pendingOperations, setPendingOperations] = useState<QueuedOperation[]>([]);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    syncInProgress: false,
    lastSync: null,
    pendingUploads: 0,
    conflicts: 0
  });

  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [showSyncIndicator, setShowSyncIndicator] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const offlineStartRef = useRef<Date | null>(null);
  const syncUnsubscribeRef = useRef<(() => void) | null>(null);
  // Track toast state to avoid duplicates
  const toastShownRef = useRef<{ online: boolean; offline: boolean }>({ online: false, offline: false });

  // Mettre à jour le statut de la file
  const updateQueueStatus = useCallback(async () => {
    try {
      const stats = await getQueueStats();
      setQueueStatus({
        total: stats.total,
        pending: stats.pending,
        processing: stats.processing,
        failed: stats.failed,
        completed: stats.completed
      });

      // Récupérer les opérations en attente
      const pending = await offlineQueueManager.getPendingOperations({ limit: 50 });
      setPendingOperations(pending);
    } catch (error) {
      console.error('[useOfflineMode] Error updating queue status:', error);
    }
  }, []);

  // Mettre à jour le statut de sync
  const updateSyncStatus = useCallback(async () => {
    try {
      const status = await offlineSyncService.getSyncStatus();
      setSyncStatus({
        syncInProgress: status.syncInProgress.length > 0,
        lastSync: status.entities.length > 0
          ? new Date(Math.max(...status.entities.map(e =>
              new Date(e.last_incremental_sync || 0).getTime()
            )))
          : null,
        pendingUploads: status.totalPending,
        conflicts: status.totalConflicts
      });
    } catch (error) {
      console.error('[useOfflineMode] Error updating sync status:', error);
    }
  }, []);

  // Gérer le passage online
  const handleOnline = useCallback(() => {
    console.log('[useOfflineMode] Back online!');

    const duration = offlineStartRef.current
      ? Math.round((Date.now() - offlineStartRef.current.getTime()) / 1000)
      : null;

    setOfflineStatus(prev => ({
      isOnline: true,
      wasOffline: !prev.isOnline,
      lastOnline: new Date(),
      offlineDuration: duration
    }));

    offlineStartRef.current = null;
    setShowOfflineBanner(false);
    setBannerDismissed(false);

    // Toast de retour online - only show once to avoid duplicates
    if (duration && duration > 5 && !toastShownRef.current.online) {
      toastShownRef.current.online = true;
      toastShownRef.current.offline = false;
      toast.success('Connexion rétablie!', {
        description: `Vous étiez hors ligne pendant ${formatDuration(duration)}`
      });
    }

    // Déclencher la synchronisation
    setShowSyncIndicator(true);
    setTimeout(async () => {
      await processQueue();
      await updateQueueStatus();
      await updateSyncStatus();
      setShowSyncIndicator(false);
    }, 500);
  }, [updateQueueStatus, updateSyncStatus]);

  // Gérer le passage offline
  const handleOffline = useCallback(() => {
    console.log('[useOfflineMode] Gone offline!');

    offlineStartRef.current = new Date();
    setOfflineStatus(prev => ({
      ...prev,
      isOnline: false
    }));

    if (!bannerDismissed) {
      setShowOfflineBanner(true);
    }

    // Toast only show once to avoid duplicates
    if (!toastShownRef.current.offline) {
      toastShownRef.current.offline = true;
      toastShownRef.current.online = false;
      toast.warning('Mode hors ligne', {
        description: 'Vos actions seront synchronisées dès que la connexion sera rétablie'
      });
    }
  }, [bannerDismissed]);

  // Setup des listeners de connectivité
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Setup du listener du queue manager
    const cleanupQueue = setupConnectivityListener();

    // S'abonner aux événements de sync
    syncUnsubscribeRef.current = offlineSyncService.subscribe((event) => {
      if (event.type === 'sync_complete') {
        updateSyncStatus();
        updateQueueStatus();
      }
    });

    // Check initial
    if (!navigator.onLine) {
      offlineStartRef.current = new Date();
      setShowOfflineBanner(true);
    }

    // Mettre à jour les statuts périodiquement
    const interval = setInterval(() => {
      updateQueueStatus();
      updateSyncStatus();
    }, 30000); // Toutes les 30 secondes

    // Initial update
    updateQueueStatus();
    updateSyncStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupQueue();
      if (syncUnsubscribeRef.current) {
        syncUnsubscribeRef.current();
      }
      clearInterval(interval);
    };
  }, [handleOnline, handleOffline, updateQueueStatus, updateSyncStatus]);

  // Actions
  const handleProcessQueue = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Impossible de synchroniser', {
        description: 'Vous êtes actuellement hors ligne'
      });
      return;
    }

    setShowSyncIndicator(true);
    try {
      const result = await processQueue();
      await updateQueueStatus();

      if (result.processed > 0) {
        toast.success('Synchronisation terminée', {
          description: `${result.processed} opération(s) synchronisée(s)`
        });
      }

      if (result.failed > 0) {
        toast.warning('Erreurs de synchronisation', {
          description: `${result.failed} opération(s) ont échoué`
        });
      }
    } catch (_error) {
      toast.error('Erreur de synchronisation');
    } finally {
      setShowSyncIndicator(false);
    }
  }, [updateQueueStatus]);

  const handleSyncAll = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Impossible de synchroniser hors ligne');
      return;
    }

    setShowSyncIndicator(true);
    try {
      await offlineSyncService.syncAll();
      await updateSyncStatus();
      toast.success('Synchronisation complète terminée');
    } catch (_error) {
      toast.error('Erreur lors de la synchronisation');
    } finally {
      setShowSyncIndicator(false);
    }
  }, [updateSyncStatus]);

  const handleSyncEntity = useCallback(async (entity: SyncableEntity) => {
    if (!navigator.onLine) {
      toast.error('Impossible de synchroniser hors ligne');
      return;
    }

    setShowSyncIndicator(true);
    try {
      await offlineSyncService.syncEntity(entity);
      await updateSyncStatus();
    } catch (_error) {
      toast.error(`Erreur lors de la synchronisation de ${entity}`);
    } finally {
      setShowSyncIndicator(false);
    }
  }, [updateSyncStatus]);

  const retryFailedOperations = useCallback(async () => {
    const failed = pendingOperations.filter(op => op.status === 'failed');
    for (const op of failed) {
      await offlineQueueManager.retryOperation(op.id);
    }
    await updateQueueStatus();

    if (navigator.onLine) {
      handleProcessQueue();
    }
  }, [pendingOperations, updateQueueStatus, handleProcessQueue]);

  const clearFailedOperations = useCallback(async () => {
    const failed = pendingOperations.filter(op => op.status === 'failed');
    for (const op of failed) {
      await offlineQueueManager.cancelOperation(op.id);
    }
    await updateQueueStatus();
    toast.info(`${failed.length} opération(s) supprimée(s)`);
  }, [pendingOperations, updateQueueStatus]);

  const dismissOfflineBanner = useCallback(() => {
    setShowOfflineBanner(false);
    setBannerDismissed(true);
  }, []);

  return {
    offlineStatus,
    isOnline: offlineStatus.isOnline,
    queueStatus,
    pendingOperations,
    syncStatus,
    processQueue: handleProcessQueue,
    syncAll: handleSyncAll,
    syncEntity: handleSyncEntity,
    retryFailedOperations,
    clearFailedOperations,
    showOfflineBanner,
    showSyncIndicator,
    dismissOfflineBanner
  };
}

// Helpers
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} secondes`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  return `${Math.floor(seconds / 3600)} heures`;
}

export default useOfflineMode;

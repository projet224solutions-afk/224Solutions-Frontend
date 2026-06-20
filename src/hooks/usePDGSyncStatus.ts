/**
 * 🔄 HOOK DE STATUT DE SYNCHRONISATION PDG
 *
 * Fournit un accès temps réel à l'état de synchronisation des données PDG
 */

import { useState, useEffect, useCallback } from 'react';
import { pdgSyncService, DataConsistencyCheck, SyncResult } from '@/services/pdg/PDGSyncService';
import { toast } from 'sonner';

export interface SyncStatus {
  lastCheck: string | null;
  isHealthy: boolean;
  checks: DataConsistencyCheck[];
  recommendations: string[];
  loading: boolean;
  syncing: boolean;
}

export function usePDGSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    lastCheck: null,
    isHealthy: true,
    checks: [],
    recommendations: [],
    loading: true,
    syncing: false
  });

  const checkStatus = useCallback(async () => {
    setStatus(prev => ({ ...prev, loading: true }));

    try {
      const report = await pdgSyncService.generateSyncReport();

      const isHealthy = report.consistency.every(c => c.status !== 'error');
      const hasWarnings = report.consistency.some(c => c.status === 'warning');

      setStatus({
        lastCheck: report.timestamp,
        isHealthy: isHealthy && !hasWarnings,
        checks: report.consistency,
        recommendations: report.recommendations,
        loading: false,
        syncing: false
      });

      if (!isHealthy) {
        toast.warning('Problèmes de cohérence détectés dans les données');
      }
    } catch (error) {
      console.error('Erreur vérification sync:', error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        isHealthy: false,
        recommendations: ['Erreur lors de la vérification - Veuillez réessayer']
      }));
    }
  }, []);

  const runSync = useCallback(async (): Promise<{
    success: boolean;
    totalSynced: number;
    totalErrors: number;
  }> => {
    setStatus(prev => ({ ...prev, syncing: true }));

    try {
      const result = await pdgSyncService.runFullSync();

      if (result.totalErrors === 0) {
        toast.success(`Synchronisation réussie: ${result.totalSynced} éléments mis à jour`);
      } else {
        toast.warning(`Synchronisation partielle: ${result.totalSynced} réussis, ${result.totalErrors} erreurs`);
      }

      // Recharger le statut après sync
      await checkStatus();

      return {
        success: result.totalErrors === 0,
        totalSynced: result.totalSynced,
        totalErrors: result.totalErrors
      };
    } catch (error) {
      console.error('Erreur synchronisation:', error);
      toast.error('Erreur lors de la synchronisation');
      setStatus(prev => ({ ...prev, syncing: false }));
      return { success: false, totalSynced: 0, totalErrors: 1 };
    }
  }, [checkStatus]);

  // Vérifier au montage
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    ...status,
    refresh: checkStatus,
    runSync
  };
}

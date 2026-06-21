/**
 * BANNIÈRE OFFLINE VENDEUR - 224SOLUTIONS
 * S'affiche automatiquement quand l'utilisateur passe en mode hors-ligne
 * Intègre le système de synchronisation automatique
 *
 * @version 2.0.0 - Intégration useOfflineStatus et sync automatique
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Database, X, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  /** Afficher les informations de synchronisation */
  showSyncInfo?: boolean;
  /** Callback pour déclencher une synchronisation */
  onSync?: () => Promise<void>;
  /** Nombre d'éléments en attente (optionnel, sinon lecture IndexedDB) */
  pendingCount?: number;
  /** Position de la bannière */
  position?: 'top' | 'bottom';
}

export default function OfflineBanner({
  showSyncInfo = true,
  onSync,
  pendingCount: externalPendingCount,
  position = 'bottom'
}: OfflineBannerProps) {
  const { t } = useTranslation();
  const { isOnline, isOffline, offlineDuration } = useOfflineStatus({
    showToasts: true, // Les toasts sont gérés par le hook
    onOnline: async () => {
      // Déclencher la synchronisation au retour en ligne
      if (onSync) {
        setIsSyncing(true);
        try {
          await onSync();
        } finally {
          setIsSyncing(false);
        }
      }
    }
  });

  const [isDismissed, setIsDismissed] = useState(false);
  const [pendingCount, setPendingCount] = useState(externalPendingCount ?? 0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Tracker si on était offline pour afficher la bannière de sync
  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
      setIsDismissed(false);
    }
  }, [isOffline]);

  // Mettre à jour le pendingCount depuis la prop externe
  useEffect(() => {
    if (externalPendingCount !== undefined) {
      setPendingCount(externalPendingCount);
    }
  }, [externalPendingCount]);

  // Vérifier les données en attente dans IndexedDB si pas de prop externe
  useEffect(() => {
    if (externalPendingCount !== undefined) return;

    const checkPendingData = async () => {
      try {
        const dbRequest = indexedDB.open('224Solutions-OfflineDB', 3);
        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          if (db.objectStoreNames.contains('events')) {
            const tx = db.transaction('events', 'readonly');
            const store = tx.objectStore('events');
            const index = store.index('by-status');
            const countRequest = index.count('pending');
            countRequest.onsuccess = () => {
              setPendingCount(countRequest.result);
            };
          }
          db.close();
        };
      } catch {
        // Ignorer les erreurs IndexedDB
      }
    };

    checkPendingData();
    const interval = setInterval(checkPendingData, 10000);
    return () => clearInterval(interval);
  }, [externalPendingCount, isOffline]);

  // Formater la durée offline
  const formatOfflineDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
  };

  // Handler pour sync manuelle
  const handleManualSync = useCallback(async () => {
    if (!onSync) {
      window.location.reload();
      return;
    }

    setIsSyncing(true);
    try {
      await onSync();
      toast.success(t('offlineBanner.synchronisationTerminee'));
    } catch {
      toast.error(t('offlineBanner.erreurDeSynchronisation'));
    } finally {
      setIsSyncing(false);
    }
  }, [onSync]);

  // Ne rien afficher si en ligne sans pending et pas de sync récente
  if (isOnline && pendingCount === 0 && !isSyncing && (!wasOffline || isDismissed)) {
    return null;
  }

  // Bannière de synchronisation réussie (affichée brièvement après retour en ligne)
  if (isOnline && wasOffline && !isDismissed && pendingCount === 0 && !isSyncing) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: position === 'bottom' ? 100 : -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'bottom' ? 100 : -100 }}
          className={cn(
            'fixed left-0 right-0 z-50',
            position === 'bottom' ? 'bottom-0' : 'top-0'
          )}
        >
          <div className="bg-[#ff4000] text-white px-4 py-3 shadow-lg">
            <div className="max-w-screen-xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-full">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">{t('offlineBanner.connexionRetablie')}</p>
                  <p className="text-sm text-white/90">
                    Toutes les données ont été synchronisées
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsDismissed(true);
                  setWasOffline(false);
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label={t('offlineBanner.fermer')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Ne pas afficher si online et dismissed
  if (isOnline && isDismissed && pendingCount === 0) return null;

  // Bannière principale (offline ou avec pending)
  return (
    <AnimatePresence>
      {(isOffline || pendingCount > 0 || isSyncing) && (
        <motion.div
          initial={{ opacity: 0, y: position === 'bottom' ? 100 : -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'bottom' ? 100 : -100 }}
          className={cn(
            'fixed left-0 right-0 z-50',
            position === 'bottom' ? 'bottom-0' : 'top-0'
          )}
        >
          <div className={cn(
            'px-4 py-3 shadow-lg text-white',
            isOffline
              ? 'bg-[#ff4000]'
              : isSyncing
                ? 'bg-[#04439e]'
                : 'bg-[#ff4000]'
          )}>
            <div className="max-w-screen-xl mx-auto flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-full">
                  {isSyncing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isOffline ? (
                    <WifiOff className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">
                    {isSyncing
                      ? 'Synchronisation en cours...'
                      : isOffline
                        ? 'Mode Hors-Ligne'
                        : 'Données en attente'}
                  </p>
                  <p className="text-sm text-white/90">
                    {isSyncing
                      ? `Synchronisation de ${pendingCount} élément(s)...`
                      : isOffline
                        ? offlineDuration > 0
                          ? `Hors ligne depuis ${formatOfflineDuration(offlineDuration)}`
                          : 'Vos données seront synchronisées à la reconnexion'
                        : `${pendingCount} opération(s) en attente de synchronisation`
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {showSyncInfo && pendingCount > 0 && !isSyncing && (
                  <div className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-sm">
                    <Database className="w-4 h-4" />
                    <span>{pendingCount}</span>
                  </div>
                )}

                {!isSyncing && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleManualSync}
                    disabled={isOffline && !onSync}
                    className="bg-white text-orange-600 hover:bg-white/90"
                  >
                    {isOnline ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Synchroniser
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Réessayer
                      </>
                    )}
                  </Button>
                )}

                {!isSyncing && (
                  <button
                    onClick={() => setIsDismissed(true)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    aria-label={t('offlineBanner.fermer')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

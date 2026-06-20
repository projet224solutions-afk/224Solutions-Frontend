/**
 * INDICATEUR DE STATUT RÉSEAU COMPACT
 * Affiche le statut de connexion et permet la sync manuelle
 * 224SOLUTIONS - Interface Vendeur
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { toast } from 'sonner';
import { useTranslation } from "@/hooks/useTranslation";

export default function NetworkStatusIndicator() {
    const { t } = useTranslation();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingSync, setPendingSync] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Ne compter QUE les ventes encore synchronisables (type POS + non abandonnées).
    // Une vente abandonnée (retry_count >= MAX) ne doit plus apparaître comme "en attente".
    const MAX_SYNC_ATTEMPTS = 5;
    const checkPendingData = useCallback(async () => {
        try {
            const { default: offlineDB } = await import('@/lib/offlineDB');
            const pendingEvents = await offlineDB.getPendingEvents();
            const failedEvents = await offlineDB.getFailedEvents();
            const syncable = [...pendingEvents, ...failedEvents].filter(
                (event) =>
                    (event.type === 'sale' || event.type === 'credit_sale') &&
                    (event.retry_count || 0) < MAX_SYNC_ATTEMPTS
            );
            setPendingSync(syncable.length);
        } catch {
            // Ignorer
        }
    }, []);

    // Synchronisation. `manual=true` quand l'utilisateur clique → on peut alors signaler un échec.
    // En automatique (montage / reconnexion / intervalle), on reste SILENCIEUX sur les échecs
    // pour ne pas spammer un message récurrent sur une vente bloquée.
    const forceSyncPending = useCallback(async (manual = false) => {
        if (!navigator.onLine || isSyncing) return;

        setIsSyncing(true);
        try {
            const { default: offlineDB } = await import('@/lib/offlineDB');
            const pendingEvents = await offlineDB.getPendingEvents();
            const failedEvents = await offlineDB.getFailedEvents();
            const posEvents = [...pendingEvents, ...failedEvents].filter(
                (event) =>
                    (event.type === 'sale' || event.type === 'credit_sale') &&
                    (event.retry_count || 0) < MAX_SYNC_ATTEMPTS
            );

            if (posEvents.length === 0) {
                setPendingSync(0);
                return;
            }

            const { syncOfflinePosSales } = await import('@/lib/offlinePosSync');
            const result = await syncOfflinePosSales();

            await checkPendingData();

            if (result.synced > 0) {
                toast.success(`${result.synced} ${t('networkStatus.salesSynced')}`);
            }
            // Échec signalé UNIQUEMENT sur action manuelle de l'utilisateur.
            if (manual && result.failed > 0) {
                toast.error(`${result.failed} ${t('networkStatus.salesSyncFailed')}`);
            }
        } catch (error) {
            console.error('Erreur sync:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, checkPendingData]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setTimeout(() => forceSyncPending(), 2000);
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        checkPendingData();
        const interval = setInterval(checkPendingData, 15000);

        // Auto-sync au montage si en ligne
        if (navigator.onLine) {
            setTimeout(() => forceSyncPending(), 3000);
        }

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [checkPendingData, forceSyncPending]);

    // Masquer si tout va bien
    if (isOnline && pendingSync === 0 && !isSyncing) {
        return null;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        onClick={isOnline && pendingSync > 0 ? () => forceSyncPending(true) : undefined}
                        className={`${
                            isSyncing ? 'bg-blue-500' : !isOnline ? 'bg-destructive' : 'bg-[#ff4000]'
                        } text-white text-[9px] leading-none px-1.5 py-0.5 flex items-center gap-0.5 ${
                            isOnline && pendingSync > 0 ? 'cursor-pointer hover:opacity-80' : 'cursor-help'
                        }`}
                        variant="default"
                    >
                        {isSyncing ? (
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        ) : !isOnline ? (
                            <WifiOff className="w-2.5 h-2.5" />
                        ) : (
                            <RefreshCw className="w-2.5 h-2.5" />
                        )}
                        <span>
                            {isSyncing ? t('networkStatus.syncShort') : !isOnline ? t('networkStatus.offShort') : pendingSync.toString()}
                        </span>
                    </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                            {isOnline ? (
                                <Wifi className="w-3 h-3 text-[#ff4000]" />
                            ) : (
                                <WifiOff className="w-3 h-3 text-destructive" />
                            )}
                            <span className="font-medium">{isOnline ? t('networkStatus.connected') : t('networkStatus.offline')}</span>
                        </div>
                        {pendingSync > 0 && (
                            <p className="text-muted-foreground">
                                {pendingSync} {t('networkStatus.pending')} — {isOnline ? t('networkStatus.clickToSync') : t('networkStatus.syncOnReconnect')}
                            </p>
                        )}
                        {isSyncing && <p className="text-blue-500">{t('networkStatus.syncing')}</p>}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
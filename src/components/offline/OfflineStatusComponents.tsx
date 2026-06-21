import { useTranslation } from "@/hooks/useTranslation";
/**
 * OFFLINE STATUS COMPONENTS - 224SOLUTIONS
 * Composants UI pour afficher le statut offline
 */

import React from 'react';
import { WifiOff, Wifi, RefreshCw, AlertCircle, CheckCircle, Clock, CloudOff, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import useOfflineMode from '@/hooks/useOfflineMode';

/**
 * Bannière de statut offline (fixée en haut)
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const {
    isOnline,
    showOfflineBanner,
    dismissOfflineBanner,
    queueStatus,
    processQueue,
    showSyncIndicator
  } = useOfflineMode();

  if (!showOfflineBanner && isOnline) return null;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        showOfflineBanner ? 'translate-y-0' : '-translate-y-full'
      )}
    >
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        isOnline
          ? 'bg-[#ff4000] text-white'
          : 'bg-[#ff4000] text-white'
      )}>
        <div className="flex items-center gap-3">
          {isOnline ? (
            <Wifi className="h-5 w-5" />
          ) : (
            <WifiOff className="h-5 w-5 animate-pulse" />
          )}
          <span className="font-medium">
            {isOnline
              ? 'Connexion rétablie'
              : 'Mode hors ligne'}
          </span>
          {!isOnline && queueStatus.pending > 0 && (
            <Badge variant="secondary" className="bg-white/20 text-white">
              {queueStatus.pending} en attente
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOnline && queueStatus.pending > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={processQueue}
              disabled={showSyncIndicator}
              className="text-white hover:bg-white/20"
            >
              {showSyncIndicator ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Synchroniser
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissOfflineBanner}
            className="text-white hover:bg-white/20"
          >
            ✕
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Indicateur compact de synchronisation
 */
export function SyncIndicator() {
  const { t } = useTranslation();
  const { showSyncIndicator, queueStatus, isOnline } = useOfflineMode();

  if (!showSyncIndicator && queueStatus.pending === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Card className="shadow-lg">
        <CardContent className="p-3 flex items-center gap-3">
          {showSyncIndicator ? (
            <>
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
              <span className="text-sm">Synchronisation...</span>
            </>
          ) : (
            <>
              <CloudOff className="h-4 w-4 text-[#ff4000]" />
              <span className="text-sm">
                {queueStatus.pending} action{queueStatus.pending > 1 ? 's' : ''} en attente
              </span>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Widget de statut détaillé
 */
export function OfflineStatusWidget() {
  const { t } = useTranslation();
  const {
    isOnline,
    offlineStatus,
    queueStatus,
    syncStatus,
    processQueue,
    syncAll,
    retryFailedOperations,
    clearFailedOperations,
    showSyncIndicator
  } = useOfflineMode();

  const totalOperations = queueStatus.pending + queueStatus.processing;
  const progress = queueStatus.completed > 0
    ? (queueStatus.completed / (queueStatus.completed + totalOperations)) * 100
    : 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-[#ff4000]" />
            ) : (
              <WifiOff className="h-5 w-5 text-[#ff4000]" />
            )}
            État de la connexion
          </CardTitle>
          <Badge variant={isOnline ? 'default' : 'secondary'}>
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </Badge>
        </div>
        <CardDescription>
          {offlineStatus.wasOffline
            ? 'Connexion rétablie après une interruption'
            : isOnline
              ? 'Toutes vos données sont synchronisées'
              : 'Vos actions seront synchronisées plus tard'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistiques de la file */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{queueStatus.pending}</p>
            <p className="text-xs text-muted-foreground">En attente</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-[#ff4000]" />
            </div>
            <p className="text-2xl font-bold">{queueStatus.completed}</p>
            <p className="text-xs text-muted-foreground">{t('offlineStatusComponents.synchronises')}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-[#ff4000]" />
            </div>
            <p className="text-2xl font-bold">{queueStatus.failed}</p>
            <p className="text-xs text-muted-foreground">{t('offlineStatusComponents.echoues')}</p>
          </div>
        </div>

        {/* Barre de progression */}
        {(totalOperations > 0 || queueStatus.completed > 0) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t('offlineStatusComponents.progressionDeSynchronisation')}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Conflits */}
        {syncStatus.conflicts > 0 && (
          <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-[#ff4000]" />
            <span className="text-sm text-[#ff4000] dark:text-orange-300">
              {syncStatus.conflicts} conflit{syncStatus.conflicts > 1 ? 's' : ''} à résoudre
            </span>
          </div>
        )}

        {/* Dernière sync */}
        {syncStatus.lastSync && (
          <p className="text-xs text-muted-foreground">
            Dernière synchronisation: {formatRelativeTime(syncStatus.lastSync)}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={syncAll}
            disabled={!isOnline || showSyncIndicator}
          >
            {showSyncIndicator ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Tout synchroniser
          </Button>

          {queueStatus.failed > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={retryFailedOperations}
              disabled={!isOnline}
            >
              Réessayer
            </Button>
          )}
        </div>

        {queueStatus.failed > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-[#ff4000] hover:text-[#ff4000]"
            onClick={clearFailedOperations}
          >
            Supprimer les échecs
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Badge inline de statut
 */
export function OfflineStatusBadge({
  showLabel = true,
  size = 'default'
}: {
  showLabel?: boolean;
  size?: 'sm' | 'default' | 'lg';
}) {
  const { t } = useTranslation();
  const { isOnline, queueStatus } = useOfflineMode();

  const sizeClasses = {
    sm: 'h-2 w-2',
    default: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'rounded-full',
        sizeClasses[size],
        isOnline ? 'bg-[#ff4000]' : 'bg-[#ff4000]',
        !isOnline && 'animate-pulse'
      )} />
      {showLabel && (
        <span className={cn(
          'text-muted-foreground',
          size === 'sm' && 'text-xs',
          size === 'default' && 'text-sm',
          size === 'lg' && 'text-base'
        )}>
          {isOnline
            ? queueStatus.pending > 0
              ? `${queueStatus.pending} en attente`
              : 'Synchronisé'
            : 'Hors ligne'}
        </span>
      )}
    </div>
  );
}

// Helpers
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'À l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return date.toLocaleDateString('fr-FR');
}

// Exports groupés
export const OfflineComponents = {
  Banner: OfflineBanner,
  Indicator: SyncIndicator,
  Widget: OfflineStatusWidget,
  Badge: OfflineStatusBadge
};

export default OfflineComponents;

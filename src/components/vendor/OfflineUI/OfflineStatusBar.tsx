/**
 * Offline Status Bar - Barre de statut mode offline
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Affiche le statut online/offline et les informations de sync
 */

import React from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface OfflineStatusBarProps {
  className?: string;
  showDetails?: boolean;
  pendingSyncCount?: number;
  lastSyncTime?: Date;
}

export function OfflineStatusBar({
  className,
  showDetails = true,
  pendingSyncCount = 0,
  lastSyncTime
}: OfflineStatusBarProps) {
  const { t } = useTranslation();
  const { isOnline, wasOffline, lastOnline, offlineDuration } = useOnlineStatus();

  // Afficher brièvement la notification de reconnexion
  if (isOnline && wasOffline) {
    return (
      <div
        className={cn(
          'bg-[#ff4000] text-white',
          'py-2 px-4 rounded-lg shadow-lg',
          'animate-in slide-in-from-top duration-300',
          className
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">{t('offlineSync.connectionRestored')}</p>
              {offlineDuration > 0 && (
                <p className="text-xs opacity-90">
                  {t('offlineSync.offlineFor')} {formatDuration(offlineDuration)}
                </p>
              )}
            </div>
          </div>
          {pendingSyncCount > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{t('offlineSync.syncInProgress')} ({pendingSyncCount})</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Barre de statut offline
  if (!isOnline) {
    return (
      <div
        className={cn(
          'bg-[#ff4000] text-white',
          'py-2.5 px-4 rounded-lg shadow-lg border-l-4 border-white/30',
          className
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <WifiOff className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-sm">{t('offlineSync.offlineMode')}</p>
              {showDetails && (
                <p className="text-xs opacity-90">
                  {t('offlineSync.limitedFeatures')}
                </p>
              )}
            </div>
          </div>

          {showDetails && pendingSyncCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">{pendingSyncCount} {t('offlineSync.pending')}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Barre de statut online (minimaliste)
  if (!showDetails) return null;

  return (
    <div
      className={cn(
        'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
        'py-1.5 px-4 rounded-lg',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[#ff4000]" />
          <span>{t('offlineSync.online')}</span>
        </div>

        {lastSyncTime && (
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <CheckCircle className="w-3 h-3" />
            <span>{t('offlineSync.lastSync')} {formatSyncTime(lastSyncTime, t)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Badge de statut compact
 */
export function OfflineStatusBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { isOnline } = useOnlineStatus();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        isOnline
          ? 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]'
          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        className
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="w-3 h-3" />
          <span>{t('offlineSync.online')}</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          <span>{t('offlineSync.offline')}</span>
        </>
      )}
    </div>
  );
}

/**
 * Indicateur de sync en cours
 */
export function SyncIndicator({
  syncing,
  count,
  className
}: {
  syncing: boolean;
  count?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!syncing) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'text-xs font-medium',
        className
      )}
    >
      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      <span>{t('offlineSync.syncingWord')}{count ? ` (${count})` : '...'}</span>
    </div>
  );
}

/**
 * Formater la durée en texte lisible
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
}

/**
 * Formater l'heure de sync
 */
function formatSyncTime(date: Date, t: (k: string) => string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return t('offlineSync.instant');
  if (diffMinutes < 60) return `${t('offlineSync.agoPrefix')} ${diffMinutes}min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${t('offlineSync.agoPrefix')} ${diffHours}h`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default OfflineStatusBar;

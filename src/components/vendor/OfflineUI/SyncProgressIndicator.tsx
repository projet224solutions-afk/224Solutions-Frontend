/**
 * Sync Progress Indicator - Indicateur de progression de synchronisation
 * 224SOLUTIONS - Mode Offline Avancé
 */

import React from 'react';
import { RefreshCw, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from '@/hooks/useTranslation';

interface SyncProgressIndicatorProps {
  total: number;
  synced: number;
  failed: number;
  pending: number;
  className?: string;
  showDetails?: boolean;
}

export function SyncProgressIndicator({
  total,
  synced,
  failed,
  pending,
  className,
  showDetails = true
}: SyncProgressIndicatorProps) {
  const { t } = useTranslation();
  const isSyncing = pending > 0;
  const progressPercentage = total > 0 ? Math.round((synced / total) * 100) : 0;

  if (total === 0 && !isSyncing) return null;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border bg-white dark:bg-gray-800',
        'border-gray-200 dark:border-gray-700',
        className
      )}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="font-medium text-sm">{t('offlineSync.syncingNow')}</span>
            </>
          ) : failed > 0 ? (
            <>
              <XCircle className="w-4 h-4 text-[#ff4000]" />
              <span className="font-medium text-sm">{t('offlineSync.syncDoneErrors')}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#ff4000]" />
              <span className="font-medium text-sm">{t('offlineSync.syncDone')}</span>
            </>
          )}
        </div>

        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {synced}/{total}
        </span>
      </div>

      {/* Barre de progression */}
      <Progress value={progressPercentage} className="mb-3" />

      {/* Détails */}
      {showDetails && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[#ff4000] dark:text-[#ff4000]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{synced} {t('offlineSync.syncedWord')}</span>
          </div>

          {pending > 0 && (
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{pending} {t('offlineSync.pendingWord')}</span>
            </div>
          )}

          {failed > 0 && (
            <div className="flex items-center gap-1.5 text-[#ff4000] dark:text-[#ff4000]">
              <XCircle className="w-3.5 h-3.5" />
              <span>{failed} {t('offlineSync.failedWord')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Indicateur compact de sync (pour header/toolbar)
 */
export function CompactSyncIndicator({
  pending,
  className
}: {
  pending: number;
  className?: string;
}) {
  const { t } = useTranslation();
  if (pending === 0) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
          'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]',
          className
        )}
      >
        <CheckCircle2 className="w-3 h-3" />
        <span>{t('offlineSync.allSynced')}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        className
      )}
    >
      <RefreshCw className="w-3 h-3 animate-spin" />
      <span>{pending} {t('offlineSync.pending')}</span>
    </div>
  );
}

/**
 * Toast de sync avec progression
 */
export function SyncToast({
  entity,
  progress,
  total,
  status
}: {
  entity: string;
  progress: number;
  total: number;
  status: 'syncing' | 'success' | 'error';
}) {
  const { t } = useTranslation();
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {status === 'syncing' && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === 'success' && <CheckCircle2 className="w-4 h-4 text-[#ff4000]" />}
        {status === 'error' && <XCircle className="w-4 h-4 text-[#ff4000]" />}

        <span className="font-medium">
          {status === 'syncing' && `${t('offlineSync.syncingWord')} ${entity}...`}
          {status === 'success' && `${entity} ${t('offlineSync.syncedSuffix')}`}
          {status === 'error' && `${t('offlineSync.errorSyncPrefix')} ${entity}`}
        </span>
      </div>

      {status === 'syncing' && (
        <>
          <Progress value={percentage} className="h-1" />
          <p className="text-xs text-gray-500">
            {progress} {t('offlineSync.ofWord')} {total} ({percentage}%)
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Liste détaillée des items en cours de sync
 */
export function SyncDetailsList({
  items,
  className
}: {
  items: Array<{
    id: string;
    entity: string;
    status: 'pending' | 'syncing' | 'success' | 'error';
    retryCount?: number;
  }>;
  className?: string;
}) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-[#ff4000]" />
        <p>{t('offlineSync.noPendingSync')}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            {item.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
            {item.status === 'syncing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
            {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-[#ff4000]" />}
            {item.status === 'error' && <XCircle className="w-4 h-4 text-[#ff4000]" />}

            <div>
              <p className="text-sm font-medium">{item.entity}</p>
              {item.retryCount !== undefined && item.retryCount > 0 && (
                <p className="text-xs text-gray-500">
                  {t('offlineSync.attemptWord')} {item.retryCount}
                </p>
              )}
            </div>
          </div>

          <StatusBadge status={item.status} />
        </div>
      ))}
    </div>
  );
}

/**
 * Badge de statut
 */
function StatusBadge({ status }: { status: 'pending' | 'syncing' | 'success' | 'error' }) {
  const { t } = useTranslation();
  const variants = {
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    syncing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    success: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]',
    error: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]'
  };

  const labels = {
    pending: t('offlineSync.statusPending'),
    syncing: t('offlineSync.statusSending'),
    success: t('offlineSync.statusSynced'),
    error: t('offlineSync.statusFailed')
  };

  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', variants[status])}>
      {labels[status]}
    </span>
  );
}

export default SyncProgressIndicator;

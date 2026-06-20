/**
 * OFFLINE SYNC INDICATOR - 224SOLUTIONS
 * Indicateur visuel du statut de connexion et de synchronisation
 *
 * Fonctionnalités:
 * - Affiche le statut en ligne/hors ligne
 * - Montre le nombre d'éléments en attente de synchronisation
 * - Animation pendant la synchronisation
 * - Bouton pour forcer la synchronisation
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Wifi,
  WifiOff,
  Cloud,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineSyncIndicatorProps {
  /** Nombre d'éléments en attente de sync */
  pendingCount?: number;
  /** Nombre d'éléments en échec */
  failedCount?: number;
  /** La synchronisation est en cours */
  isSyncing?: boolean;
  /** Date de la dernière synchronisation */
  lastSyncAt?: Date | null;
  /** Callback pour forcer la synchronisation */
  onSync?: () => void;
  /** Afficher en mode compact (icône seule) */
  compact?: boolean;
  /** Position du badge */
  position?: 'fixed' | 'inline';
  /** Classe CSS additionnelle */
  className?: string;
}

export function OfflineSyncIndicator({
  pendingCount = 0,
  failedCount = 0,
  isSyncing = false,
  lastSyncAt,
  onSync,
  compact = false,
  position = 'inline',
  className
}: OfflineSyncIndicatorProps) {
  const { isOnline, isOffline, offlineDuration } = useOfflineStatus({
    showToasts: false
  });

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Déterminer l'état général
  const hasIssues = failedCount > 0;
  const hasPending = pendingCount > 0;

  // Formater la durée offline
  const formatOfflineDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
  };

  // Formater la date de dernière sync
  const formatLastSync = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes}min`;
    if (minutes < 1440) return `Il y a ${Math.floor(minutes / 60)}h`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  // Icône principale
  const getStatusIcon = () => {
    if (isSyncing) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }

    if (isOffline) {
      return <WifiOff className="w-4 h-4 text-orange-500" />;
    }

    if (hasIssues) {
      return <AlertCircle className="w-4 h-4 text-[#ff4000]" />;
    }

    if (hasPending) {
      return <Cloud className="w-4 h-4 text-[#ff4000]" />;
    }

    return <Wifi className="w-4 h-4 text-[#ff4000]" />;
  };

  // Couleur du badge
  const getBadgeColor = () => {
    if (isSyncing) return 'bg-blue-500';
    if (isOffline) return 'bg-orange-500';
    if (hasIssues) return 'bg-[#ff4000]';
    if (hasPending) return 'bg-[#ff4000]';
    return 'bg-[#ff4000]';
  };

  // Texte du statut
  const getStatusText = () => {
    if (isSyncing) return 'Synchronisation...';
    if (isOffline) return 'Hors ligne';
    if (hasIssues) return `${failedCount} en échec`;
    if (hasPending) return `${pendingCount} en attente`;
    return 'Synchronisé';
  };

  // Version compacte (icône seule avec badge)
  if (compact) {
    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
              position === 'fixed' && 'fixed bottom-4 right-4 z-40 bg-white dark:bg-gray-900 shadow-lg',
              className
            )}
          >
            {getStatusIcon()}

            {/* Badge de notification */}
            {(hasPending || hasIssues) && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold text-white rounded-full flex items-center justify-center',
                  getBadgeColor()
                )}
              >
                {pendingCount + failedCount}
              </motion.span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-72" align="end">
          <SyncPopoverContent
            isOnline={isOnline}
            isOffline={isOffline}
            isSyncing={isSyncing}
            pendingCount={pendingCount}
            failedCount={failedCount}
            lastSyncAt={lastSyncAt}
            offlineDuration={offlineDuration}
            onSync={onSync}
            formatOfflineDuration={formatOfflineDuration}
            formatLastSync={formatLastSync}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Version étendue (barre complète)
  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors',
            isOffline ? 'bg-orange-100 dark:bg-orange-900/30' :
            hasIssues ? 'bg-orange-100 dark:bg-[#ff4000]/30' :
            hasPending ? 'bg-orange-100 dark:bg-[#ff4000]/30' :
            'bg-orange-100 dark:bg-[#ff4000]/30',
            'hover:opacity-80',
            className
          )}
        >
          {getStatusIcon()}
          <span className={cn(
            'font-medium',
            isOffline ? 'text-orange-700 dark:text-orange-300' :
            hasIssues ? 'text-[#ff4000] dark:text-orange-300' :
            hasPending ? 'text-[#ff4000] dark:text-orange-300' :
            'text-[#ff4000] dark:text-orange-300'
          )}>
            {getStatusText()}
          </span>

          {/* Indicateur de chargement */}
          {isSyncing && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <RefreshCw className="w-3 h-3" />
            </motion.div>
          )}
        </motion.button>
      </PopoverTrigger>

      <PopoverContent className="w-72" align="end">
        <SyncPopoverContent
          isOnline={isOnline}
          isOffline={isOffline}
          isSyncing={isSyncing}
          pendingCount={pendingCount}
          failedCount={failedCount}
          lastSyncAt={lastSyncAt}
          offlineDuration={offlineDuration}
          onSync={onSync}
          formatOfflineDuration={formatOfflineDuration}
          formatLastSync={formatLastSync}
        />
      </PopoverContent>
    </Popover>
  );
}

// Contenu du popover
function SyncPopoverContent({
  isOnline,
  isOffline,
  isSyncing,
  pendingCount,
  failedCount,
  lastSyncAt,
  offlineDuration,
  onSync,
  formatOfflineDuration,
  formatLastSync
}: {
  isOnline: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt?: Date | null;
  offlineDuration: number;
  onSync?: () => void;
  formatOfflineDuration: (s: number) => string;
  formatLastSync: (d: Date) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">État de la synchronisation</h4>
        <div className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium',
          isOffline ? 'bg-orange-100 text-orange-700' : 'bg-orange-100 text-[#ff4000]'
        )}>
          {isOffline ? 'Hors ligne' : 'En ligne'}
        </div>
      </div>

      {/* Durée offline */}
      {isOffline && offlineDuration > 0 && (
        <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
          <Clock className="w-4 h-4" />
          <span>Hors ligne depuis {formatOfflineDuration(offlineDuration)}</span>
        </div>
      )}

      {/* Statistiques */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1">
            <Database className="w-3 h-3" />
            En attente
          </span>
          <span className={cn(
            'font-medium',
            pendingCount > 0 ? 'text-[#ff4000]' : 'text-gray-600'
          )}>
            {pendingCount} élément(s)
          </span>
        </div>

        {failedCount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              En échec
            </span>
            <span className="font-medium text-[#ff4000]">
              {failedCount} élément(s)
            </span>
          </div>
        )}

        {lastSyncAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Dernière sync
            </span>
            <span className="font-medium text-gray-600">
              {formatLastSync(lastSyncAt)}
            </span>
          </div>
        )}
      </div>

      {/* Bouton de synchronisation */}
      {onSync && isOnline && (
        <Button
          onClick={onSync}
          disabled={isSyncing || (pendingCount === 0 && failedCount === 0)}
          className="w-full"
          size="sm"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Synchronisation...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Synchroniser maintenant
            </>
          )}
        </Button>
      )}

      {/* Message hors ligne */}
      {isOffline && pendingCount > 0 && (
        <p className="text-xs text-gray-500 text-center">
          Les données seront synchronisées automatiquement au retour de la connexion
        </p>
      )}
    </div>
  );
}

export default OfflineSyncIndicator;

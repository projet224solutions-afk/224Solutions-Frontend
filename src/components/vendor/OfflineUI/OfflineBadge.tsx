/**
 * Offline Badge - Badge pour fonctionnalités nécessitant une connexion
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Affiche un badge "Nécessite connexion" sur les boutons/liens désactivés en mode offline
 */

import React from 'react';
import { WifiOff, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOfflineFeatureAccess } from '@/hooks/useOfflineFeatureAccess';
import { useTranslation } from '@/hooks/useTranslation';
import type { Feature } from '@/lib/offline/featureGate';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OfflineBadgeProps {
  feature: Feature;
  children: React.ReactNode;
  className?: string;
  showTooltip?: boolean;
  variant?: 'badge' | 'overlay' | 'inline';
}

/**
 * Badge qui wrappe un élément et affiche un indicateur si la fonctionnalité
 * n'est pas disponible en mode offline
 */
export function OfflineBadge({
  feature,
  children,
  className,
  showTooltip = true,
  variant = 'badge'
}: OfflineBadgeProps) {
  const { t } = useTranslation();
  const { isAllowed, reason, requiresOnline } = useOfflineFeatureAccess(feature);

  // Si autorisé, retourner l'enfant tel quel
  if (isAllowed) {
    return <>{children}</>;
  }

  // Badge variant
  if (variant === 'badge') {
    return (
      <div className={cn('relative inline-flex', className)}>
        {children}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded-full shadow-lg">
                <WifiOff className="w-3 h-3" />
                {showTooltip && <span className="hidden sm:inline">{t('offlineBadge.connectionRequired')}</span>}
              </div>
            </TooltipTrigger>
            {showTooltip && reason && (
              <TooltipContent>
                <p className="font-medium">{reason.message}</p>
                {reason.action && <p className="text-xs mt-1 opacity-80">{reason.action}</p>}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  // Overlay variant (désactive visuellement l'élément)
  if (variant === 'overlay') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('relative', className)}>
              <div className="opacity-50 pointer-events-none">
                {children}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 rounded-lg backdrop-blur-[1px]">
                <div className="flex flex-col items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                  <Lock className="w-5 h-5 text-orange-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t('offlineBadge.requiresConnection')}
                  </span>
                </div>
              </div>
            </div>
          </TooltipTrigger>
          {showTooltip && reason && (
            <TooltipContent>
              <p className="font-medium">{reason.message}</p>
              {reason.action && <p className="text-xs mt-1 opacity-80">{reason.action}</p>}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Inline variant (ajoute un message à côté)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="opacity-50">{children}</div>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium rounded">
        <WifiOff className="w-3 h-3" />
        <span>{t('offlineBadge.connectionRequired')}</span>
      </div>
    </div>
  );
}

/**
 * Badge simple sans wrapper (pour utilisation inline)
 */
export function RequiresOnlineBadge({
  className,
  size = 'sm'
}: {
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm'
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-4 h-4'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        sizeClasses[size],
        className
      )}
    >
      <WifiOff className={iconSizes[size]} />
      <span>{t('offlineBadge.requiresConnection')}</span>
    </span>
  );
}

/**
 * Banner d'alerte pour les fonctionnalités désactivées
 */
export function OfflineFeatureAlert({
  feature,
  className
}: {
  feature: Feature;
  className?: string;
}) {
  const { isAllowed, reason } = useOfflineFeatureAccess(feature);

  if (isAllowed || !reason) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        'bg-orange-50 border-orange-200 text-orange-900',
        'dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-200',
        className
      )}
    >
      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="font-medium text-sm">{reason.message}</p>
        {reason.action && (
          <p className="text-xs opacity-80">{reason.action}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Hook pour désactiver un bouton si la fonctionnalité n'est pas disponible
 */
export function useDisableIfOffline(feature: Feature) {
  const { isAllowed, reason } = useOfflineFeatureAccess(feature);

  return {
    disabled: !isAllowed,
    title: !isAllowed ? reason?.message : undefined,
    className: !isAllowed ? 'opacity-50 cursor-not-allowed' : undefined
  };
}

export default OfflineBadge;

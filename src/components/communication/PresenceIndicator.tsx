/**
 * Composant d'indicateur de présence en ligne - Amélioré
 * Affiche un point coloré selon le statut de l'utilisateur
 * Avec animations et tooltip détaillé
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, Clock, Phone } from 'lucide-react';
import type { PresenceStatus } from '@/types/communication.types';

interface PresenceIndicatorProps {
  status: PresenceStatus;
  lastSeen?: string;
  showLabel?: boolean;
  showLastSeen?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'dot' | 'badge' | 'inline';
  className?: string;
}

const statusConfig: Record<PresenceStatus, {
  color: string;
  bgColor: string;
  label: string;
  animation?: string;
  icon?: React.ComponentType<{ className?: string }>;
}> = {
  online: {
    color: 'bg-[#ff4000]',
    bgColor: 'bg-[#ff4000]/20',
    label: 'En ligne',
    animation: 'animate-pulse',
  },
  offline: {
    color: 'bg-muted-foreground/50',
    bgColor: 'bg-muted/50',
    label: 'Hors ligne',
  },
  away: {
    color: 'bg-[#ff4000]',
    bgColor: 'bg-[#ff4000]/20',
    label: 'Absent',
  },
  busy: {
    color: 'bg-[#ff4000]',
    bgColor: 'bg-[#ff4000]/20',
    label: 'Occupé',
  },
  in_call: {
    color: 'bg-[#04439e]',
    bgColor: 'bg-[#04439e]/20',
    label: 'En appel',
    animation: 'animate-pulse',
  },
};

const sizeConfig = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export function PresenceIndicator({
  status,
  lastSeen,
  showLabel = false,
  showLastSeen = false,
  size = 'md',
  variant = 'dot',
  className,
}: PresenceIndicatorProps) {
  const config = statusConfig[status] || statusConfig.offline;

  const formatLastSeen = (dateStr?: string) => {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;

    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const lastSeenFormatted = formatLastSeen(lastSeen);
  const tooltipContent = status === 'offline' && lastSeen
    ? `Vu ${lastSeenFormatted}`
    : config.label;

  // Variante badge (plus visible)
  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium',
              config.bgColor,
              className
            )}>
              <span className={cn(
                'rounded-full',
                config.color,
                config.animation,
                sizeConfig[size]
              )} />
              {showLabel && (
                <span className={cn(
                  'text-xs',
                  status === 'online' ? 'text-[#ff4000] dark:text-orange-300' :
                  status === 'away' ? 'text-[#ff4000] dark:text-orange-300' :
                  status === 'busy' ? 'text-[#ff4000] dark:text-orange-300' :
                  status === 'in_call' ? 'text-[#04439e] dark:text-blue-300' :
                  'text-muted-foreground'
                )}>
                  {showLastSeen && status === 'offline' && lastSeen
                    ? `Vu ${lastSeenFormatted}`
                    : config.label}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Variante inline (texte avec indicateur)
  if (variant === 'inline') {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <span className={cn(
          'rounded-full ring-2 ring-background shadow-sm',
          config.color,
          config.animation,
          sizeConfig[size]
        )} />
        <span className={cn(
          'text-xs',
          status === 'online' ? 'text-[#ff4000] dark:text-[#ff4000] font-medium' :
          'text-muted-foreground'
        )}>
          {showLastSeen && status === 'offline' && lastSeen
            ? `Vu ${lastSeenFormatted}`
            : config.label}
        </span>
      </div>
    );
  }

  // Variante dot par défaut
  const indicator = (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full ring-2 ring-background shadow-sm',
          config.color,
          config.animation,
          sizeConfig[size]
        )}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {config.label}
        </span>
      )}
    </div>
  );

  if (!showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {indicator}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return indicator;
}

/**
 * Badge de présence pour les avatars (positionné en overlay)
 */
interface PresenceBadgeProps {
  status: PresenceStatus;
  size?: 'sm' | 'md' | 'lg';
  position?: 'bottom-right' | 'top-right' | 'bottom-left';
  className?: string;
}

export function PresenceBadge({
  status,
  size = 'md',
  position = 'bottom-right',
  className
}: PresenceBadgeProps) {
  const config = statusConfig[status] || statusConfig.offline;

  const positionClasses = {
    'bottom-right': '-bottom-0.5 -right-0.5',
    'top-right': '-top-0.5 -right-0.5',
    'bottom-left': '-bottom-0.5 -left-0.5',
  };

  const sizeClasses = {
    sm: 'w-2 h-2 ring-1',
    md: 'w-2.5 h-2.5 ring-2',
    lg: 'w-3 h-3 ring-2',
  };

  // Ne pas afficher pour offline dans certains cas
  if (status === 'offline') {
    return null;
  }

  return (
    <span
      className={cn(
        'absolute rounded-full ring-background',
        config.color,
        config.animation,
        positionClasses[position],
        sizeClasses[size],
        className
      )}
    />
  );
}

/**
 * Indicateur de frappe ("X est en train d'écrire...")
 */
interface TypingIndicatorProps {
  userNames: string[];
  className?: string;
}

export function TypingIndicator({ userNames, className }: TypingIndicatorProps) {
  if (userNames.length === 0) return null;

  const getText = () => {
    if (userNames.length === 1) {
      return `${userNames[0]} est en train d'écrire`;
    }
    if (userNames.length === 2) {
      return `${userNames[0]} et ${userNames[1]} sont en train d'écrire`;
    }
    return `${userNames[0]} et ${userNames.length - 1} autres sont en train d'écrire`;
  };

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span>{getText()}</span>
    </div>
  );
}

/**
 * Badge de statut de message (envoyé, livré, lu)
 */
interface MessageStatusBadgeProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  readAt?: string;
  className?: string;
}

export function MessageStatusBadge({ status, readAt, className }: MessageStatusBadgeProps) {
  const getIcon = () => {
    switch (status) {
      case 'sending':
        return (
          <svg className="w-4 h-4 text-muted-foreground animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      case 'sent':
        return (
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12l5 5L20 7" />
          </svg>
        );
      case 'delivered':
        return (
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12l5 5L16 7" />
            <path d="M8 12l5 5L23 7" />
          </svg>
        );
      case 'read':
        return (
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12l5 5L16 7" />
            <path d="M8 12l5 5L23 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex', className)}>
            {getIcon()}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {status === 'sending' && 'Envoi en cours...'}
          {status === 'sent' && 'Envoyé'}
          {status === 'delivered' && 'Livré'}
          {status === 'read' && (readAt ? `Lu le ${new Date(readAt).toLocaleString('fr-FR')}` : 'Lu')}
          {status === 'failed' && 'Échec de l\'envoi'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default PresenceIndicator;

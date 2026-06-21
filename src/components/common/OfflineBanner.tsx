/**
 * Bannière affichée quand l'utilisateur est hors ligne
 * 224SOLUTIONS
 */

import React from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { WifiOff, RefreshCw, Wifi } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  className?: string;
  /** Position fixe ou intégrée */
  fixed?: boolean;
  /** Afficher même online pour tester */
  forceShow?: boolean;
}

export function OfflineBanner({ className, fixed = true, forceShow = false }: OfflineBannerProps) {
  const { t } = useTranslation();
  const { isOnline, wasOffline, checkConnection, lastError } = useOnlineStatus();
  const [isChecking, setIsChecking] = React.useState(false);

  const handleRetry = async () => {
    setIsChecking(true);
    await checkConnection();
    setTimeout(() => setIsChecking(false), 1000);
  };

  // N'afficher que si offline ou forceShow
  if (isOnline && !forceShow && !wasOffline) {
    return null;
  }

  // Afficher une notification de reconnexion brève
  if (isOnline && wasOffline) {
    return (
      <div
        className={cn(
          'bg-[#ff4000] text-white py-2 px-4 text-center text-sm font-medium',
          'animate-in fade-in slide-in-from-top duration-300',
          fixed && 'fixed top-0 left-0 right-0 z-50',
          className
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4" />
          <span>{t('offlineBanner.connexionRetablie')}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-[#ff4000] text-white py-3 px-4',
        'shadow-lg',
        fixed && 'fixed top-0 left-0 right-0 z-50',
        className
      )}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <WifiOff className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Mode hors ligne</span>
            <span className="text-xs opacity-90">
              {lastError || 'Certaines fonctionnalités sont limitées'}
            </span>
          </div>
        </div>

        <button
          onClick={handleRetry}
          disabled={isChecking}
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 rounded-full',
            'bg-white/20 hover:bg-white/30 transition-colors',
            'text-sm font-medium',
            'disabled:opacity-50'
          )}
        >
          <RefreshCw className={cn('w-4 h-4', isChecking && 'animate-spin')} />
          <span className="hidden sm:inline">
            {isChecking ? 'Vérification...' : 'Réessayer'}
          </span>
        </button>
      </div>
    </div>
  );
}

export default OfflineBanner;

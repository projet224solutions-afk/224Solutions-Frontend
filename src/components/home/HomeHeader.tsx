/**
 * HOME HEADER - Ultra Professional Design
 * 224Solutions - Marketplace Header Component
 * Uses NotificationBellButton for unified notification logic
 */

import { useNavigate } from 'react-router-dom';
import { MapPin, ShoppingCart, Loader2, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import LanguageSelector from '@/components/LanguageSelector';
import { NotificationBellButton } from '@/components/shared/NotificationBellButton';
import { useUserLocation } from '@/hooks/useUserLocation';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface HomeHeaderProps {
  cartCount?: number;
  onCartClick?: () => void;
  className?: string;
}

export function HomeHeader({
  cartCount = 0,
  onCartClick,
  className,
}: HomeHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { location, loading, refresh } = useUserLocation();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      toast.success(t('common.appInstalled'), {
        description: t('common.appInstalledDesc')
      });
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50',
        'bg-primary text-primary-foreground',
        'shadow-md',
        'transition-all duration-200',
        className
      )}
    >
      <div className="px-4 py-3 md:px-6 md:py-3.5">
        <div className="flex items-center justify-between gap-3">
          {/* Logo & Location */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo */}
            <div className="relative">
              <img src="/logo-224solutions.png" alt="224Solutions" className="w-10 h-10 md:w-11 md:h-11 rounded-xl object-contain bg-white/10 p-0.5" />
            </div>

            <div className="min-w-0 text-center">
              <h1 className="font-bold text-white text-lg md:text-xl tracking-tight truncate">
                224Solutions
              </h1>
              <button
                className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors group no-hover-effect"
                onClick={() => refresh()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 text-white/70 animate-spin" />
                ) : (
                  <MapPin className="w-3 h-3 text-white/70 group-hover:scale-110 transition-transform" />
                )}
                <span className="truncate max-w-[150px]">
                  {loading ? 'Détection...' : location?.address || 'Conakry, Guinée'}
                </span>
                {!loading && (
                  <RefreshCw className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* PWA Install Button */}
            {isInstallable && !isInstalled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleInstall}
                className="relative h-10 w-10 rounded-full hover:bg-white/15 transition-colors animate-pulse no-hover-effect"
                title="Installer l'application"
              >
                <Download className="w-5 h-5 text-white" />
              </Button>
            )}

            <div className="[&_button]:text-white [&_button]:hover:bg-white/15 [&_button]:no-hover-effect">
              <ThemeToggle />
            </div>
            <div className="[&_button]:text-white [&_button]:hover:bg-white/15 [&_button]:no-hover-effect">
              <LanguageSelector variant="minimal" />
            </div>

            {/* Cart Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onCartClick || (() => navigate('/cart'))}
              className="relative h-10 w-10 rounded-full hover:bg-white/15 transition-colors no-hover-effect"
            >
              <ShoppingCart className="w-5 h-5 text-white" />
              {cartCount > 0 && (
                <Badge
                  className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-accent text-accent-foreground border-2 border-primary"
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </Badge>
              )}
            </Button>

            {/* Unified Notification Bell - uses communication_notifications + realtime */}
            <div className="[&_button]:text-white [&_button]:hover:bg-white/15 [&_button]:no-hover-effect">
              <NotificationBellButton />
            </div>
          </div>
        </div>
      </div>

      {/* Professional Ticker Banner */}
      <div className="bg-white/10 border-t border-white/15 overflow-hidden relative">
        <div className="flex animate-ticker py-2">
          <span className="ticker-item text-base md:text-lg font-semibold text-white whitespace-nowrap px-8">
            🎉 Bienvenue sur 224SOLUTIONS
          </span>
          <span className="ticker-item text-sm md:text-base font-medium text-white/85 whitespace-nowrap px-8">
            🌍 Une plateforme africaine
          </span>
          <span className="ticker-item text-sm md:text-base font-medium text-white/85 whitespace-nowrap px-8">
            🚀 Des opportunités sans frontières
          </span>
          <span className="ticker-item text-sm md:text-base font-medium text-white/85 whitespace-nowrap px-8">
            🏪 Tout votre marché en un seul endroit
          </span>
          <span className="ticker-item text-sm md:text-base font-medium text-white/85 whitespace-nowrap px-8">
            💎 Découvrez, achetez et vendez simplement
          </span>
          {/* Duplicate for seamless loop */}
          <span className="ticker-item text-base md:text-lg font-semibold text-white whitespace-nowrap px-8">
            🎉 Bienvenue sur 224SOLUTIONS
          </span>
          <span className="ticker-item text-sm md:text-base font-medium text-white/85 whitespace-nowrap px-8">
            🌍 Une plateforme africaine
          </span>
          <span className="ticker-item text-sm md:text-base font-medium text-white/85 whitespace-nowrap px-8">
            🚀 Des opportunités sans frontières
          </span>
          <span className="ticker-item text-sm md:text-base font-medium text-white/85 whitespace-nowrap px-8">
            🏪 Tout votre marché en un seul endroit
          </span>
          <span className="ticker-item text-sm md:text-base font-medium text-white/85 whitespace-nowrap px-8">
            💎 Découvrez, achetez et vendez simplement
          </span>
        </div>
      </div>
    </header>
  );
}

export default HomeHeader;

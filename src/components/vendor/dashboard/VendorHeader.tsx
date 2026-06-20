/**
 * VENDOR HEADER COMPONENT
 * Header optimisé et mémoïsé pour le dashboard vendeur
 * 224Solutions - Optimisation Performance & Accessibilité
 */

import { memo, Suspense, lazy, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, Settings } from 'lucide-react';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { useVendorNotifications } from '@/hooks/useVendorNotifications';
import { useTranslation } from '@/hooks/useTranslation';
import { UserTrackerButton } from '@/components/taxi-moto/UserTrackerButton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Lazy loaded header components (UI non-critique)
const NetworkStatusIndicator = lazy(() => import('@/components/vendor/NetworkStatusIndicator'));
const VendorIdDisplay = lazy(() =>
  import('@/components/vendor/VendorIdDisplay').then(m => ({ default: m.VendorIdDisplay }))
);
const WalletBalanceWidget = lazy(() =>
  import('@/components/wallet/WalletBalanceWidget').then(m => ({ default: m.WalletBalanceWidget }))
);
const NotificationBellButton = lazy(() =>
  import('@/components/shared/NotificationBellButton').then(m => ({ default: m.NotificationBellButton }))
);

// ============================================================================
// Types
// ============================================================================

interface VendorHeaderProps {
  /** Nom d'affichage de l'utilisateur */
  displayName: string;
  /** Callback de déconnexion */
  onSignOut: () => Promise<void>;
}

// ============================================================================
// Sous-composants mémoïsés
// ============================================================================

/**
 * Logo et titre de l'application
 */
const AppBranding = memo(function AppBranding({ displayName }: { displayName: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <SidebarTrigger
        className="h-[60px] w-[60px] sm:h-10 sm:w-10 md:h-8 md:w-8 sm:mr-2 md:mr-4 [&_svg]:h-8 [&_svg]:w-8 sm:[&_svg]:h-5 sm:[&_svg]:w-5"
        aria-label={t('common.toggleMenu')}
      />

      <div
        className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white shadow-sm ring-1 ring-blue-100"
        aria-hidden="true"
      >
        <img
          src="/logo-224solutions.png"
          alt="224Solutions"
          className="w-full h-full object-contain p-0.5"
        />
      </div>

      <div className="flex flex-col leading-tight">
        <h1 className="text-sm md:text-xl font-bold text-[#04439e] whitespace-nowrap pr-1">
          224Solutions
        </h1>
        {displayName && (
          <span className="text-xs md:text-sm font-semibold text-black whitespace-nowrap">
            {displayName}
          </span>
        )}
      </div>
    </div>
  );
});

/**
 * Indicateur de statut utilisateur
 */
const UserStatus = memo(function UserStatus() {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from('vendors')
      .select('business_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setBusinessName(data?.business_name ?? null);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="flex items-center gap-1 md:gap-2 min-w-0 flex-1">
      <div className="flex flex-col items-start gap-1 min-w-0 ml-4 sm:ml-8 md:ml-12">
        <Suspense fallback={null}>
          <VendorIdDisplay showName={false} />
        </Suspense>
        {/* Traking sous l'ID + nom de la boutique à côté */}
        <div className="flex items-center gap-2 min-w-0">
          <UserTrackerButton
            mode="merchant"
            prominent
            driverName={businessName || 'Vendeur'}
            className="h-7 px-2.5 text-[11px] bg-[#04439e] hover:bg-[#04439e]/90 text-white"
          />
          {businessName && (
            <span className="text-[11px] md:text-xs font-semibold text-[#04439e] truncate max-w-[110px] sm:max-w-[160px]">
              {businessName}
            </span>
          )}
        </div>
      </div>
      <Suspense fallback={null}>
        <NetworkStatusIndicator />
      </Suspense>
    </div>
  );
});

/**
 * Actions du header (boutons)
 */
const HeaderActions = memo(function HeaderActions({
  onSignOut,
  onNavigateToSettings,
  vendorUnreadCount,
}: {
  onSignOut: () => Promise<void>;
  onNavigateToSettings: () => void;
  vendorUnreadCount: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
      {/* Bouton d'abonnement retiré du header (doublon) — l'abonnement reste affiché
          via la carte « Mon Abonnement » du dashboard et la page d'abonnement. */}

      {/* Notification Bell (bouton de notification opérationnel — l'autre, push FCM, a été retiré) */}
      <Suspense fallback={null}>
        <NotificationBellButton
          className="h-8 w-8 md:h-10 md:w-10"
          iconSize="w-4 h-4 md:w-5 md:h-5"
          externalUnreadCount={vendorUnreadCount}
          badgeClassName="bg-[#ff4000] text-white"
        />
      </Suspense>

      {/* Settings */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 md:h-10 md:w-10"
        onClick={onNavigateToSettings}
        aria-label={t('common.settings')}
        title={t('common.settings')}
      >
        <Settings className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
      </Button>

      {/* Sign Out */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSignOut}
        className="h-8 w-8 md:h-10 md:w-10"
        aria-label={t('common.signOut')}
        title={t('common.signOut')}
      >
        <LogOut className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
      </Button>
    </div>
  );
});

// ============================================================================
// Composant principal
// ============================================================================

const VendorHeader = memo(function VendorHeader({
  displayName,
  onSignOut,
}: VendorHeaderProps) {
  const navigate = useNavigate();
  const { unreadCount: vendorUnreadCount } = useVendorNotifications();

  const handleNavigateToSettings = () => {
    navigate('/vendeur/settings');
  };

  return (
    <header className="min-h-14 md:min-h-16 bg-white/95 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-40 shadow-sm px-2 sm:px-3 md:px-6 w-full max-w-full overflow-visible">
      <div className="flex flex-col sm:flex-row sm:items-center w-full min-w-0 gap-2 py-2 md:py-0">
        {/* Ligne 1 (mobile): menu + logo + nom app + nom utilisateur dessous */}
        <AppBranding displayName={displayName} />

        {/* Ligne 2 (mobile): ID + Traking + nom boutique à gauche, actions à droite */}
        <div className="flex items-center justify-between w-full min-w-0 gap-2">
          <UserStatus />
          <HeaderActions
            onSignOut={onSignOut}
            onNavigateToSettings={handleNavigateToSettings}
            vendorUnreadCount={vendorUnreadCount}
          />
        </div>
      </div>

      {/* Wallet compact - visible uniquement sur grands écrans */}
      <div className="hidden xl:block pb-2">
        <Suspense fallback={null}>
          <WalletBalanceWidget className="max-w-[250px]" showTransferButton={false} />
        </Suspense>
      </div>
    </header>
  );
});

export { VendorHeader };
export default VendorHeader;

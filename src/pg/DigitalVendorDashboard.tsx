/**
 * DASHBOARD VENDEUR DIGITAL - Interface dédiée produits numériques
 * Complètement séparé du dashboard vendeur e-commerce classique
 * Note: CommunicationWidget retiré car déjà rendu null et évite doublons potentiels
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRoleRedirect } from '@/hooks/useRoleRedirect';
import { useToast } from '@/hooks/use-toast';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DigitalVendorSidebar } from '@/components/digital-vendor/DigitalVendorSidebar';
import { DigitalVendorHeader } from '@/components/digital-vendor/DigitalVendorHeader';
import { DigitalVendorRoutes } from '@/components/digital-vendor/DigitalVendorRoutes';
import { PageLoader } from '@/components/ui/GlobalLoader';
import { DataLoadTimeoutState } from '@/components/ui/DataLoadTimeoutState';
import { useLoadingTimeout } from '@/hooks/useLoadingTimeout';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { shouldAssumeOffline } from '@/lib/networkHealth';
import { supabase } from '@/integrations/supabase/client';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

export default function DigitalVendorDashboard() {
  const { user, profile, signOut, loading: authLoading, profileLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  useRoleRedirect();

  const [vendorId, setVendorId] = useState<string>('');
  const [vendorBusinessType, setVendorBusinessType] = useState<string | null>(null);
  const [vendorLoading, setVendorLoading] = useState<boolean>(false);
  const [redirectingToStandardDashboard, setRedirectingToStandardDashboard] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setVendorLoading(false);
      setVendorId('');
      setVendorBusinessType(null);
      return;
    }

    const loadVendorId = async () => {
      setVendorLoading(true);
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('id, business_type')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('FIRST SUPABASE ERROR', {
            scope: 'DigitalVendorDashboard.loadVendorId',
            message: error.message,
          });
          return;
        }

        if (data?.id) {
          setVendorId(data.id);
          setVendorBusinessType(data.business_type ?? null);
        } else {
          setVendorId('');
          setVendorBusinessType(null);
        }
      } catch (error) {
        console.error('FIRST SUPABASE ERROR', {
          scope: 'DigitalVendorDashboard.loadVendorId.catch',
          error,
        });
      } finally {
        setVendorLoading(false);
      }
    };

    void loadVendorId();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !profile?.role || vendorLoading || redirectingToStandardDashboard) {
      return;
    }

    if (profile.role === 'admin') {
      return;
    }

    if (profile.role === 'vendeur' && vendorBusinessType && vendorBusinessType !== 'digital') {
      setRedirectingToStandardDashboard(true);
      toast({
        title: t('vendor.standardVendorDetected'),
        description: t('vendor.redirectingToStandardDashboard'),
      });
      navigate('/vendeur', { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    profile?.role,
    vendorLoading,
    vendorBusinessType,
    redirectingToStandardDashboard,
    toast,
    navigate,
  ]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      toast({ title: t('common.signOutSuccess') });
      navigate('/');
    } catch (err) {
      console.error('Erreur déconnexion:', err);
      toast({ title: t('common.error'), description: t('common.signOutError'), variant: 'destructive' });
    }
  }, [signOut, toast, navigate, t]);

  const isLoading = authLoading || profileLoading || (!!user && vendorLoading);
  const { timedOut: loadingTimedOut, resetTimeout } = useLoadingTimeout(isLoading, 8000);
  const { connectivity, checkConnection } = useOnlineStatus();
  const confirmedOffline = !isLoading && !!user && connectivity === 'offline' && shouldAssumeOffline();

  if (redirectingToStandardDashboard) {
    return <PageLoader text={t('vendor.redirectingToStandardDashboard')} />;
  }

  if (confirmedOffline) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#eef3fb] px-6">
        <div className="max-w-sm w-full rounded-[28px] bg-white shadow-[0_22px_55px_rgba(4,67,158,0.12)] p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#04439e]/10">
            <WifiOff className="h-8 w-8 text-[#04439e]" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">{t('common.connectionRequired')}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {t('vendor.digitalOfflineDesc')}
          </p>
          <Button
            onClick={() => {
              void checkConnection();
              window.location.reload();
            }}
            className="mt-6 w-full rounded-2xl bg-[#04439e] font-semibold text-white hover:bg-[#04439e]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (loadingTimedOut) {
    return (
      <DataLoadTimeoutState
        title={t('vendor.digitalDashboardLoadFailed')}
        description={t('vendor.loadingTooLong')}
        onRetry={resetTimeout}
        onReload={() => window.location.reload()}
      />
    );
  }

  if (isLoading) {
    return <PageLoader text={t('common.loadingData')} />;
  }

  if (!user) {
    return (
      <DataLoadTimeoutState
        title={t('auth.sessionUnavailable')}
        description={t('auth.sessionRestoreFailed')}
        onRetry={resetTimeout}
        onReload={() => window.location.reload()}
      />
    );
  }

  const displayName = profile?.first_name || user?.email?.split('@')[0] || t('vendor.digitalVendor');
  const sellerCode = (profile as any)?.public_id || (profile as any)?.custom_id || vendorId || null;

  return (
    <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen w-full flex bg-[#eef3fb]">
        <DigitalVendorSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <DigitalVendorHeader displayName={displayName} sellerCode={sellerCode} onSignOut={handleSignOut} />

          <main
            className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-3 pb-24 pt-5 sm:px-5 md:px-8 md:pb-10 md:pt-7"
            role="main"
            aria-label={t('vendor.digitalDashboard')}
          >
            <div className="mx-auto w-full max-w-[1600px] min-w-0">
              <DigitalVendorRoutes vendorId={vendorId} />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

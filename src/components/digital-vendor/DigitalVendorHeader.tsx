/**
 * Header dédié pour le vendeur digital
 */

import { memo, Suspense, lazy } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, Settings } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

const WalletBalanceWidget = lazy(() =>
  import('@/components/wallet/WalletBalanceWidget').then(m => ({ default: m.WalletBalanceWidget }))
);

interface DigitalVendorHeaderProps {
  displayName: string;
  sellerCode?: string | null;
  onSignOut: () => Promise<void>;
}

const DigitalVendorHeader = memo(function DigitalVendorHeader({
  displayName,
  sellerCode,
  onSignOut,
}: DigitalVendorHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full bg-transparent shadow-none">
      <div className="flex w-full min-w-0 flex-col gap-2 px-2.5 py-2 sm:gap-3 sm:px-5 sm:py-3 md:px-8">
        {/* Brand */}
        <div className="flex items-center justify-between gap-3 min-w-0 rounded-[28px] border border-blue-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_52%,#eef4ff_100%)] px-3 py-2 shadow-[0_14px_30px_rgba(15,23,42,0.07)] sm:px-4 sm:py-3">
          <div className="flex items-center gap-3 min-w-0">
          <SidebarTrigger
            className="h-10 w-10 rounded-2xl border border-blue-200/80 bg-white text-slate-700 shadow-[0_8px_18px_rgba(148,163,184,0.16)] hover:bg-blue-50 [&_svg]:h-4 [&_svg]:w-4 sm:h-11 sm:w-11 sm:[&_svg]:h-5 sm:[&_svg]:w-5"
            aria-label="Ouvrir/Fermer le menu"
          />
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-blue-100 bg-white shadow-[0_10px_24px_rgba(59,130,246,0.12)] sm:h-12 sm:w-12">
              <img src="/logo-224solutions.png" alt="224Solutions" className="h-5 w-5 rounded-md object-contain sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="whitespace-nowrap text-xs font-semibold tracking-[0.01em] text-slate-950 sm:text-base md:text-xl">
                  Cockpit vendeur digital
                </h1>
                <span className="hidden rounded-full border border-[#ffb08a] bg-[#fff1e9] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff5a1f] sm:inline-flex">
                  Business
                </span>
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500 sm:text-xs">
                Catalogue • ventes • revenus
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-600 md:text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a] shadow-[0_0_0_5px_rgba(22,163,74,0.16)] animate-pulse" />
                <span className="truncate max-w-[220px] sm:max-w-[340px]">{displayName}</span>
              </p>
              {sellerCode ? (
                <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                  ID vendeur : <span className="font-mono font-semibold text-slate-900">{sellerCode}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5 rounded-[24px] border border-blue-200/80 bg-white/88 p-1.5 shadow-[0_10px_20px_rgba(15,23,42,0.05)] sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 sm:h-10 sm:w-10 md:h-11 md:w-11"
              onClick={() => navigate('/vendeur-digital/settings')}
              aria-label={t('digitalVendorHeader.parametres')}
            >
              <Settings className="h-4 w-4 md:h-5 md:w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              className="h-9 w-9 rounded-2xl border border-[#ffcfb8] bg-[#fff4ee] text-[#ff6a1a] hover:bg-[#ff6a1a] hover:text-white sm:h-10 sm:w-10 md:h-11 md:w-11"
              aria-label={t('digitalVendorHeader.seDeconnecter')}
            >
              <LogOut className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Wallet compact - desktop */}
      <div className="hidden px-5 py-3 xl:block md:px-8">
        <Suspense fallback={null}>
          <WalletBalanceWidget className="max-w-[250px]" showTransferButton={false} variant="surface" />
        </Suspense>
      </div>
    </header>
  );
});

export { DigitalVendorHeader };
export default DigitalVendorHeader;

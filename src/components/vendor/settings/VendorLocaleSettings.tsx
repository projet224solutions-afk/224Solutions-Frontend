/**
 * PARAMÈTRES DE LOCALISATION VENDEUR
 * Permet de changer la langue et la devise d'AFFICHAGE (conversion de prix).
 * La devise du wallet est verrouillée selon le pays de résidence et ne peut
 * être modifiée que par un administrateur.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, RefreshCw, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/hooks/useLocale';
import LanguageSelector from '@/components/LanguageSelector';
import { CurrencySelect } from '@/components/ui/currency-select';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/hooks/useWallet';
import { useTranslation } from '@/hooks/useTranslation';

export default function VendorLocaleSettings() {
  const { t } = useTranslation();
  const { language, currency, setCurrency, country, loading, refreshGeo } = useLocale();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const handleRefreshGeo = async () => {
    localStorage.removeItem('app_language_manual');
    localStorage.removeItem('app_currency_manual');
    localStorage.removeItem('app_language');
    localStorage.removeItem('app_currency');
    localStorage.removeItem('user_country');
    localStorage.removeItem('geo_detection_cache');

    await refreshGeo();

    toast({
      title: t('vendorLocale.positionUpdated'),
      description: t('vendorLocale.positionUpdatedDesc'),
    });
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    toast({
      title: t('vendorLocale.currencyUpdated'),
      description: `${t('vendorLocale.currencyChangedTo')} ${newCurrency}. ${t('vendorLocale.walletCurrencyStays')} ${wallet?.currency || '—'}.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          {t('vendorLocale.title')}
        </CardTitle>
        <CardDescription>
          {t('vendorLocale.subtitle')}
          {country && (
            <span className="block mt-1 text-xs">
              {t('vendorLocale.detectedCountry')} <strong>{country}</strong>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Devise wallet verrouillée — information uniquement */}
        {wallet && (
          <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
            <Lock className="w-4 h-4 flex-shrink-0 text-[#ff4000]" />
            <div>
              <p className="font-medium text-[#ff4000]">{t('vendorLocale.walletLocked')} {wallet.currency}</p>
              <p className="text-xs text-[#ff4000] mt-0.5">
                {t('vendorLocale.walletLockedDesc')}
              </p>
            </div>
          </div>
        )}

        {/* Sélecteur de langue */}
        <div className="space-y-2">
          <LanguageSelector variant="default" />
        </div>

        {/* Sélecteur de devise d'affichage */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            {t('vendorLocale.displayCurrency')}
          </label>
          <CurrencySelect
            value={currency}
            onValueChange={handleCurrencyChange}
            showFlag={true}
            showName={true}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            {t('vendorLocale.displayCurrencyHint')}
          </p>
        </div>

        {/* Bouton de réinitialisation */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleRefreshGeo}
            disabled={loading}
            className="w-full gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('vendorLocale.detectPosition')}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {t('vendorLocale.detectPositionHint')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Indicateur de Devise avec Toggle - Marketplace
 * Affiche la devise actuelle et permet de basculer entre locale/GNF
 * Inclut rafraîchissement de la détection géographique
 */

import { useState, useEffect } from 'react';
import { Globe, RefreshCw, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { useGeoDetection } from '@/hooks/useGeoDetection';
import { useTranslation } from '@/hooks/useTranslation';
import { getCurrencyByCode } from '@/data/currencies';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';

const CURRENCY_STORAGE_KEY = 'app_currency';

interface CurrencyIndicatorProps {
  variant?: 'default' | 'compact';
  showToggle?: boolean;
}

// Fonction pour vider tous les caches géo et langue
function clearAllGeoCaches() {
  try {
    localStorage.removeItem('geo_detection_cache');
    localStorage.removeItem('user_country');
    localStorage.removeItem('marketplace_display_currency'); // legacy cleanup
    localStorage.removeItem('app_language');
    localStorage.removeItem('app_language_manual');
    localStorage.removeItem('app_currency');
    localStorage.removeItem('app_currency_manual');
  } catch {}
}

export function CurrencyIndicator({
  variant = 'default',
  showToggle = true
}: CurrencyIndicatorProps) {
  const { userCurrency, userCountry, loading, lastUpdated, refreshRates } = usePriceConverter();
  const { forceRefresh: forceGeoRefresh, loading: geoLoading } = useGeoDetection();
  const { currency: globalCurrency, setCurrency: setGlobalCurrency } = useCurrency();
  const { t } = useTranslation();

  // Source unique de vérité : le contexte global
  const displayCurrency = globalCurrency || userCurrency;

  const handleToggleCurrency = () => {
    const newCurrency = displayCurrency === 'GNF' ? userCurrency : 'GNF';
    setGlobalCurrency(newCurrency);
    window.dispatchEvent(new CustomEvent('currencyChanged', {
      detail: { currency: newCurrency }
    }));
  };

  const handleSelectCurrency = (currency: string) => {
    setGlobalCurrency(currency);
    window.dispatchEvent(new CustomEvent('currencyChanged', {
      detail: { currency }
    }));
  };

  // Rafraîchir la détection géo et réinitialiser tout
  const handleRefreshGeo = async () => {
    clearAllGeoCaches();
    await forceGeoRefresh();
    await refreshRates();
    toast.success(t('marketplace.geoRefreshed') || 'Localisation actualisée');

    // Recharger la page pour appliquer les changements
    window.location.reload();
  };

  const currency = getCurrencyByCode(displayCurrency);
  const detectedCurrency = getCurrencyByCode(userCurrency);

  if (loading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
        {variant === 'compact' ? '...' : t('common.loading') || 'Chargement...'}
      </Badge>
    );
  }

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-primary/10"
              onClick={showToggle ? handleToggleCurrency : undefined}
            >
              <Globe className="w-3 h-3 mr-1" />
              {currency?.flag} {displayCurrency}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <p className="font-semibold">
                {t('marketplace.pricesIn') || 'Prix affichés en'}
              </p>
              <p>{currency?.name || displayCurrency}</p>
              <p className="text-muted-foreground">
                {t('marketplace.detectedCountry') || 'Pays détecté'}: {userCountry}
              </p>
              {displayCurrency !== userCurrency && (
                <p className="text-muted-foreground">
                  {t('marketplace.convertedFrom') || 'Converti depuis'} {detectedCurrency?.name}
                </p>
              )}
              {showToggle && (
                <p className="text-primary font-medium mt-2">
                  {t('common.clickToToggle') || 'Cliquez pour basculer'}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">
            {t('marketplace.pricesIn') || 'Prix en'}:
          </span>
          <Badge variant="secondary" className="ml-1">
            {currency?.flag} {displayCurrency}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('marketplace.selectCurrency') || 'Sélectionner la devise'}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleRefreshGeo}
            disabled={geoLoading}
          >
            {geoLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <MapPin className="w-3 h-3" />
            )}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Pays détecté */}
        <div className="px-2 py-1 text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span>{t('marketplace.detectedCountry') || 'Pays'}: {userCountry}</span>
        </div>

        <DropdownMenuSeparator />

        {/* Devise locale détectée */}
        {userCurrency !== 'GNF' && (
          <DropdownMenuItem
            onClick={() => handleSelectCurrency(userCurrency)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span>{detectedCurrency?.flag}</span>
              <div>
                <p className="font-medium">{detectedCurrency?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t('marketplace.yourLocalCurrency') || 'Votre devise locale'} ({userCountry})
                </p>
              </div>
            </div>
            {displayCurrency === userCurrency && (
              <span className="text-primary">✓</span>
            )}
          </DropdownMenuItem>
        )}

        {/* GNF (devise d'origine) */}
        <DropdownMenuItem
          onClick={() => handleSelectCurrency('GNF')}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span>🇬🇳</span>
            <div>
              <p className="font-medium">{t('currencyIndicator.francGuineenGnf')}</p>
              <p className="text-xs text-muted-foreground">
                {t('marketplace.originalCurrency') || 'Devise d\'origine'}
              </p>
            </div>
          </div>
          {displayCurrency === 'GNF' && (
            <span className="text-primary">✓</span>
          )}
        </DropdownMenuItem>

        {/* Devises populaires */}
        {[
          { code: 'XOF', flag: '🇸🇳', name: 'Franc CFA BCEAO (XOF)' },
          { code: 'XAF', flag: '🇬🇦', name: 'Franc CFA BEAC (XAF)' },
          { code: 'USD', flag: '🇺🇸', name: 'Dollar US (USD)' },
          { code: 'EUR', flag: '🇪🇺', name: 'Euro (EUR)' },
        ]
          .filter(c => c.code !== userCurrency && c.code !== 'GNF')
          .map(c => (
            <DropdownMenuItem
              key={c.code}
              onClick={() => handleSelectCurrency(c.code)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span>{c.flag}</span>
                <p className="font-medium">{c.name}</p>
              </div>
              {displayCurrency === c.code && (
                <span className="text-primary">✓</span>
              )}
            </DropdownMenuItem>
          ))}

        <DropdownMenuSeparator />

        {/* Bouton de rafraîchissement géo */}
        <div className="px-2 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-2"
            onClick={handleRefreshGeo}
            disabled={geoLoading}
          >
            {geoLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <MapPin className="w-3 h-3" />
            )}
            {t('marketplace.refreshLocation') || 'Actualiser ma position'}
          </Button>
        </div>

        {/* Informations sur le taux de change */}
        {displayCurrency !== 'GNF' && lastUpdated && (
          <div className="px-2 py-2 text-xs text-muted-foreground border-t">
            <p className="flex items-center justify-between">
              <span>{t('marketplace.exchangeRate') || 'Taux de change'}:</span>
              <span className="font-mono">
                {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-7 text-xs"
              onClick={() => refreshRates()}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              {t('common.refresh') || 'Actualiser'}
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Hook pour écouter les changements de devise
export function useDisplayCurrency() {
  const { userCurrency } = usePriceConverter();
  const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
    return localStorage.getItem(CURRENCY_STORAGE_KEY) || userCurrency;
  });

  useEffect(() => {
    const handleCurrencyChange = (event: any) => {
      setDisplayCurrency(event.detail.currency);
    };

    window.addEventListener('currencyChanged', handleCurrencyChange);
    return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(CURRENCY_STORAGE_KEY) && userCurrency) {
      setDisplayCurrency(userCurrency);
    }
  }, [userCurrency]);

  return { displayCurrency, isLocal: displayCurrency !== 'GNF' };
}

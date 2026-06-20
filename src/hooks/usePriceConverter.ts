/**
 * HOOK DE CONVERSION DE PRIX – VERSION INTERNE
 * Convertit les prix dans la devise locale de l'utilisateur.
 * Source unique : table currency_exchange_rates (cron horaire african-fx-collect).
 *
 * Règle affichage :
 *  - Taux exact disponible en base → montant converti dans la devise du visiteur
 *  - Aucun taux en base pour la paire → montant ORIGINAL dans la devise du produit
 *    (jamais de taux hardcodés approximatifs pour l'affichage public)
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useGeoDetection } from './useGeoDetection';
import { formatCurrency } from '@/lib/formatters';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getRatesForBase, invalidateRatesCache, getLastUpdated } from '@/services/exchangeService';
import { WORLD_CURRENCIES } from '@/data/currencies';

export interface ConvertedPrice {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  userCurrency: string;
  rate: number;
  formatted: string;
  originalFormatted: string;
  /** true = taux backend trouvé → affiché en devise visiteur ; false = affiché en devise originale */
  wasConverted: boolean;
}

interface UsePriceConverterResult {
  convert: (amount: number, fromCurrency: string) => ConvertedPrice;
  userCurrency: string;
  userCountry: string;
  loading: boolean;
  hasBackendRates: boolean;
  lastUpdated: Date | null;
  refreshRates: () => Promise<void>;
}

const WORLD_CURRENCY_CODES = Array.from(new Set(WORLD_CURRENCIES.map((c) => c.code.toUpperCase())));


export function usePriceConverter(): UsePriceConverterResult {
  const { geoInfo, loading: geoLoading } = useGeoDetection();
  const { currency: contextCurrency } = useCurrency();

  const userCurrency = contextCurrency || geoInfo?.currency || 'GNF';
  const userCountry = geoInfo?.country || 'GN';

  // dbRates : taux RÉELS chargés depuis currency_exchange_rates (vide si base vide)
  const [dbRates, setDbRates] = useState<Record<string, number>>({});
  const [hasBackendRates, setHasBackendRates] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRatesLoading(true);

    getRatesForBase('GNF', WORLD_CURRENCY_CODES)
      .then((result) => {
        if (cancelled) return;
        if (Object.keys(result).length > 0) {
          setDbRates(result);
          setHasBackendRates(true);
        } else {
          // Base vide : on ne convertit pas (affichage original)
          setDbRates({});
          setHasBackendRates(false);
          console.warn('[usePriceConverter] Aucun taux en base — affichage en devise originale.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDbRates({});
        setHasBackendRates(false);
        console.error('[usePriceConverter] Erreur chargement taux — affichage en devise originale.');
      })
      .finally(() => { if (!cancelled) setRatesLoading(false); });

    getLastUpdated().then((ts) => { if (!cancelled) setLastUpdated(ts); });

    return () => { cancelled = true; };
  }, [userCurrency]);

  const refresh = useCallback(async () => {
    invalidateRatesCache();
    setRatesLoading(true);
    try {
      const result = await getRatesForBase('GNF', WORLD_CURRENCY_CODES);
      if (Object.keys(result).length > 0) {
        setDbRates(result);
        setHasBackendRates(true);
      } else {
        setDbRates({});
        setHasBackendRates(false);
      }
      const ts = await getLastUpdated();
      setLastUpdated(ts);
    } catch {
      // garder les taux actuels
    } finally {
      setRatesLoading(false);
    }
  }, []);

  const convert = useCallback((amount: number, fromCurrency: string): ConvertedPrice => {
    const from = fromCurrency.toUpperCase();
    const to = userCurrency.toUpperCase();

    const originalFormatted = formatCurrency(amount, from);

    // Même devise → retour immédiat sans conversion
    if (from === to) {
      return {
        originalAmount: amount, originalCurrency: from,
        convertedAmount: amount, userCurrency: to,
        rate: 1, formatted: originalFormatted, originalFormatted,
        wasConverted: false,
      };
    }

    // Aucun taux backend → afficher le prix original
    if (!hasBackendRates || Object.keys(dbRates).length === 0) {
      return {
        originalAmount: amount, originalCurrency: from,
        convertedAmount: amount, userCurrency: from,
        rate: 1, formatted: originalFormatted, originalFormatted,
        wasConverted: false,
      };
    }

    // Chercher le taux dans les données RÉELLES du backend
    let rate = 0;
    let convertedAmount = 0;

    if (from === 'GNF') {
      const toRate = dbRates[to];
      if (toRate && toRate > 0) {
        rate = toRate;
        convertedAmount = amount * rate;
      }
    } else if (to === 'GNF') {
      const fromRate = dbRates[from];
      if (fromRate && fromRate > 0) {
        rate = 1 / fromRate;
        convertedAmount = amount * rate;
      }
    } else {
      // Croisement via GNF : from → GNF → to
      const fromRate = dbRates[from];
      const toRate = dbRates[to];
      if (fromRate && toRate && fromRate > 0) {
        rate = toRate / fromRate;
        convertedAmount = amount * rate;
      }
    }

    // Aucun taux en base pour cette paire → afficher le prix original
    if (rate === 0) {
      return {
        originalAmount: amount, originalCurrency: from,
        convertedAmount: amount, userCurrency: from,
        rate: 1, formatted: originalFormatted, originalFormatted,
        wasConverted: false,
      };
    }

    // Arrondi selon la devise
    const noDecimalCurrencies = ['GNF', 'XOF', 'XAF', 'JPY', 'KRW', 'VND', 'NGN', 'UGX', 'RWF', 'BIF', 'CDF'];
    if (noDecimalCurrencies.includes(to)) {
      convertedAmount = Math.round(convertedAmount);
    } else {
      convertedAmount = Math.round(convertedAmount * 100) / 100;
    }

    return {
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount,
      userCurrency: to,
      rate,
      formatted: formatCurrency(convertedAmount, to),
      originalFormatted,
      wasConverted: true,
    };
  }, [userCurrency, dbRates, hasBackendRates]);

  return {
    convert,
    userCurrency,
    userCountry,
    loading: geoLoading || ratesLoading,
    hasBackendRates,
    lastUpdated,
    refreshRates: refresh,
  };
}

/**
 * Hook simplifié pour convertir un prix unique.
 * Retourne null pendant le chargement.
 */
export function useConvertedPrice(amount: number, fromCurrency: string): ConvertedPrice | null {
  const { convert, loading } = usePriceConverter();

  return useMemo(() => {
    // NB : ne PAS utiliser `!amount` — `!0` est true, ce qui faisait afficher « 0 GNF »
    // (non converti) au lieu de « 0 » dans la devise de l'utilisateur. On convertit 0 aussi.
    if (loading || amount == null || Number.isNaN(amount) || !fromCurrency) return null;
    return convert(amount, fromCurrency);
  }, [convert, loading, amount, fromCurrency]);
}

/**
 * HOOK UNIFIÉ DE LOCALISATION
 * Accès combiné à la langue et la devise avec détection automatique
 */

import { useLanguage } from '@/i18n/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useGeoDetection } from '@/hooks/useGeoDetection';

interface UseLocaleResult {
  // Langue
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  isRTL: boolean;

  // Devise
  currency: string;
  setCurrency: (currency: string) => void;

  // Pays détecté
  country: string | null;

  // États
  loading: boolean;

  // Rafraîchir la détection
  refreshGeo: () => Promise<void>;
}

/**
 * Hook principal pour accéder aux paramètres de localisation
 * Combine langue, devise et géo-détection
 */
export function useLocale(): UseLocaleResult {
  const { language, setLanguage, t, isRTL, userCountry } = useLanguage();
  const { currency, setCurrency, loading: currencyLoading } = useCurrency();
  const { geoInfo, loading: geoLoading, refresh } = useGeoDetection();

  return {
    // Langue
    language,
    setLanguage,
    t,
    isRTL,

    // Devise
    currency,
    setCurrency,

    // Pays (priorité: geo-detection > language context)
    country: geoInfo?.country || userCountry,

    // États
    loading: currencyLoading || geoLoading,

    // Actions
    refreshGeo: refresh,
  };
}

export default useLocale;

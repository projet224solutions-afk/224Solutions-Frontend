/**
 * HOOK DE TRADUCTION
 * Fournit un accès simple aux traductions dans les composants
 */

import { useLanguage } from '@/i18n/LanguageContext';

export const useTranslation = () => {
  const { t, language, setLanguage, isRTL, userCountry, supportedLanguages } = useLanguage();

  return {
    t,
    language,
    setLanguage,
    isRTL,
    userCountry,
    supportedLanguages,
    // Alias pour compatibilité
    currentLanguage: language,
    changeLanguage: setLanguage,
  };
};

export default useTranslation;

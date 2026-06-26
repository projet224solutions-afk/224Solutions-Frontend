/**
 * CONTEXTE DE LANGUE GLOBAL
 * Gère la langue de l'application avec détection automatique basée sur le pays
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supportedLanguages, defaultLanguage, loadTranslations } from './languages';
import { getLanguageForCountry, isRTLLanguage } from '@/data/countryMappings';

// Précharge la langue par défaut (fr) dès l'import du module : évite un flash de clés
// brutes au tout premier rendu. Les traductions complètes (21 Mo) ne sont plus dans le
// bundle initial — chaque langue est un chunk chargé à la volée.
let defaultTranslationsCache: Record<string, string> = {};
void loadTranslations(defaultLanguage).then((t) => { defaultTranslationsCache = t; });


interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  userCountry: string | null;
  isRTL: boolean;
  supportedLanguages: typeof supportedLanguages;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'app_language';
const MANUAL_LANG_KEY = 'app_language_manual'; // Indique si l'utilisateur a VRAIMENT choisi manuellement
const COUNTRY_KEY = 'user_country';
const GEO_CACHE_KEY = 'geo_detection_cache';
const GEO_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - synchronisé avec useGeoDetection

function safeGetLocalStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures in embedded/local preview contexts
  }
}

// Détecte la langue du navigateur
const detectBrowserLanguage = (): string => {
  try {
    const browserLang = navigator.language || (navigator as any).userLanguage || '';
    const langCode = browserLang.split('-')[0].toLowerCase();

    const isSupported = supportedLanguages.some(l => l.code === langCode);
    return isSupported ? langCode : defaultLanguage;
  } catch {
    return defaultLanguage;
  }
};

// Détecte le pays depuis le cache local (peuplé par useGeoDetection, PAS d'appel direct à l'edge function)
const detectCountryFromCache = (): { country: string | null; language: string | null } => {
  try {
    // Vérifier le cache de géo-détection
    const geoCacheRaw = safeGetLocalStorageItem(GEO_CACHE_KEY);
    if (geoCacheRaw) {
      const geoCache = JSON.parse(geoCacheRaw);
      if (geoCache?.data?.country) {
        const country = geoCache.data.country;
        const langFromCache = String(geoCache.data.language || '').toLowerCase();
        const mappedLang = getLanguageForCountry(country);
        const candidateLang = supportedLanguages.some(l => l.code === langFromCache) ? langFromCache : mappedLang;
        const language = candidateLang && supportedLanguages.some(l => l.code === candidateLang) ? candidateLang : null;
        return { country, language };
      }
    }

    // Fallback: user_country dans localStorage
    const cachedCountry = safeGetLocalStorageItem(COUNTRY_KEY);
    if (cachedCountry) {
      const language = getLanguageForCountry(cachedCountry);
      const isSupported = supportedLanguages.some(l => l.code === language);
      return { country: cachedCountry, language: isSupported ? language : null };
    }
  } catch { }

  return { country: null, language: null };
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(() => {
    // Priorité: localStorage (choix manuel) > navigateur > défaut
    const stored = safeGetLocalStorageItem(STORAGE_KEY);
    if (stored && supportedLanguages.some(l => l.code === stored)) {
      return stored;
    }
    return detectBrowserLanguage();
  });

  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [hasAutoDetected, setHasAutoDetected] = useState(false);

  // ✅ Traductions de la langue active, chargées dynamiquement (1 chunk par langue).
  const [activeTranslations, setActiveTranslations] = useState<Record<string, string>>(
    () => defaultTranslationsCache
  );

  // Charge dynamiquement les traductions à chaque changement de langue.
  useEffect(() => {
    let cancelled = false;
    loadTranslations(language)
      .then((trans) => { if (!cancelled) setActiveTranslations(trans); })
      .catch(() => { /* ne pas bloquer l'UI ; t() retombe sur la clé / le cache fr */ });
    return () => { cancelled = true; };
  }, [language]);

  // Détection du pays et langue au chargement - SYNCHRO avec useGeoDetection
  useEffect(() => {
    const detect = async () => {
      // Vérifier si l'utilisateur a VRAIMENT choisi manuellement (pas juste une ancienne valeur)
      const hasManualChoice = safeGetLocalStorageItem(MANUAL_LANG_KEY) === 'true';
      if (hasManualChoice) {
        console.log('🌍 Langue choisie manuellement, pas de sync auto');
        return;
      }

      // Essayer de récupérer depuis le cache de géo-détection (ignorer les fallback)
      const geoCacheRaw = safeGetLocalStorageItem(GEO_CACHE_KEY);
      if (geoCacheRaw) {
        try {
          const geoCache = JSON.parse(geoCacheRaw);
          if (geoCache?.data?.country && geoCache?.data?.language && geoCache?.data?.detectionMethod !== 'fallback') {
            const country = geoCache.data.country;
            const detectedLang = geoCache.data.language;

            // Vérifier si la langue est supportée
            if (supportedLanguages.some(l => l.code === detectedLang)) {
              console.log(`🌍 Auto-sync langue (geo-cache): pays=${country}, langue=${detectedLang}`);
              setUserCountry(country);
              if (detectedLang !== language) {
                setLanguageState(detectedLang);
                safeSetLocalStorageItem(STORAGE_KEY, detectedLang);
              }
              setHasAutoDetected(true);
              return;
            }
          }
        } catch { }
      }

      // Fallback: lire depuis le cache local (pas d'appel réseau)
      const { country, language: detectedLang } = detectCountryFromCache();
      setUserCountry(country);

      // Si on a une langue détectée et pas encore auto-détecté
      if (detectedLang && !hasAutoDetected) {
        console.log(`🌍 Auto-détection cache: pays=${country}, langue=${detectedLang}`);
        setLanguageState(detectedLang);
        safeSetLocalStorageItem(STORAGE_KEY, detectedLang);
        setHasAutoDetected(true);
      }
    };

    detect();
  }, [hasAutoDetected, language]);

  // Écouter les changements de cache géo pour synchroniser la langue
  useEffect(() => {
    const syncFromGeoCache = () => {
      // Ne pas écraser si choix manuel explicite
      const hasManualChoice = safeGetLocalStorageItem(MANUAL_LANG_KEY) === 'true';
      if (hasManualChoice) return;

      try {
        const geoCacheRaw = safeGetLocalStorageItem(GEO_CACHE_KEY);
        if (geoCacheRaw) {
          const geoCache = JSON.parse(geoCacheRaw);
          // Ignorer les fallback
          if (geoCache?.data?.language && geoCache?.data?.detectionMethod !== 'fallback') {
            const detectedLang = geoCache.data.language;
            if (supportedLanguages.some(l => l.code === detectedLang) && detectedLang !== language) {
              console.log(`🌍 Sync langue (geo-cache): ${detectedLang}`);
              setLanguageState(detectedLang);
              safeSetLocalStorageItem(STORAGE_KEY, detectedLang);
              setUserCountry(geoCache.data.country);
            }
          }
        }
      } catch { }
    };

    // Synchroniser immédiatement au montage
    syncFromGeoCache();

    // Vérifier périodiquement si le cache géo a changé
    const checkInterval = setInterval(syncFromGeoCache, 2000);

    // Écouter les changements de storage
    const handleStorage = (e: StorageEvent) => {
      if (e.key === GEO_CACHE_KEY) {
        syncFromGeoCache();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [language]);

  // Mise à jour de la direction du document
  useEffect(() => {
    const langInfo = supportedLanguages.find(l => l.code === language);
    document.documentElement.lang = language;
    document.documentElement.dir = langInfo?.dir || 'ltr';
  }, [language]);

  const setLanguage = useCallback((lang: string) => {
    if (!supportedLanguages.some(l => l.code === lang)) {
      console.warn(`Langue non supportée: ${lang}`);
      return;
    }

    setLanguageState(lang);
    safeSetLocalStorageItem(STORAGE_KEY, lang);
    safeSetLocalStorageItem(MANUAL_LANG_KEY, 'true'); // Marquer comme choix manuel explicite
    console.log(`🌍 Langue définie manuellement: ${lang}`);
  }, []);

  // Fonction de traduction
  const t = useCallback((key: string): string => {
    // Langue active si chargée, sinon repli sur le cache fr préchargé, sinon la clé brute.
    return activeTranslations[key] || defaultTranslationsCache[key] || key;
  }, [activeTranslations]);

  // Vérifier si RTL - utiliser notre helper centralisé
  const currentIsRTL = isRTLLanguage(language) ||
    supportedLanguages.find(l => l.code === language)?.dir === 'rtl';

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    userCountry,
    isRTL: currentIsRTL,
    supportedLanguages
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Valeurs par défaut pour usage en dehors du provider (fallback sécurisé)
const defaultContextValue: LanguageContextType = {
  language: defaultLanguage,
  setLanguage: () => console.warn('LanguageProvider not mounted'),
  t: (key: string) => defaultTranslationsCache[key] || key,
  userCountry: null,
  isRTL: false,
  supportedLanguages
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);

  if (!context) {
    console.warn('⚠️ useLanguage utilisé hors du LanguageProvider, fallback activé');
    return defaultContextValue;
  }

  return context;
};

export default LanguageContext;

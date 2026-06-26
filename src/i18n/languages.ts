/**
 * MÉTADONNÉES DES LANGUES — léger (reste dans le bundle initial).
 * Les traductions elles-mêmes sont dans src/i18n/locales/{code}.ts
 * et chargées dynamiquement par LanguageContext (code splitting).
 */

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export const supportedLanguages: LanguageInfo[] = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'es', name: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'pt', name: 'Português', flag: '🇧🇷', dir: 'ltr' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'zh', name: '中文', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', dir: 'ltr' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱', dir: 'ltr' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱', dir: 'ltr' },
  { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭', dir: 'ltr' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', dir: 'ltr' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', dir: 'ltr' },
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪', dir: 'ltr' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦', dir: 'ltr' },
  { code: 'he', name: 'עברית', flag: '🇮🇱', dir: 'rtl' },
  { code: 'fa', name: 'فارسی', flag: '🇮🇷', dir: 'rtl' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩', dir: 'ltr' },
  { code: 'wo', name: 'Wolof', flag: '🇸🇳', dir: 'ltr' },
  { code: 'ff', name: 'Pulaar / Peul', flag: '🇬🇳', dir: 'ltr' },
  { code: 'su', name: 'Soussou', flag: '🇬🇳', dir: 'ltr' },
];

export const defaultLanguage = 'fr';

/** Charge dynamiquement les traductions d'une langue (code splitting via import()). */
export async function loadTranslations(code: string): Promise<Record<string, string>> {
  const lang = supportedLanguages.some(l => l.code === code) ? code : defaultLanguage;
  try {
    const mod = await import(`./locales/${lang}.ts`);
    return mod.default || {};
  } catch (err) {
    console.error(`[i18n] Échec chargement langue ${lang}, repli ${defaultLanguage}`, err);
    if (lang !== defaultLanguage) {
      const fallback = await import(`./locales/${defaultLanguage}.ts`);
      return fallback.default || {};
    }
    return {};
  }
}

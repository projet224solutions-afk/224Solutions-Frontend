/**
 * MAPPINGS PAYS → DEVISE & LANGUE
 * Base de données complète pour la détection automatique mondiale
 */

// ISO 3166-1 alpha-2 → ISO 4217 (code devise)
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // AFRIQUE DE L'OUEST
  GN: 'GNF', // Guinée
  SN: 'XOF', // Sénégal
  ML: 'XOF', // Mali
  CI: 'XOF', // Côte d'Ivoire
  BF: 'XOF', // Burkina Faso
  NE: 'XOF', // Niger
  TG: 'XOF', // Togo
  BJ: 'XOF', // Bénin
  SL: 'SLL', // Sierra Leone
  LR: 'LRD', // Liberia
  GM: 'GMD', // Gambie
  GW: 'XOF', // Guinée-Bissau
  CV: 'CVE', // Cap-Vert
  MR: 'MRU', // Mauritanie
  NG: 'NGN', // Nigeria
  GH: 'GHS', // Ghana

  // AFRIQUE CENTRALE
  CM: 'XAF', // Cameroun
  GA: 'XAF', // Gabon
  TD: 'XAF', // Tchad
  CF: 'XAF', // Centrafrique
  CG: 'XAF', // Congo
  GQ: 'XAF', // Guinée Équatoriale
  CD: 'CDF', // RD Congo
  ST: 'STN', // Sao Tomé

  // AFRIQUE DE L'EST
  KE: 'KES', // Kenya
  TZ: 'TZS', // Tanzanie
  UG: 'UGX', // Ouganda
  RW: 'RWF', // Rwanda
  BI: 'BIF', // Burundi
  ET: 'ETB', // Éthiopie
  ER: 'ERN', // Érythrée
  DJ: 'DJF', // Djibouti
  SO: 'SOS', // Somalie
  SS: 'SSP', // Soudan du Sud
  SD: 'SDG', // Soudan

  // AFRIQUE AUSTRALE
  ZA: 'ZAR', // Afrique du Sud
  NA: 'NAD', // Namibie
  BW: 'BWP', // Botswana
  ZW: 'ZWL', // Zimbabwe
  ZM: 'ZMW', // Zambie
  MW: 'MWK', // Malawi
  MZ: 'MZN', // Mozambique
  AO: 'AOA', // Angola
  LS: 'LSL', // Lesotho
  SZ: 'SZL', // Eswatini

  // AFRIQUE DU NORD
  MA: 'MAD', // Maroc
  DZ: 'DZD', // Algérie
  TN: 'TND', // Tunisie
  LY: 'LYD', // Libye
  EG: 'EGP', // Égypte

  // OCÉAN INDIEN
  MG: 'MGA', // Madagascar
  MU: 'MUR', // Maurice
  SC: 'SCR', // Seychelles
  KM: 'KMF', // Comores

  // EUROPE
  FR: 'EUR', DE: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR',
  BE: 'EUR', NL: 'EUR', AT: 'EUR', IE: 'EUR', FI: 'EUR',
  GR: 'EUR', LU: 'EUR', MT: 'EUR', CY: 'EUR', SK: 'EUR',
  SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', HR: 'EUR',
  GB: 'GBP', // Royaume-Uni
  CH: 'CHF', // Suisse
  NO: 'NOK', // Norvège
  SE: 'SEK', // Suède
  DK: 'DKK', // Danemark
  PL: 'PLN', // Pologne
  CZ: 'CZK', // Tchéquie
  HU: 'HUF', // Hongrie
  RO: 'RON', // Roumanie
  BG: 'BGN', // Bulgarie
  UA: 'UAH', // Ukraine
  RU: 'RUB', // Russie
  BY: 'BYN', // Biélorussie
  RS: 'RSD', // Serbie
  AL: 'ALL', // Albanie
  MK: 'MKD', // Macédoine du Nord
  BA: 'BAM', // Bosnie
  ME: 'EUR', // Monténégro
  XK: 'EUR', // Kosovo
  IS: 'ISK', // Islande
  MD: 'MDL', // Moldavie
  GE: 'GEL', // Géorgie
  AM: 'AMD', // Arménie
  AZ: 'AZN', // Azerbaïdjan
  TR: 'TRY', // Turquie

  // AMÉRIQUE DU NORD
  US: 'USD', // États-Unis
  CA: 'CAD', // Canada
  MX: 'MXN', // Mexique

  // AMÉRIQUE CENTRALE & CARAÏBES
  GT: 'GTQ', // Guatemala
  HN: 'HNL', // Honduras
  NI: 'NIO', // Nicaragua
  CR: 'CRC', // Costa Rica
  PA: 'PAB', // Panama
  CU: 'CUP', // Cuba
  DO: 'DOP', // Rép. Dominicaine
  HT: 'HTG', // Haïti
  JM: 'JMD', // Jamaïque
  TT: 'TTD', // Trinité-et-Tobago
  BB: 'BBD', // Barbade
  BS: 'BSD', // Bahamas
  BZ: 'BZD', // Belize

  // AMÉRIQUE DU SUD
  BR: 'BRL', // Brésil
  AR: 'ARS', // Argentine
  CL: 'CLP', // Chili
  CO: 'COP', // Colombie
  PE: 'PEN', // Pérou
  VE: 'VES', // Venezuela
  EC: 'USD', // Équateur (utilise USD)
  BO: 'BOB', // Bolivie
  PY: 'PYG', // Paraguay
  UY: 'UYU', // Uruguay
  GY: 'GYD', // Guyana
  SR: 'SRD', // Suriname

  // MOYEN-ORIENT
  AE: 'AED', // Émirats
  SA: 'SAR', // Arabie Saoudite
  QA: 'QAR', // Qatar
  KW: 'KWD', // Koweït
  BH: 'BHD', // Bahreïn
  OM: 'OMR', // Oman
  JO: 'JOD', // Jordanie
  LB: 'LBP', // Liban
  SY: 'SYP', // Syrie
  IQ: 'IQD', // Irak
  IR: 'IRR', // Iran
  YE: 'YER', // Yémen
  IL: 'ILS', // Israël
  PS: 'ILS', // Palestine

  // ASIE DU SUD
  IN: 'INR', // Inde
  PK: 'PKR', // Pakistan
  BD: 'BDT', // Bangladesh
  LK: 'LKR', // Sri Lanka
  NP: 'NPR', // Népal
  BT: 'BTN', // Bhoutan
  MV: 'MVR', // Maldives
  AF: 'AFN', // Afghanistan

  // ASIE DU SUD-EST
  ID: 'IDR', // Indonésie
  MY: 'MYR', // Malaisie
  SG: 'SGD', // Singapour
  TH: 'THB', // Thaïlande
  VN: 'VND', // Vietnam
  PH: 'PHP', // Philippines
  MM: 'MMK', // Myanmar
  KH: 'KHR', // Cambodge
  LA: 'LAK', // Laos
  BN: 'BND', // Brunei
  TL: 'USD', // Timor-Leste

  // ASIE DE L'EST
  CN: 'CNY', // Chine
  JP: 'JPY', // Japon
  KR: 'KRW', // Corée du Sud
  KP: 'KPW', // Corée du Nord
  TW: 'TWD', // Taïwan
  HK: 'HKD', // Hong Kong
  MO: 'MOP', // Macao
  MN: 'MNT', // Mongolie

  // ASIE CENTRALE
  KZ: 'KZT', // Kazakhstan
  UZ: 'UZS', // Ouzbékistan
  TM: 'TMT', // Turkménistan
  KG: 'KGS', // Kirghizistan
  TJ: 'TJS', // Tadjikistan

  // OCÉANIE
  AU: 'AUD', // Australie
  NZ: 'NZD', // Nouvelle-Zélande
  FJ: 'FJD', // Fidji
  PG: 'PGK', // Papouasie-Nouvelle-Guinée
  SB: 'SBD', // Îles Salomon
  VU: 'VUV', // Vanuatu
  WS: 'WST', // Samoa
  TO: 'TOP', // Tonga
  PF: 'XPF', // Polynésie française
  NC: 'XPF', // Nouvelle-Calédonie
};

// ISO 3166-1 alpha-2 → ISO 639-1 (code langue)
export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  // AFRIQUE FRANCOPHONE
  GN: 'fr', SN: 'fr', ML: 'fr', CI: 'fr', BF: 'fr', NE: 'fr',
  TG: 'fr', BJ: 'fr', CM: 'fr', GA: 'fr', TD: 'fr', CF: 'fr',
  CG: 'fr', CD: 'fr', DJ: 'fr', MG: 'fr', KM: 'fr',
  MR: 'ar', // Mauritanie - arabe officiel

  // AFRIQUE ANGLOPHONE
  SL: 'en', LR: 'en', GM: 'en', NG: 'en', GH: 'en',
  KE: 'en', TZ: 'en', UG: 'en', RW: 'en', BI: 'fr',
  ET: 'en', ER: 'en', ZA: 'en', ZW: 'en', ZM: 'en',
  MW: 'en', BW: 'en', NA: 'en', LS: 'en', SZ: 'en',
  MU: 'en', SC: 'en', SS: 'en', SD: 'ar',

  // AFRIQUE LUSOPHONE
  GW: 'pt', CV: 'pt', MZ: 'pt', AO: 'pt', ST: 'pt',

  // AFRIQUE DU NORD (ARABE)
  MA: 'ar', DZ: 'ar', TN: 'ar', LY: 'ar', EG: 'ar',

  // EUROPE
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', CH: 'fr',
  DE: 'de', AT: 'de', LI: 'de',
  GB: 'en', IE: 'en', MT: 'en',
  ES: 'es', AD: 'es',
  PT: 'pt',
  IT: 'it', SM: 'it', VA: 'it',
  NL: 'nl',
  PL: 'pl',
  RU: 'ru', BY: 'ru',
  UA: 'uk',
  TR: 'tr',
  GR: 'el', CY: 'el',
  SE: 'sv', FI: 'sv',
  NO: 'no',
  DK: 'da',
  IS: 'is',
  CZ: 'cs',
  SK: 'sk',
  HU: 'hu',
  RO: 'ro', MD: 'ro',
  BG: 'bg',
  HR: 'hr',
  SI: 'sl',
  RS: 'sr', ME: 'sr', BA: 'bs',
  MK: 'mk',
  AL: 'sq', XK: 'sq',
  EE: 'et',
  LV: 'lv',
  LT: 'lt',
  GE: 'ka',
  AM: 'hy',
  AZ: 'az',

  // AMÉRIQUES
  US: 'en', CA: 'en', // Canada bilingue, en par défaut
  MX: 'es', GT: 'es', HN: 'es', NI: 'es', CR: 'es',
  PA: 'es', CU: 'es', DO: 'es', VE: 'es', CO: 'es',
  EC: 'es', PE: 'es', BO: 'es', PY: 'es', UY: 'es',
  AR: 'es', CL: 'es',
  BR: 'pt',
  HT: 'fr',
  JM: 'en', TT: 'en', BB: 'en', BS: 'en', BZ: 'en',
  GY: 'en', SR: 'nl',

  // MOYEN-ORIENT
  AE: 'ar', SA: 'ar', QA: 'ar', KW: 'ar', BH: 'ar',
  OM: 'ar', JO: 'ar', LB: 'ar', SY: 'ar', IQ: 'ar',
  YE: 'ar', PS: 'ar',
  IR: 'fa',
  IL: 'he',
  AF: 'fa',

  // ASIE DU SUD
  IN: 'hi', PK: 'ur', BD: 'bn', LK: 'si', NP: 'ne',
  BT: 'dz', MV: 'dv',

  // ASIE DU SUD-EST
  ID: 'id', MY: 'ms', SG: 'en', TH: 'th', VN: 'vi',
  PH: 'tl', MM: 'my', KH: 'km', LA: 'lo', BN: 'ms',
  TL: 'pt',

  // ASIE DE L'EST
  CN: 'zh', JP: 'ja', KR: 'ko', TW: 'zh', HK: 'zh',
  MO: 'zh', MN: 'mn', KP: 'ko',

  // ASIE CENTRALE
  KZ: 'kk', UZ: 'uz', TM: 'tk', KG: 'ky', TJ: 'tg',

  // OCÉANIE
  AU: 'en', NZ: 'en', FJ: 'en', PG: 'en', SB: 'en',
  VU: 'en', WS: 'en', TO: 'en',
  PF: 'fr', NC: 'fr',
};

/**
 * Mapping nom de pays (tel que stocké en DB) → code devise
 * Utilisé pour déterminer la devise d'un vendeur à partir de son champ `country`
 */
const COUNTRY_NAME_TO_CURRENCY: Record<string, string> = {
  'guinée': 'GNF', 'guinea': 'GNF',
  'sénégal': 'XOF', 'senegal': 'XOF',
  'mali': 'XOF',
  'côte d\'ivoire': 'XOF', 'cote d\'ivoire': 'XOF', 'ivory coast': 'XOF',
  'burkina faso': 'XOF',
  'niger': 'XOF',
  'togo': 'XOF',
  'bénin': 'XOF', 'benin': 'XOF',
  'guinée-bissau': 'XOF', 'guinea-bissau': 'XOF',
  'sierra leone': 'SLL',
  'liberia': 'LRD', 'libéria': 'LRD',
  'gambie': 'GMD', 'gambia': 'GMD',
  'nigeria': 'NGN', 'nigéria': 'NGN',
  'ghana': 'GHS',
  'cameroun': 'XAF', 'cameroon': 'XAF',
  'gabon': 'XAF',
  'tchad': 'XAF', 'chad': 'XAF',
  'congo': 'XAF',
  'rd congo': 'CDF', 'rdc': 'CDF', 'congo-kinshasa': 'CDF',
  'maroc': 'MAD', 'morocco': 'MAD',
  'tunisie': 'TND', 'tunisia': 'TND',
  'algérie': 'DZD', 'algeria': 'DZD',
  'égypte': 'EGP', 'egypt': 'EGP',
  'kenya': 'KES',
  'tanzanie': 'TZS', 'tanzania': 'TZS',
  'ouganda': 'UGX', 'uganda': 'UGX',
  'rwanda': 'RWF',
  'éthiopie': 'ETB', 'ethiopia': 'ETB',
  'afrique du sud': 'ZAR', 'south africa': 'ZAR',
  'france': 'EUR',
  'belgique': 'EUR', 'belgium': 'EUR',
  'suisse': 'CHF', 'switzerland': 'CHF',
  'canada': 'CAD',
  'états-unis': 'USD', 'united states': 'USD', 'usa': 'USD',
  'royaume-uni': 'GBP', 'united kingdom': 'GBP', 'uk': 'GBP',
  'chine': 'CNY', 'china': 'CNY',
  'japon': 'JPY', 'japan': 'JPY',
  'inde': 'INR', 'india': 'INR',
  'brésil': 'BRL', 'brazil': 'BRL',
  'turquie': 'TRY', 'turkey': 'TRY',
};

/**
 * Obtenir la devise d'un pays (par code ISO ou par nom)
 */
export function getCurrencyForCountry(countryCode: string): string {
  if (!countryCode) return 'GNF';
  // Essayer d'abord par code ISO
  const byCode = COUNTRY_TO_CURRENCY[countryCode.toUpperCase()];
  if (byCode) return byCode;
  // Sinon par nom de pays
  const byName = COUNTRY_NAME_TO_CURRENCY[countryCode.trim().toLowerCase()];
  return byName || 'GNF';
}

/**
 * Obtenir la langue d'un pays
 */
export function getLanguageForCountry(countryCode: string): string {
  return COUNTRY_TO_LANGUAGE[countryCode?.toUpperCase()] || 'en';
}

/**
 * Mapping code ISO-2 → nom de pays FR (tel que stocké dans vendors.country).
 * Sert à présélectionner le bon « chip » pays quand on ne connaît que le code détecté (IP).
 */
export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  GN: 'Guinée', SN: 'Sénégal', ML: 'Mali', CI: "Côte d'Ivoire", BF: 'Burkina Faso',
  NE: 'Niger', TG: 'Togo', BJ: 'Bénin', GW: 'Guinée-Bissau', SL: 'Sierra Leone',
  LR: 'Liberia', GM: 'Gambie', NG: 'Nigeria', GH: 'Ghana', CM: 'Cameroun',
  GA: 'Gabon', TD: 'Tchad', CG: 'Congo', CD: 'RD Congo', MA: 'Maroc',
  TN: 'Tunisie', DZ: 'Algérie', EG: 'Égypte', KE: 'Kenya', TZ: 'Tanzanie',
  UG: 'Ouganda', RW: 'Rwanda', ET: 'Éthiopie', ZA: 'Afrique du Sud', FR: 'France',
  BE: 'Belgique', CH: 'Suisse', CA: 'Canada', US: 'États-Unis', GB: 'Royaume-Uni',
  CN: 'Chine', JP: 'Japon', IN: 'Inde', BR: 'Brésil', TR: 'Turquie',
};

/** Nom de pays FR (minuscule) → code ISO-2 (inverse de COUNTRY_CODE_TO_NAME, pour les drapeaux). */
const COUNTRY_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_CODE_TO_NAME).flatMap(([code, name]) => [
    [name.toLowerCase(), code],
  ])
);
// Alias supplémentaires (variantes d'écriture rencontrées en base)
Object.assign(COUNTRY_NAME_TO_CODE, {
  'guinea': 'GN', 'senegal': 'SN', 'cote d\'ivoire': 'CI', 'ivory coast': 'CI',
  'benin': 'BJ', 'guinea-bissau': 'GW', 'libéria': 'LR', 'gambia': 'GM',
  'nigéria': 'NG', 'cameroon': 'CM', 'chad': 'TD', 'rdc': 'CD', 'congo-kinshasa': 'CD',
  'morocco': 'MA', 'tunisia': 'TN', 'algeria': 'DZ', 'egypt': 'EG', 'tanzania': 'TZ',
  'uganda': 'UG', 'ethiopia': 'ET', 'south africa': 'ZA', 'belgium': 'BE',
  'switzerland': 'CH', 'united states': 'US', 'usa': 'US', 'united kingdom': 'GB',
  'uk': 'GB', 'china': 'CN', 'japan': 'JP', 'india': 'IN', 'brazil': 'BR', 'turkey': 'TR',
});

/** code ISO-2 → nom FR du pays (ou null si inconnu). */
export function getCountryNameFromCode(code?: string): string | null {
  if (!code || code.length !== 2) return null;
  return COUNTRY_CODE_TO_NAME[code.toUpperCase()] || null;
}

/**
 * Emoji drapeau d'un pays, à partir d'un code ISO-2 OU d'un nom (FR/EN).
 * Renvoie '' si on ne peut pas déterminer le pays (l'appelant peut alors ne rien afficher).
 */
export function getFlagEmoji(countryNameOrCode?: string): string {
  if (!countryNameOrCode) return '';
  const raw = countryNameOrCode.trim();
  let code: string | undefined;
  if (raw.length === 2 && /^[a-zA-Z]{2}$/.test(raw)) {
    code = raw.toUpperCase();
  } else {
    code = COUNTRY_NAME_TO_CODE[raw.replace(/\s+/g, ' ').toLowerCase()];
  }
  if (!code || code.length !== 2) return '';
  // Lettres → indicateurs régionaux Unicode (🇬🇳, etc.)
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/**
 * Code ISO-2 (minuscule) d'un pays à partir d'un code OU d'un nom (FR/EN).
 * Utile pour construire une URL d'image de drapeau (ex. flagcdn).
 * Renvoie null si indéterminé.
 */
export function getCountryCode2(countryNameOrCode?: string): string | null {
  if (!countryNameOrCode) return null;
  const raw = countryNameOrCode.trim();
  if (raw.length === 2 && /^[a-zA-Z]{2}$/.test(raw)) return raw.toLowerCase();
  const code = COUNTRY_NAME_TO_CODE[raw.replace(/\s+/g, ' ').toLowerCase()];
  return code ? code.toLowerCase() : null;
}

/**
 * Liste des langues RTL (Right-to-Left)
 */
export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

/**
 * Vérifier si une langue est RTL
 */
export function isRTLLanguage(langCode: string): boolean {
  return RTL_LANGUAGES.includes(langCode?.toLowerCase());
}

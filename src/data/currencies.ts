/**
 * Liste complète des devises mondiales (ISO 4217)
 * 224SOLUTIONS - Currency Management System
 */

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag?: string;
  decimals: number;
}

// Liste exhaustive des devises ISO 4217 les plus utilisées
export const WORLD_CURRENCIES: Currency[] = [
  // Afrique
  { code: 'GNF', name: 'Franc Guinéen', symbol: 'GNF', flag: '🇬🇳', decimals: 0 },
  { code: 'XOF', name: 'Franc CFA (BCEAO)', symbol: 'CFA', flag: '🌍', decimals: 0 },
  { code: 'XAF', name: 'Franc CFA (BEAC)', symbol: 'FCFA', flag: '🌍', decimals: 0 },
  { code: 'NGN', name: 'Naira Nigérian', symbol: '₦', flag: '🇳🇬', decimals: 2 },
  { code: 'GHS', name: 'Cedi Ghanéen', symbol: '₵', flag: '🇬🇭', decimals: 2 },
  { code: 'ZAR', name: 'Rand Sud-Africain', symbol: 'R', flag: '🇿🇦', decimals: 2 },
  { code: 'EGP', name: 'Livre Égyptienne', symbol: 'E£', flag: '🇪🇬', decimals: 2 },
  { code: 'MAD', name: 'Dirham Marocain', symbol: 'DH', flag: '🇲🇦', decimals: 2 },
  { code: 'TND', name: 'Dinar Tunisien', symbol: 'DT', flag: '🇹🇳', decimals: 3 },
  { code: 'DZD', name: 'Dinar Algérien', symbol: 'DA', flag: '🇩🇿', decimals: 2 },
  { code: 'KES', name: 'Shilling Kényan', symbol: 'KSh', flag: '🇰🇪', decimals: 2 },
  { code: 'UGX', name: 'Shilling Ougandais', symbol: 'USh', flag: '🇺🇬', decimals: 0 },
  { code: 'TZS', name: 'Shilling Tanzanien', symbol: 'TSh', flag: '🇹🇿', decimals: 2 },
  { code: 'RWF', name: 'Franc Rwandais', symbol: 'FRw', flag: '🇷🇼', decimals: 0 },
  { code: 'ETB', name: 'Birr Éthiopien', symbol: 'Br', flag: '🇪🇹', decimals: 2 },
  { code: 'SLL', name: 'Leone Sierra-Léonais', symbol: 'Le', flag: '🇸🇱', decimals: 2 },
  { code: 'LRD', name: 'Dollar Libérien', symbol: 'L$', flag: '🇱🇷', decimals: 2 },
  { code: 'GMD', name: 'Dalasi Gambien', symbol: 'D', flag: '🇬🇲', decimals: 2 },
  { code: 'CVE', name: 'Escudo Cap-Verdien', symbol: '$', flag: '🇨🇻', decimals: 2 },
  { code: 'MRU', name: 'Ouguiya Mauritanien', symbol: 'UM', flag: '🇲🇷', decimals: 2 },
  { code: 'SZL', name: 'Lilangeni Eswatini', symbol: 'E', flag: '🇸🇿', decimals: 2 },
  { code: 'BWP', name: 'Pula Botswanais', symbol: 'P', flag: '🇧🇼', decimals: 2 },
  { code: 'MWK', name: 'Kwacha Malawien', symbol: 'MK', flag: '🇲🇼', decimals: 2 },
  { code: 'ZMW', name: 'Kwacha Zambien', symbol: 'ZK', flag: '🇿🇲', decimals: 2 },
  { code: 'MZN', name: 'Metical Mozambicain', symbol: 'MT', flag: '🇲🇿', decimals: 2 },
  { code: 'AOA', name: 'Kwanza Angolais', symbol: 'Kz', flag: '🇦🇴', decimals: 2 },
  { code: 'NAD', name: 'Dollar Namibien', symbol: 'N$', flag: '🇳🇦', decimals: 2 },
  { code: 'SCR', name: 'Roupie Seychelloise', symbol: '₨', flag: '🇸🇨', decimals: 2 },
  { code: 'MUR', name: 'Roupie Mauricienne', symbol: '₨', flag: '🇲🇺', decimals: 2 },
  { code: 'MGA', name: 'Ariary Malgache', symbol: 'Ar', flag: '🇲🇬', decimals: 2 },
  { code: 'CDF', name: 'Franc Congolais', symbol: 'FC', flag: '🇨🇩', decimals: 2 },
  { code: 'BIF', name: 'Franc Burundais', symbol: 'FBu', flag: '🇧🇮', decimals: 0 },
  { code: 'DJF', name: 'Franc Djiboutien', symbol: 'Fdj', flag: '🇩🇯', decimals: 0 },
  { code: 'ERN', name: 'Nakfa Érythréen', symbol: 'Nkf', flag: '🇪🇷', decimals: 2 },
  { code: 'SOS', name: 'Shilling Somalien', symbol: 'S', flag: '🇸🇴', decimals: 2 },
  { code: 'SDG', name: 'Livre Soudanaise', symbol: 'ج.س', flag: '🇸🇩', decimals: 2 },
  { code: 'SSP', name: 'Livre Sud-Soudanaise', symbol: '£', flag: '🇸🇸', decimals: 2 },
  { code: 'LYD', name: 'Dinar Libyen', symbol: 'LD', flag: '🇱🇾', decimals: 3 },
  { code: 'STN', name: 'Dobra Santoméen', symbol: 'Db', flag: '🇸🇹', decimals: 2 },
  { code: 'KMF', name: 'Franc Comorien', symbol: 'CF', flag: '🇰🇲', decimals: 0 },

  // Europe
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', decimals: 2 },
  { code: 'GBP', name: 'Livre Sterling', symbol: '£', flag: '🇬🇧', decimals: 2 },
  { code: 'CHF', name: 'Franc Suisse', symbol: 'CHF', flag: '🇨🇭', decimals: 2 },
  { code: 'NOK', name: 'Couronne Norvégienne', symbol: 'kr', flag: '🇳🇴', decimals: 2 },
  { code: 'SEK', name: 'Couronne Suédoise', symbol: 'kr', flag: '🇸🇪', decimals: 2 },
  { code: 'DKK', name: 'Couronne Danoise', symbol: 'kr', flag: '🇩🇰', decimals: 2 },
  { code: 'PLN', name: 'Zloty Polonais', symbol: 'zł', flag: '🇵🇱', decimals: 2 },
  { code: 'CZK', name: 'Couronne Tchèque', symbol: 'Kč', flag: '🇨🇿', decimals: 2 },
  { code: 'HUF', name: 'Forint Hongrois', symbol: 'Ft', flag: '🇭🇺', decimals: 2 },
  { code: 'RON', name: 'Leu Roumain', symbol: 'lei', flag: '🇷🇴', decimals: 2 },
  { code: 'BGN', name: 'Lev Bulgare', symbol: 'лв', flag: '🇧🇬', decimals: 2 },
  { code: 'HRK', name: 'Kuna Croate', symbol: 'kn', flag: '🇭🇷', decimals: 2 },
  { code: 'RSD', name: 'Dinar Serbe', symbol: 'дин', flag: '🇷🇸', decimals: 2 },
  { code: 'UAH', name: 'Hryvnia Ukrainien', symbol: '₴', flag: '🇺🇦', decimals: 2 },
  { code: 'RUB', name: 'Rouble Russe', symbol: '₽', flag: '🇷🇺', decimals: 2 },
  { code: 'TRY', name: 'Livre Turque', symbol: '₺', flag: '🇹🇷', decimals: 2 },
  { code: 'ISK', name: 'Couronne Islandaise', symbol: 'kr', flag: '🇮🇸', decimals: 0 },
  { code: 'ALL', name: 'Lek Albanais', symbol: 'L', flag: '🇦🇱', decimals: 2 },
  { code: 'MKD', name: 'Denar Macédonien', symbol: 'ден', flag: '🇲🇰', decimals: 2 },
  { code: 'BAM', name: 'Mark Convertible', symbol: 'KM', flag: '🇧🇦', decimals: 2 },
  { code: 'MDL', name: 'Leu Moldave', symbol: 'L', flag: '🇲🇩', decimals: 2 },
  { code: 'BYN', name: 'Rouble Biélorusse', symbol: 'Br', flag: '🇧🇾', decimals: 2 },
  { code: 'GEL', name: 'Lari Géorgien', symbol: '₾', flag: '🇬🇪', decimals: 2 },
  { code: 'AMD', name: 'Dram Arménien', symbol: '֏', flag: '🇦🇲', decimals: 2 },
  { code: 'AZN', name: 'Manat Azerbaïdjanais', symbol: '₼', flag: '🇦🇿', decimals: 2 },

  // Amérique du Nord
  { code: 'USD', name: 'Dollar Américain', symbol: '$', flag: '🇺🇸', decimals: 2 },
  { code: 'CAD', name: 'Dollar Canadien', symbol: 'C$', flag: '🇨🇦', decimals: 2 },
  { code: 'MXN', name: 'Peso Mexicain', symbol: '$', flag: '🇲🇽', decimals: 2 },

  // Amérique du Sud
  { code: 'BRL', name: 'Real Brésilien', symbol: 'R$', flag: '🇧🇷', decimals: 2 },
  { code: 'ARS', name: 'Peso Argentin', symbol: '$', flag: '🇦🇷', decimals: 2 },
  { code: 'CLP', name: 'Peso Chilien', symbol: '$', flag: '🇨🇱', decimals: 0 },
  { code: 'COP', name: 'Peso Colombien', symbol: '$', flag: '🇨🇴', decimals: 2 },
  { code: 'PEN', name: 'Sol Péruvien', symbol: 'S/', flag: '🇵🇪', decimals: 2 },
  { code: 'VES', name: 'Bolivar Vénézuélien', symbol: 'Bs', flag: '🇻🇪', decimals: 2 },
  { code: 'UYU', name: 'Peso Uruguayen', symbol: '$U', flag: '🇺🇾', decimals: 2 },
  { code: 'PYG', name: 'Guarani Paraguayen', symbol: '₲', flag: '🇵🇾', decimals: 0 },
  { code: 'BOB', name: 'Boliviano Bolivien', symbol: 'Bs', flag: '🇧🇴', decimals: 2 },
  { code: 'GYD', name: 'Dollar Guyanien', symbol: '$', flag: '🇬🇾', decimals: 2 },
  { code: 'SRD', name: 'Dollar Surinamais', symbol: '$', flag: '🇸🇷', decimals: 2 },

  // Amérique Centrale et Caraïbes
  { code: 'GTQ', name: 'Quetzal Guatémaltèque', symbol: 'Q', flag: '🇬🇹', decimals: 2 },
  { code: 'HNL', name: 'Lempira Hondurien', symbol: 'L', flag: '🇭🇳', decimals: 2 },
  { code: 'NIO', name: 'Córdoba Nicaraguayen', symbol: 'C$', flag: '🇳🇮', decimals: 2 },
  { code: 'CRC', name: 'Colón Costaricain', symbol: '₡', flag: '🇨🇷', decimals: 2 },
  { code: 'PAB', name: 'Balboa Panaméen', symbol: 'B/', flag: '🇵🇦', decimals: 2 },
  { code: 'DOP', name: 'Peso Dominicain', symbol: 'RD$', flag: '🇩🇴', decimals: 2 },
  { code: 'CUP', name: 'Peso Cubain', symbol: '$', flag: '🇨🇺', decimals: 2 },
  { code: 'JMD', name: 'Dollar Jamaïcain', symbol: 'J$', flag: '🇯🇲', decimals: 2 },
  { code: 'HTG', name: 'Gourde Haïtienne', symbol: 'G', flag: '🇭🇹', decimals: 2 },
  { code: 'TTD', name: 'Dollar Trinidadien', symbol: 'TT$', flag: '🇹🇹', decimals: 2 },
  { code: 'BBD', name: 'Dollar Barbadien', symbol: '$', flag: '🇧🇧', decimals: 2 },
  { code: 'BSD', name: 'Dollar Bahaméen', symbol: '$', flag: '🇧🇸', decimals: 2 },
  { code: 'BZD', name: 'Dollar Bélizien', symbol: 'BZ$', flag: '🇧🇿', decimals: 2 },
  { code: 'XCD', name: 'Dollar Caraïbes Est', symbol: 'EC$', flag: '🌴', decimals: 2 },

  // Asie
  { code: 'CNY', name: 'Yuan Chinois', symbol: '¥', flag: '🇨🇳', decimals: 2 },
  { code: 'JPY', name: 'Yen Japonais', symbol: '¥', flag: '🇯🇵', decimals: 0 },
  { code: 'KRW', name: 'Won Sud-Coréen', symbol: '₩', flag: '🇰🇷', decimals: 0 },
  { code: 'INR', name: 'Roupie Indienne', symbol: '₹', flag: '🇮🇳', decimals: 2 },
  { code: 'IDR', name: 'Roupie Indonésienne', symbol: 'Rp', flag: '🇮🇩', decimals: 2 },
  { code: 'MYR', name: 'Ringgit Malaisien', symbol: 'RM', flag: '🇲🇾', decimals: 2 },
  { code: 'SGD', name: 'Dollar Singapourien', symbol: 'S$', flag: '🇸🇬', decimals: 2 },
  { code: 'THB', name: 'Baht Thaïlandais', symbol: '฿', flag: '🇹🇭', decimals: 2 },
  { code: 'VND', name: 'Dong Vietnamien', symbol: '₫', flag: '🇻🇳', decimals: 0 },
  { code: 'PHP', name: 'Peso Philippin', symbol: '₱', flag: '🇵🇭', decimals: 2 },
  { code: 'HKD', name: 'Dollar Hong-Kongais', symbol: 'HK$', flag: '🇭🇰', decimals: 2 },
  { code: 'TWD', name: 'Dollar Taïwanais', symbol: 'NT$', flag: '🇹🇼', decimals: 2 },
  { code: 'PKR', name: 'Roupie Pakistanaise', symbol: '₨', flag: '🇵🇰', decimals: 2 },
  { code: 'BDT', name: 'Taka Bangladais', symbol: '৳', flag: '🇧🇩', decimals: 2 },
  { code: 'LKR', name: 'Roupie Sri-Lankaise', symbol: 'Rs', flag: '🇱🇰', decimals: 2 },
  { code: 'NPR', name: 'Roupie Népalaise', symbol: '₨', flag: '🇳🇵', decimals: 2 },
  { code: 'MMK', name: 'Kyat Birman', symbol: 'K', flag: '🇲🇲', decimals: 2 },
  { code: 'KHR', name: 'Riel Cambodgien', symbol: '៛', flag: '🇰🇭', decimals: 2 },
  { code: 'LAK', name: 'Kip Laotien', symbol: '₭', flag: '🇱🇦', decimals: 2 },
  { code: 'BND', name: 'Dollar Brunéien', symbol: '$', flag: '🇧🇳', decimals: 2 },
  { code: 'MNT', name: 'Tugrik Mongol', symbol: '₮', flag: '🇲🇳', decimals: 2 },
  { code: 'KZT', name: 'Tenge Kazakh', symbol: '₸', flag: '🇰🇿', decimals: 2 },
  { code: 'UZS', name: 'Sum Ouzbek', symbol: 'soʻm', flag: '🇺🇿', decimals: 2 },
  { code: 'TJS', name: 'Somoni Tadjik', symbol: 'SM', flag: '🇹🇯', decimals: 2 },
  { code: 'KGS', name: 'Som Kirghiz', symbol: 'с', flag: '🇰🇬', decimals: 2 },
  { code: 'TMT', name: 'Manat Turkmène', symbol: 'm', flag: '🇹🇲', decimals: 2 },
  { code: 'AFN', name: 'Afghani Afghan', symbol: '؋', flag: '🇦🇫', decimals: 2 },
  { code: 'MVR', name: 'Rufiyaa Maldivien', symbol: 'Rf', flag: '🇲🇻', decimals: 2 },
  { code: 'BTN', name: 'Ngultrum Bhoutanais', symbol: 'Nu.', flag: '🇧🇹', decimals: 2 },

  // Moyen-Orient
  { code: 'AED', name: 'Dirham Émirati', symbol: 'د.إ', flag: '🇦🇪', decimals: 2 },
  { code: 'SAR', name: 'Riyal Saoudien', symbol: '﷼', flag: '🇸🇦', decimals: 2 },
  { code: 'QAR', name: 'Riyal Qatari', symbol: '﷼', flag: '🇶🇦', decimals: 2 },
  { code: 'KWD', name: 'Dinar Koweïtien', symbol: 'د.ك', flag: '🇰🇼', decimals: 3 },
  { code: 'BHD', name: 'Dinar Bahreïni', symbol: '.د.ب', flag: '🇧🇭', decimals: 3 },
  { code: 'OMR', name: 'Rial Omanais', symbol: '﷼', flag: '🇴🇲', decimals: 3 },
  { code: 'JOD', name: 'Dinar Jordanien', symbol: 'د.ا', flag: '🇯🇴', decimals: 3 },
  { code: 'LBP', name: 'Livre Libanaise', symbol: 'ل.ل', flag: '🇱🇧', decimals: 2 },
  { code: 'SYP', name: 'Livre Syrienne', symbol: '£', flag: '🇸🇾', decimals: 2 },
  { code: 'IQD', name: 'Dinar Irakien', symbol: 'ع.د', flag: '🇮🇶', decimals: 3 },
  { code: 'IRR', name: 'Rial Iranien', symbol: '﷼', flag: '🇮🇷', decimals: 2 },
  { code: 'YER', name: 'Rial Yéménite', symbol: '﷼', flag: '🇾🇪', decimals: 2 },
  { code: 'ILS', name: 'Shekel Israélien', symbol: '₪', flag: '🇮🇱', decimals: 2 },

  // Océanie
  { code: 'AUD', name: 'Dollar Australien', symbol: 'A$', flag: '🇦🇺', decimals: 2 },
  { code: 'NZD', name: 'Dollar Néo-Zélandais', symbol: 'NZ$', flag: '🇳🇿', decimals: 2 },
  { code: 'FJD', name: 'Dollar Fidjien', symbol: 'FJ$', flag: '🇫🇯', decimals: 2 },
  { code: 'PGK', name: 'Kina Papou', symbol: 'K', flag: '🇵🇬', decimals: 2 },
  { code: 'SBD', name: 'Dollar Salomonais', symbol: '$', flag: '🇸🇧', decimals: 2 },
  { code: 'VUV', name: 'Vatu Vanuatais', symbol: 'VT', flag: '🇻🇺', decimals: 0 },
  { code: 'WST', name: 'Tala Samoan', symbol: 'WS$', flag: '🇼🇸', decimals: 2 },
  { code: 'TOP', name: 'Pa\'anga Tongien', symbol: 'T$', flag: '🇹🇴', decimals: 2 },
  { code: 'XPF', name: 'Franc CFP', symbol: '₣', flag: '🇵🇫', decimals: 0 },

  // Métaux précieux & Crypto (référence)
  { code: 'XAU', name: 'Or (once)', symbol: 'XAU', flag: '🥇', decimals: 4 },
  { code: 'XAG', name: 'Argent (once)', symbol: 'XAG', flag: '🥈', decimals: 4 },
];

// Devises les plus populaires (pour affichage prioritaire)
export const POPULAR_CURRENCIES = [
  'GNF', 'XOF', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AED', 'SAR', 'NGN', 'MAD', 'CNY', 'JPY', 'INR'
];

// Obtenir une devise par son code
export function getCurrencyByCode(code: string): Currency | undefined {
  return WORLD_CURRENCIES.find(c => c.code === code.toUpperCase());
}

// Obtenir le symbole d'une devise
export function getCurrencySymbol(code: string): string {
  return getCurrencyByCode(code)?.symbol || code;
}

// Formater un montant avec la devise
export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = getCurrencyByCode(currencyCode);
  if (!currency) {
    return `${amount.toLocaleString()} ${currencyCode}`;
  }

  const formatted = amount.toLocaleString('fr-FR', {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  });

  // Placement du symbole selon la devise
  if (['USD', 'CAD', 'AUD', 'NZD', 'HKD', 'SGD', 'MXN'].includes(currency.code)) {
    return `${currency.symbol}${formatted}`;
  }
  return `${formatted} ${currency.symbol}`;
}

// Obtenir les devises triées (populaires en premier)
export function getSortedCurrencies(): Currency[] {
  const popular = POPULAR_CURRENCIES
    .map(code => getCurrencyByCode(code))
    .filter((c): c is Currency => c !== undefined);

  const others = WORLD_CURRENCIES
    .filter(c => !POPULAR_CURRENCIES.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return [...popular, ...others];
}

export default WORLD_CURRENCIES;

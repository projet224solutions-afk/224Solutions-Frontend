import { getCurrencyByCode } from '@/data/currencies';

/**
 * Liste des devises sans décimales
 */
const NO_DECIMAL_CURRENCIES = [
  'GNF', 'JPY', 'KRW', 'VND', 'XOF', 'XAF', 'UGX', 'RWF', 'BIF',
  'DJF', 'KMF', 'PYG', 'CLP', 'ISK', 'VUV', 'SLL'
];

/**
 * Format a number as currency with the correct symbol and formatting
 * Compatible avec tous les navigateurs et devises africaines
 */
export function formatCurrency(amount: number, currencyCode: string = 'GNF'): string {
  const code = currencyCode?.toUpperCase() || 'GNF';
  const currency = getCurrencyByCode(code);

  // Déterminer les décimales selon la devise
  const decimals = NO_DECIMAL_CURRENCIES.includes(code) || (currency?.decimals === 0) ? 0 : 2;

  // Arrondir le montant
  const roundedAmount = decimals === 0 ? Math.round(amount) : Math.round(amount * 100) / 100;

  // Formatage manuel pour garantir la compatibilité (évite les bugs Intl sur mobile)
  // S'assurer que le montant est un nombre valide
  const safeAmount = typeof roundedAmount === 'number' && isFinite(roundedAmount) ? roundedAmount : 0;

  // Choisir la locale adaptée à la devise pour un formatage correct (séparateurs)
  const locale = ['USD', 'GBP', 'CAD', 'AUD', 'HKD', 'SGD', 'NZD'].includes(code) ? 'en-US' : 'fr-FR';

  let formattedAmount: string;
  try {
    formattedAmount = safeAmount.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } catch {
    // Fallback si toLocaleString échoue
    formattedAmount = decimals === 0
      ? safeAmount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
      : safeAmount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Supprimer tout zéro initial parasite (ex: "050 000" -> "50 000")
  formattedAmount = formattedAmount.replace(/^0+(?=\d)/, '');

  // Utiliser le symbole de la devise ou le code
  const symbol = currency?.symbol || code;

  // Position du symbole selon la devise
  const symbolBefore = ['USD', 'GBP', 'CAD', 'AUD', 'HKD', 'SGD', 'NZD', 'MXN'].includes(code);

  if (symbolBefore) {
    return `${symbol}${formattedAmount}`;
  }

  return `${formattedAmount} ${symbol}`;
}

/**
 * Format a number as a compact currency (e.g., 1.5M, 2.3K)
 */
export function formatCompactCurrency(amount: number, currencyCode: string = 'GNF'): string {
  const currency = getCurrencyByCode(currencyCode);
  const symbol = currency?.symbol || currencyCode;

  if (amount >= 1_000_000_000) {
    return `${symbol}${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  }

  return formatCurrency(amount, currencyCode);
}

/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Format based on length
  if (digits.length === 9) {
    // Guinea format: XXX XX XX XX
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }

  // Default: just add spaces every 3 digits
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ');
}

/**
 * Format a date for display
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/**
 * Format a date and time for display
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "il y a 5 minutes")
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHour < 24) return `Il y a ${diffHour}h`;
  if (diffDay < 7) return `Il y a ${diffDay}j`;

  return formatDate(d);
}

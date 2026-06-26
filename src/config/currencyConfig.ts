/**
 * SOURCE UNIQUE DE VÉRITÉ — Configuration des devises (frontend)
 * Doit rester STRICTEMENT identique au backend src/config/currencyConfig.ts
 * Ne jamais redéfinir une liste ZERO_DECIMAL ailleurs (Money, usePriceConverter, etc.).
 */

export const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  // ── Devises africaines 224Solutions ──
  'GNF', 'XOF', 'XAF', 'BIF', 'DJF', 'KMF', 'MGA', 'RWF', 'UGX',
  // ── Zero-decimal Stripe internationales ──
  'CLP', 'JPY', 'KRW', 'PYG', 'VND', 'VUV', 'XPF',
]);

export function getCurrencyDecimals(currency: string): number {
  const cur = (currency || 'GNF').toUpperCase();
  return ZERO_DECIMAL_CURRENCIES.has(cur) ? 0 : 2;
}

export function smartRound(amount: number, currency: string): number {
  const decimals = getCurrencyDecimals(currency);
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}

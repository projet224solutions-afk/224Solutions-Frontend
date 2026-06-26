/**
 * 💱 BRIQUE DE CONVERSION DEVISE CENTRALE
 *
 * Affiche TOUT montant dans la devise de l'utilisateur connecté (vendeur, client, service, taxi,
 * livreur). La devise cible = celle synchronisée par CurrencyContext/CurrencySync (= devise du
 * wallet/profil, gérée par le PDG). La conversion utilise UNIQUEMENT le taux officiel du jour
 * via `usePriceConverter` → table `currency_exchange_rates` (alimentée par le scraper BCRG).
 *
 * → Dès que le PDG change la devise d'un utilisateur, tous les `<Money>` de SON interface suivent.
 *
 * Usage :
 *   <Money amount={25000} />                     // montant stocké en GNF (défaut) → devise user
 *   <Money amount={product.price} from={product.currency} />
 *   const { format } = useMoneyFormat(); format(25000)        // version string (toasts, etc.)
 */
import { usePriceConverter, useConvertedPrice } from '@/hooks/usePriceConverter';
import { getCurrencyDecimals } from '@/config/currencyConfig';

function rawFormat(amount: number, currency: string): string {
  const cur = (currency || 'GNF').toUpperCase();
  const digits = getCurrencyDecimals(cur);
  return `${Number(amount || 0).toLocaleString('fr-FR', { maximumFractionDigits: digits })} ${cur}`;
}

/** Hook pour formater un montant en string (toasts, libellés, valeurs calculées). */
export function useMoneyFormat() {
  const { convert, userCurrency, loading } = usePriceConverter();
  return {
    /** Convertit `amount` (devise `from`, défaut GNF) vers la devise de l'utilisateur, formaté. */
    format: (amount: number, from: string = 'GNF') => convert(amount, from).formatted,
    /** Devise d'affichage actuelle de l'utilisateur. */
    userCurrency,
    loading,
  };
}

interface MoneyProps {
  amount?: number | null;
  /** Devise dans laquelle le montant est STOCKÉ (défaut GNF). */
  from?: string;
  className?: string;
  /** Affiché si amount est null/undefined. */
  fallback?: string;
}

/** Composant d'affichage d'un montant, converti dans la devise de l'utilisateur (taux BCRG). */
export function Money({ amount, from = 'GNF', className, fallback = '—' }: MoneyProps) {
  const value = typeof amount === 'number' ? amount : 0;
  const converted = useConvertedPrice(value, from);

  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return <span className={className}>{fallback}</span>;
  }
  // Pendant le chargement des taux, afficher le montant dans sa devise d'origine (transitoire).
  return <span className={className}>{converted ? converted.formatted : rawFormat(value, from)}</span>;
}

export default Money;

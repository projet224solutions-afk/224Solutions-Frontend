/**
 * 🌍 CountryPriceTag — affiche un prix d'abonnement dans la devise du pays VERROUILLÉ
 * du client, avec le drapeau réel (CountryFlag, car les emojis-drapeaux ne s'affichent
 * pas sur Windows). Ex. : 🇬🇳 Plan Pro — 25 000 GNF/mois.
 *
 * NE PAS envelopper dans <Money> : ces prix sont déjà localisés (pas de conversion FX).
 */

import { CountryFlag } from '@/components/CountryFlag';
import { CountryPrice, formatCountryPrice } from '@/hooks/useCountryPricing';
import { cn } from '@/lib/utils';

interface CountryPriceTagProps {
  price: CountryPrice | null | undefined;
  planDisplay?: string;
  className?: string;
  /** Afficher « /mois » ou « /an ». Défaut true. */
  showCycle?: boolean;
}

export function CountryPriceTag({ price, planDisplay, className, showCycle = true }: CountryPriceTagProps) {
  if (!price) return null;
  const cycle = price.billing_cycle === 'yearly' ? 'an' : 'mois';
  const name = planDisplay || `Plan ${price.plan_code}`;

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', className)}>
      <CountryFlag country={price.country_code} size={14} />
      <span>{name} —</span>
      <span className="font-semibold">{formatCountryPrice(price.price, price.currency_code)}</span>
      {showCycle && <span className="text-muted-foreground">/{cycle}</span>}
    </span>
  );
}

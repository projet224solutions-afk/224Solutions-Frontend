/**
 * 🌍 useCountryPricing — prix d'abonnement dans la devise du PAYS VERROUILLÉ du client.
 *
 * Le client ne voit QUE la grille de son pays (le backend filtre par profiles.country_code).
 * Les prix sont déjà localisés (devise du pays) → on N'APPLIQUE PAS la conversion <Money>.
 */

import { useCallback, useEffect, useState } from 'react';
import { backendFetch } from '@/services/backendApi';

export interface CountryPrice {
  country_code: string;
  service_type: string;
  plan_code: string;
  price: number;
  currency_code: string;
  currency_symbol: string;
  flag_emoji: string | null;
  commission_rate: number;
  billing_cycle: string;
  label?: string;
}

export interface UserCountry {
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  flag_emoji: string | null;
  payment_methods: string[];
}

/** Formate un montant dans la devise du pays (ex. « 25 000 GNF », « 9,99 EUR »). */
export function formatCountryPrice(price: number, currency: string): string {
  const amount = price % 1 === 0
    ? price.toLocaleString('fr-FR')
    : price.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  return `${amount} ${currency}`;
}

export function useCountryPricing(serviceType: string = 'vendor') {
  const [country, setCountry] = useState<UserCountry | null>(null);
  const [prices, setPrices] = useState<CountryPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cRes, pRes] = await Promise.all([
        backendFetch<any>('/api/v2/country-pricing/my-country'),
        backendFetch<any>(`/api/v2/country-pricing/prices?service_type=${encodeURIComponent(serviceType)}`),
      ]);
      if ((cRes as any)?.country) setCountry((cRes as any).country as UserCountry);
      if ((pRes as any)?.prices) setPrices((pRes as any).prices as CountryPrice[]);
      if (cRes.success === false) setError(cRes.error || 'Erreur pays');
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [serviceType]);

  useEffect(() => { void load(); }, [load]);

  const getPlanPrice = useCallback(
    (planCode: string, cycle: string = 'monthly') =>
      prices.find((p) => p.plan_code === planCode && p.billing_cycle === cycle) || null,
    [prices],
  );

  return { country, prices, getPlanPrice, loading, error, reload: load };
}

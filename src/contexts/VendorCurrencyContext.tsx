/**
 * Contexte unique pour la devise du vendeur.
 *
 * Pourquoi un contexte ?
 * - useWallet() fait 3 appels API (balance + pin + transactions) à chaque appel.
 *   Sans contexte, N composants = N×3 appels. Avec ce contexte : 3 appels pour tout le rendu.
 * - useFxRates fait une requête DB. Idem : une seule requête partagée.
 * - Le timeout empêche isReady=false indéfiniment si les taux ne chargent pas (réseau lent/erreur).
 */

import React, { createContext, useContext, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useFxRates } from '@/hooks/useFxRates';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const PLATFORM_BASE = 'GNF';
/** Après ce délai sans taux disponible, on bascule en GNF plutôt que d'afficher '—' indéfiniment */
const READY_TIMEOUT_MS = 8_000;

export interface VendorCurrencyContextValue {
  /** Devise cible du wallet du vendeur (ex: 'XAF', 'GNF') */
  currency: string;
  /** Convertit un montant depuis GNF vers la devise cible */
  convert: (amount: number) => number;
  /** Taux GNF → devise cible, null si indisponible */
  rate: number | null;
  /** true quand auth + wallet + taux sont prêts (ou après timeout) */
  isReady: boolean;
  /** true si les taux n'ont pas pu être chargés après le timeout */
  hasRateError: boolean;
  /** true pendant le chargement des taux */
  ratesLoading: boolean;
  /** Date de dernière mise à jour des taux en base */
  lastUpdated: Date | null;
}

const VendorCurrencyContext = createContext<VendorCurrencyContextValue>({
  currency: PLATFORM_BASE,
  convert: (a) => a,
  rate: 1,
  isReady: true,
  hasRateError: false,
  ratesLoading: false,
  lastUpdated: null,
});

export function VendorCurrencyProvider({ children }: { children: React.ReactNode }) {
  // authLoading guard : useWallet retourne loading=false immédiatement quand user?.id
  // est undefined (auth pas encore résolue), ce qui ferait isReady=true avec la devise
  // GNF par défaut, puis la vraie devise arriverait → clignotement.
  const { user, loading: authLoading } = useAuth();
  const { currency: walletCurrency, loading: walletLoading } = useWallet();

  // Devise du PAYS VERROUILLÉ (profiles.country_code → countries.currency_code) : sert de devise
  // par défaut quand le wallet est en GNF, pour qu'un vendeur sénégalais voie XOF et non GNF.
  const [countryCurrency, setCountryCurrency] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { if (!cancelled) setCountryCurrency(null); return; }
      try {
        const { data: prof } = await supabase.from('profiles').select('country_code').eq('id', user.id).maybeSingle();
        const cc = prof?.country_code ? String(prof.country_code) : null;
        if (!cc) { if (!cancelled) setCountryCurrency(null); return; }
        const { data: ctry } = await supabase.from('countries').select('currency_code').eq('country_code', cc).maybeSingle();
        if (!cancelled) setCountryCurrency(ctry?.currency_code ? String(ctry.currency_code).toUpperCase() : null);
      } catch { if (!cancelled) setCountryCurrency(null); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Wallet ≠ GNF prime (devise réellement détenue) ; sinon devise du pays ; sinon GNF.
  const targetCurrency = (walletCurrency && walletCurrency.toUpperCase() !== PLATFORM_BASE)
    ? walletCurrency
    : (countryCurrency || PLATFORM_BASE);
  const needsConversion = targetCurrency.toUpperCase() !== PLATFORM_BASE;

  const { rates, loading: ratesLoading, lastUpdated } = useFxRates({
    base: PLATFORM_BASE,
    symbols: needsConversion ? [targetCurrency] : [],
  });

  const rate = useMemo(
    () => (needsConversion ? (rates[targetCurrency.toUpperCase()] ?? null) : 1),
    [needsConversion, rates, targetCurrency]
  );

  // Timeout : si les taux n'arrivent pas dans READY_TIMEOUT_MS, on débloque l'UI
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTimedOut(false);
    if (timerRef.current) clearTimeout(timerRef.current);

    // Ne démarrer le timeout qu'après que l'auth ET le wallet soient chargés
    if (!authLoading && !walletLoading && needsConversion && !rate) {
      timerRef.current = setTimeout(() => {
        console.warn(
          `[VendorCurrency] Taux GNF→${targetCurrency} non disponible après ${READY_TIMEOUT_MS}ms.`,
          'Affichage en GNF par défaut.'
        );
        setTimedOut(true);
      }, READY_TIMEOUT_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [authLoading, walletLoading, needsConversion, rate, targetCurrency]);

  // isReady = auth chargée ET wallet chargé ET (pas de conversion OU taux dispo OU timeout)
  // L'ajout de !authLoading empêche le faux isReady=true quand useWallet retourne
  // loading=false prématurément (user pas encore authentifié).
  const isReady = !authLoading && !walletLoading && (!needsConversion || !!rate || timedOut);
  // hasRateError = timeout atteint sans taux (conversion impossible, affichage GNF)
  const hasRateError = timedOut && !rate && needsConversion;

  const convert = useCallback(
    (amount: number): number => {
      if (!needsConversion || !rate) return amount;
      return amount * rate;
    },
    [needsConversion, rate]
  );

  const value = useMemo<VendorCurrencyContextValue>(
    () => ({
      // Si timeout sans taux → afficher en GNF plutôt qu'en devise inconnue
      currency: hasRateError ? PLATFORM_BASE : targetCurrency,
      convert,
      rate,
      isReady,
      hasRateError,
      ratesLoading: needsConversion ? ratesLoading : false,
      lastUpdated,
    }),
    [targetCurrency, convert, rate, isReady, hasRateError, needsConversion, ratesLoading, lastUpdated]
  );

  return (
    <VendorCurrencyContext.Provider value={value}>
      {children}
    </VendorCurrencyContext.Provider>
  );
}

export function useVendorCurrencyContext(): VendorCurrencyContextValue {
  return useContext(VendorCurrencyContext);
}

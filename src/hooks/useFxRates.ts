/**
 * HOOK DE TAUX DE CHANGE – VERSION INTERNE
 * Lit les taux depuis currency_exchange_rates (alimentée par le cron horaire).
 * Plus aucun appel à l'edge function fx-rates ni à une API externe.
 *
 * Robustesse :
 * - Retry automatique (3 tentatives, backoff 1s/2s) si les taux sont vides
 * - Logs d'erreur explicites pour le debug en production
 * - Clés retournées toujours en MAJUSCULES
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRatesForBase, invalidateRatesCache, getLastUpdated } from "@/services/exchangeService";

type RatesBySymbol = Record<string, number>;

interface UseFxRatesParams {
  base: string;
  symbols: string[];
  /** Ignoré – les taux sont rafraîchis automatiquement par le backend toutes les heures */
  refreshMinutes?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

export function useFxRates({ base, symbols }: UseFxRatesParams) {
  const [rates, setRates] = useState<RatesBySymbol>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const symbolsKey = useMemo(
    () => symbols.map((s) => s.toUpperCase()).sort().join(","),
    [symbols]
  );

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const load = useCallback(async (attempt = 0) => {
    if (symbols.length === 0) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const result = await getRatesForBase(base, symbols);

      if (Object.keys(result).length === 0 && attempt < MAX_RETRIES) {
        // Taux vides — retry avec backoff
        const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        console.warn(
          `[useFxRates] Taux vides pour ${base}→${symbols.join(',')} (tentative ${attempt + 1}/${MAX_RETRIES}). Retry dans ${delay}ms.`
        );
        retryTimerRef.current = setTimeout(() => load(attempt + 1), delay);
        return;
      }

      if (Object.keys(result).length === 0) {
        const msg = `Aucun taux disponible pour ${base}→${symbols.join(',')} après ${MAX_RETRIES} tentatives.`;
        console.error(`[useFxRates] ${msg}`);
        setError(msg);
      } else {
        setError(null);
        retryCountRef.current = 0;
      }

      setRates(result);

      const ts = await getLastUpdated();
      setLastUpdated(ts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        console.warn(`[useFxRates] Erreur chargement taux (tentative ${attempt + 1}): ${msg}. Retry dans ${delay}ms.`);
        retryTimerRef.current = setTimeout(() => load(attempt + 1), delay);
        return;
      }
      console.error(`[useFxRates] Échec définitif après ${MAX_RETRIES} tentatives:`, err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, symbolsKey]);

  const refresh = useCallback(async () => {
    clearRetryTimer();
    invalidateRatesCache();
    await load(0);
  }, [load]);

  // Chargement initial ou quand base/symbols changent
  useEffect(() => {
    clearRetryTimer();
    retryCountRef.current = 0;
    load(0);
    return clearRetryTimer;
  }, [load]);

  return { rates, lastUpdated, loading, error, refresh };
}

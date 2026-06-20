/**
 * SERVICE INTERNE DE TAUX DE CHANGE
 * Lit les taux depuis la table currency_exchange_rates (alimentée par le cron horaire)
 * Remplace toute dépendance aux API externes (fx-rates edge function, open.er-api.com)
 *
 * Source prioritaire pour GNF : BCRG (bcrg-guinee.org) — fixings quotidiens officiels.
 * Les taux incluent déjà la marge configurée dans margin_config (valeur DB actuelle : 2%).
 * Le backend (african-fx-collect) actualise les taux toutes les heures via pg_cron.
 * En cas d'inaccessibilité du site BCRG, le dernier taux officiel est conservé (heartbeat).
 */

import { supabase } from '@/integrations/supabase/client';

/** Cache mémoire côté client – TTL 5 min (les taux changent au max toutes les heures, BCRG = fixing quotidien) */
const CACHE_TTL_MS = 5 * 60_000;
const OFFICIAL_BANK_HINTS = /bcrg|bceao|beac|cbn|banque|bank|afric/i;

interface CachedRates {
  rates: Map<string, number>;
  fetchedAt: number;
}

interface RateRow {
  from_currency?: string | null;
  to_currency?: string | null;
  rate?: number | null;
  final_rate_usd?: number | null;
  final_rate_eur?: number | null;
  margin?: number | null;
  source_type?: string | null;
  source_url?: string | null;
  retrieved_at?: string | null;
}

let ratesCache: CachedRates | null = null;

/** Promesse en cours pour dédupliquer les requêtes concurrentes (thundering herd) */
let inflightPromise: Promise<Map<string, number>> | null = null;

function parseTimestampMs(value?: string | null): number {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSameUtcDay(value?: string | null): boolean {
  const timestamp = parseTimestampMs(value);
  if (!timestamp) return false;

  const candidate = new Date(timestamp);
  const now = new Date();
  return candidate.getUTCFullYear() === now.getUTCFullYear()
    && candidate.getUTCMonth() === now.getUTCMonth()
    && candidate.getUTCDate() === now.getUTCDate();
}

function isOfficialBankRow(row: RateRow): boolean {
  const url = String(row.source_url || '').toLowerCase();
  const sourceType = String(row.source_type || '').toLowerCase();
  return url.includes('bcrg-guinee.org') || OFFICIAL_BANK_HINTS.test(`${url} ${sourceType}`);
}

function getRateRowPriority(row: RateRow): number {
  const from = String(row.from_currency || '').toUpperCase();
  const to = String(row.to_currency || '').toUpperCase();
  const involvesGNF = from === 'GNF' || to === 'GNF';
  const official = isOfficialBankRow(row);
  const sameDay = isSameUtcDay(row.retrieved_at);

  if (involvesGNF && official && sameDay) return 4;
  if (involvesGNF && official) return 3;
  if (sameDay) return 2;
  if (official) return 1;
  return 0;
}

function shouldPreferRateRow(candidate: RateRow, current: RateRow): boolean {
  const candidatePriority = getRateRowPriority(candidate);
  const currentPriority = getRateRowPriority(current);

  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority;
  }

  return parseTimestampMs(candidate.retrieved_at) > parseTimestampMs(current.retrieved_at);
}

function resolveDisplayedRate(row: RateRow): number {
  // TAUX EXACT BCRG : on AFFICHE le taux OFFICIEL du jour (colonne `rate`), SANS marge.
  // Avant : on retournait final_rate_usd/eur (= rate margé ~20%) → prix produits sous-évalués
  // (ex. 45 000 GNF affiché 3,69 € au lieu du taux exact 4,43 €). Le PDG veut le taux BCRG exact
  // sur toutes les pages produit. (La marge/commission éventuelle s'applique à l'ACHAT, pas à
  // l'affichage du taux du jour.)
  const rawRate = Number(row.rate || 0);
  if (Number.isFinite(rawRate) && rawRate > 0) {
    return rawRate;
  }

  // Repli UNIQUEMENT si `rate` absent : final_rate (mieux que rien).
  const from = String(row.from_currency || '').toUpperCase();
  const to = String(row.to_currency || '').toUpperCase();
  const finalByBase = (from === 'USD' || to === 'USD')
    ? Number(row.final_rate_usd)
    : (from === 'EUR' || to === 'EUR')
      ? Number(row.final_rate_eur)
      : Number.NaN;
  if (Number.isFinite(finalByBase) && finalByBase > 0) {
    return finalByBase;
  }

  return Number.NaN;
}

/**
 * Charge tous les taux actifs depuis la DB en une seule requête.
 * Résultat mis en cache 5 min côté client.
 * Déduplique les appels concurrents pour éviter les requêtes N+1.
 */
async function loadAllRates(): Promise<Map<string, number>> {
  if (ratesCache && Date.now() - ratesCache.fetchedAt < CACHE_TTL_MS) {
    return ratesCache.rates;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('currency_exchange_rates')
        .select('from_currency, to_currency, rate, final_rate_usd, final_rate_eur, margin, source_type, source_url, retrieved_at')
        .eq('is_active', true)
        .order('retrieved_at', { ascending: false });

      if (error) {
        console.error('[exchangeService] Erreur lecture currency_exchange_rates:', error);
      }

      const selectedRates = new Map<string, RateRow>();
      const map = new Map<string, number>();

      if (!error && Array.isArray(data)) {
        if (data.length === 0) {
          console.warn('[exchangeService] Aucun taux actif en base (currency_exchange_rates vide ou tous is_active=false).');
        }

        for (const row of data as RateRow[]) {
          const from = String(row.from_currency || '').toUpperCase();
          const to = String(row.to_currency || '').toUpperCase();
          const rate = resolveDisplayedRate(row);

          if (!from || !to || !Number.isFinite(rate) || rate <= 0) {
            continue;
          }

          const key = `${from}→${to}`;
          const current = selectedRates.get(key);

          if (!current || shouldPreferRateRow(row, current)) {
            selectedRates.set(key, row);
          }
        }

        for (const [key, row] of selectedRates.entries()) {
          map.set(key, resolveDisplayedRate(row));
        }
      }

      ratesCache = { rates: map, fetchedAt: Date.now() };
      return map;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

/**
 * Obtient le taux final (avec marge) pour une paire de devises.
 * Essaie d'abord la paire directe, puis le pivot via USD, puis EUR.
 *
 * @returns taux final ou null si indisponible
 */
export async function getFinalRate(from: string, to: string): Promise<number | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;

  const rates = await loadAllRates();

  const direct = rates.get(`${f}→${t}`);
  if (direct) return direct;

  const inverse = rates.get(`${t}→${f}`);
  if (inverse && inverse > 0) return 1 / inverse;

  const fromToUsd = rates.get(`${f}→USD`) ?? (rates.get(`USD→${f}`) ? 1 / rates.get(`USD→${f}`)! : null);
  const usdToTo = rates.get(`USD→${t}`) ?? (rates.get(`${t}→USD`) ? 1 / rates.get(`${t}→USD`)! : null);
  if (fromToUsd && usdToTo) return fromToUsd * usdToTo;

  const fromToEur = rates.get(`${f}→EUR`) ?? (rates.get(`EUR→${f}`) ? 1 / rates.get(`EUR→${f}`)! : null);
  const eurToTo = rates.get(`EUR→${t}`) ?? (rates.get(`${t}→EUR`) ? 1 / rates.get(`${t}→EUR`)! : null);
  if (fromToEur && eurToTo) return fromToEur * eurToTo;

  return null;
}

/**
 * Charge les taux pour une devise de base vers plusieurs cibles.
 * Renvoie un Record<symbol, rate>.
 */
export async function getRatesForBase(base: string, symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const entries = await Promise.all(
    symbols.map(async (sym) => {
      const rate = await getFinalRate(base, sym);
      return [sym.toUpperCase(), rate] as const;
    })
  );
  for (const [sym, rate] of entries) {
    if (rate !== null) result[sym] = rate;
  }
  return result;
}

/**
 * Convertit un montant d'une devise à une autre en utilisant le taux final interne.
 */
export async function convertAmount(amount: number, from: string, to: string): Promise<{ converted: number; rate: number } | null> {
  const rate = await getFinalRate(from, to);
  if (rate === null) return null;
  return { converted: amount * rate, rate };
}

/**
 * Force le rechargement du cache (par ex. après un changement de devise utilisateur).
 */
export function invalidateRatesCache() {
  ratesCache = null;
  lastUpdatedCache = null;
}

/**
 * Retourne la date de dernière mise à jour des taux.
 * Dédupliquée et cachée pour éviter les requêtes multiples.
 */
let lastUpdatedCache: { value: Date | null; fetchedAt: number } | null = null;
let lastUpdatedInflight: Promise<Date | null> | null = null;

export async function getLastUpdated(): Promise<Date | null> {
  if (lastUpdatedCache && Date.now() - lastUpdatedCache.fetchedAt < CACHE_TTL_MS) {
    return lastUpdatedCache.value;
  }
  if (lastUpdatedInflight) return lastUpdatedInflight;

  lastUpdatedInflight = (async () => {
    try {
      const { data } = await (supabase as any)
        .from('currency_exchange_rates')
        .select('from_currency, to_currency, source_type, source_url, retrieved_at')
        .eq('is_active', true)
        .order('retrieved_at', { ascending: false })
        .limit(200);

      const rows = Array.isArray(data) ? (data as RateRow[]) : [];
      const preferred = rows.reduce<RateRow | null>((best, row) => {
        if (!best) return row;
        return shouldPreferRateRow(row, best) ? row : best;
      }, null);

      const value = preferred?.retrieved_at ? new Date(preferred.retrieved_at) : null;
      lastUpdatedCache = { value, fetchedAt: Date.now() };
      return value;
    } finally {
      lastUpdatedInflight = null;
    }
  })();

  return lastUpdatedInflight;
}

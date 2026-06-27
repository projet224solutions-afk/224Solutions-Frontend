/**
 * CONTEXTE DE DEVISE GLOBAL
 * Gère la devise de l'application avec détection automatique basée sur le pays
 * Synchronisé avec useGeoDetection
 */

import { createContext, useState, useContext, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface CurrencyContextType {
  currency: string;
  setCurrency: (c: string) => void;
  /** Devise OFFICIELLE de l'utilisateur connecté (profiles.detected_currency, gérée par le PDG,
   *  alignée sur la devise du wallet). Prioritaire sur la géo et le choix manuel. */
  setProfileCurrency: (c: string | null) => void;
  userCountry: string | null;
  loading: boolean;
}

const CURRENCY_STORAGE_KEY = 'app_currency';
const CURRENCY_MANUAL_KEY = 'app_currency_manual'; // Flag explicite pour choix manuel
const GEO_CACHE_KEY = 'geo_detection_cache';

function safeGetLocalStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures in embedded/local preview contexts
  }
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "GNF",
  setCurrency: () => { },
  setProfileCurrency: () => { },
  userCountry: null,
  loading: true,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(() => {
    try {
      // Vérifier d'abord le choix manuel
      const hasManualChoice = safeGetLocalStorageItem(CURRENCY_MANUAL_KEY) === 'true';
      const stored = safeGetLocalStorageItem(CURRENCY_STORAGE_KEY);
      if (hasManualChoice && stored) return stored;

      // Sinon, essayer de récupérer depuis le cache géo (ignorer les fallback)
      const geoCache = localStorage.getItem(GEO_CACHE_KEY);
      if (geoCache) {
        const parsed = JSON.parse(geoCache);
        if (parsed?.data?.currency && parsed?.data?.detectionMethod !== 'fallback') {
          return parsed.data.currency;
        }
      }
    } catch { }

    return "GNF"; // Défaut
  });

  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAutoDetected, setHasAutoDetected] = useState(false);
  // Devise officielle de l'utilisateur connecté (profiles.detected_currency, gérée par le PDG).
  // Quand elle est définie, elle PRIME sur la géo et le choix manuel → quand le PDG change la
  // devise, l'interface (prix) suit la même devise que le wallet (cohérence garantie).
  const [profileCurrency, setProfileCurrencyState] = useState<string | null>(null);
  const setProfileCurrency = useCallback((c: string | null) => {
    setProfileCurrencyState(c ? c.toUpperCase() : null);
  }, []);

  // Synchronisation avec géo-détection (utilise UNIQUEMENT le cache de useGeoDetection, pas d'appel direct)
  useEffect(() => {
    // Si on a déjà auto-détecté, ne pas relancer
    if (hasAutoDetected) {
      setLoading(false);
      return;
    }

    // Vérifier si une devise a été choisie manuellement (flag explicite)
    const hasManualChoice = safeGetLocalStorageItem(CURRENCY_MANUAL_KEY) === 'true';
    if (hasManualChoice) {
      console.log('💱 Devise choisie manuellement, pas de sync auto');
      setLoading(false);
      return;
    }

    // Lire depuis le cache de géo-détection (peuplé par useGeoDetection)
    try {
      const geoCacheRaw = safeGetLocalStorageItem(GEO_CACHE_KEY);
      if (geoCacheRaw) {
        const geoCache = JSON.parse(geoCacheRaw);
        // Ignorer les résultats fallback (GN/GNF par défaut — pas fiable)
        if (geoCache?.data?.country && geoCache?.data?.currency && geoCache?.data?.detectionMethod !== 'fallback') {
          const country = geoCache.data.country;
          const detectedCurrency = geoCache.data.currency;

          console.log(`💱 Auto-détection (geo-cache): pays=${country}, devise=${detectedCurrency}`);
          setUserCountry(country);
          setCurrencyState(detectedCurrency);
          setHasAutoDetected(true);
          setLoading(false);
          return;
        }
      }
    } catch { }

    // Pas encore de cache — useGeoDetection le peuplera, on attend via l'intervalle ci-dessous
    setLoading(false);
  }, [hasAutoDetected]);

  // Sync live depuis geo-cache (quand useGeoDetection met à jour le cache dans le même onglet)
  useEffect(() => {
    const syncFromGeoCache = () => {
      // Ne pas écraser si choix manuel explicite
      const hasManualChoice = safeGetLocalStorageItem(CURRENCY_MANUAL_KEY) === 'true';
      if (hasManualChoice) return;

      try {
        const geoCacheRaw = safeGetLocalStorageItem(GEO_CACHE_KEY);
        if (!geoCacheRaw) return;

        const geoCache = JSON.parse(geoCacheRaw);
        const nextCurrency = geoCache?.data?.currency;
        const nextCountry = geoCache?.data?.country;

        if (nextCurrency && nextCurrency !== currency) {
          console.log(`💱 Sync devise depuis geo-cache: ${nextCurrency}`);
          setCurrencyState(nextCurrency);
          setUserCountry(nextCountry || null);
          setHasAutoDetected(true);
        }
      } catch { }
    };

    syncFromGeoCache();
    const interval = setInterval(syncFromGeoCache, 2000);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === GEO_CACHE_KEY) syncFromGeoCache();
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currency]);

  // Fonction pour changer manuellement la devise
  const setCurrency = useCallback((newCurrency: string) => {
    setCurrencyState(newCurrency);
    safeSetLocalStorageItem(CURRENCY_STORAGE_KEY, newCurrency);
    safeSetLocalStorageItem(CURRENCY_MANUAL_KEY, 'true'); // Marquer comme choix manuel
    console.log('💱 Devise changée manuellement:', newCurrency);
  }, []);

  // Devise effective : le profil (PDG) prime, sinon géo/manuel.
  const effectiveCurrency = profileCurrency || currency;

  return (
    <CurrencyContext.Provider value={{
      currency: effectiveCurrency,
      setCurrency,
      setProfileCurrency,
      userCountry,
      loading
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);

/**
 * Synchronise la devise d'affichage avec la devise OFFICIELLE de l'utilisateur connecté
 * (profiles.detected_currency — gérée par le PDG et alignée sur la devise du wallet).
 * ⚠️ À monter À L'INTÉRIEUR de AuthProvider (a besoin de useAuth). Ne rend rien.
 * Corrige : quand le PDG change la devise d'un utilisateur, les PRIX de son interface suivent
 * désormais la même devise que son wallet (avant : les prix restaient en devise géo/IP).
 */
export function CurrencySync() {
  const { user, profile, refreshProfile } = useAuth();
  const { setProfileCurrency } = useCurrency();

  // Résout la devise d'affichage de l'utilisateur. SOURCE DE VÉRITÉ = le WALLET (devise réellement
  // détenue, pilotée par le PDG), comme le système vendeur (useWallet). Ordre de priorité :
  //   1. devise du WALLET si explicite (≠ GNF) — gagne même si detected_currency est périmé en GNF ;
  //   2. sinon profiles.detected_currency si explicite (≠ GNF) ;
  //   3. sinon null → CurrencyContext garde la devise géo/manuelle (clients à wallet GNF par défaut).
  // ⚠️ NE PAS court-circuiter sur detected_currency='GNF' : une valeur GNF périmée bloquait la
  //    conversion alors que le wallet est en XOF/EUR. ⚠️ PAS de .maybeSingle() : plusieurs lignes
  //    wallet (changements de devise répétés) la faisaient planter → repli erroné sur la géo.
  // Devise du PAYS VERROUILLÉ de l'utilisateur (profiles.country_code → countries.currency_code).
  // C'est la devise par défaut du système pour cet utilisateur : déterministe, indépendante de la
  // géolocalisation. Renvoie null si pas de pays / pas de table.
  const resolveCountryCurrency = useCallback(async (): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      const { data: prof } = await supabase.from('profiles').select('country_code').eq('id', user.id).maybeSingle();
      const cc = prof?.country_code ? String(prof.country_code) : null;
      if (!cc) return null;
      const { data: ctry } = await supabase.from('countries').select('currency_code').eq('country_code', cc).maybeSingle();
      return ctry?.currency_code ? String(ctry.currency_code).toUpperCase() : null;
    } catch { return null; }
  }, [user?.id]);

  const applyCurrency = useCallback(async () => {
    const detected = profile?.detected_currency
      ? String(profile.detected_currency).toUpperCase()
      : null;
    // Indice rapide (évite un flash GNF avant la lecture wallet).
    if (detected && detected !== 'GNF') setProfileCurrency(detected);
    if (!user?.id) { setProfileCurrency(detected && detected !== 'GNF' ? detected : null); return; }
    try {
      const { data } = await supabase
        .from('wallets')
        .select('currency, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      const rows = Array.isArray(data) ? data : [];
      // Gérer les lignes wallet multiples : préférer une devise explicite (≠ GNF), sinon la + récente.
      const explicit = rows.find((w) => w.currency && String(w.currency).toUpperCase() !== 'GNF');
      const walletCurrency = explicit?.currency
        ? String(explicit.currency).toUpperCase()
        : (rows[0]?.currency ? String(rows[0].currency).toUpperCase() : null);
      if (walletCurrency && walletCurrency !== 'GNF') { setProfileCurrency(walletCurrency); return; }
      if (detected && detected !== 'GNF') { setProfileCurrency(detected); return; }
      // Wallet GNF + pas de detected → DEVISE DU PAYS VERROUILLÉ (prime sur la géo).
      // Un Sénégalais voit XOF, un Guinéen GNF — même en voyage. On pose même 'GNF' explicitement
      // pour bloquer le repli sur la géolocalisation.
      const countryCurrency = await resolveCountryCurrency();
      setProfileCurrency(countryCurrency || (detected && detected !== 'GNF' ? detected : null));
    } catch {
      setProfileCurrency(detected && detected !== 'GNF' ? detected : null);
    }
  }, [user?.id, profile?.detected_currency, setProfileCurrency, resolveCountryCurrency]);

  useEffect(() => { applyCurrency(); }, [applyCurrency]);

  // TEMPS RÉEL : si le PDG change la devise de l'utilisateur (profiles.detected_currency ou
  // wallets.currency), on ré-applique la devise → l'interface suit IMMÉDIATEMENT, sans re-login.
  // On émet aussi 'wallet-updated' pour que les widgets de solde se rafraîchissent.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`currency-sync-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => {
        refreshProfile().catch(() => {});
        applyCurrency();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, () => {
        applyCurrency();
        try { window.dispatchEvent(new Event('wallet-updated')); } catch { /* SSR/embed */ }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshProfile, applyCurrency]);

  return null;
}

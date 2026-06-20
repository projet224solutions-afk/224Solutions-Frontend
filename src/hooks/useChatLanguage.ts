/**
 * 🌍 LANGUE CONVERSATIONNELLE (chat) — choix DÉDIÉ, indépendant de la langue de l'interface.
 *
 * L'utilisateur choisit la langue dans laquelle il veut RECEVOIR ses messages (traduction auto),
 * et peut la changer à tout moment — sans changer la langue de l'app.
 *
 * Source de vérité (par ordre de priorité au chargement) :
 *   1. choix explicite mémorisé  → localStorage('chat_language')  (instantané, hors-ligne)
 *   2. profil Supabase           → profiles.preferred_chat_language
 *   3. repli                     → preferred_language (profil) → langue de l'interface → 'fr'
 *
 * Synchronisation : un changement émet un event ('chat-language-changed') + écrit localStorage,
 * donc TOUTES les instances ouvertes (et les autres onglets via 'storage') se mettent à jour.
 * Persistance profil = un seul UPDATE de ligne (atomique), best-effort (ne bloque pas l'UI).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/services/translationService';

const LS_KEY = 'chat_language';
const EVENT = 'chat-language-changed';

const isSupported = (l: unknown): l is SupportedLanguage =>
  typeof l === 'string' && l in SUPPORTED_LANGUAGES;

function readLocal(): SupportedLanguage | null {
  try {
    const v = localStorage.getItem(LS_KEY);
    return isSupported(v) ? v : null;
  } catch {
    return null;
  }
}

export function useChatLanguage() {
  const { user } = useAuth();
  const { language: uiLanguage } = useLanguage();

  // Repli immédiat : choix mémorisé → langue UI → 'fr' (le profil affine ensuite).
  const [chatLanguage, setChatLanguageState] = useState<SupportedLanguage>(
    () => readLocal() || (isSupported(uiLanguage) ? uiLanguage : 'fr'),
  );

  // Charger le choix persisté côté profil (si aucun choix local explicite).
  useEffect(() => {
    if (readLocal()) return; // un choix explicite l'emporte
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_chat_language, preferred_language')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled || !data) return;
        const pick = (data as any).preferred_chat_language || (data as any).preferred_language;
        if (isSupported(pick)) setChatLanguageState(pick);
      } catch {
        /* best-effort : on garde le repli */
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Synchroniser entre composants (même onglet) et entre onglets (storage).
  useEffect(() => {
    const onEvent = (e: Event) => {
      const lang = (e as CustomEvent).detail;
      if (isSupported(lang)) setChatLanguageState(lang);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && isSupported(e.newValue)) setChatLanguageState(e.newValue);
    };
    window.addEventListener(EVENT, onEvent as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onEvent as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setChatLanguage = useCallback(async (lang: SupportedLanguage) => {
    if (!isSupported(lang) || lang === chatLanguage) return;
    // 1) Effet immédiat + diffusion (toutes les instances/onglets suivent).
    setChatLanguageState(lang);
    try { localStorage.setItem(LS_KEY, lang); } catch { /* */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: lang }));
    // 2) Persistance profil (best-effort, un seul UPDATE atomique).
    if (user?.id) {
      try {
        await supabase.from('profiles').update({ preferred_chat_language: lang }).eq('id', user.id);
      } catch {
        /* non bloquant : le localStorage garde le choix */
      }
    }
  }, [chatLanguage, user?.id]);

  return {
    chatLanguage,
    setChatLanguage,
    languages: SUPPORTED_LANGUAGES as Record<string, string>,
  };
}

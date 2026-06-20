/**
 * 📡 Configuration de la couche temps réel.
 * Flag de bascule entre Supabase Realtime (défaut) et Ably (Phase 1 scalabilité).
 *
 * Activer Ably : définir VITE_REALTIME_PROVIDER=ably (frontend) + ABLY_API_KEY (backend).
 * Tant que le flag n'est pas `ably`, tout reste sur Supabase Realtime (aucun changement).
 */

export type RealtimeProvider = 'supabase' | 'ably';

export const realtimeProvider: RealtimeProvider =
  String(import.meta.env.VITE_REALTIME_PROVIDER || '').toLowerCase() === 'ably'
    ? 'ably'
    : 'supabase';

export const isAblyEnabled = realtimeProvider === 'ably';

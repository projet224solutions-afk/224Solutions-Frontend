/**
 * Client Ably (singleton, lazy).
 * Le SDK Ably n'est chargé qu'à la première utilisation (import dynamique) → aucun
 * surcoût de bundle quand le transport Supabase est actif.
 *
 * Authentification déléguée : le client récupère un TokenRequest auprès du backend
 * (`/api/v2/realtime/token`) en présentant le JWT Supabase. La clé API reste côté serveur.
 */

import { supabase } from '@/integrations/supabase/client';
import { resolveBackendUrl } from '@/config/backend';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clientPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAblyClient(): Promise<any> {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const mod: any = await import('ably');
    const Ably = mod?.default ?? mod;

    return new Ably.Realtime({
      // Parité avec Supabase (broadcast self:false) : ne pas se ré-écho ses propres messages
      echoMessages: false,
      // Récupère un token signé auprès du backend (JWT Supabase → TokenRequest Ably)
      authCallback: async (
        _tokenParams: unknown,
        callback: (err: unknown, token: unknown) => void,
      ) => {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (!token) {
            callback('Non authentifié', null);
            return;
          }
          const res = await fetch(resolveBackendUrl('/api/v2/realtime/token'), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            callback(`Token temps réel indisponible (HTTP ${res.status})`, null);
            return;
          }
          const tokenRequest = await res.json();
          callback(null, tokenRequest);
        } catch (e) {
          callback(e as Error, null);
        }
      },
    });
  })();

  return clientPromise;
}

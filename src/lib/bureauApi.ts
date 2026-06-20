/**
 * 🏢 Client backend BUREAU — utilise le JWT bureau signé serveur.
 * ---------------------------------------------------------------------------
 * Le bureau n'est pas un utilisateur Supabase Auth : son JWT (émis par le backend
 * après vérification OTP) est stocké dans la session bureau et envoyé en Bearer.
 * Toutes les opérations bureau scopées passent par ici (jamais d'appel RPC anon).
 */

import { backendConfig } from '@/config/backend';

export function getBureauToken(): string | null {
  try {
    const raw = sessionStorage.getItem('bureau_session');
    if (!raw) return null;
    return JSON.parse(raw)?.token ?? null;
  } catch {
    return null;
  }
}

export interface BureauApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

export async function bureauFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<BureauApiResponse<T>> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getBureauToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  try {
    const resp = await fetch(`${backendConfig.baseUrl}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const json = await resp.json().catch(() => ({ success: false, error: `Erreur ${resp.status}` }));
    return json as BureauApiResponse<T>;
  } catch {
    return { success: false, error: 'Erreur réseau' };
  }
}

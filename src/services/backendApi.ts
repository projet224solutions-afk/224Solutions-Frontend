/**
 * 🔗 BACKEND API CLIENT — Phase 5
 * Client centralisé pour appeler le backend Node.js
 * Gère : auth JWT, idempotency, retry, abort, erreurs métier structurées
 */

import { backendConfig } from '@/config/backend';
import { supabase } from '@/integrations/supabase/client';

const MAX_RETRIES = 2;
const TIMEOUT_MS = 15000;

interface BackendRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /**
   * Endpoint PUBLIC (accessible sans compte : marketplace, commande en personne via QR, etc.).
   * → on N'EXIGE PAS de token et on n'envoie l'en-tête Authorization que si une session existe.
   * Sans ce flag, une requête sans token est refusée d'office (« Non authentifié »).
   */
  allowAnonymous?: boolean;
}

export interface BackendResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
  /** Code métier alternatif (ex. défis 2FA admin : MFA_REQUIRED, MFA_INVALID…). */
  code?: string;
  details?: unknown;
  meta?: { limit: number; offset: number; total: number };
}

// ── Step-up 2FA admin : handler global enregistré par l'UI (modal de saisie du code) ──
// Quand une op sensible renvoie un défi MFA, on déclenche ce handler (prompt + /mfa/step-up).
// S'il réussit (grant Redis posé côté serveur), la requête d'origine est REJOUÉE une fois.
const MFA_CHALLENGE_CODES = new Set(['MFA_REQUIRED', 'MFA_INVALID']);
let mfaStepUpHandler: (() => Promise<boolean>) | null = null;

/** Enregistre la modal de step-up 2FA (appelé une fois par l'app admin). */
export function registerMfaStepUpHandler(handler: (() => Promise<boolean>) | null): void {
  mfaStepUpHandler = handler;
}

/** Error codes métier retournés par le backend */
export type BackendErrorCode =
  | 'STOCK_INSUFFICIENT'
  | 'PRODUCT_LIMIT_REACHED'
  | 'IMAGE_LIMIT_REACHED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_PAYLOAD_MISMATCH'
  | 'ORDER_NOT_CANCELLABLE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'ESCROW_FAILED'
  | 'VENDOR_INACTIVE'
  | 'SELF_PURCHASE'
  | 'TRANSITION_DENIED'
  | 'NEGATIVE_STOCK'
  | 'PROCESSING';

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Traduit un code d'erreur backend en message utilisateur
 */
export function translateBackendError(response: BackendResponse): string {
  const code = response.error_code;
  const fallback = response.error || 'Une erreur est survenue';

  const translations: Record<string, string> = {
    STOCK_INSUFFICIENT: 'Stock insuffisant pour un ou plusieurs produits',
    PRODUCT_LIMIT_REACHED: 'Limite de produits atteinte pour votre plan. Passez à un plan supérieur.',
    IMAGE_LIMIT_REACHED: 'Limite d\'images par produit atteinte pour votre plan.',
    IDEMPOTENCY_CONFLICT: 'Opération déjà en cours de traitement, veuillez patienter.',
    IDEMPOTENCY_PAYLOAD_MISMATCH: 'Conflit de données détecté. Rafraîchissez la page.',
    ORDER_NOT_CANCELLABLE: 'Cette commande ne peut plus être annulée.',
    SUBSCRIPTION_EXPIRED: 'Votre abonnement a expiré. Renouvelez pour continuer.',
    ESCROW_FAILED: 'Erreur lors de la mise en séquestre. Réessayez.',
    VENDOR_INACTIVE: 'Cette boutique est actuellement inactive.',
    SELF_PURCHASE: 'Vous ne pouvez pas commander dans votre propre boutique.',
    TRANSITION_DENIED: 'Ce changement de statut n\'est pas autorisé.',
    NEGATIVE_STOCK: 'Le stock résultant serait négatif.',
    PROCESSING: 'Opération en cours, veuillez patienter.',
  };

  return code ? (translations[code] || fallback) : fallback;
}

export async function backendFetch<T = unknown>(
  path: string,
  options: BackendRequestOptions = {}
): Promise<BackendResponse<T>> {
  const { body, idempotencyKey, signal: externalSignal, allowAnonymous, ...rest } = options;

  if (
    !backendConfig.baseUrl &&
    typeof window !== 'undefined' &&
    !import.meta.env.DEV &&
    (/^capacitor:\/\//i.test(window.location.origin) || /^ionic:\/\//i.test(window.location.origin) || /^http:\/\/localhost(:\d+)?$/i.test(window.location.origin))
  ) {
    return {
      success: false,
      error: 'Configuration backend mobile manquante (VITE_BACKEND_MOBILE_URL).',
    };
  }

  const token = await getAuthToken();
  // Endpoints protégés : on refuse vite sans token. Endpoints publics (allowAnonymous) : on continue.
  if (!token && !allowAnonymous) {
    return { success: false, error: 'Non authentifié', error_code: undefined };
  }

  const url = `${backendConfig.baseUrl}${path}`;
  const publicFallbackUrl = `${backendConfig.publicBaseUrl}${path}`;
  const rawHeaders = ((rest.headers as Record<string, string>) || {});
  const isRawBody =
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob;

  // Authorization uniquement si une session existe (les routes publiques l'ignorent côté backend).
  const headers: Record<string, string> = { ...rawHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  if (!headers['Content-Type'] && (!isRawBody || typeof body === 'string')) {
    headers['Content-Type'] = 'application/json';
  }

  const requestBody = body == null
    ? undefined
    : isRawBody
      ? body
      : JSON.stringify(body);

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  async function executeRequest(requestUrl: string): Promise<BackendResponse<T>> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      if (externalSignal) {
        externalSignal.addEventListener('abort', () => controller.abort());
      }

      try {
        const response = await fetch(requestUrl, {
          ...rest,
          // Défaut défensif : un body sans method partirait en GET (invalide, lève une
          // TypeError). On force POST quand un corps est présent et qu'aucune méthode
          // n'est précisée → évite cette classe de bug (PDF devis/facture, etc.).
          method: rest.method ?? (requestBody != null ? 'POST' : undefined),
          headers,
          body: requestBody,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const json = await response.json();

        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              error: json.error || `Erreur ${response.status}`,
              error_code: json.error_code,
              code: json.code,
              details: json.details,
            };
          }

          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }

          return { success: false, error: json.error || 'Erreur serveur', error_code: json.error_code };
        }

        return json as BackendResponse<T>;
      } catch (err: any) {
        clearTimeout(timeout);

        if (err.name === 'AbortError') {
          return { success: false, error: 'Requête annulée ou timeout' };
        }

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        return { success: false, error: 'Erreur réseau' };
      }
    }

    return { success: false, error: 'Échec après plusieurs tentatives' };
  }

  let primaryResult = await executeRequest(url);

  // Défi 2FA admin : si l'op sensible exige un step-up, on prompte le code via le handler
  // global, puis on REJOUE la requête une seule fois (le grant Redis ouvre la fenêtre 5 min).
  if (primaryResult.code && MFA_CHALLENGE_CODES.has(primaryResult.code) && mfaStepUpHandler) {
    const verified = await mfaStepUpHandler();
    if (verified) {
      primaryResult = await executeRequest(url);
    }
  }

  const isLocalApiRequest = import.meta.env.DEV && (backendConfig.baseUrl === '' || /https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(backendConfig.baseUrl));
  const shouldTryPublicFallback =
    isLocalApiRequest &&
    primaryResult.success === false &&
    (primaryResult.error === 'Erreur réseau' || primaryResult.error === 'Requête annulée ou timeout') &&
    Boolean(backendConfig.publicBaseUrl) &&
    publicFallbackUrl !== url;

  if (shouldTryPublicFallback) {
    const fallbackResult = await executeRequest(publicFallbackUrl);
    if (fallbackResult.success || (fallbackResult.error && fallbackResult.error !== 'Erreur réseau')) {
      return fallbackResult;
    }

    return { success: false, error: 'Serveur backend local indisponible et API publique injoignable.' };
  }

  if (isLocalApiRequest && primaryResult.success === false && primaryResult.error === 'Erreur réseau') {
    return { success: false, error: 'Serveur backend local indisponible. Lancez npm run dev:backend.' };
  }

  return primaryResult;
}

/**
 * 🔐 CLIENT-SIDE HMAC REQUEST SIGNER V2
 * Signe toutes les requêtes de paiement avec HMAC-SHA256
 *
 * Headers générés:
 * - X-API-KEY: identifiant client (PayPal Client ID)
 * - X-SIGNATURE: HMAC-SHA256(METHOD + PATH + BODY + TIMESTAMP + NONCE)
 * - X-TIMESTAMP: Date.now()
 * - X-NONCE: UUID unique
 * - Idempotency-Key: UUID pour anti-double-transaction
 *
 * 224Solutions
 */

import { backendFetch } from '@/services/backendApi';

const encoder = new TextEncoder();

/**
 * Generate HMAC-SHA256 signature using Web Crypto API
 */
async function _hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a unique nonce (UUID v4)
 */
function generateNonce(): string {
  return crypto.randomUUID();
}

export interface SignedHeaders {
  "x-api-key": string;
  "x-signature": string;
  "x-timestamp": string;
  "x-nonce": string;
  "idempotency-key"?: string;
}

/**
 * 🔐 Sign a request for secure Edge Function calls
 */
export async function signRequest(
  method: string,
  path: string,
  _body: string = "",
  options?: { idempotencyKey?: string }
): Promise<SignedHeaders> {
  const timestamp = Date.now().toString();
  const nonce = generateNonce();

  // No secret is embedded in the frontend anymore.
  // Keep idempotency metadata only; server-side auth and rate limiting do the real protection.
  const headers: SignedHeaders = {
    "x-api-key": "",
    "x-signature": "",
    "x-timestamp": timestamp,
    "x-nonce": nonce,
  };

  if (options?.idempotencyKey) {
    headers["idempotency-key"] = options.idempotencyKey;
  }

  return headers;
}

/**
 * 🔐 Invoke a Supabase Edge Function with HMAC signature + idempotency
 * Anti-double-transaction: generates a unique idempotency key per call
 */
export async function signedInvoke(
  functionName: string,
  body: Record<string, unknown>,
  options?: {
    idempotencyKey?: string;
    skipSigning?: boolean;
  }
) {
  const idempotencyKey = options?.idempotencyKey || generateNonce();
  const response = await backendFetch(`/edge-functions/${functionName}`, {
    method: 'POST',
    body,
    idempotencyKey,
  });

  if (!response.success) {
    return {
      data: null,
      error: { message: response.error || 'Erreur serveur' },
    };
  }

  return {
    data: response,
    error: null,
  };
}

/**
 * Check if HMAC signing is configured
 */
export function isHmacConfigured(): boolean {
  return false;
}

/**
 * Generate a unique idempotency key for a transaction
 * Format: txn_<type>_<userId_short>_<timestamp>_<random>
 */
export function generateIdempotencyKey(
  type: 'deposit' | 'withdrawal' | 'transfer' | 'payment',
  userId?: string
): string {
  const userPart = userId ? userId.substring(0, 8) : 'anon';
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `txn_${type}_${userPart}_${ts}_${rand}`;
}

/**
 * 224Guard — masquage & hachage.
 * RÈGLE D'OR : aucune valeur de secret ne circule jamais en clair. Toute valeur est
 * soit hashée (SHA-256, pour corréler/dédupliquer sans divulguer), soit masquée
 * (affichage non reconstructible). Ce module est le SEUL endroit qui touche la valeur
 * brute, et il ne renvoie que des formes sûres.
 */

import { ENV_CAPS } from './config';

/**
 * Masque non reconstructible. On ne révèle qu'un court préfixe + suffixe pour aider
 * l'admin à reconnaître la clé, jamais assez pour la reconstruire.
 * Ex. 'eyJhbGciOi...service_role...' → 'eyJh****…(len=412)'.
 */
export function maskSecret(value: string): string {
  const len = value.length;
  if (len <= 8) return '****';
  const prefix = value.slice(0, 4);
  // suffixe seulement si la chaîne est assez longue pour rester non reconstructible.
  const suffix = len >= 24 ? value.slice(-2) : '';
  return `${prefix}****…${suffix ? suffix + '·' : ''}(len=${len})`;
}

/** Hash SHA-256 hex (Web Crypto). Fallback déterministe non-crypto si indisponible. */
export async function hashSecret(value: string): Promise<string> {
  if (ENV_CAPS.hasSubtleCrypto) {
    const buf = await (globalThis as any).crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value),
    );
    return (
      'sha256:' +
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }
  return 'fnv1a:' + fnv1a(value);
}

/** Hash synchrone léger (FNV-1a 32 bits) — usage non cryptographique (dédup en mémoire). */
export function fnv1a(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

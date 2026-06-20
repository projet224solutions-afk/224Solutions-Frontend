/**
 * 224Guard — analyse d'entropie de Shannon.
 * Complément aux regex (cf. LOGIC_AUDIT §1.2) : détecte les secrets à haute entropie
 * SANS format connu, tout en excluant les faux positifs classiques (UUID, hash hex,
 * base64 d'image, texte normal).
 */

import { GUARD_CONFIG } from '../config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_HASH_RE = /^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{64}$/i; // md5/sha1/sha256
const DATA_URI_RE = /^data:[^;]+;base64,/i;

export class EntropyAnalyzer {
  /** Entropie de Shannon en bits/caractère. */
  calculateEntropy(str: string): number {
    if (!str) return 0;
    const freq: Record<string, number> = {};
    for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
    const n = str.length;
    let h = 0;
    for (const c of Object.values(freq)) {
      const p = c / n;
      h -= p * Math.log2(p);
    }
    return h;
  }

  /** Mélange de classes de caractères (réduit les faux positifs sur du texte). */
  private hasMixedCharset(str: string): boolean {
    let classes = 0;
    if (/[a-z]/.test(str)) classes++;
    if (/[A-Z]/.test(str)) classes++;
    if (/[0-9]/.test(str)) classes++;
    if (/[^a-zA-Z0-9]/.test(str)) classes++;
    return classes >= 2;
  }

  /** Exclut les formats à haute entropie mais NON secrets (UUID, hash, data-URI). */
  isNotCommonHash(str: string): boolean {
    return !UUID_RE.test(str) && !HEX_HASH_RE.test(str) && !DATA_URI_RE.test(str);
  }

  /**
   * Heuristique « ressemble à un secret » — appliquée à un JETON ISOLÉ (pas à un blob).
   *  - jeton contigu (pas d'espace), longueur ≥ seuil, charset mixte, entropie ≥ seuil,
   *  - exclut : JSON, texte, mot tout-minuscule (identifiant), UUID/hash/data-URI.
   */
  isLikelySecret(str: string): boolean {
    const { minBitsPerChar, minLength } = GUARD_CONFIG.entropy;
    if (str.length < minLength) return false;
    if (/\s/.test(str)) return false;                    // espace = phrase/texte, pas un secret
    if (str[0] === '{' || str[0] === '[') return false;  // JSON
    if (/^[a-z]+$/.test(str)) return false;              // mot tout en minuscules = identifiant/texte
    if (!this.isNotCommonHash(str)) return false;        // UUID / hash hex / data-URI
    if (!this.hasMixedCharset(str)) return false;
    return this.calculateEntropy(str) >= minBitsPerChar;
  }

  /**
   * Extrait d'une VALEUR (souvent du JSON, du texte, des headers) les JETONS contigus
   * du charset « secret » qui ressemblent à un secret. Évite de flaguer un blob JSON
   * entier ou une phrase : seul un VRAI jeton à haute entropie embarqué est remonté.
   */
  extractSecretTokens(value: string): string[] {
    const { minLength } = GUARD_CONFIG.entropy;
    const re = new RegExp(`[A-Za-z0-9_\\-+/=]{${minLength},}`, 'g');
    const out: string[] = [];
    const seen = new Set<string>();
    for (const tok of value.match(re) || []) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      if (this.isLikelySecret(tok)) out.push(tok);
    }
    return out;
  }

  /** Score d'entropie normalisé ∈ [0,1] (0 ≈ texte, 1 ≈ aléatoire ~6 bits/char). */
  entropyScore(str: string): number {
    const h = this.calculateEntropy(str);
    // 6 bits/char ≈ maximum pratique (base64). On borne à [0,1].
    return Math.max(0, Math.min(1, h / 6));
  }
}

export const entropyAnalyzer = new EntropyAnalyzer();

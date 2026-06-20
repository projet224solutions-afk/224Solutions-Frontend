/**
 * 224Guard — moteur de correspondance de motifs.
 *
 * Point critique (cf. LOGIC_AUDIT §1.1 Q5) : les JWT sont DÉCODÉS pour distinguer un
 * token utilisateur légitime (`role:anon`/`authenticated`) — qu'il NE FAUT PAS alerter —
 * d'une clé `service_role` exposée — qui DOIT déclencher une alerte CRITIQUE.
 */

import type { DetectionCandidate } from '../core/types';
import { CRITICAL_PATTERNS, PUBLIC_PATTERNS, JWT_RE } from './patterns';

/** Décode un segment base64url (navigateur via atob, Node via Buffer). */
function b64urlDecode(seg: string): string | null {
  try {
    let s = seg.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    if (typeof atob === 'function') return atob(s);
    // Fallback Node
    const B = (globalThis as any).Buffer;
    if (B) return B.from(s, 'base64').toString('utf8');
    return null;
  } catch {
    return null;
  }
}

/** Rôle Supabase d'un JWT, ou null si non décodable / pas un JWT Supabase. */
export function jwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const json = b64urlDecode(parts[1]);
  if (!json) return null;
  try {
    const payload = JSON.parse(json);
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export class PatternMatcher {
  /**
   * Analyse un texte et renvoie les candidats de détection.
   * Note : la valeur brute (`rawValue`) est portée jusqu'au scorer puis IMMÉDIATEMENT
   * masquée par l'AlertManager — elle ne quitte jamais le pipeline.
   */
  match(text: string): DetectionCandidate[] {
    const out: DetectionCandidate[] = [];
    if (!text) return out;

    // 1) Motifs serveur INTERDITS au front.
    for (const p of CRITICAL_PATTERNS) {
      const m = p.re.exec(text);
      if (m) {
        out.push({
          patternKey: p.key,
          type: p.type,
          severity: p.severity,
          publicByDesign: false,
          rawValue: m[0],
          label: p.label,
        });
      }
    }

    // 2) JWT : décoder le claim `role`.
    JWT_RE.lastIndex = 0;
    let jm: RegExpExecArray | null;
    while ((jm = JWT_RE.exec(text)) !== null) {
      const token = jm[0];
      const role = jwtRole(token);
      if (role === 'service_role') {
        out.push({
          patternKey: 'supabase.service_role',
          type: 'SERVICE_ROLE_KEY',
          severity: 'CRITICAL',
          publicByDesign: false,
          rawValue: token,
          label: 'Clé service_role Supabase (bypass RLS, accès total DB)',
        });
      }
      // role anon/authenticated/null → token utilisateur légitime : IGNORÉ (pas de candidat).
    }

    // 3) Clés publiques par conception → candidats LOW (alerte seulement si contexte aggravant).
    for (const p of PUBLIC_PATTERNS) {
      const m = p.re.exec(text);
      if (m) {
        out.push({
          patternKey: p.key,
          type: p.type,
          severity: p.severity,
          publicByDesign: true,
          rawValue: m[0],
          label: p.label,
        });
      }
    }

    return out;
  }
}

export const patternMatcher = new PatternMatcher();

/**
 * 224Guard — point d'entrée (bootstrap PRIVÉ).
 *
 * DÉCISION D1 (cf. LOGIC_AUDIT attaque #1) : l'instance n'est JAMAIS exposée sur `window`.
 * Elle vit dans la closure de ce module. Le dashboard consomme les alertes via l'événement
 * DOM `224guard:alert` et via `getRecentAlerts()` — pas via une référence globale qu'un
 * script malveillant pourrait appeler (`window.Guard224.stop()`).
 *
 * À appeler AU PLUS TÔT dans `main.tsx` (avant les SDK tiers) :
 *   import { startGuard224 } from '@/224guard';
 *   startGuard224();
 */

import { Guard224, type Guard224Options } from './core/Guard224';
import { BackendSink } from './pipeline/sinks/BackendSink';
import type { Alert224 } from './core/types';

let _instance: Guard224 | null = null;

/** Démarre 224Guard une seule fois. No-op en SSR (pas de window). */
export function startGuard224(opts?: Guard224Options): void {
  if (_instance) return;
  if (typeof window === 'undefined') return; // garde SSR
  // Par défaut : LocalSink (interne) + BackendSink (ingestion serveur + Ably).
  _instance = new Guard224({ sinks: [new BackendSink()], ...opts });
  void _instance.start();
}

/** Alertes récentes (lecture seule) pour le dashboard. */
export function getRecentAlerts(): Alert224[] {
  return _instance ? _instance.recentAlerts : [];
}

/** Le moteur de monitoring est-il actif (lecture seule, pour l'interrupteur du dashboard) ? */
export function isGuard224Running(): boolean {
  return _instance !== null;
}

/**
 * Préférence d'activation persistée (le PDG peut couper/activer le monitoring depuis le dashboard).
 * Défaut = activé. main.tsx la respecte au démarrage ; le dashboard l'écrit via setGuard224Enabled.
 */
const GUARD_PREF_KEY = '224guard:enabled';
export function isGuard224EnabledPref(): boolean {
  try { return localStorage.getItem(GUARD_PREF_KEY) !== 'false'; } catch { return true; }
}
export function setGuard224Enabled(on: boolean): void {
  try { localStorage.setItem(GUARD_PREF_KEY, on ? 'true' : 'false'); } catch { /* best-effort */ }
  if (on) startGuard224();
  else disposeGuard224();
}

/** Marque une alerte comme faux positif (apprentissage adaptatif plafonné). */
export function reportFalsePositive(patternKey: string): void {
  _instance?.allowlist.onFalsePositive(patternKey);
}

/** Arrête et nettoie 224Guard (tests / hot-reload). */
export function disposeGuard224(): void {
  _instance?.dispose();
  _instance = null;
}

export type { Alert224 } from './core/types';

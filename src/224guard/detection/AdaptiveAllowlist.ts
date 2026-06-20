/**
 * 224Guard — allowlist adaptative (apprentissage des faux positifs).
 *
 * SÉCURITÉ (cf. LOGIC_AUDIT attaque #6) : l'apprentissage est PLAFONNÉ et ne peut JAMAIS
 * s'appliquer à un motif CRITIQUE (service_role, sk_live, clé privée…). Sinon un attaquant
 * inonderait de faux positifs pour aveugler la détection sur une vraie clé.
 */

import { GUARD_CONFIG } from '../config';
import { CRITICAL_PATTERN_KEYS } from './patterns';

interface TrustRecord {
  falsePositives: number;
  truePositives: number;
  updatedAt: number;
}

export class AdaptiveAllowlist {
  private records = new Map<string, TrustRecord>();

  /** Hook de persistance (Lot C) : remplacé pour charger/sauver depuis Supabase. */
  persist: (patternKey: string, rec: TrustRecord) => void = () => {};

  onFalsePositive(patternKey: string): void {
    if (CRITICAL_PATTERN_KEYS.has(patternKey)) return; // jamais sur un motif critique
    const rec = this.records.get(patternKey) ?? { falsePositives: 0, truePositives: 0, updatedAt: 0 };
    rec.falsePositives++;
    rec.updatedAt = Date.now();
    this.records.set(patternKey, rec);
    this.persist(patternKey, rec);
  }

  onTruePositive(patternKey: string): void {
    const rec = this.records.get(patternKey) ?? { falsePositives: 0, truePositives: 0, updatedAt: 0 };
    rec.truePositives++;
    rec.updatedAt = Date.now();
    this.records.set(patternKey, rec);
    this.persist(patternKey, rec);
  }

  /**
   * Réduction de score ∈ [0, maxScoreReduction] à appliquer pour ce motif.
   * 0 si motif critique, si pas assez de faux positifs, ou si record absent.
   */
  reductionFor(patternKey: string): number {
    if (CRITICAL_PATTERN_KEYS.has(patternKey)) return 0;
    const rec = this.records.get(patternKey);
    if (!rec) return 0;
    if (rec.falsePositives < GUARD_CONFIG.allowlist.minFalsePositivesToAdjust) return 0;
    const total = rec.falsePositives + rec.truePositives || 1;
    const fpRate = rec.falsePositives / total;
    return Math.min(GUARD_CONFIG.allowlist.maxScoreReduction, fpRate * GUARD_CONFIG.allowlist.maxScoreReduction);
  }

  /** Pour les tests / le dashboard. */
  snapshot(): Record<string, TrustRecord> {
    return Object.fromEntries(this.records);
  }
}

export const adaptiveAllowlist = new AdaptiveAllowlist();

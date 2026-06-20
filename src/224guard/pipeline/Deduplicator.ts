/**
 * 224Guard — déduplication multi-dimensionnelle (cf. LOGIC_AUDIT §1.3).
 * Clé = hash du secret ; coalescing des SOURCES sous une même exposition ; fenêtre
 * glissante. Une ESCALADE de sévérité réinitialise la dédup (nouvelle alerte).
 */

import { GUARD_CONFIG } from '../config';
import type { AlertSource, Severity } from '../core/types';

const RANK: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

interface DedupRecord {
  severity: Severity;
  lastSeen: number;
  sources: Set<AlertSource>;
}

export interface DedupDecision {
  /** émettre une NOUVELLE alerte ? */
  emit: boolean;
  /** s'agit-il d'une escalade de sévérité ? */
  escalated: boolean;
  /** une nouvelle source a-t-elle été ajoutée (coalescing) ? */
  newSource: boolean;
}

export class Deduplicator {
  private records = new Map<string, DedupRecord>();

  constructor(private now: () => number = () => Date.now()) {}

  decide(keyHash: string, severity: Severity, source: AlertSource): DedupDecision {
    const t = this.now();
    const rec = this.records.get(keyHash);
    const windowMs = GUARD_CONFIG.dedup.windowMs;

    // Nouvelle, ou fenêtre expirée → émettre.
    if (!rec || t - rec.lastSeen > windowMs) {
      this.records.set(keyHash, { severity, lastSeen: t, sources: new Set([source]) });
      return { emit: true, escalated: false, newSource: true };
    }

    // Escalade de sévérité → nouvelle alerte (l'admin doit revoir l'aggravation).
    if (RANK[severity] > RANK[rec.severity]) {
      this.records.set(keyHash, { severity, lastSeen: t, sources: new Set([source]) });
      return { emit: true, escalated: true, newSource: true };
    }

    // Doublon (même sévérité ou inférieure, dans la fenêtre) → coalescer la source.
    const newSource = !rec.sources.has(source);
    rec.sources.add(source);
    rec.lastSeen = t;
    return { emit: false, escalated: false, newSource };
  }

  reset(): void {
    this.records.clear();
  }
}

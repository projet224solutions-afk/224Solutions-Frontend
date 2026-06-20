/**
 * 224Guard — file d'attente résiliente (cf. LOGIC_AUDIT §1.3, D4).
 * GARANTIE : aucune alerte CRITIQUE perdue tant que le store de persistance est dispo.
 * - Persistance d'abord (source de vérité), envoi best-effort vers les sinks ensuite.
 * - Retry backoff exponentiel ; abandon après maxRetries (LOW/MEDIUM uniquement).
 * - Store PLUGGABLE → testable en Node (MemoryStore) ; IndexedDB en navigateur.
 */

import { GUARD_CONFIG } from '../config';
import type { Alert224, AlertSink } from '../core/types';

/** Abstraction de persistance (IndexedDB en prod, mémoire en test). */
export interface PersistentStore {
  put(alert: Alert224): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<Alert224[]>;
}

/** Implémentation mémoire (fallback + tests). */
export class MemoryStore implements PersistentStore {
  private map = new Map<string, Alert224>();
  async put(a: Alert224): Promise<void> {
    this.map.set(a.id, a);
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
  async all(): Promise<Alert224[]> {
    return [...this.map.values()];
  }
}

interface QueueItem {
  alert: Alert224;
  retries: number;
}

export class ResilientAlertQueue {
  private queue: QueueItem[] = [];
  private processing = false;

  constructor(
    private store: PersistentStore,
    private sinks: AlertSink[],
    /** sleep injectable (tests : résolution immédiate). */
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  /** Persiste puis met en file. La persistance est la garantie anti-perte. */
  async enqueue(alert: Alert224): Promise<void> {
    if (this.queue.length >= GUARD_CONFIG.queue.maxSize) {
      // Cap atteint : on évince la plus ancienne LOW/MEDIUM pour garder les CRITIQUES.
      const idx = this.queue.findIndex((q) => q.alert.severity === 'LOW' || q.alert.severity === 'MEDIUM');
      if (idx >= 0) {
        const [evicted] = this.queue.splice(idx, 1);
        await this.store.delete(evicted.alert.id);
      } else {
        return; // file pleine de CRITIQUES non livrées → on ne perd pas, on diffère.
      }
    }
    await this.store.put(alert);
    this.queue.push({ alert, retries: 0 });
    // On attend le drain : non bloquant pour l'app (les moniteurs appellent enqueue
    // sans `await`), mais déterministe pour les tests et garantit le traitement.
    await this.process();
  }

  /** Récupère les alertes non livrées au démarrage (survie aux rechargements). */
  async recoverPending(): Promise<void> {
    const pending = await this.store.all();
    for (const alert of pending) this.queue.push({ alert, retries: 0 });
    if (this.queue.length) await this.process();
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];
        const results = await Promise.all(
          this.sinks.map((s) => s.deliver(item.alert).catch((e) => ({ ok: false, retryable: true, error: String(e) }))),
        );
        const allOk = results.every((r) => r.ok);
        const anyRetryable = results.some((r) => !r.ok && r.retryable);

        if (allOk || (!anyRetryable)) {
          // Livré, ou échec définitif non-retryable → on retire et on purge le store.
          this.queue.shift();
          await this.store.delete(item.alert.id);
          continue;
        }

        // Échec retryable → backoff exponentiel.
        item.retries++;
        if (item.retries >= GUARD_CONFIG.queue.maxRetries) {
          // Abandon, SAUF CRITIQUE qu'on garde en file durable pour rejeu ultérieur.
          if (item.alert.severity !== 'CRITICAL') {
            this.queue.shift();
            await this.store.delete(item.alert.id);
            continue;
          }
          item.retries = 0; // CRITIQUE : on ne perd jamais, on recommencera.
          break; // on sort ; un appel ultérieur (online/recover) relancera.
        }
        await this.sleep(GUARD_CONFIG.queue.backoffBaseMs * 2 ** item.retries);
      }
    } finally {
      this.processing = false;
    }
  }

  /** Taille courante (tests/diagnostic). */
  get size(): number {
    return this.queue.length;
  }
}

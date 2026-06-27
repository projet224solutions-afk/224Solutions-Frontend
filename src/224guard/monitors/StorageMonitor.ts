/**
 * 224Guard — surveillance du stockage (localStorage / sessionStorage).
 * Scanne les entrées existantes au démarrage puis intercepte `setItem` pour analyser
 * toute nouvelle valeur écrite (un secret en storage = CRITIQUE s'il s'agit d'une clé serveur).
 */

import type { AlertManager } from '../pipeline/AlertManager';
import type { DisposableRegistry } from '../core/DisposableRegistry';
import type { AlertSource, DetectionContext } from '../core/types';

export class StorageMonitor {
  constructor(
    private alerts: AlertManager,
    private registry: DisposableRegistry,
    private storage: Storage,
    private source: AlertSource, // 'local_storage' | 'session_storage'
  ) {}

  install(): void {
    if (!this.storage) return; // feature-detect (storage désactivé)
    this.scanExisting();
    this.hookSetItem();
  }

  private ctx(key: string): DetectionContext {
    return { source: this.source, location: key };
  }

  private scanExisting(): void {
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key == null) continue;
        const value = this.storage.getItem(key);
        if (value) void this.alerts.analyzeValue(value, this.ctx(key));
      }
    } catch { /* storage inaccessible → on ignore */ }
  }

  private hookSetItem(): void {
    const storage = this.storage;
    const original = storage.setItem.bind(storage);
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- l'override setItem a son propre this
    const self = this;
    try {
      storage.setItem = function (key: string, value: string) {
        queueMicrotask(() => { try { void self.alerts.analyzeValue(String(value), self.ctx(String(key))); } catch { /* noop */ } });
        return original(key, value);
      };
      this.registry.add(() => { try { storage.setItem = original; } catch { /* noop */ } });
    } catch {
      // Certains navigateurs interdisent l'override de l'instance → dégradation (scan only).
    }
  }
}

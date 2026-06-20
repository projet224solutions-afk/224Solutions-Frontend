/**
 * 224Guard — registre central de nettoyage (anti memory-leak, cf. LOGIC_AUDIT §1.5).
 * Chaque moniteur enregistre ses ressources (intervalles, observers, listeners,
 * abonnements) ; `dispose()` garantit qu'AUCUNE n'est oubliée.
 */

export type Disposable = () => void;

export class DisposableRegistry {
  private disposables: Disposable[] = [];
  private disposed = false;

  /** Enregistre une fonction de nettoyage et la renvoie (pour usage direct). */
  add(d: Disposable): Disposable {
    if (this.disposed) {
      // Déjà disposé → on nettoie immédiatement pour ne rien laisser fuir.
      try { d(); } catch { /* noop */ }
      return () => {};
    }
    this.disposables.push(d);
    return d;
  }

  /** Helpers typés pour les ressources courantes (auto-nettoyées). */
  setInterval(fn: () => void, ms: number): void {
    const id = setInterval(fn, ms);
    this.add(() => clearInterval(id));
  }

  addEventListener(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.add(() => target.removeEventListener(type, fn, opts));
  }

  /** Nettoie toutes les ressources. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const d of this.disposables.splice(0).reverse()) {
      try { d(); } catch { /* on continue malgré une erreur de nettoyage */ }
    }
  }

  get size(): number {
    return this.disposables.length;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}

/**
 * 224Guard — sink LOCAL (par défaut, toujours disponible).
 * Conserve les alertes récentes en mémoire et émet un événement DOM `224guard:alert`
 * que le dashboard peut écouter — même AVANT qu'Ably/Supabase (Lot C) soient branchés.
 */

import type { Alert224, AlertSink, SinkResult } from '../../core/types';

function defaultDispatch(alert: Alert224): void {
  if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('224guard:alert', { detail: alert }));
  }
}

export class LocalSink implements AlertSink {
  readonly name = 'local';
  readonly recent: Alert224[] = [];

  constructor(
    private max = 200,
    private dispatch: (a: Alert224) => void = defaultDispatch,
  ) {}

  async deliver(alert: Alert224): Promise<SinkResult> {
    this.recent.unshift(alert);
    if (this.recent.length > this.max) this.recent.pop();
    try { this.dispatch(alert); } catch { /* le dispatch ne doit jamais bloquer */ }
    return { ok: true, retryable: false };
  }
}

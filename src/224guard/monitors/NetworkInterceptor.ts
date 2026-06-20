/**
 * 224Guard — intercepteur réseau (fetch + XHR).
 *
 * DÉCISION D2/D3 (cf. LOGIC_AUDIT) : NON-BLOQUANT. On capture les arguments puis on
 * lance l'analyse en tâche différée (`queueMicrotask`) ; la requête part IMMÉDIATEMENT
 * (overhead < 1 ms). On installe un Proxy RÉVERSIBLE (pas de `configurable:false` qui
 * casserait les SDK et serait irréversible). L'IntegrityMonitor (séparé) surveille le tamper.
 */

import type { AlertManager } from '../pipeline/AlertManager';
import type { DisposableRegistry } from '../core/DisposableRegistry';
import type { DetectionContext } from '../core/types';

type FetchLike = typeof fetch;

interface FetchTarget {
  fetch: FetchLike;
  XMLHttpRequest?: typeof XMLHttpRequest;
}

export class NetworkInterceptor {
  private proxy: FetchLike | null = null;
  private original: FetchLike | null = null;

  constructor(
    private alerts: AlertManager,
    private registry: DisposableRegistry,
    private target: FetchTarget = globalThis as unknown as FetchTarget,
  ) {}

  /** Le proxy installé (l'IntegrityMonitor vérifie que `target.fetch === proxy`). */
  get currentProxy(): FetchLike | null {
    return this.proxy;
  }

  /** Vrai si notre proxy est toujours le `fetch` actif (sinon = tamper). */
  isIntact(): boolean {
    return this.proxy != null && this.target.fetch === this.proxy;
  }

  /** Réinstalle notre proxy (appelé par self-heal / integrity si écrasé). */
  reinstall(): void {
    if (this.proxy) this.target.fetch = this.proxy;
  }

  install(): void {
    if (typeof this.target.fetch !== 'function') return; // feature-detect
    // Original NON-bindé → identité préservée pour la restauration au dispose.
    this.original = this.target.fetch;

    const self = this;
    this.proxy = new Proxy(this.original, {
      apply(targetFn, thisArg, args: Parameters<FetchLike>) {
        // Analyse HORS chemin critique : on programme et on rend la main aussitôt.
        queueMicrotask(() => {
          try { self.analyzeRequest(args[0], args[1]); } catch { /* jamais bloquer le réseau */ }
        });
        // `this` de repli = la cible (window) pour éviter « Illegal invocation » sur fetch() nu.
        return Reflect.apply(targetFn, thisArg ?? self.target, args);
      },
    });
    this.target.fetch = this.proxy;
    this.registry.add(() => { if (this.original) this.target.fetch = this.original; });

    this.installXhr();
  }

  private installXhr(): void {
    const XHR = this.target.XMLHttpRequest;
    if (!XHR) return;
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;
    const self = this;
    XHR.prototype.open = function (this: any, method: string, url: string, ...rest: any[]) {
      this.__guard_url = url;
      return origOpen.call(this, method, url, ...rest);
    };
    XHR.prototype.send = function (this: any, body?: any) {
      const url = this.__guard_url;
      queueMicrotask(() => {
        try {
          const ctx: DetectionContext = { source: 'network_request', direction: 'outbound', location: String(url || '') };
          if (typeof url === 'string') void self.alerts.analyzeText(url, ctx);
          if (typeof body === 'string') void self.alerts.analyzeText(body, ctx);
        } catch { /* noop */ }
      });
      return origSend.call(this, body);
    };
    this.registry.add(() => { XHR.prototype.open = origOpen; XHR.prototype.send = origSend; });
  }

  private analyzeRequest(input: RequestInfo | URL, init?: RequestInit): void {
    const url = this.extractUrl(input);
    const ctx: DetectionContext = { source: 'network_request', direction: 'outbound', location: url };

    // URL (peut contenir ?key=… en query).
    if (url) void this.alerts.analyzeText(url, ctx);

    // En-têtes : chaque VALEUR est discrète (Authorization, x-api-key…).
    const headers = this.extractHeaders(input, init);
    for (const value of headers) void this.alerts.analyzeValue(value, ctx);

    // Corps (si string) : texte libre.
    const body = init?.body ?? (input instanceof Request ? undefined : undefined);
    if (typeof body === 'string') void this.alerts.analyzeText(body, ctx);
  }

  private extractUrl(input: RequestInfo | URL): string {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.toString();
      if (input instanceof Request) return input.url;
    } catch { /* noop */ }
    return '';
  }

  private extractHeaders(input: RequestInfo | URL, init?: RequestInit): string[] {
    const out: string[] = [];
    const push = (h: HeadersInit | undefined) => {
      if (!h) return;
      try {
        if (h instanceof Headers) h.forEach((v) => out.push(v));
        else if (Array.isArray(h)) h.forEach(([, v]) => out.push(String(v)));
        else for (const v of Object.values(h)) out.push(String(v));
      } catch { /* noop */ }
    };
    push(init?.headers);
    if (input instanceof Request) {
      try { input.headers.forEach((v) => out.push(v)); } catch { /* noop */ }
    }
    return out;
  }
}

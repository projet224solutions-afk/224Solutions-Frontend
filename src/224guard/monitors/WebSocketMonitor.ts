/**
 * 224Guard — surveillance WebSocket (Ably, Firebase…).
 * Les WS ne passent pas par fetch/XHR → on proxifie le constructeur `WebSocket` et on
 * enveloppe `send` pour analyser l'URL de connexion et les messages sortants.
 */

import type { AlertManager } from '../pipeline/AlertManager';
import type { DisposableRegistry } from '../core/DisposableRegistry';
import type { DetectionContext } from '../core/types';

interface WsTarget { WebSocket?: typeof WebSocket }

export class WebSocketMonitor {
  private original: typeof WebSocket | null = null;

  constructor(
    private alerts: AlertManager,
    private registry: DisposableRegistry,
    private target: WsTarget = globalThis as unknown as WsTarget,
  ) {}

  install(): void {
    const OrigWS = this.target.WebSocket;
    if (typeof OrigWS !== 'function') return; // feature-detect
    this.original = OrigWS;
    const self = this;

    const proxy = new Proxy(OrigWS, {
      construct(targetCtor, args: any[]) {
        const url = String(args[0] ?? '');
        const ctx: DetectionContext = { source: 'websocket', direction: 'outbound', location: url };
        queueMicrotask(() => { try { void self.alerts.analyzeText(url, ctx); } catch { /* noop */ } });

        const ws: WebSocket = Reflect.construct(targetCtor, args);
        const origSend = ws.send.bind(ws);
        ws.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
          if (typeof data === 'string') {
            queueMicrotask(() => { try { void self.alerts.analyzeText(data, ctx); } catch { /* noop */ } });
          }
          return origSend(data as any);
        };
        return ws;
      },
    });

    this.target.WebSocket = proxy as typeof WebSocket;
    this.registry.add(() => { if (this.original) this.target.WebSocket = this.original; });
  }
}

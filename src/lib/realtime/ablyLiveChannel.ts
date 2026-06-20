/**
 * Adaptateur LiveChannel sur Ably (Phase 1 scalabilité).
 * Mappe le modèle "broadcast" (on/send) vers publish/subscribe Ably.
 * Le SDK est chargé paresseusement via getAblyClient().
 */

import type { LiveChannel, LiveStatus } from './types';
import { getAblyClient } from './ablyClient';

export class AblyLiveChannel implements LiveChannel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private channelPromise: Promise<any>;
  private closed = false;

  constructor(name: string) {
    this.channelPromise = getAblyClient().then((client) => client.channels.get(name));
  }

  on(event: string, cb: (payload: unknown) => void): LiveChannel {
    this.channelPromise
      .then((ch) => {
        if (this.closed) return;
        ch.subscribe(event, (msg: { data: unknown }) => cb(msg.data));
      })
      .catch(() => { /* canal indisponible */ });
    return this;
  }

  send(event: string, payload: unknown): void {
    this.channelPromise
      .then((ch) => { if (!this.closed) ch.publish(event, payload); })
      .catch(() => { /* publication ignorée si canal indisponible */ });
  }

  subscribe(onStatus?: (status: LiveStatus) => void): LiveChannel {
    this.channelPromise
      .then((ch) => {
        if (this.closed) return;
        const notify = () => {
          const s = String(ch.state);
          if (s === 'attached') onStatus?.('subscribed');
          else if (s === 'failed' || s === 'suspended') onStatus?.('error');
          else if (s === 'detached') onStatus?.('closed');
          else onStatus?.('connecting');
        };
        ch.on(notify);
        ch.attach();
        notify();
      })
      .catch(() => onStatus?.('error'));
    return this;
  }

  close(): void {
    this.closed = true;
    this.channelPromise.then((ch) => { try { ch.detach(); } catch { /* déjà détaché */ } }).catch(() => undefined);
  }
}

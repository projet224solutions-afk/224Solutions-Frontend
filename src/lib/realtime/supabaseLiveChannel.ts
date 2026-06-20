/**
 * Adaptateur LiveChannel sur Supabase Realtime (broadcast).
 * Reproduit le comportement actuel : c'est le transport par défaut.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { LiveChannel, LiveStatus } from './types';

export class SupabaseLiveChannel implements LiveChannel {
  private channel: RealtimeChannel;

  constructor(name: string) {
    this.channel = supabase.channel(name, { config: { broadcast: { self: false } } });
  }

  on(event: string, cb: (payload: unknown) => void): LiveChannel {
    this.channel.on('broadcast', { event }, ({ payload }) => cb(payload));
    return this;
  }

  send(event: string, payload: unknown): void {
    this.channel.send({ type: 'broadcast', event, payload });
  }

  subscribe(onStatus?: (status: LiveStatus) => void): LiveChannel {
    this.channel.subscribe((status) => {
      if (!onStatus) return;
      if (status === 'SUBSCRIBED') onStatus('subscribed');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus('error');
      else if (status === 'CLOSED') onStatus('closed');
      else onStatus('connecting');
    });
    return this;
  }

  close(): void {
    supabase.removeChannel(this.channel);
  }
}

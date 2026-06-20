/**
 * Fabrique de canal temps réel — point d'entrée unique.
 *
 * Renvoie l'implémentation selon le flag `VITE_REALTIME_PROVIDER` :
 *   - 'ably'     → AblyLiveChannel (SDK chargé paresseusement)
 *   - sinon      → SupabaseLiveChannel (défaut, comportement actuel)
 *
 * Les hooks consomment `getLiveChannel(name)` sans connaître le transport.
 */

import { isAblyEnabled } from '@/config/realtime';
import type { LiveChannel } from './types';
import { SupabaseLiveChannel } from './supabaseLiveChannel';
import { AblyLiveChannel } from './ablyLiveChannel';

export function getLiveChannel(name: string): LiveChannel {
  return isAblyEnabled ? new AblyLiveChannel(name) : new SupabaseLiveChannel(name);
}

export type { LiveChannel, LiveStatus } from './types';

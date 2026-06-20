/**
 * LISTENER GLOBAL - BROADCASTS
 * Monte le hook useBroadcasts au niveau global pour recevoir les diffusions
 * (Realtime + toast) sur toutes les pages, sans ajouter d'UI.
 */

import { useBroadcasts } from '@/hooks/useBroadcasts';

export function BroadcastRealtimeListener() {
  // Le hook gère:
  // - chargement initial
  // - subscription Realtime sur broadcast_recipients
  // - affichage des toasts
  useBroadcasts();
  return null;
}

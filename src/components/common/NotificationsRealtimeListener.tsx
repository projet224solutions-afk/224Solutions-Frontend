/**
 * LISTENER GLOBAL - NOTIFICATIONS
 * Monte le hook useNotificationsRealtime au niveau global pour recevoir les notifications
 * (Realtime + toast) sur toutes les pages, sans ajouter d'UI.
 */

import { useNotificationsRealtime } from "@/hooks/useNotificationsRealtime";

export function NotificationsRealtimeListener() {
  useNotificationsRealtime();
  return null;
}

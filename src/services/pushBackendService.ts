/**
 * 📲 PUSH BACKEND SERVICE
 * Déclenche l'envoi d'un push (FCM) via le backend Node.js.
 */

import { backendFetch } from './backendApi';

/**
 * Envoie une notification push au client pour qu'il ouvre l'app et confirme sa position.
 * Utilisé quand le client est hors ligne (app fermée / pas de connexion temps réel).
 */
export async function sendLocateRequest(targetUserId: string, driverName?: string) {
  return backendFetch<{ delivered?: boolean; reason?: string }>('/api/v2/push/locate-request', {
    method: 'POST',
    body: { target_user_id: targetUserId, driver_name: driverName },
  });
}

/**
 * Notifie un destinataire d'un appel entrant (push FCM) pour qu'il ouvre l'app
 * même si elle est fermée. Une fois ouverte, l'offre WebRTC (réémise) fait sonner.
 */
export async function sendCallNotification(
  targetUserId: string,
  callerName?: string,
  mode: 'audio' | 'video' = 'audio'
) {
  return backendFetch<{ delivered?: boolean; reason?: string }>('/api/v2/push/call-notify', {
    method: 'POST',
    body: { target_user_id: targetUserId, caller_name: callerName, mode },
  });
}

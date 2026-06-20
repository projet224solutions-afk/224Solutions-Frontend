/**
 * Abstraction temps réel — interface commune Supabase / Ably.
 *
 * Calquée sur le sous-ensemble de l'API canal réellement utilisé par les hooks
 * de partage de position (broadcast d'événements + statut d'abonnement), pour
 * permettre de basculer de transport sans réécrire la logique métier.
 */

export type LiveStatus = 'subscribed' | 'connecting' | 'error' | 'closed';

export interface LiveChannel {
  /** Écoute un événement broadcast. Le callback reçoit le payload. */
  on(event: string, cb: (payload: unknown) => void): LiveChannel;
  /** Diffuse un événement broadcast à tous les abonnés du canal. */
  send(event: string, payload: unknown): void;
  /** Démarre l'abonnement. `onStatus` notifie l'état (subscribed/error/…). */
  subscribe(onStatus?: (status: LiveStatus) => void): LiveChannel;
  /** Ferme/désabonne le canal et libère les ressources. */
  close(): void;
}

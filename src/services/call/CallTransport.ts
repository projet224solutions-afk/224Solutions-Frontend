/**
 * 🔀 CallTransport — contrat COMMUN de transport d'appel média.
 * Agora l'implémente aujourd'hui (AgoraTransport) ; WebRTC natif l'implémentera
 * demain (WebRTCTransport) SANS toucher l'UI. Préparation à la bascule — l'UI ne
 * dépendra que de cette interface, jamais de agoraService directement.
 *
 * NB : la SIGNALISATION (table `calls` + realtime) reste hors de ce contrat ;
 * CallTransport ne concerne que le MÉDIA (join/leave/play/toggle).
 */
export interface CallTransport {
  join(channel: string, opts: { video: boolean }): Promise<void>;
  leave(): Promise<void>;
  playLocal(el: HTMLElement): void;
  playRemote(uid: string, el: HTMLElement): void;
  /** @returns nouvel état muet (true = coupé) */
  toggleMute(): Promise<boolean>;
  /** @returns nouvel état vidéo (true = activée) */
  toggleVideo(): Promise<boolean>;
  onRemoteJoined(cb: (uid: string) => void): void;
  onRemoteLeft(cb: (uid: string) => void): void;
}

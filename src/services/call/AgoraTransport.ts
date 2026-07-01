/**
 * 🅰️ AgoraTransport — implémentation Agora de CallTransport (transport ACTIF).
 * Mappe le contrat commun → agoraService (déjà présent). L'UI passera par ce
 * contrat pour que la bascule future vers WebRTC (WebRTCTransport) soit un simple
 * changement de transport, SANS réécrire l'UI.
 *
 * ⚠️ PRÉPARATION : non encore branché. Aujourd'hui l'UI (AgoraVideoCall) utilise
 * encore useAgora/agoraService directement (qui gère le token via
 * fetchAgoraCredentials). La migration branchera ce transport en injectant un
 * CredentialsProvider (le même fetchAgoraCredentials).
 */
import { agoraService } from '@/services/agoraService';
import type { CallTransport } from './CallTransport';

export interface AgoraCredentials {
  appId: string;
  token: string;
  uid: string;
}

/** Fournit les crédentials Agora pour un canal (à brancher sur fetchAgoraCredentials). */
export type CredentialsProvider = (channel: string) => Promise<AgoraCredentials>;

export class AgoraTransport implements CallTransport {
  private onJoined?: (uid: string) => void;
  private onLeft?: (uid: string) => void;

  constructor(private readonly getCredentials?: CredentialsProvider) {}

  async join(channel: string, _opts: { video: boolean }): Promise<void> {
    if (!this.getCredentials) {
      // Point d'intégration explicite : à la migration UI, injecter le provider
      // (fetchAgoraCredentials). Aujourd'hui l'UI passe encore par useAgora.
      throw new Error(
        '[AgoraTransport] join : fournir un CredentialsProvider (fetchAgoraCredentials) au moment de brancher CallTransport dans l\'UI.'
      );
    }
    const creds = await this.getCredentials(channel);
    await agoraService.initialize({ appId: creds.appId, appCertificate: '' });
    await agoraService.joinChannel({ channel, uid: creds.uid, token: creds.token, role: 'publisher' });
  }

  async leave(): Promise<void> {
    await agoraService.leaveChannel();
  }

  playLocal(el: HTMLElement): void {
    agoraService.playLocalVideo(el);
  }

  playRemote(uid: string, el: HTMLElement): void {
    agoraService.playRemoteVideo(uid, el);
  }

  toggleMute(): Promise<boolean> {
    return agoraService.toggleMicrophone();
  }

  toggleVideo(): Promise<boolean> {
    return agoraService.toggleCamera();
  }

  onRemoteJoined(cb: (uid: string) => void): void {
    this.onJoined = cb;
    this.applyCallbacks();
  }

  onRemoteLeft(cb: (uid: string) => void): void {
    this.onLeft = cb;
    this.applyCallbacks();
  }

  // setEventCallbacks remplace TOUT le bloc → on repose les deux callbacks ensemble.
  private applyCallbacks(): void {
    agoraService.setEventCallbacks({
      onUserJoined: (u) => this.onJoined?.(String(u.uid)),
      onUserLeft: (uid) => this.onLeft?.(String(uid)),
    });
  }
}

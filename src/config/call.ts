/**
 * ☎️ Sélection du transport d'appel (préparation à la bascule WebRTC).
 * Aujourd'hui TOUJOURS 'agora'. Quand WebRTCTransport sera prêt, poser
 * VITE_CALL_PROVIDER=webrtc suffira à basculer — SANS toucher l'UI (elle passe
 * par CallTransport). Même logique que VITE_REALTIME_PROVIDER pour le tracking.
 */
export type CallProvider = 'agora' | 'webrtc';

export const callProvider: CallProvider =
  String(import.meta.env.VITE_CALL_PROVIDER || '').toLowerCase() === 'webrtc' ? 'webrtc' : 'agora';

export const isWebRTCCall = callProvider === 'webrtc';

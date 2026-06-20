/**
 * 🔌 PROVIDER WEBRTC - 224SOLUTIONS
 * Source UNIQUE de vérité pour l'état d'appel WebRTC.
 * Instancie le hook UNE SEULE FOIS et expose le contexte + overlay global.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useWebRTCAudioCall, WebRTCCallState, WebRTCCallActions } from '@/hooks/useWebRTCAudioCall';
import WebRTCAudioCall from './WebRTCAudioCall';

interface WebRTCCallContextType {
  callState: WebRTCCallState;
  startCall: WebRTCCallActions['startCall'];
  acceptCall: WebRTCCallActions['acceptCall'];
  rejectCall: WebRTCCallActions['rejectCall'];
  endCall: WebRTCCallActions['endCall'];
  toggleMute: WebRTCCallActions['toggleMute'];
  toggleVideo: WebRTCCallActions['toggleVideo'];
}

const WebRTCCallContext = createContext<WebRTCCallContextType | null>(null);

/**
 * Hook à utiliser dans TOUS les composants qui ont besoin de l'état d'appel.
 * NE PAS utiliser useWebRTCAudioCall() directement dans les composants.
 */
export function useWebRTCCallContext() {
  const context = useContext(WebRTCCallContext);
  if (!context) {
    // Retourner un état inactif au lieu de throw (pour les composants hors provider)
    return {
      callState: {
        isInCall: false,
        isCalling: false,
        isReceivingCall: false,
        isConnected: false,
        isMuted: false,
        callDuration: 0,
        remoteUserId: null,
        remoteUserInfo: null,
        connectionState: null,
        iceConnectionState: null,
        callMode: 'audio',
        isVideoEnabled: false,
        localStream: null,
        remoteStream: null,
      },
      startCall: async () => { console.warn('WebRTCCallProvider not mounted'); },
      acceptCall: async () => {},
      rejectCall: () => {},
      endCall: () => {},
      toggleMute: () => {},
      toggleVideo: () => {},
    } as WebRTCCallContextType;
  }
  return context;
}

interface WebRTCCallProviderProps {
  children: ReactNode;
}

export default function WebRTCCallProvider({ children }: WebRTCCallProviderProps) {
  // SEULE instance du hook dans toute l'app
  const webrtcCall = useWebRTCAudioCall();

  return (
    <WebRTCCallContext.Provider value={webrtcCall}>
      {children}
      {/* Overlay d'appel global - utilise le contexte, pas un nouveau hook */}
      <WebRTCAudioCall />
    </WebRTCCallContext.Provider>
  );
}

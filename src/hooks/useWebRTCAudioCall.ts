/**
 * 🎤 HOOK WEBRTC AUDIO CALL - 224SOLUTIONS
 * Appels audio 1-to-1 WebRTC natif sans Agora
 * Compatible réseaux mobiles africains
 *
 * ARCHITECTURE:
 * - Ce hook est instancié UNE SEULE FOIS dans WebRTCCallProvider.
 * - Tous les composants utilisent useWebRTCCallContext().
 * - Signalisation: UN seul canal par utilisateur (webrtc-signal-{userId}).
 *   Tous les messages (offer, answer, ICE, reject, end) transitent par
 *   le canal personnel du DESTINATAIRE. Pas de canal pair, pas de canal
 *   temporaire, pas de délai artificiel.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// ─── ICE SERVERS ───
// STUN (toujours présent, gratuit)
const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Construit la liste ICE dynamiquement.
 * TURN est chargé depuis une configuration runtime locale pour éviter
 * d'embarquer des identifiants sensibles dans le bundle frontend.
 * Si elle est absente → STUN seul (fonctionne pour ~80% des cas).
 */
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [...STUN_SERVERS];

  const turnUrl = typeof window !== 'undefined' ? window.sessionStorage.getItem('vf_turn_url') : null;
  const turnUser = typeof window !== 'undefined' ? window.sessionStorage.getItem('vf_turn_username') : null;
  const turnCred = typeof window !== 'undefined' ? window.sessionStorage.getItem('vf_turn_credential') : null;

  if (turnUrl && turnUser && turnCred) {
    // Ajouter le TURN principal
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnCred,
    });
    // Ajouter aussi en TCP/443 si c'est un turn: classique
    if (turnUrl.startsWith('turn:') && !turnUrl.includes('?transport=')) {
      servers.push({
        urls: `${turnUrl}?transport=tcp`,
        username: turnUser,
        credential: turnCred,
      });
      // Version turns: (TLS) sur 443
      const turnsUrl = turnUrl.replace('turn:', 'turns:').replace(/:3478$/, ':443');
      servers.push({
        urls: turnsUrl,
        username: turnUser,
        credential: turnCred,
      });
    }
    console.log('🔒 TURN server configured');
  } else {
    console.warn(
      '⚠️ TURN non configuré — les appels ne fonctionneront pas sur les réseaux à NAT symétrique (4G/entreprise).\n' +
      'Injectez vf_turn_url, vf_turn_username et vf_turn_credential en configuration runtime si nécessaire.\n' +
      'Voir https://github.com/coturn/coturn pour un serveur TURN auto-hébergé.'
    );
  }

  return servers;
}

const CALL_TIMEOUT_MS = 30_000;

export type CallMode = 'audio' | 'video';

export interface WebRTCCallState {
  isInCall: boolean;
  isCalling: boolean;
  isReceivingCall: boolean;
  isConnected: boolean;
  isMuted: boolean;
  callDuration: number;
  remoteUserId: string | null;
  remoteUserInfo: { name: string; avatar?: string } | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  // ─── Vidéo ───
  callMode: CallMode;
  isVideoEnabled: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export interface WebRTCCallActions {
  startCall: (userId: string, userInfo?: { name: string; avatar?: string }, mode?: CallMode) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

type SignalingEventType = 'call-offer' | 'call-answer' | 'ice-candidate' | 'call-rejected' | 'call-ended';

interface SignalingMessage {
  type: SignalingEventType;
  from: string;
  to: string;
  payload: any;
  userInfo?: { name: string; avatar?: string };
  media?: CallMode;
  timestamp: number;
}

const RINGTONE_FREQUENCY = 440;
const RING_DURATION = 1000;
const RING_PAUSE = 2000;

const INITIAL_CALL_STATE: WebRTCCallState = {
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
};

export function useWebRTCAudioCall() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [callState, setCallState] = useState<WebRTCCallState>(INITIAL_CALL_STATE);

  // Refs WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offerRetryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastOfferRef = useRef<{ offer: RTCSessionDescriptionInit; userInfo: any; mode: CallMode } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteUserIdRef = useRef<string | null>(null);
  const callModeRef = useRef<CallMode>('audio');
  const iceServersRef = useRef<RTCIceServer[]>(buildIceServers());

  // Ref pour le canal de signalisation personnel (persistant)
  const myChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Canaux d'envoi persistants par destinataire (réutilisés pendant tout l'appel)
  const senderChannelsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());

  // Sync ref ↔ state
  useEffect(() => {
    remoteUserIdRef.current = callState.remoteUserId;
  }, [callState.remoteUserId]);

  // ─── Sonnerie ───
  const playRingtone = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      const playBeep = () => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = RINGTONE_FREQUENCY;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + RING_DURATION / 1000);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + RING_DURATION / 1000);
        } catch { /* AudioContext suspended */ }
      };

      playBeep();
      ringtoneIntervalRef.current = setInterval(playBeep, RING_PAUSE);
    } catch (err) {
      console.warn('Impossible de jouer la sonnerie:', err);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  }, []);

  // ─── Durée d'appel ───
  const startCallDuration = useCallback(() => {
    setCallState(prev => ({ ...prev, callDuration: 0 }));
    callDurationIntervalRef.current = setInterval(() => {
      setCallState(prev => ({ ...prev, callDuration: prev.callDuration + 1 }));
    }, 1000);
  }, []);

  const stopCallDuration = useCallback(() => {
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
  }, []);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  const clearOfferRetry = useCallback(() => {
    if (offerRetryIntervalRef.current) {
      clearInterval(offerRetryIntervalRef.current);
      offerRetryIntervalRef.current = null;
    }
  }, []);

  // ─── Envoyer un message au canal du DESTINATAIRE ───
  // Le canal est PERSISTANT (mis en cache) pour toute la durée de l'appel :
  // on ne le recrée pas à chaque candidat ICE (sinon perte de signalisation).
  const sendToUser = useCallback(async (targetUserId: string, message: SignalingMessage) => {
    const targetChannelName = `webrtc-signal-${targetUserId}`;

    try {
      let ch = senderChannelsRef.current.get(targetUserId);

      if (!ch) {
        ch = supabase.channel(targetChannelName, {
          config: { broadcast: { self: false } },
        });
        senderChannelsRef.current.set(targetUserId, ch);

        // Subscribe UNE seule fois, attendre que le canal soit joint
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Channel join timeout')), 8000);
          ch!.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timeout);
              resolve();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(timeout);
              reject(new Error(`Channel ${status}`));
            }
          });
        });
      }

      await ch.send({
        type: 'broadcast',
        event: 'webrtc',
        payload: message,
      });
    } catch (err) {
      console.error('❌ Erreur envoi signalisation vers', targetUserId, err);
      // Retirer le canal défaillant du cache pour pouvoir le recréer proprement
      const bad = senderChannelsRef.current.get(targetUserId);
      if (bad) {
        try { bad.unsubscribe(); } catch { /* noop */ }
        senderChannelsRef.current.delete(targetUserId);
      }
    }
  }, []);

  // ─── Nettoyage complet ───
  const cleanup = useCallback(() => {
    stopRingtone();
    stopCallDuration();
    clearCallTimeout();
    clearOfferRetry();
    lastOfferRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    remoteUserIdRef.current = null;

    // Fermer les canaux d'envoi persistants
    senderChannelsRef.current.forEach((ch) => {
      try { ch.unsubscribe(); } catch { /* noop */ }
    });
    senderChannelsRef.current.clear();

    setCallState(INITIAL_CALL_STATE);
  }, [stopRingtone, stopCallDuration, clearCallTimeout, clearOfferRetry]);

  // ─── Créer la connexion peer ───
  const createPeerConnection = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserIdRef.current && user?.id) {
        const c = event.candidate;
        console.log('🧊➡️ Envoi ICE candidate:', c.type, c.protocol, '→', remoteUserIdRef.current);
        sendToUser(remoteUserIdRef.current, {
          type: 'ice-candidate',
          from: user.id,
          to: remoteUserIdRef.current,
          payload: c.toJSON(),
          timestamp: Date.now(),
        });
      } else if (!event.candidate) {
        console.log('🧊 Fin de gathering ICE (toutes les candidates envoyées)');
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering:', pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log('📶 Signaling state:', pc.signalingState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🔗 ICE:', pc.iceConnectionState);
      setCallState(prev => ({ ...prev, iceConnectionState: pc.iceConnectionState }));

      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallState(prev => ({ ...prev, isConnected: true, isCalling: false }));
        startCallDuration();
        stopRingtone();
        clearCallTimeout();
      } else if (pc.iceConnectionState === 'failed') {
        toast({
          title: "❌ Connexion échouée",
          description: "Impossible d'établir la connexion audio. Vérifiez votre réseau.",
          variant: "destructive",
        });
        cleanup();
      } else if (pc.iceConnectionState === 'disconnected') {
        toast({
          title: "⚠️ Connexion instable",
          description: "Tentative de reconnexion...",
        });
        setTimeout(() => {
          if (peerConnectionRef.current?.iceConnectionState === 'disconnected') {
            toast({
              title: "❌ Appel perdu",
              description: "La connexion a été perdue",
              variant: "destructive",
            });
            cleanup();
          }
        }, 10_000);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection:', pc.connectionState);
      setCallState(prev => ({ ...prev, connectionState: pc.connectionState }));
      if (pc.connectionState === 'failed') {
        cleanup();
      }
    };

    pc.ontrack = (event) => {
      console.log('🎵 Remote track received:', event.track.kind);
      remoteStreamRef.current = event.streams[0];
      // Exposer le flux distant à l'UI (pour <video>/<audio>)
      setCallState(prev => ({ ...prev, remoteStream: event.streams[0] }));
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }
      remoteAudioRef.current.srcObject = event.streams[0];
      remoteAudioRef.current.play().catch(() => {
        console.warn('Auto-play bloqué');
      });
    };

    return pc;
  }, [user?.id, sendToUser, startCallDuration, stopRingtone, clearCallTimeout, cleanup, toast]);

  // ─── Obtenir le flux local (micro + caméra si vidéo) ───
  const getLocalStream = useCallback(async (withVideo: boolean, silent = false): Promise<MediaStream> => {
    // ⚠️ getUserMedia n'existe que sur un contexte sécurisé (HTTPS ou localhost).
    // Sur http://<IP locale>, navigator.mediaDevices est undefined → message clair.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      if (!silent) {
        toast({
          title: "❌ Appels indisponibles ici",
          description:
            "Les appels nécessitent HTTPS ou localhost. Sur une IP locale (http://192.168…), le navigateur bloque le micro et la caméra. Ouvre l'app via https:// ou http://localhost.",
          variant: "destructive",
        });
      }
      throw new Error('getUserMedia indisponible (contexte non sécurisé)');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: withVideo
          ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
          : false,
      });
      localStreamRef.current = stream;
      setCallState(prev => ({
        ...prev,
        localStream: stream,
        isVideoEnabled: withVideo,
      }));
      return stream;
    } catch (err: any) {
      console.error('❌ Erreur média:', err?.name, err?.message, err);
      const device = withVideo ? 'caméra/micro' : 'microphone';
      let message: string;
      switch (err?.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          message = `Accès ${device} refusé. Clique sur l'icône 🔒/caméra dans la barre d'adresse et autorise, puis réessaie.`;
          break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          message = `Aucun ${device} détecté sur cet appareil.`;
          break;
        case 'NotReadableError':
        case 'TrackStartError':
          message = `${device} déjà utilisé par une autre application ou un autre onglet. Ferme-les (et l'autre onglet de test) puis réessaie.`;
          break;
        case 'OverconstrainedError':
          message = `Le ${device} ne supporte pas la configuration demandée.`;
          break;
        case 'SecurityError':
          message = `Accès ${device} bloqué (connexion non sécurisée). Utilise https:// ou http://localhost.`;
          break;
        default:
          message = `Impossible d'accéder à la ${device} (${err?.name || 'erreur inconnue'}).`;
      }
      if (!silent) {
        toast({ title: "❌ Média", description: message, variant: "destructive" });
      }
      throw err;
    }
  }, [toast]);

  // ─── Handlers de signalisation ───
  const handleIceCandidate = useCallback(async (message: SignalingMessage) => {
    if (peerConnectionRef.current?.remoteDescription) {
      console.log('🧊⬅️ Ajout ICE candidate reçue de', message.from);
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(message.payload));
      } catch (e) {
        console.warn('🧊 addIceCandidate échoué:', e);
      }
    } else {
      console.log('🧊⏳ ICE candidate mise en attente (pas encore de remoteDescription)');
      pendingIceCandidatesRef.current.push(message.payload);
    }
  }, []);

  const flushPendingCandidates = useCallback(async () => {
    if (!peerConnectionRef.current?.remoteDescription) return;
    for (const candidate of pendingIceCandidatesRef.current) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingIceCandidatesRef.current = [];
  }, []);

  const handleCallAnswer = useCallback(async (message: SignalingMessage) => {
    console.log('✅ Answer reçue');
    clearCallTimeout();
    clearOfferRetry(); // le destinataire a répondu → stop la réémission de l'offre
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.payload));
      await flushPendingCandidates();
    }
    stopRingtone();
  }, [stopRingtone, clearCallTimeout, clearOfferRetry, flushPendingCandidates]);

  const handleCallRejected = useCallback(() => {
    toast({ title: "📵 Appel refusé", description: "L'utilisateur a refusé votre appel" });
    cleanup();
  }, [toast, cleanup]);

  const handleCallEnded = useCallback(() => {
    toast({ title: "📞 Appel terminé", description: "L'appel a pris fin" });
    cleanup();
  }, [toast, cleanup]);

  // ─── Gérer un appel entrant ───
  const handleIncomingCall = useCallback(async (message: SignalingMessage) => {
    console.log('📞 Appel entrant de:', message.from);

    // Offre dupliquée du MÊME appelant (réémission) → ne PAS rejeter.
    // Si j'ai DÉJÀ répondu (answer posée), la réponse a pu se perdre → la renvoyer.
    // Sinon, la sonnerie est en cours → ignorer simplement.
    if (remoteUserIdRef.current === message.from) {
      const existingPc = peerConnectionRef.current;
      if (existingPc?.localDescription?.type === 'answer' && user?.id) {
        console.log('🔁 Re-envoi de la réponse (offre dupliquée reçue)');
        sendToUser(message.from, {
          type: 'call-answer',
          from: user.id,
          to: message.from,
          payload: existingPc.localDescription,
          timestamp: Date.now(),
        });
      } else {
        console.log('📞 Offre dupliquée du même appelant, ignorée (sonnerie en cours)');
      }
      return;
    }

    // Réellement occupé avec QUELQU'UN D'AUTRE → rejeter automatiquement.
    if (peerConnectionRef.current) {
      console.log('📞 Occupé (autre appel), rejet auto');
      sendToUser(message.from, {
        type: 'call-rejected',
        from: user?.id || '',
        to: message.from,
        payload: null,
        timestamp: Date.now(),
      });
      return;
    }

    const incomingMode: CallMode = message.media === 'video' ? 'video' : 'audio';
    callModeRef.current = incomingMode;

    setCallState(prev => ({
      ...prev,
      isReceivingCall: true,
      isInCall: true,
      callMode: incomingMode,
      remoteUserId: message.from,
      remoteUserInfo: message.userInfo || { name: 'Utilisateur' },
    }));
    remoteUserIdRef.current = message.from;
    pendingIceCandidatesRef.current = [];

    // Créer la peer connection et appliquer l'offre distante
    const pc = createPeerConnection();
    peerConnectionRef.current = pc;
    await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
    await flushPendingCandidates();

    playRingtone();

    // Auto-timeout
    callTimeoutRef.current = setTimeout(() => {
      if (peerConnectionRef.current && !callState.isConnected) {
        toast({
          title: "📞 Appel manqué",
          description: `Appel de ${message.userInfo?.name || 'Utilisateur'}`,
        });
        cleanup();
      }
    }, CALL_TIMEOUT_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, createPeerConnection, playRingtone, cleanup, toast, sendToUser, flushPendingCandidates]);

  // ═══════════ ACTIONS PUBLIQUES ═══════════

  const startCall = useCallback(async (
    userId: string,
    userInfo?: { name: string; avatar?: string },
    mode: CallMode = 'audio'
  ) => {
    if (!user?.id) {
      toast({ title: "❌ Non connecté", description: "Connectez-vous d'abord", variant: "destructive" });
      return;
    }
    if (peerConnectionRef.current) {
      toast({ title: "⚠️ Appel en cours", description: "Terminez l'appel en cours d'abord" });
      return;
    }

    try {
      console.log('📞 Appel vers:', userId, 'mode:', mode);
      callModeRef.current = mode;

      setCallState(prev => ({
        ...prev,
        isCalling: true,
        isInCall: true,
        callMode: mode,
        remoteUserId: userId,
        remoteUserInfo: userInfo || { name: 'Utilisateur' },
      }));
      remoteUserIdRef.current = userId;

      // Obtenir l'accès média AVANT de créer l'offre, avec repli vidéo → audio.
      let stream: MediaStream;
      let effectiveMode: CallMode = mode;
      try {
        stream = await getLocalStream(mode === 'video', true);
      } catch {
        if (mode === 'video') {
          // Caméra occupée/refusée → tenter audio seul
          try {
            stream = await getLocalStream(false, true);
            effectiveMode = 'audio';
            callModeRef.current = 'audio';
            setCallState(prev => ({ ...prev, callMode: 'audio' }));
            toast({ title: "📷 Caméra indisponible", description: "Appel lancé en audio seul." });
          } catch (e2: any) {
            toast({ title: "❌ Micro/caméra", description: `Impossible d'accéder au micro/caméra (${e2?.name || 'erreur'}).`, variant: "destructive" });
            cleanup();
            return;
          }
        } else {
          toast({ title: "❌ Microphone", description: "Impossible d'accéder au micro. Vérifie les permissions (🩺).", variant: "destructive" });
          cleanup();
          return;
        }
      }

      // Créer la connexion peer
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Ajouter les pistes (audio + vidéo)
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Créer l'offre
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Récupérer les infos du caller
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('id', user.id)
        .single();

      const callerInfo = {
        name: profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Utilisateur'
          : 'Utilisateur',
        avatar: profile?.avatar_url,
      };

      // Envoyer l'offre au canal personnel du destinataire
      const offerMessage: SignalingMessage = {
        type: 'call-offer',
        from: user.id,
        to: userId,
        payload: offer,
        userInfo: callerInfo,
        media: effectiveMode,
        timestamp: Date.now(),
      };
      await sendToUser(userId, offerMessage);

      // 🔁 RÉ-ÉMISSION : le broadcast Realtime n'a pas de garantie de livraison.
      // On réémet l'offre toutes les 2 s jusqu'à ce que le destinataire réponde
      // (= remoteDescription posée) ou que l'appel se termine. Côté destinataire,
      // les offres dupliquées du même appelant sont ignorées (idempotent).
      lastOfferRef.current = { offer, userInfo: callerInfo, mode };
      clearOfferRetry();
      offerRetryIntervalRef.current = setInterval(() => {
        const pc2 = peerConnectionRef.current;
        // Arrêter si l'appel n'est plus en cours OU si la réponse est arrivée
        if (!pc2 || pc2.remoteDescription || pc2.connectionState === 'connected') {
          clearOfferRetry();
          return;
        }
        console.log('🔁 Réémission de l\'offre vers', userId);
        sendToUser(userId, { ...offerMessage, timestamp: Date.now() });
      }, 2000);

      playRingtone();

      // 🔔 Push FCM : réveille le destinataire si son app est fermée (mais en ligne).
      // Quand il ouvre l'app, son canal de signalisation se réabonne et l'offre
      // réémise (toutes les 2 s) fait sonner l'appel. Non bloquant.
      import('@/services/pushBackendService')
        .then(({ sendCallNotification }) =>
          sendCallNotification(userId, callerInfo.name, effectiveMode)
        )
        .catch((e) => console.warn('[Call] push notify échoué (non bloquant):', e));

      toast({ title: "📞 Appel en cours...", description: `Appel vers ${userInfo?.name || 'Utilisateur'}` });

      // Timeout
      callTimeoutRef.current = setTimeout(() => {
        if (!peerConnectionRef.current || peerConnectionRef.current.connectionState !== 'connected') {
          toast({ title: "📵 Pas de réponse", description: `${userInfo?.name || 'L\'utilisateur'} ne répond pas` });
          sendToUser(userId, {
            type: 'call-ended',
            from: user.id,
            to: userId,
            payload: null,
            timestamp: Date.now(),
          });
          cleanup();
        }
      }, CALL_TIMEOUT_MS);

    } catch (err) {
      console.error('❌ Erreur démarrage appel:', err);
      toast({ title: "❌ Erreur", description: "Impossible de démarrer l'appel", variant: "destructive" });
      cleanup();
    }
  }, [user?.id, toast, getLocalStream, createPeerConnection, sendToUser, playRingtone, cleanup, clearOfferRetry]);

  const acceptCall = useCallback(async () => {
    if (!peerConnectionRef.current || !user?.id || !remoteUserIdRef.current) return;

    try {
      console.log('✅ Acceptation appel, mode:', callModeRef.current);
      stopRingtone();
      clearCallTimeout();

      // 🎯 Obtention du média avec REPLIS pour que le décrochage réussisse même
      // si la caméra/micro est occupé (cas fréquent : test sur une seule machine,
      // la caméra ne peut pas être ouverte par 2 navigateurs en même temps).
      let stream: MediaStream | null = null;
      try {
        // 1) Tentative dans le mode demandé (vidéo ou audio)
        stream = await getLocalStream(callModeRef.current === 'video', true);
      } catch {
        if (callModeRef.current === 'video') {
          // 2) Caméra indisponible → bascule en audio seul
          try {
            stream = await getLocalStream(false, true);
            toast({
              title: "📷 Caméra indisponible",
              description: "Décrochage en audio seul (ta caméra est occupée ou refusée). Tu vois quand même la vidéo de l'autre.",
            });
          } catch {
            stream = null;
          }
        }
      }

      if (!stream) {
        // 3) Aucun média local → on décroche quand même en RÉCEPTION SEULE
        //    (tu entends/vois l'autre, mais il ne te reçoit pas).
        toast({
          title: "🔇 Micro/caméra indisponible",
          description: "Décrochage en réception seule. Ferme les autres apps/onglets qui utilisent le micro/la caméra pour parler à ton tour.",
          variant: "destructive",
        });
        // Garantir une m-line pour recevoir l'audio même sans piste locale
        try {
          peerConnectionRef.current.addTransceiver('audio', { direction: 'recvonly' });
          if (callModeRef.current === 'video') {
            peerConnectionRef.current.addTransceiver('video', { direction: 'recvonly' });
          }
        } catch { /* déjà négocié */ }
      } else {
        stream.getTracks().forEach(track => peerConnectionRef.current?.addTrack(track, stream!));
      }

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Envoyer l'answer au canal personnel de l'appelant
      await sendToUser(remoteUserIdRef.current, {
        type: 'call-answer',
        from: user.id,
        to: remoteUserIdRef.current,
        payload: answer,
        timestamp: Date.now(),
      });

      setCallState(prev => ({ ...prev, isReceivingCall: false, isInCall: true }));
      toast({ title: "📞 Appel accepté", description: "Connexion en cours..." });

    } catch (err) {
      console.error('❌ Erreur acceptation:', err);
      toast({ title: "❌ Erreur", description: "Impossible d'accepter l'appel", variant: "destructive" });
      cleanup();
    }
  }, [user?.id, stopRingtone, clearCallTimeout, getLocalStream, sendToUser, toast, cleanup]);

  const rejectCall = useCallback(() => {
    if (!user?.id || !remoteUserIdRef.current) return;

    sendToUser(remoteUserIdRef.current, {
      type: 'call-rejected',
      from: user.id,
      to: remoteUserIdRef.current,
      payload: null,
      timestamp: Date.now(),
    });

    toast({ title: "📵 Appel refusé" });
    cleanup();
  }, [user?.id, sendToUser, toast, cleanup]);

  const endCall = useCallback(() => {
    if (user?.id && remoteUserIdRef.current) {
      sendToUser(remoteUserIdRef.current, {
        type: 'call-ended',
        from: user.id,
        to: remoteUserIdRef.current,
        payload: null,
        timestamp: Date.now(),
      });
    }
    toast({ title: "📞 Appel terminé" });
    cleanup();
  }, [user?.id, sendToUser, toast, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setCallState(prev => ({ ...prev, isMuted: !track.enabled }));
      }
    }
  }, []);

  // ─── Activer/couper la caméra ───
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setCallState(prev => ({ ...prev, isVideoEnabled: track.enabled }));
      }
    }
  }, []);

  // ═══════════ CANAL PERSONNEL PERSISTANT ═══════════
  // Chaque utilisateur connecté écoute sur `webrtc-signal-{userId}`.
  // TOUS les messages (offer, answer, ICE, reject, end) arrivent ici.
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `webrtc-signal-${user.id}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'webrtc' }, async ({ payload }: { payload: SignalingMessage }) => {
      // Vérification de sécurité : le message doit être adressé à moi
      if (payload.to !== user.id) return;

      console.log('📨 Signal reçu:', payload.type, 'de', payload.from);

      switch (payload.type) {
        case 'call-offer':
          await handleIncomingCall(payload);
          break;
        case 'call-answer':
          await handleCallAnswer(payload);
          break;
        case 'ice-candidate':
          await handleIceCandidate(payload);
          break;
        case 'call-rejected':
          handleCallRejected();
          break;
        case 'call-ended':
          handleCallEnded();
          break;
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('📡 Canal signalisation prêt:', channelName);
      }
    });

    myChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
      myChannelRef.current = null;
    };
  }, [user?.id, handleIncomingCall, handleCallAnswer, handleIceCandidate, handleCallRejected, handleCallEnded]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    callState,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}

export default useWebRTCAudioCall;

/**
 * 🎤📹 OVERLAY D'APPEL WEBRTC (AUDIO + VIDÉO) - 224SOLUTIONS
 * Utilise le CONTEXTE global (pas son propre hook).
 * Affiché automatiquement par WebRTCCallProvider quand un appel est actif.
 */

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWebRTCCallContext } from './WebRTCCallProvider';
import {
  Phone,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Wifi,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WebRTCAudioCall() {
  // UTILISE LE CONTEXTE — pas useWebRTCAudioCall() directement
  const {
    callState,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useWebRTCCallContext();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const isVideo = callState.callMode === 'video';

  // Attacher les flux aux éléments <video>
  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && callState.remoteStream) {
      remoteVideoRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionColor = () => {
    switch (callState.iceConnectionState) {
      case 'connected':
      case 'completed':
        return 'text-[#ff4000]';
      case 'checking':
      case 'new':
        return 'text-[#ff4000]';
      case 'disconnected':
      case 'failed':
        return 'text-[#ff4000]';
      default:
        return 'text-muted-foreground';
    }
  };

  const getConnectionText = () => {
    switch (callState.iceConnectionState) {
      case 'connected':
      case 'completed':
        return 'Connecté';
      case 'checking':
        return 'Connexion...';
      case 'new':
        return 'Initialisation';
      case 'disconnected':
        return 'Reconnexion...';
      case 'failed':
        return 'Échec';
      default:
        return 'En attente';
    }
  };

  // Ne rien afficher si pas d'appel
  if (!callState.isInCall && !callState.isReceivingCall && !callState.isCalling) {
    return null;
  }

  const modeLabel = isVideo ? 'Appel vidéo' : 'Appel vocal';

  // Miniature vidéo locale (caméra de l'utilisateur) — réutilisée dans tous les écrans
  const LocalPreview = ({ small = true }: { small?: boolean }) =>
    isVideo && callState.localStream ? (
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          'rounded-xl object-cover bg-black shadow-lg',
          small ? 'absolute bottom-24 right-4 w-28 h-40 z-10 border-2 border-white/30' : 'w-full h-48'
        )}
      />
    ) : null;

  // ─── Écran d'appel entrant ───
  if (callState.isReceivingCall && !callState.isConnected) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 relative">
              <div className="absolute inset-0 bg-[#ff4000]/20 rounded-full animate-ping" />
              {isVideo ? (
                <Video className="w-12 h-12 text-[#ff4000] mx-auto relative animate-bounce" />
              ) : (
                <Phone className="w-12 h-12 text-[#ff4000] mx-auto relative animate-bounce" />
              )}
            </div>
            <CardTitle className="text-xl">{isVideo ? 'Appel vidéo entrant' : 'Appel entrant'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <Avatar className="w-24 h-24 mx-auto mb-4 ring-4 ring-[#ff4000]/30">
                <AvatarImage src={callState.remoteUserInfo?.avatar} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {callState.remoteUserInfo?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-2xl font-semibold">{callState.remoteUserInfo?.name}</h3>
              <p className="text-muted-foreground">{modeLabel}</p>
            </div>

            <div className="flex gap-4 justify-center">
              <Button
                onClick={acceptCall}
                size="lg"
                className="bg-[#ff4000] hover:bg-[#ff4000] rounded-full w-16 h-16"
              >
                {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </Button>
              <Button
                onClick={rejectCall}
                variant="destructive"
                size="lg"
                className="rounded-full w-16 h-16"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Écran d'appel sortant ───
  if (callState.isCalling && !callState.isConnected) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center pb-2">
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              {isVideo ? 'Appel vidéo...' : 'Appel en cours...'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isVideo && callState.localStream ? (
              <LocalPreview small={false} />
            ) : (
              <div className="text-center">
                <Avatar className="w-24 h-24 mx-auto mb-4">
                  <AvatarImage src={callState.remoteUserInfo?.avatar} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {callState.remoteUserInfo?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            <div className="text-center">
              <h3 className="text-2xl font-semibold">{callState.remoteUserInfo?.name}</h3>
              <p className="text-muted-foreground animate-pulse">Sonnerie...</p>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={endCall}
                variant="destructive"
                size="lg"
                className="rounded-full w-16 h-16"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Écran d'appel connecté : VIDÉO ───
  if (isVideo) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
        {/* Vidéo distante plein écran (son géré par l'élément audio dédié → muted ici) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover bg-black"
        />

        {/* Miniature locale */}
        <LocalPreview small />

        {/* Bandeau infos en haut */}
        <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent text-white">
          <div>
            <h3 className="text-lg font-semibold">{callState.remoteUserInfo?.name}</h3>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono">{formatDuration(callState.callDuration)}</span>
              <Wifi className={cn('w-3.5 h-3.5 ml-2', getConnectionColor())} />
              <span>{getConnectionText()}</span>
            </div>
          </div>
        </div>

        {/* Contrôles en bas */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center gap-5 p-6 bg-gradient-to-t from-black/70 to-transparent">
          <Button
            onClick={toggleMute}
            variant={callState.isMuted ? 'destructive' : 'secondary'}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>
          <Button
            onClick={toggleVideo}
            variant={callState.isVideoEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {callState.isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </Button>
          <Button
            onClick={endCall}
            variant="destructive"
            size="lg"
            className="rounded-full w-14 h-14"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </div>
    );
  }

  // ─── Écran d'appel connecté : AUDIO ───
  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto bg-slate-800/50 border-slate-700">
        <CardHeader className="text-center pb-2">
          <CardTitle className="flex items-center justify-center gap-2 text-white">
            <Phone className="w-5 h-5 text-[#ff4000]" />
            Appel en cours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="relative inline-block">
              <Avatar className="w-28 h-28 mx-auto mb-4 ring-4 ring-[#ff4000]/30">
                <AvatarImage src={callState.remoteUserInfo?.avatar} />
                <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                  {callState.remoteUserInfo?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "absolute bottom-4 right-0 w-5 h-5 rounded-full border-2 border-slate-800",
                callState.isConnected ? "bg-[#ff4000]" : "bg-[#ff4000] animate-pulse"
              )} />
            </div>
            <h3 className="text-2xl font-semibold text-white">{callState.remoteUserInfo?.name}</h3>
            <p className="text-slate-400">{modeLabel}</p>
          </div>

          <div className="flex justify-center items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-white">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="font-mono text-lg">{formatDuration(callState.callDuration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className={cn("w-4 h-4", getConnectionColor())} />
              <span className={getConnectionColor()}>{getConnectionText()}</span>
            </div>
          </div>

          <div className="text-center">
            <Badge
              variant={callState.isConnected ? "default" : "secondary"}
              className={cn(
                "text-sm",
                callState.isConnected ? "bg-[#ff4000]" : "bg-[#ff4000]"
              )}
            >
              {callState.isConnected ? 'Connecté' : 'Connexion...'}
            </Badge>
            {/* Diagnostic technique (utile tant que l'appel ne se connecte pas) */}
            {!callState.isConnected && (
              <p className="mt-2 text-[10px] font-mono text-slate-400">
                ice: {callState.iceConnectionState || 'null'} · conn: {callState.connectionState || 'null'}
                {' · '}local: {callState.localStream ? 'oui' : 'non'} · distant: {callState.remoteStream ? 'oui' : 'non'}
              </p>
            )}
          </div>

          <div className="flex justify-center gap-6 pt-4">
            <div className="text-center">
              <Button
                onClick={toggleMute}
                variant={callState.isMuted ? "destructive" : "secondary"}
                size="lg"
                className="rounded-full w-16 h-16 mb-2"
              >
                {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </Button>
              <p className="text-xs text-slate-400">
                {callState.isMuted ? 'Muet' : 'Micro'}
              </p>
            </div>

            <div className="text-center">
              <Button
                onClick={endCall}
                variant="destructive"
                size="lg"
                className="rounded-full w-16 h-16 mb-2"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
              <p className="text-xs text-slate-400">Fin</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

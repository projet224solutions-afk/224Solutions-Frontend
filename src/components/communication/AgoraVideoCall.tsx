/**
 * 🎥 COMPOSANT APPEL VIDÉO AGORA - 224SOLUTIONS
 * Interface complète pour les appels vidéo avec Agora
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAgora } from '@/hooks/useAgora';
import { useAuth } from '@/hooks/useAuth';
import { agoraService, RemoteUser } from '@/services/agoraService';
import {
  Phone,
  Video,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Wifi,
  Clock
} from 'lucide-react';

interface AgoraVideoCallProps {
  channel: string;
  isIncoming?: boolean;
  callerInfo?: {
    name: string;
    avatar?: string;
    userId?: string;
  };
  onCallEnd?: () => void;
}

export default function AgoraVideoCall({
  channel,
  isIncoming = false,
  callerInfo,
  onCallEnd
}: AgoraVideoCallProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { callState, joinCall, toggleMute, toggleVideo, endCall } = useAgora();

  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Configurer les callbacks pour les utilisateurs distants
  useEffect(() => {
    agoraService.setEventCallbacks({
      onUserJoined: (user) => {
        console.log('👤 Utilisateur rejoint:', user.uid);
        setRemoteUsers(agoraService.getRemoteUsers());
        // Le (re)play de la vidéo distante est géré de façon FIABLE par le
        // useEffect [remoteUsers] ci-dessous (déclenché à chaque user-published,
        // donc dès que le videoTrack distant est disponible).
      },
      onUserLeft: (uid) => {
        console.log('👤 Utilisateur parti:', uid);
        setRemoteUsers(agoraService.getRemoteUsers());
      }
    });

    return () => {
      agoraService.setEventCallbacks({});
    };
  }, []);

  // Démarrer l'appel automatiquement
  useEffect(() => {
    if (!isIncoming && channel) {
      console.log('🎥 AgoraVideoCall: Démarrage automatique pour channel:', channel);
      handleJoinCall();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, isIncoming]);

  // Gestion de la durée d'appel
  useEffect(() => {
    if (callState.isInCall) {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callState.isInCall]);

  // ▶️ (Re)joue la vidéo DISTANTE de façon FIABLE dès qu'un flux distant avec vidéo
  // est disponible. Déclenché à chaque mise à jour de remoteUsers (donc à chaque
  // user-published), ce qui couvre le cas où le play initial arrive avant que le
  // track/DOM soit prêt. Le conteneur remoteVideoRef est VIDE → Agora en garde le
  // contrôle exclusif (plus d'écran noir au re-render).
  useEffect(() => {
    if (remoteUsers.length > 0 && remoteVideoRef.current) {
      const remote = remoteUsers.find((u) => u.videoTrack);
      if (remote) {
        agoraService.playRemoteVideo(String(remote.uid), remoteVideoRef.current);
      }
    }
  }, [remoteUsers]);

  // ▶️ Joue la vidéo LOCALE quand l'appel est établi ET le conteneur monté (après la
  // fin de l'écran « connexion »). playLocalVideo est idempotent (ne fait rien si le
  // track n'est pas prêt) → pas de setTimeout fragile.
  useEffect(() => {
    if (callState.isInCall && !isConnecting && localVideoRef.current) {
      agoraService.playLocalVideo(localVideoRef.current);
    }
  }, [callState.isInCall, isConnecting]);

  const handleJoinCall = useCallback(async () => {
    console.log('🎥 AgoraVideoCall: handleJoinCall appelé');
    setIsConnecting(true);
    try {
      await joinCall(channel, true);
      console.log('🎥 AgoraVideoCall: Appel rejoint avec succès');
    } catch (error) {
      console.error('🎥 AgoraVideoCall: Erreur rejoindre appel:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [channel, joinCall]);

  const handleEndCall = useCallback(async () => {
    await endCall();
    onCallEnd?.();
  }, [endCall, onCallEnd]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getNetworkQualityColor = (quality: number) => {
    if (quality >= 4) return 'text-[#ff4000]';
    if (quality >= 2) return 'text-[#ff4000]';
    return 'text-[#ff4000]';
  };

  if (isIncoming && !callState.isInCall) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Phone className="w-6 h-6 text-[#ff4000]" />
            Appel entrant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <Avatar className="w-20 h-20 mx-auto mb-4">
              <AvatarImage src={callerInfo?.avatar} />
              <AvatarFallback>
                {callerInfo?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-semibold">{callerInfo?.name}</h3>
            <p className="text-muted-foreground">{t('agoraVideoCall.appelVideo')}</p>
          </div>

          <div className="flex gap-2 justify-center">
            <Button
              onClick={handleJoinCall}
              className="bg-[#ff4000] hover:bg-[#ff4000]"
              disabled={isConnecting}
            >
              <Phone className="w-4 h-4 mr-2" />
              {isConnecting ? 'Connexion...' : 'Accepter'}
            </Button>
            <Button
              onClick={handleEndCall}
              variant="destructive"
            >
              <PhoneOff className="w-4 h-4 mr-2" />
              Refuser
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isConnecting) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>{t('agoraVideoCall.connexionALAppel')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full bg-black rounded-lg overflow-hidden relative min-h-[400px]">
      {/* Interface vidéo principale */}
      <div className="relative w-full h-full">
        {/* Zone vidéo distante : conteneur Agora (VIDE) + overlay séparé, dans un parent relatif */}
        <div className="relative w-full h-full min-h-[400px]">
          {/* Conteneur DÉDIÉ à Agora — VIDE : React n'y met JAMAIS d'enfant JSX,
              donc il ne le re-rend jamais → l'élément <video> injecté par Agora
              reste en place (fini l'écran noir au re-render). */}
          <div
            ref={remoteVideoRef}
            className="w-full h-full bg-gray-900 min-h-[400px]"
          />

          {/* Overlay « en attente » — SÉPARÉ, positionné PAR-DESSUS. Disparaît quand
              la vidéo arrive, SANS jamais toucher au conteneur vidéo. */}
          {remoteUsers.length === 0 && callerInfo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-white">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarImage src={callerInfo.avatar} />
                  <AvatarFallback>
                    {callerInfo.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold">{callerInfo.name}</h3>
                <p className="text-gray-400">
                  {callState.isConnected ? 'En attente de la vidéo...' : 'Connexion en cours...'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Vidéo locale (PiP) : conteneur relatif = placeholder (derrière) + div Agora VIDE (devant) */}
        <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          {/* Placeholder DERRIÈRE (visible tant que la vidéo locale n'est pas jouée) */}
          <div className="absolute inset-0 bg-gray-700 flex items-center justify-center pointer-events-none">
            <Video className="w-8 h-8 text-white" />
          </div>
          {/* Conteneur DÉDIÉ à Agora — VIDE, PAR-DESSUS le placeholder */}
          <div ref={localVideoRef} className="absolute inset-0 w-full h-full" />
        </div>

        {/* Informations d'appel */}
        <div className="absolute top-4 left-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatDuration(callDuration)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className={`w-4 h-4 ${getNetworkQualityColor(callState.networkQuality)}`} />
            <span className="text-sm">
              Qualité: {callState.networkQuality >= 4 ? 'Excellente' :
                       callState.networkQuality >= 2 ? 'Bonne' : 'Faible'}
            </span>
          </div>
        </div>

        {/* Contrôles d'appel */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-full px-6 py-3">
            {/* Microphone */}
            <Button
              onClick={toggleMute}
              variant={callState.isMuted ? "destructive" : "secondary"}
              size="sm"
              className="rounded-full w-12 h-12"
            >
              {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            {/* Vidéo */}
            <Button
              onClick={toggleVideo}
              variant={!callState.isVideoEnabled ? "destructive" : "secondary"}
              size="sm"
              className="rounded-full w-12 h-12"
            >
              {callState.isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>

            {/* Terminer l'appel */}
            <Button
              onClick={handleEndCall}
              variant="destructive"
              size="sm"
              className="rounded-full w-12 h-12"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Statut de connexion */}
        <div className="absolute top-4 right-4">
          <Badge
            variant={callState.isConnected ? "default" : "destructive"}
            className="bg-black/50 text-white"
          >
            {callState.isConnected ? 'Connecté' : 'Déconnecté'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

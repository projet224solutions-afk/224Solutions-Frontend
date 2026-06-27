/**
 * 🎤 COMPOSANT APPEL AUDIO AGORA - 224SOLUTIONS
 * Interface pour les appels vocaux avec Agora
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAgora } from '@/hooks/useAgora';
import { useAuth } from '@/hooks/useAuth';
import {
  Phone,
  Mic,
  MicOff,
  PhoneOff,
  Wifi,
  Clock,
  Volume2,
  VolumeX
} from 'lucide-react';

interface AgoraAudioCallProps {
  channel: string;
  isIncoming?: boolean;
  callerInfo?: {
    name: string;
    avatar?: string;
    userId?: string;
  };
  onCallEnd?: () => void;
}

export default function AgoraAudioCall({
  channel,
  isIncoming = false,
  callerInfo,
  onCallEnd
}: AgoraAudioCallProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { callState, isLoading, joinCall, leaveCall, toggleMute, endCall } = useAgora();

  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Démarrer l'appel automatiquement
  useEffect(() => {
    if (!isIncoming && channel) {
      console.log('🔊 AgoraAudioCall: Démarrage automatique pour channel:', channel);
      handleJoinCall();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, isIncoming]);

  // Gestion de la durée d'appel
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (callState.isInCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState.isInCall]);

  const handleJoinCall = async () => {
    console.log('🔊 AgoraAudioCall: handleJoinCall appelé');
    setIsConnecting(true);
    try {
      await joinCall(channel, false); // Audio seulement
      console.log('🔊 AgoraAudioCall: Appel rejoint avec succès');
    } catch (error) {
      console.error('🔊 AgoraAudioCall: Erreur rejoindre appel:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEndCall = async () => {
    await endCall();
    onCallEnd?.();
  };

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
            <Avatar className="w-24 h-24 mx-auto mb-4">
              <AvatarImage src={callerInfo?.avatar} />
              <AvatarFallback className="text-2xl">
                {callerInfo?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-2xl font-semibold">{callerInfo?.name}</h3>
            <p className="text-muted-foreground">Appel vocal</p>
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
          <p>{t('agoraAudioCall.connexionALAppel')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Phone className="w-6 h-6 text-[#ff4000]" />
          Appel en cours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Informations de l'appelant */}
        <div className="text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4">
            <AvatarImage src={callerInfo?.avatar} />
            <AvatarFallback className="text-2xl">
              {callerInfo?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <h3 className="text-2xl font-semibold">{callerInfo?.name}</h3>
          <p className="text-muted-foreground">Appel vocal</p>
        </div>

        {/* Durée et qualité */}
        <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatDuration(callDuration)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Wifi className={`w-4 h-4 ${getNetworkQualityColor(callState.networkQuality)}`} />
            <span>
              {callState.networkQuality >= 4 ? 'Excellente' :
               callState.networkQuality >= 2 ? 'Bonne' : 'Faible'}
            </span>
          </div>
        </div>

        {/* Statut de connexion */}
        <div className="text-center">
          <Badge
            variant={callState.isConnected ? "default" : "destructive"}
            className="text-sm"
          >
            {callState.isConnected ? 'Connecté' : 'Déconnecté'}
          </Badge>
        </div>

        {/* Contrôles d'appel */}
        <div className="flex justify-center gap-4">
          {/* Microphone */}
          <Button
            onClick={toggleMute}
            variant={callState.isMuted ? "destructive" : "secondary"}
            size="lg"
            className="rounded-full w-16 h-16"
          >
            {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>

          {/* Haut-parleur */}
          <Button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            variant={isSpeakerOn ? "default" : "secondary"}
            size="lg"
            className="rounded-full w-16 h-16"
          >
            {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </Button>

          {/* Terminer l'appel */}
          <Button
            onClick={handleEndCall}
            variant="destructive"
            size="lg"
            className="rounded-full w-16 h-16"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>

        {/* Indicateurs visuels */}
        <div className="flex justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${callState.isMuted ? 'bg-[#ff4000]' : 'bg-[#ff4000]'}`}></div>
          <div className={`w-3 h-3 rounded-full ${isSpeakerOn ? 'bg-[#ff4000]' : 'bg-gray-400'}`}></div>
          <div className={`w-3 h-3 rounded-full ${callState.isConnected ? 'bg-[#ff4000]' : 'bg-[#ff4000]'}`}></div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 🎙️ COMPOSANT D'ENREGISTREMENT VOCAL AVEC TRADUCTION AUTOMATIQUE
 * Enregistre un message vocal, l'envoie et déclenche automatiquement
 * la traduction vers la langue du destinataire
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Send, X, Loader2, Languages, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceMessageWithTranslation } from '@/hooks/useVoiceMessageWithTranslation';
import { cn } from '@/lib/utils';

interface VoiceRecorderWithTranslationProps {
  senderId: string;
  recipientId?: string;
  conversationId?: string;
  onMessageSent?: (messageId: string, audioUrl: string) => void;
  onCancel?: () => void;
  className?: string;
  compact?: boolean;
}

export function VoiceRecorderWithTranslation({
  senderId,
  recipientId,
  conversationId,
  onMessageSent,
  onCancel,
  className,
  compact = false
}: VoiceRecorderWithTranslationProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    sendVoiceMessage,
    isSending,
    translationStatus,
    subscribeToTranslationStatus
  } = useVoiceMessageWithTranslation();

  // Nettoyer l'URL audio précédente
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Formater le temps d'enregistrement
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Détecter iOS/Safari
  const isIOSDevice = useCallback(() => {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  const isSafariBrowser = useCallback(() => {
    return /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|Chrome/i.test(navigator.userAgent);
  }, []);

  // Démarrer l'enregistrement
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // iOS/Safari: utiliser mp4/aac en priorité
      // Autres navigateurs: utiliser webm/opus
      let mimeType: string;

      if (isIOSDevice() || isSafariBrowser()) {
        // iOS Safari supporte uniquement mp4 ou wav
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
        } else {
          // Fallback - iOS peut ne pas supporter MediaRecorder du tout
          console.warn('⚠️ MediaRecorder non supporté sur ce navigateur iOS');
          mimeType = 'audio/mp4'; // Essayer quand même
        }
      } else {
        // Chrome, Firefox, Edge, etc.
        mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';
      }

      console.log('🎙️ Using MIME type:', mimeType, '| iOS:', isIOSDevice(), '| Safari:', isSafariBrowser());

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));

        // Arrêter les pistes audio
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collecter toutes les secondes
      setIsRecording(true);
      setRecordingTime(0);

      // Timer pour afficher la durée
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [isIOSDevice, isSafariBrowser]);

  // Arrêter l'enregistrement
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  // Annuler l'enregistrement
  const cancelRecording = useCallback(() => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    onCancel?.();
  }, [stopRecording, onCancel]);

  // Envoyer le message vocal
  const handleSend = useCallback(async () => {
    if (!audioBlob) return;

    const result = await sendVoiceMessage(audioBlob, {
      senderId,
      recipientId,
      conversationId
    });

    if (result.success && result.messageId) {
      onMessageSent?.(result.messageId, result.audioUrl || '');

      // Écouter les mises à jour de traduction
      if (result.needsTranslation) {
        subscribeToTranslationStatus(result.messageId, (status, data) => {
          console.log('Translation status:', status, data);
        });
      }

      // Réinitialiser
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
    }
  }, [audioBlob, sendVoiceMessage, senderId, recipientId, conversationId, onMessageSent, subscribeToTranslationStatus]);

  // Status de traduction indicator
  const TranslationIndicator = () => {
    if (translationStatus === 'idle') return null;

    return (
      <div className={cn(
        "flex items-center gap-1 text-xs",
        translationStatus === 'pending' && "text-[#ff4000]",
        translationStatus === 'completed' && "text-[#ff4000]",
        translationStatus === 'failed' && "text-[#ff4000]"
      )}>
        {translationStatus === 'pending' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Traduction...</span>
          </>
        )}
        {translationStatus === 'completed' && (
          <>
            <Check className="h-3 w-3" />
            <span>Traduit</span>
          </>
        )}
        {translationStatus === 'failed' && (
          <span>Échec traduction</span>
        )}
      </div>
    );
  };

  // Mode compact (juste le bouton d'enregistrement)
  if (compact && !isRecording && !audioBlob) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={startRecording}
        className={cn("rounded-full", className)}
        title="Enregistrer un message vocal"
      >
        <Mic className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 bg-secondary/50 rounded-full",
      className
    )}>
      {/* État: En cours d'enregistrement */}
      {isRecording && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="rounded-full text-[#ff4000] hover:text-[#ff4000]"
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-3 h-3 rounded-full bg-[#ff4000] animate-pulse" />
            <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
          </div>

          <Button
            variant="default"
            size="icon"
            onClick={stopRecording}
            className="rounded-full bg-[#ff4000] hover:bg-[#ff4000]"
          >
            <MicOff className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* État: Audio enregistré, prêt à envoyer */}
      {!isRecording && audioBlob && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="rounded-full"
            disabled={isSending}
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="flex-1 flex items-center gap-2">
            {audioUrl && (
              <audio
                src={audioUrl}
                controls
                className="h-8 max-w-[150px]"
              />
            )}
            <span className="text-xs text-muted-foreground">
              {formatTime(recordingTime)}
            </span>
            <TranslationIndicator />
          </div>

          <Button
            variant="default"
            size="icon"
            onClick={handleSend}
            disabled={isSending}
            className="rounded-full bg-primary"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </>
      )}

      {/* État: Prêt à enregistrer */}
      {!isRecording && !audioBlob && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>

          <span className="flex-1 text-sm text-muted-foreground text-center">
            Appuyez pour enregistrer
          </span>

          <Button
            variant="default"
            size="icon"
            onClick={startRecording}
            className="rounded-full bg-primary"
          >
            <Mic className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Indicateur de traduction automatique */}
      {recipientId && (
        <div className="absolute -top-6 right-0 flex items-center gap-1 text-xs text-muted-foreground">
          <Languages className="h-3 w-3" />
          <span>Traduction auto.</span>
        </div>
      )}
    </div>
  );
}

export default VoiceRecorderWithTranslation;

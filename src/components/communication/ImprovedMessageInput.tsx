import React, { useState, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  X,
  Loader2
} from 'lucide-react';

interface ImprovedMessageInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ImprovedMessageInput({
  onSendMessage,
  disabled = false,
  placeholder = "Tapez votre message..."
}: ImprovedMessageInputProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSend = () => {
    if (message.trim() || attachments.length > 0) {
      onSendMessage(message, attachments);
      setMessage('');
      setAttachments([]);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length + attachments.length > 5) {
      toast({
        title: "Limite atteinte",
        description: "Maximum 5 fichiers par message",
        variant: "destructive"
      });
      return;
    }
    setAttachments([...attachments, ...files]);
    if (event.target) event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Détection iOS/Safari
  const isIOSDevice = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isSafariBrowser = () => /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|Chrome/i.test(navigator.userAgent);

  const startRecording = async () => {
    try {
      // CRITICAL: getUserMedia must be called directly within the click handler
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Déterminer le meilleur format supporté
      const isIOS = isIOSDevice();
      const isSafari = isSafariBrowser();

      console.log('[VoiceRecord] Platform:', { isIOS, isSafari });

      // Tester les formats dans l'ordre de préférence
      const formatsToTry = [
        { mime: 'audio/mp4', ext: 'm4a' },
        { mime: 'audio/aac', ext: 'aac' },
        { mime: 'audio/webm;codecs=opus', ext: 'webm' },
        { mime: 'audio/webm', ext: 'webm' },
        { mime: 'audio/wav', ext: 'wav' },
        { mime: '', ext: 'webm' }, // Fallback
      ];

      let selectedMime = '';
      let selectedExt = 'webm';

      for (const format of formatsToTry) {
        if (format.mime === '' || MediaRecorder.isTypeSupported(format.mime)) {
          selectedMime = format.mime;
          selectedExt = format.ext;
          console.log('[VoiceRecord] Selected format:', format.mime || 'default');
          break;
        }
      }

      // Configuration du MediaRecorder
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 128000
      };
      if (selectedMime) {
        recorderOptions.mimeType = selectedMime;
      }

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, recorderOptions);
      } catch (e) {
        console.warn('[VoiceRecord] Fallback to default options:', e);
        mediaRecorder = new MediaRecorder(stream);
      }

      console.log('[VoiceRecord] Using MIME type:', mediaRecorder.mimeType);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log('[VoiceRecord] Chunk received:', e.data.size, 'bytes');
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('[VoiceRecord] MediaRecorder error:', e);
        toast({
          title: "Erreur",
          description: t('improvedMessageInput.erreurLorsDeLEnregistrement'),
          variant: "destructive"
        });
        cleanupRecording();
      };

      mediaRecorder.onstop = async () => {
        console.log('[VoiceRecord] Recording stopped, chunks:', audioChunksRef.current.length);

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const actualMimeType = mediaRecorder.mimeType || selectedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });

        // Déterminer l'extension
        let finalExtension = selectedExt;
        if (actualMimeType.includes('mp4') || actualMimeType.includes('m4a')) {
          finalExtension = 'm4a';
        } else if (actualMimeType.includes('webm')) {
          finalExtension = 'webm';
        } else if (actualMimeType.includes('ogg')) {
          finalExtension = 'ogg';
        } else if (actualMimeType.includes('wav')) {
          finalExtension = 'wav';
        }

        const audioFile = new File(
          [audioBlob],
          `vocal_${Date.now()}.${finalExtension}`,
          { type: actualMimeType }
        );

        console.log('[VoiceRecord] Audio file created:', {
          name: audioFile.name,
          type: audioFile.type,
          size: audioFile.size
        });

        // Arrêter les pistes audio
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        if (audioFile.size < 1000) {
          toast({
            title: "Enregistrement trop court",
            description: t('improvedMessageInput.lEnregistrementEstTropCourt'),
            variant: "destructive"
          });
          return;
        }

        // Envoyer le fichier audio directement
        setIsSendingVoice(true);
        try {
          onSendMessage('🎙️ Message vocal', [audioFile]);
          toast({
            title: t('improvedMessageInput.messageVocalEnvoye'),
            description: t('improvedMessageInput.votreMessageVocalAEte')
          });
        } catch (error: any) {
          console.error('[VoiceRecord] Send error:', error);
          toast({
            title: "Erreur",
            description: t('improvedMessageInput.impossibleDEnvoyerLeMessage'),
            variant: "destructive"
          });
        } finally {
          setIsSendingVoice(false);
          setRecordingDuration(0);
        }
      };

      // Démarrer l'enregistrement
      const timeslice = isIOS ? 1000 : 500;
      mediaRecorder.start(timeslice);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingDuration(0);

      // Timer pour afficher la durée
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      toast({
        title: "Enregistrement en cours",
        description: t('improvedMessageInput.cliquezANouveauPourArreter')
      });

    } catch (error: any) {
      console.error('[VoiceRecord] Error:', error);
      if (error.name === 'NotAllowedError') {
        toast({
          title: t('improvedMessageInput.accesRefuse'),
          description: t('improvedMessageInput.veuillezAutoriserLAccesAu'),
          variant: "destructive"
        });
      } else if (error.name === 'NotFoundError') {
        toast({
          title: t('improvedMessageInput.microphoneNonDetecte'),
          description: t('improvedMessageInput.aucunMicrophoneNAEte'),
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erreur",
          description: t('improvedMessageInput.impossibleDAccederAuMicrophone'),
          variant: "destructive"
        });
      }
    }
  };

  const cleanupRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3 w-full">
      {/* Aperçu des pièces jointes */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
          {attachments.map((file, index) => (
            <div key={index} className="flex items-center gap-2 bg-background px-3 py-2 rounded-md border shadow-sm">
              {file.type.startsWith('image/') ? (
                <ImageIcon className="w-4 h-4 text-primary" />
              ) : file.type.startsWith('audio/') || file.name.startsWith('vocal_') ? (
                <Mic className="w-4 h-4 text-orange-500" />
              ) : (
                <Paperclip className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm truncate max-w-[120px]">{file.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeAttachment(index)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Barre de saisie professionnelle */}
      <div className="flex items-end gap-2 p-2 bg-muted/30 rounded-lg border border-border/50">
        {/* Boutons de pièces jointes */}
        <div className="flex gap-1 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          <Button
            size="icon"
            variant="ghost"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled || isRecording}
            title={t('improvedMessageInput.ajouterUneImage')}
            className="h-9 w-9 hover:bg-primary/10 hover:text-primary"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isRecording}
            title={t('improvedMessageInput.ajouterUnFichier')}
            className="h-9 w-9 hover:bg-primary/10 hover:text-primary"
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          <Button
            size="icon"
            variant={isRecording ? "destructive" : "ghost"}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled || isSendingVoice}
            title={isRecording ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
            className={`h-9 w-9 ${!isRecording ? 'hover:bg-orange-500/10 hover:text-orange-500' : ''}`}
          >
            {isSendingVoice ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Mic className={`w-5 h-5 ${isRecording ? 'animate-pulse' : ''}`} />
            )}
          </Button>
        </div>

        {/* Champ de texte avec style amélioré */}
        <div className="flex-1 min-w-0">
          {isRecording ? (
            <div className="flex items-center gap-2 h-10 px-3 text-destructive">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="font-medium">{formatDuration(recordingDuration)}</span>
              <span className="text-sm opacity-70">Enregistrement...</span>
            </div>
          ) : (
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={placeholder}
              disabled={disabled || isSendingVoice}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/60"
            />
          )}
        </div>

        {/* Bouton d'envoi */}
        {!isRecording && (
          <Button
            onClick={handleSend}
            disabled={disabled || (!message.trim() && attachments.length === 0) || isSendingVoice}
            size="icon"
            className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/90"
          >
            <Send className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

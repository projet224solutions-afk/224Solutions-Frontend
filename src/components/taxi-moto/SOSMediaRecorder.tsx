/**
 * Composant d'enregistrement audio/vidéo pour les alertes SOS
 * Auto-arrêt à 60 secondes + envoi automatique au Bureau Syndicat
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  Mic,
  Square,
  Send,
  Camera,
  Loader2,
  CheckCircle,
  X,
  Play,
  Pause,
  Volume2,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { uploadToGCSDirect } from '@/lib/gcsUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SOSMediaRecorderProps {
  sosAlertId: string;
  driverId: string;
  driverName: string;
  onMediaSent?: () => void;
  className?: string;
}

type RecordingType = 'audio' | 'video';
type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading' | 'sent';

const AUTO_STOP_SECONDS = 60;

export function SOSMediaRecorder({
  sosAlertId,
  driverId,
  driverName,
  onMediaSent,
  className
}: SOSMediaRecorderProps) {
  const { t } = useTranslation();
  const [recordingType, setRecordingType] = useState<RecordingType | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const autoSendRef = useRef(false);
  const recordingTypeRef = useRef<RecordingType | null>(null);
  const durationRef = useRef(0);

  // Synchronise les refs utilisées dans les callbacks asynchrones
  useEffect(() => { recordingTypeRef.current = recordingType; }, [recordingType]);
  useEffect(() => { durationRef.current = recordingDuration; }, [recordingDuration]);

  const timeLeft = Math.max(0, AUTO_STOP_SECONDS - recordingDuration);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, []);

  // Auto-stop à 60 secondes
  useEffect(() => {
    if (recordingState === 'recording' && recordingDuration >= AUTO_STOP_SECONDS) {
      autoSendRef.current = true;
      stopRecording();
      toast.info(t('sOSMediaRecorder.autoArretEnregistrement'), {
        description: 'Envoi automatique au Bureau Syndicat en cours...'
      });
    }
  }, [recordingDuration, recordingState, stopRecording]);

  const sendRecordingWithBlob = useCallback(async (blob: Blob) => {
    if (!blob || !sosAlertId) return;

    setRecordingState('uploading');

    try {
      const type = recordingTypeRef.current;
      const mimeType = type === 'video' ? 'video/webm' : 'audio/webm';
      const fileName = `sos-${sosAlertId}-${Date.now()}.webm`;
      const filePath = `sos/${sosAlertId}/${fileName}`;

      let publicUrl: string | null = null;
      let objectPath: string = filePath;

      // 1. Essai GCS via edge function
      const file = new File([blob], fileName, { type: mimeType });
      const gcsResult = await uploadToGCSDirect(file, 'sos', fileName, mimeType, sosAlertId);

      if (gcsResult.success && gcsResult.publicUrl) {
        publicUrl = gcsResult.publicUrl;
        objectPath = gcsResult.objectPath ?? filePath;
      } else {
        // 2. Fallback direct sur communication-files (bucket existant)
        console.warn('GCS/sos-recordings indisponible, fallback communication-files');
        const { error: fallbackError } = await supabase.storage
          .from('communication-files')
          .upload(filePath, blob, { contentType: mimeType, upsert: true });

        if (fallbackError) {
          throw new Error(`Upload échoué: ${fallbackError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('communication-files')
          .getPublicUrl(filePath);

        publicUrl = urlData.publicUrl;
      }

      // Mettre à jour sos_alerts avec l'URL de l'enregistrement
      await supabase
        .from('sos_alerts')
        .update({
          recording_url: publicUrl,
          recording_stopped_at: new Date().toISOString()
        })
        .eq('id', sosAlertId);

      // Enregistrer dans sos_media (non bloquant)
      try {
        await (supabase as any).from('sos_media').insert({
          sos_alert_id: sosAlertId,
          driver_id: driverId,
          driver_name: driverName,
          media_type: type,
          file_path: objectPath,
          file_url: publicUrl,
          file_size_bytes: blob.size,
          duration_seconds: durationRef.current,
          created_at: new Date().toISOString()
        });
      } catch (mediaError) {
        console.warn('⚠️ sos_media insert warning (non bloquant):', mediaError);
      }

      setRecordingState('sent');
      toast.success(t('sOSMediaRecorder.enregistrementEnvoyeAuBureauSyndicat'), {
        description: t('sOSMediaRecorder.leBureauPeutMaintenantVisualiser')
      });

      onMediaSent?.();

      setTimeout(() => {
        setRecordedBlob(null);
        setRecordingState('idle');
        setRecordingType(null);
        setRecordingDuration(0);
      }, 3000);

    } catch (error) {
      console.error('Erreur envoi enregistrement:', error);
      toast.error(t('sOSMediaRecorder.erreurLorsDeLEnvoi'));
      setRecordingState('stopped');
    }
  }, [sosAlertId, driverId, driverName, onMediaSent]);

  // Déclenchement auto-envoi quand blob disponible après auto-stop
  useEffect(() => {
    if (recordedBlob && autoSendRef.current) {
      autoSendRef.current = false;
      sendRecordingWithBlob(recordedBlob);
    }
  }, [recordedBlob, sendRecordingWithBlob]);

  const sendRecording = useCallback(() => {
    if (recordedBlob) sendRecordingWithBlob(recordedBlob);
  }, [recordedBlob, sendRecordingWithBlob]);

  const startRecording = useCallback(async (type: RecordingType) => {
    try {
      setRecordingType(type);
      chunksRef.current = [];
      setRecordingDuration(0);
      autoSendRef.current = false;

      const constraints = type === 'video'
        ? { video: { facingMode: 'environment' }, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (type === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const mimeType = type === 'video'
        ? 'video/webm;codecs=vp8,opus'
        : 'audio/webm;codecs=opus';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: type === 'video' ? 'video/webm' : 'audio/webm'
        });
        setRecordedBlob(blob);
        setRecordingState('stopped');

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        if (type === 'video' && videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
          videoPreviewRef.current.src = URL.createObjectURL(blob);
        } else if (type === 'audio' && audioPreviewRef.current) {
          audioPreviewRef.current.src = URL.createObjectURL(blob);
        }
      };

      mediaRecorder.start(1000);
      setRecordingState('recording');

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      toast.success(`Enregistrement ${type === 'video' ? 'vidéo' : 'audio'} démarré — auto-envoi dans ${AUTO_STOP_SECONDS}s`);
    } catch (error) {
      console.error('Erreur démarrage enregistrement:', error);
      toast.error('Impossible d\'accéder à la caméra/micro');
      setRecordingState('idle');
      setRecordingType(null);
    }
  }, []);

  const cancelRecording = useCallback(() => {
    autoSendRef.current = false;
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setRecordedBlob(null);
    setRecordingState('idle');
    setRecordingType(null);
    setRecordingDuration(0);
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
      videoPreviewRef.current.src = '';
    }
    if (audioPreviewRef.current) {
      audioPreviewRef.current.src = '';
    }
  }, [stopRecording]);

  const togglePlayback = useCallback(() => {
    const player = recordingType === 'video' ? videoPreviewRef.current : audioPreviewRef.current;
    if (player) {
      if (isPlaying) player.pause();
      else player.play();
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, recordingType]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={cn("border-2 border-orange-200 bg-orange-50/50", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-[#ff4000]">
          <Camera className="w-5 h-5" />
          Enregistrement SOS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Idle */}
        {recordingState === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 text-center">
              Capturez une preuve audio ou vidéo de la situation
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => startRecording('video')}
                className="h-20 bg-[#ff4000] hover:bg-[#ce3d11] text-white shadow-xl transition-all hover:scale-105 group"
              >
                <div className="flex flex-col items-center gap-2">
                  <Video className="w-7 h-7 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold">{t('sOSMediaRecorder.video')}</span>
                  <span className="text-[10px] opacity-80">{t('sOSMediaRecorder.recommande')}</span>
                </div>
              </Button>
              <Button
                onClick={() => startRecording('audio')}
                className="h-20 bg-orange-500 text-white shadow-xl transition-all hover:scale-105 group"
              >
                <div className="flex flex-col items-center gap-2">
                  <Mic className="w-7 h-7 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold">Audio</span>
                  <span className="text-[10px] opacity-80">Plus rapide</span>
                </div>
              </Button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Envoi automatique au Bureau Syndicat après {AUTO_STOP_SECONDS}s si vous n'arrêtez pas manuellement.</span>
              </p>
            </div>
          </div>
        )}

        {/* Recording */}
        {recordingState === 'recording' && (
          <div className="space-y-4">
            {recordingType === 'video' && (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-2xl ring-4 ring-[#ff4000]/50 animate-pulse">
                <video ref={videoPreviewRef} className="w-full h-full object-cover" muted playsInline />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <Badge className="bg-[#ff4000] text-white flex items-center gap-2 px-3 py-1.5 shadow-lg">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    <span className="font-bold">ENREGISTREMENT</span>
                  </Badge>
                </div>
              </div>
            )}

            {recordingType === 'audio' && (
              <div className="bg-orange-100 rounded-xl p-8 flex flex-col items-center justify-center shadow-xl ring-4 ring-orange-500/50 animate-pulse">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-ping" />
                  <Mic className="w-16 h-16 text-orange-600 relative z-10" />
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#ff4000] rounded-full animate-pulse shadow-lg" />
                </div>
                <p className="text-orange-800 font-bold text-lg">Enregistrement audio</p>
                <p className="text-orange-600 text-sm mt-1">{t('sOSMediaRecorder.decrivezClairementLaSituation')}</p>
              </div>
            )}

            {/* Timer + countdown + contrôles */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-[#ff4000] rounded-full animate-pulse" />
                <Badge variant="outline" className="text-xl font-mono font-bold px-4 py-2 border-2">
                  {formatDuration(recordingDuration)}
                </Badge>
              </div>
              {/* Compte à rebours */}
              <div className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold",
                timeLeft <= 10
                  ? "bg-orange-100 text-[#ff4000] border border-orange-300 animate-pulse"
                  : "bg-orange-100 text-orange-700 border border-orange-200"
              )}>
                <Clock className="w-3.5 h-3.5" />
                Auto-envoi dans {timeLeft}s
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={cancelRecording} variant="outline" size="sm" className="flex-1 border-orange-300 text-[#ff4000] hover:bg-orange-50">
                <X className="w-4 h-4 mr-1" />
                Annuler
              </Button>
              <Button onClick={stopRecording} className="flex-1 bg-[#ff4000] hover:bg-[#ff4000] text-white font-bold shadow-lg" size="sm">
                <Square className="w-4 h-4 mr-1" />
                Arrêter & Envoyer
              </Button>
            </div>
          </div>
        )}

        {/* Stopped — preview avant envoi manuel */}
        {recordingState === 'stopped' && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-[#ff4000] font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                Enregistrement terminé ! Vérifiez avant d'envoyer.
              </p>
            </div>

            {recordingType === 'video' && (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-xl">
                <video ref={videoPreviewRef} className="w-full h-full object-cover" playsInline onEnded={() => setIsPlaying(false)} />
                <Button onClick={togglePlayback} className="absolute inset-0 bg-black/40 hover:bg-black/50 flex items-center justify-center" variant="ghost">
                  <div className="bg-white/90 rounded-full p-4 shadow-2xl">
                    {isPlaying ? <Pause className="w-10 h-10 text-gray-900" /> : <Play className="w-10 h-10 text-gray-900" />}
                  </div>
                </Button>
                <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-white text-sm font-medium">Durée: {formatDuration(recordingDuration)}</span>
                  <Badge className="bg-white/20 text-white">{t('sOSMediaRecorder.previsualisation')}</Badge>
                </div>
              </div>
            )}

            {recordingType === 'audio' && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
                    <Volume2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-orange-900">Enregistrement audio</p>
                    <p className="text-sm text-orange-600">Durée: {formatDuration(recordingDuration)}</p>
                  </div>
                </div>
                <audio ref={audioPreviewRef} controls className="w-full" onEnded={() => setIsPlaying(false)} />
              </div>
            )}

            <div className="flex gap-2 p-4 bg-gray-50 rounded-lg">
              <Button onClick={cancelRecording} variant="outline" className="flex-1 border-gray-300 hover:bg-gray-100">
                <X className="w-4 h-4 mr-2" />
                Recommencer
              </Button>
              <Button onClick={sendRecording} className="flex-1 bg-[#ff4000] hover:bg-[#ce3d11] text-white font-bold shadow-lg">
                <Send className="w-4 h-4 mr-2" />
                Envoyer au Bureau
              </Button>
            </div>
          </div>
        )}

        {/* Uploading */}
        {recordingState === 'uploading' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-bold text-blue-900">Envoi en cours...</p>
              <p className="text-sm text-blue-600">{t('sOSMediaRecorder.transmissionSecuriseeVersLeBureau')}</p>
            </div>
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-[#04439e] animate-pulse" style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {/* Sent */}
        {recordingState === 'sent' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="relative">
              <CheckCircle className="w-16 h-16 text-[#ff4000]" />
              <div className="absolute inset-0 bg-[#ff4000]/20 rounded-full animate-ping" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-[#ff4000]">{t('sOSMediaRecorder.envoyeAvecSucces')}</p>
              <p className="text-sm text-[#ff4000]">{t('sOSMediaRecorder.leBureauSyndicatARecu')}</p>
            </div>
            <Badge className="bg-orange-100 text-[#ff4000] border-2 border-orange-300 px-4 py-2">
              ✓ Preuve enregistrée
            </Badge>
          </div>
        )}

        {recordingType === 'audio' && recordingState !== 'recording' && (
          <audio ref={audioPreviewRef} className="hidden" />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Composant de lecture des médias SOS reçus
 * Affiche et permet de lire les enregistrements audio/vidéo des conducteurs
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Video,
  Mic,
  Play,
  Pause,
  Clock,
  User,
  Download,
  Volume2,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SOSMedia {
  id: string;
  sos_alert_id: string;
  driver_id: string;
  driver_name: string;
  media_type: 'audio' | 'video';
  file_url: string;
  duration_seconds: number;
  is_viewed: boolean;
  viewed_at: string | null;
  created_at: string;
}

interface SOSMediaPlayerProps {
  sosAlertId?: string;
  className?: string;
}

export function SOSMediaPlayer({ sosAlertId, className }: SOSMediaPlayerProps) {
  const { t } = useTranslation();
  const [mediaList, setMediaList] = useState<SOSMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadMedia = async () => {
    try {
      setLoading(true);
      let query = (supabase as any)
        .from('sos_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (sosAlertId) {
        query = query.eq('sos_alert_id', sosAlertId);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Erreur chargement médias:', error);
        throw error;
      }

      setMediaList(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(t('sOSMediaPlayer.erreurDeChargementDesMedias'));
    } finally {
      setLoading(false);
    }
  };

  // Chargement initial et abonnement temps réel
  useEffect(() => {
    loadMedia();

    // Abonnement temps réel aux nouveaux médias
    const channel = supabase
      .channel('sos-media-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sos_media'
        },
        (payload) => {
          console.log('📹 Nouveau média SOS reçu:', payload);
          const newMedia = payload.new as SOSMedia;
          setMediaList(prev => [newMedia, ...prev]);

          // Notification sonore via Web Audio API (évite CSP)
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
          } catch (_e) {
            // Ignorer si Web Audio non supporté
          }

          toast.success(`🎥 Nouveau ${newMedia.media_type === 'video' ? 'vidéo' : 'audio'} reçu!`, {
            description: `De: ${newMedia.driver_name}`,
            action: {
              label: 'Voir',
              onClick: () => playMedia(newMedia)
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sosAlertId]);

  const markAsViewed = async (media: SOSMedia) => {
    if (media.is_viewed) return;

    try {
      await (supabase as any)
        .from('sos_media')
        .update({
          is_viewed: true,
          viewed_at: new Date().toISOString()
        })
        .eq('id', media.id);

      setMediaList(prev =>
        prev.map(m =>
          m.id === media.id ? { ...m, is_viewed: true, viewed_at: new Date().toISOString() } : m
        )
      );
    } catch (error) {
      console.error('Erreur marquage vu:', error);
    }
  };

  const playMedia = (media: SOSMedia) => {
    setPlayingId(media.id);
    markAsViewed(media);
  };

  const stopMedia = () => {
    setPlayingId(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  const downloadMedia = (media: SOSMedia) => {
    const link = document.createElement('a');
    link.href = media.file_url;
    link.download = `sos_${media.media_type}_${media.id}.webm`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const unviewedCount = mediaList.filter(m => !m.is_viewed).length;
  const currentMedia = playingId ? mediaList.find(m => m.id === playingId) : null;

  return (
    <Card className={cn("border-2 border-blue-200", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-600" />
            Médias SOS Reçus
            {unviewedCount > 0 && (
              <Badge className="bg-[#ff4000] text-white animate-pulse">
                {unviewedCount} nouveau{unviewedCount > 1 ? 'x' : ''}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMedia}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lecteur actif */}
        {currentMedia && (
          <div className="rounded-lg overflow-hidden bg-black">
            {currentMedia.media_type === 'video' ? (
              <video
                ref={videoRef}
                src={currentMedia.file_url}
                controls
                autoPlay
                className="w-full aspect-video"
                onEnded={stopMedia}
              />
            ) : (
              <div className="p-6 bg-[#04439e]">
                <div className="flex flex-col items-center text-white">
                  <Volume2 className="w-12 h-12 mb-2 animate-pulse" />
                  <p className="text-sm mb-4">Audio de {currentMedia.driver_name}</p>
                  <audio
                    ref={audioRef}
                    src={currentMedia.file_url}
                    controls
                    autoPlay
                    className="w-full"
                    onEnded={stopMedia}
                  />
                </div>
              </div>
            )}
            <div className="p-2 bg-gray-900 flex items-center justify-between">
              <span className="text-white text-sm">{currentMedia.driver_name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={stopMedia}
              >
                Fermer
              </Button>
            </div>
          </div>
        )}

        {/* Liste des médias */}
        <ScrollArea className="h-64">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : mediaList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>{t('sOSMediaPlayer.aucunMediaRecu')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mediaList.map((media) => (
                <div
                  key={media.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    !media.is_viewed && "bg-blue-50 border-blue-200",
                    media.is_viewed && "bg-gray-50 border-gray-200",
                    playingId === media.id && "ring-2 ring-blue-500"
                  )}
                >
                  {/* Icône type */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    media.media_type === 'video'
                      ? "bg-orange-100 text-[#ff4000]"
                      : "bg-orange-100 text-orange-600"
                  )}>
                    {media.media_type === 'video' ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">
                        {media.driver_name}
                      </span>
                      {!media.is_viewed && (
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                          Nouveau
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(media.created_at), 'HH:mm - dd/MM', { locale: fr })}
                      </span>
                      <span>{formatDuration(media.duration_seconds)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={playingId === media.id ? "secondary" : "default"}
                      className="h-8 px-3"
                      onClick={() => playingId === media.id ? stopMedia() : playMedia(media)}
                    >
                      {playingId === media.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      onClick={() => downloadMedia(media)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

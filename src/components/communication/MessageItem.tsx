import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { MoreVertical, Trash2, Copy, Reply, Edit, Download, Play, Pause, Image as ImageIcon, Mic, AlertCircle, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Détection plateforme (exécutée une seule fois)
const detectPlatform = () => {
  if (typeof window === 'undefined') return { isIOS: false, isSafari: false };
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|Chrome/i.test(ua);
  return { isIOS, isSafari };
};

// Vérifier si un format audio est supporté pour la lecture
const canPlayAudioFormat = (url: string, fileName?: string, hasIOSUrl?: boolean): boolean => {
  const { isIOS, isSafari } = detectPlatform();

  // Si on a une URL iOS disponible, on peut toujours lire
  if ((isIOS || isSafari) && hasIOSUrl) {
    return true;
  }

  // Extraire l'extension du fichier
  const ext = (fileName || url).split('.').pop()?.toLowerCase() || '';

  // Sur iOS Safari, seuls ces formats sont supportés
  if (isIOS || isSafari) {
    const iosSupportedFormats = ['mp3', 'mp4', 'm4a', 'aac', 'wav', 'caf'];
    return iosSupportedFormats.includes(ext);
  }

  // Sur autres navigateurs, la plupart des formats sont supportés
  return true;
};

// Obtenir un message d'erreur approprié
const getAudioErrorMessage = (fileName?: string): string => {
  const { isIOS } = detectPlatform();
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

  if (isIOS && (ext === 'webm' || ext === 'ogg')) {
    return `Le format .${ext} n'est pas supporté sur iPhone. Téléchargez le fichier pour l'écouter.`;
  }
  return "Ce format audio n'est pas supporté sur votre appareil.";
};

interface MessageItemProps {
  message: {
    id: string;
    content: string;
    timestamp: string;
    isOwn: boolean;
    senderName?: string;
    type?: 'text' | 'image' | 'video' | 'audio' | 'file';
    file_url?: string;
    file_url_ios?: string; // URL du fichier converti pour iOS
    file_name?: string;
    file_size?: number;
    audio_format?: string;
    audio_format_ios?: string;
    attachments?: { type: string; url: string; name: string }[];
  };
  onDelete?: (messageId: string, deleteForEveryone: boolean) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onReply?: () => void;
}

export default function MessageItem({
  message,
  onDelete,
  onEdit,
  onReply
}: MessageItemProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [audioCurrentTimes, setAudioCurrentTimes] = useState<Record<string, number>>({});
  const [audioErrors, setAudioErrors] = useState<Record<string, boolean>>({});
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({})

  useEffect(() => {
    return () => {
      // Cleanup audio/video si composant unmount
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) audio.pause();
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(videoRefs.current).forEach(video => {
        if (video) video.pause();
      });
    };
  }, []);

  // Fonction pour enregistrer une ref audio avec gestion des erreurs
  const setAudioRef = (id: string, element: HTMLAudioElement | null) => {
    if (element) {
      audioRefs.current[id] = element;

      const handleLoadedMetadata = () => {
        setAudioDurations(prev => ({ ...prev, [id]: element.duration }));
        setAudioLoading(prev => ({ ...prev, [id]: false }));
        setAudioErrors(prev => ({ ...prev, [id]: false }));
      };
      const handleTimeUpdate = () => {
        setAudioCurrentTimes(prev => ({ ...prev, [id]: element.currentTime }));
      };
      const handleEnded = () => {
        setPlayingAudioId(null);
      };
      const handleError = (e: Event) => {
        console.error('[Audio] Erreur de lecture:', e, element.error);
        setAudioErrors(prev => ({ ...prev, [id]: true }));
        setAudioLoading(prev => ({ ...prev, [id]: false }));

        // Log l'erreur pour debug
        const errorCodes: Record<number, string> = {
          1: 'MEDIA_ERR_ABORTED',
          2: 'MEDIA_ERR_NETWORK',
          3: 'MEDIA_ERR_DECODE',
          4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
        };
        if (element.error) {
          console.error('[Audio] Code erreur:', errorCodes[element.error.code] || element.error.code);
        }
      };
      const handleCanPlay = () => {
        setAudioLoading(prev => ({ ...prev, [id]: false }));
      };
      const handleLoadStart = () => {
        setAudioLoading(prev => ({ ...prev, [id]: true }));
      };

      element.addEventListener('loadedmetadata', handleLoadedMetadata);
      element.addEventListener('timeupdate', handleTimeUpdate);
      element.addEventListener('ended', handleEnded);
      element.addEventListener('error', handleError);
      element.addEventListener('canplay', handleCanPlay);
      element.addEventListener('loadstart', handleLoadStart);
    }
  };

  // Fonction pour enregistrer une ref vidéo
  const setVideoRef = (id: string, element: HTMLVideoElement | null) => {
    if (element) {
      videoRefs.current[id] = element;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast({
      title: t('messageItem.copie'),
      description: t('messageItem.messageCopieDansLePresse')
    });
  };

  const handleDelete = () => {
    onDelete?.(message.id, deleteForEveryone);
    setShowDeleteDialog(false);
    setDeleteForEveryone(false);
    toast({
      title: t('messageItem.messageSupprime'),
      description: deleteForEveryone ? "Le message a été supprimé pour tous" : "Le message a été supprimé pour vous"
    });
  };

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      onEdit?.(message.id, editContent.trim());
      toast({
        title: t('messageItem.messageModifie'),
        description: t('messageItem.leMessageAEteModifie')
      });
    }
    setIsEditing(false);
  };

  const toggleAudio = async (audioId: string) => {
    const audio = audioRefs.current[audioId];
    if (!audio) return;

    // Si erreur, proposer le téléchargement
    if (audioErrors[audioId]) {
      toast({
        title: t('messageItem.formatNonSupporte'),
        description: t('messageItem.telechargezLeFichierPourL')
      });
      return;
    }

    if (playingAudioId === audioId) {
      audio.pause();
      setPlayingAudioId(null);
    } else {
      // Pause tous les autres audios
      Object.entries(audioRefs.current).forEach(([id, otherAudio]) => {
        if (id !== audioId && otherAudio) {
          otherAudio.pause();
        }
      });

      try {
        await audio.play();
        setPlayingAudioId(audioId);
      } catch (error: any) {
        console.error('[Audio] Erreur lecture:', error);

        // Gestion spéciale pour les erreurs de format sur iOS
        if (error.name === 'NotSupportedError' || error.name === 'NotAllowedError') {
          setAudioErrors(prev => ({ ...prev, [audioId]: true }));
          toast({
            title: t('messageItem.formatAudioNonSupporte'),
            description: t('messageItem.ceFormatNEstPas')
          });
        } else {
          toast({
            title: t('messageItem.erreurDeLecture'),
            description: t('messageItem.impossibleDeLireCeFichier')
          });
        }
      }
    }
  };

  const _toggleVideo = (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (!video) return;

    if (playingVideoId === videoId) {
      video.pause();
      setPlayingVideoId(null);
    } else {
      video.play();
      setPlayingVideoId(videoId);
    }
  };

  const handleImageClick = (url: string) => {
    setPreviewImageUrl(url);
    setShowImagePreview(true);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <>
      <div className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'} group`}>
        <div
          className={`max-w-[70%] p-3 rounded-lg relative ${
            message.isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          }`}
        >
          {/* Menu d'actions */}
          <div className={`absolute top-2 ${message.isOwn ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                >
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={message.isOwn ? "start" : "end"}>
                <DropdownMenuItem onClick={() => onReply?.()}>
                  <Reply className="w-4 h-4 mr-2" />
                  Répondre
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copier
                </DropdownMenuItem>
                {message.isOwn && (
                  <>
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setDeleteForEveryone(false);
                        setShowDeleteDialog(true);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer pour moi
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setDeleteForEveryone(true);
                        setShowDeleteDialog(true);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer pour tous
                    </DropdownMenuItem>
                  </>
                )}
                {!message.isOwn && (
                  <DropdownMenuItem
                    onClick={() => {
                      setDeleteForEveryone(false);
                      setShowDeleteDialog(true);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer pour moi
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Nom de l'expéditeur (si ce n'est pas le message de l'utilisateur) */}
          {!message.isOwn && message.senderName && (
            <div className="text-xs font-semibold mb-1 opacity-70">
              {message.senderName}
            </div>
          )}

          {/* Contenu du message */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 text-sm rounded border bg-background text-foreground"
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Enregistrer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Afficher le texte seulement s'il existe et n'est pas juste un nom de fichier */}
              {message.content && !message.file_url && (
                <div className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              )}

              {/* Pièces jointes */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment, index) => (
                    <div key={index} className="rounded overflow-hidden">
                      {/* Image */}
                      {attachment.type.startsWith('image/') && (
                        <div
                          className="cursor-pointer hover:opacity-90 transition-opacity relative group"
                          onClick={() => handleImageClick(attachment.url)}
                        >
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-w-full w-auto max-h-[300px] rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      )}

                      {/* Audio/Vocal */}
                      {(attachment.type.startsWith('audio/') || attachment.type === 'voice' || attachment.name.includes('vocal')) && (
                        <div className={cn(
                          "flex items-center gap-2 p-3 bg-background/10 rounded-lg",
                          audioErrors[`attachment-${index}`] && "border border-[#ff4000]/30"
                        )}>
                          {audioErrors[`attachment-${index}`] ? (
                            // État d'erreur
                            <>
                              <div className="h-10 w-10 rounded-full flex-shrink-0 bg-[#ff4000]/20 flex items-center justify-center">
                                <AlertCircle className="w-4 h-4 text-[#ff4000]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-[#ff4000] font-medium">{t('messageItem.formatNonSupporte')}</span>
                              </div>
                              <a
                                href={attachment.url}
                                download={attachment.name || 'vocal.m4a'}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium"
                              >
                                <Download className="w-3 h-3" />
                                Télécharger
                              </a>
                            </>
                          ) : audioLoading[`attachment-${index}`] ? (
                            // État de chargement
                            <>
                              <div className="h-10 w-10 rounded-full flex-shrink-0 bg-muted/50 flex items-center justify-center animate-pulse">
                                <Mic className="w-4 h-4 opacity-50" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs opacity-60">Chargement...</span>
                              </div>
                            </>
                          ) : (
                            // État normal
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleAudio(`attachment-${index}`)}
                                className="h-10 w-10 rounded-full flex-shrink-0"
                              >
                                {playingAudioId === `attachment-${index}` ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </Button>

                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Mic className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground truncate">
                                    {attachment.name || 'Message vocal'}
                                  </span>
                                </div>

                                {/* Barre de progression */}
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-background/20 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary transition-all duration-100"
                                      style={{
                                        width: audioDurations[`attachment-${index}`] > 0
                                          ? `${(audioCurrentTimes[`attachment-${index}`] / audioDurations[`attachment-${index}`]) * 100}%`
                                          : '0%'
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground tabular-nums min-w-[35px]">
                                    {formatTime(playingAudioId === `attachment-${index}`
                                      ? audioCurrentTimes[`attachment-${index}`] || 0
                                      : audioDurations[`attachment-${index}`] || 0
                                    )}
                                  </span>
                                </div>
                              </div>

                              <a
                                href={attachment.url}
                                download={attachment.name || 'vocal.m4a'}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-background/20 transition-colors"
                                title={t('messageItem.telecharger')}
                              >
                                <Download className="w-3.5 h-3.5 opacity-70" />
                              </a>
                            </>
                          )}

                          <audio
                            ref={(el) => setAudioRef(`attachment-${index}`, el)}
                            src={attachment.url}
                            preload="metadata"
                            className="hidden"
                          />
                        </div>
                      )}

                      {/* Vidéo */}
                      {attachment.type.startsWith('video/') && (
                        <div className="relative rounded-lg overflow-hidden bg-black">
                          <video
                            ref={(el) => setVideoRef(`attachment-${index}`, el)}
                            src={attachment.url}
                            className="w-full max-h-[400px]"
                            controls
                            preload="metadata"
                            onPlay={() => setPlayingVideoId(`attachment-${index}`)}
                            onPause={() => setPlayingVideoId(null)}
                          />
                        </div>
                      )}

                      {/* Fichier générique */}
                      {!attachment.type.startsWith('image/') &&
                       !attachment.type.startsWith('audio/') &&
                       !attachment.type.startsWith('video/') &&
                       attachment.type !== 'voice' &&
                       !attachment.name.includes('vocal') && (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={attachment.name}
                          className="flex items-center gap-2 p-2 bg-background/10 rounded hover:bg-background/20 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          <span className="text-xs underline truncate">
                            {attachment.name}
                          </span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Support ancien format (file_url direct) */}
              {message.file_url && !message.attachments && (
                <div className="mt-2 rounded overflow-hidden">
                  {/* Image */}
                  {message.type === 'image' && (
                    <div
                      className="cursor-pointer hover:opacity-90 transition-opacity relative group"
                      onClick={() => handleImageClick(message.file_url!)}
                    >
                      <img
                        src={message.file_url}
                        alt={message.file_name || 'Image'}
                        className="max-w-full w-auto max-h-[300px] rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )}

                  {/* Audio/Vocal - détection améliorée pour .webm et fichiers vocaux */}
                  {(message.type === 'audio' ||
                    message.file_name?.includes('vocal') ||
                    message.file_name?.endsWith('.webm') ||
                    message.file_name?.endsWith('.mp3') ||
                    message.file_name?.endsWith('.wav') ||
                    message.file_name?.endsWith('.ogg') ||
                    message.file_name?.endsWith('.m4a') ||
                    message.file_name?.endsWith('.mp4')) && (() => {
                    // Détection plateforme
                    const platformInfo = detectPlatform();

                    // URL audio à utiliser (iOS convertie si disponible)
                    const audioUrl = platformInfo.isIOS && message.file_url_ios
                      ? message.file_url_ios
                      : message.file_url!;
                    const audioId = `direct-audio-${message.id}`;

                    // Vérifier la compatibilité du format AVANT de tenter la lecture
                    const hasIOSUrl = !!message.file_url_ios;
                    const isFormatSupported = canPlayAudioFormat(audioUrl, message.file_name, hasIOSUrl);
                    const hasError = audioErrors[audioId] || !isFormatSupported;

                    return (
                    <div className={cn(
                      "flex items-center gap-3 p-3 rounded-xl",
                      message.isOwn
                        ? "bg-primary-foreground/10"
                        : "bg-muted/50",
                      hasError && "border border-[#ff4000]/30"
                    )}>
                      {/* Affichage conditionnel selon l'état */}
                      {hasError ? (
                        // État d'erreur - format non supporté
                        <>
                          <div className="h-11 w-11 rounded-full flex-shrink-0 bg-[#ff4000]/20 flex items-center justify-center">
                            {platformInfo.isIOS ? (
                              <Smartphone className="w-5 h-5 text-[#ff4000]" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-[#ff4000]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <Mic className="w-3.5 h-3.5 flex-shrink-0 text-[#ff4000]" />
                              <span className="text-xs font-medium text-[#ff4000]">
                                {platformInfo.isIOS ? 'Non supporté sur iPhone' : 'Format non supporté'}
                              </span>
                            </div>
                            <p className="text-xs opacity-60">
                              {getAudioErrorMessage(message.file_name)}
                            </p>
                          </div>
                          {/* Bouton Télécharger visible */}
                          <a
                            href={audioUrl}
                            download={message.file_name || 'vocal.m4a'}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs transition-colors",
                              "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                          >
                            <Download className="w-4 h-4" />
                            Télécharger
                          </a>
                        </>
                      ) : audioLoading[audioId] ? (
                        // État de chargement
                        <>
                          <div className="h-11 w-11 rounded-full flex-shrink-0 bg-muted/50 flex items-center justify-center animate-pulse">
                            <Mic className="w-5 h-5 opacity-50" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium opacity-60">
                                Chargement...
                              </span>
                            </div>
                            <div className={cn(
                              "h-2 rounded-full overflow-hidden animate-pulse",
                              message.isOwn ? "bg-primary-foreground/20" : "bg-muted"
                            )} />
                          </div>
                        </>
                      ) : (
                        // État normal - lecture disponible
                        <>
                          {/* Bouton Play/Pause */}
                          <Button
                            size="sm"
                            variant={message.isOwn ? "secondary" : "outline"}
                            onClick={() => toggleAudio(audioId)}
                            aria-label={playingAudioId === audioId ? 'Mettre en pause' : 'Lire le message vocal'}
                            className="h-11 w-11 rounded-full flex-shrink-0 shadow-sm"
                          >
                            {playingAudioId === audioId ? (
                              <Pause className="w-5 h-5" />
                            ) : (
                              <Play className="w-5 h-5 ml-0.5" />
                            )}
                          </Button>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            {/* Indicateur vocal */}
                            <div className="flex items-center gap-2">
                              <Mic className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                              <span className="text-xs font-medium opacity-80">
                                Message vocal
                              </span>
                            </div>

                            {/* Barre de progression interactive */}
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "flex-1 h-2 rounded-full overflow-hidden cursor-pointer",
                                  message.isOwn ? "bg-primary-foreground/20" : "bg-muted"
                                )}
                                onClick={(e) => {
                                  const audio = audioRefs.current[audioId];
                                  if (audio && audioDurations[audioId]) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const percent = (e.clientX - rect.left) / rect.width;
                                    audio.currentTime = percent * audioDurations[audioId];
                                  }
                                }}
                              >
                                <div
                                  className={cn(
                                    "h-full transition-all duration-100 rounded-full",
                                    message.isOwn ? "bg-primary-foreground" : "bg-primary"
                                  )}
                                  style={{
                                    width: audioDurations[audioId] > 0
                                      ? `${((audioCurrentTimes[audioId] || 0) / audioDurations[audioId]) * 100}%`
                                      : '0%'
                                  }}
                                />
                              </div>
                              <span className="text-xs tabular-nums min-w-[40px] opacity-70">
                                {formatTime(playingAudioId === audioId
                                  ? audioCurrentTimes[audioId] || 0
                                  : audioDurations[audioId] || 0
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Bouton Télécharger */}
                          <a
                            href={audioUrl}
                            download={message.file_name || 'vocal.m4a'}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                              message.isOwn
                                ? "hover:bg-primary-foreground/20"
                                : "hover:bg-muted"
                            )}
                            title={t('messageItem.telecharger')}
                          >
                            <Download className="w-4 h-4 opacity-70" />
                          </a>
                        </>
                      )}

                      {/* Ne charger l'audio que si le format est supporté */}
                      {isFormatSupported && (
                        <audio
                          ref={(el) => setAudioRef(audioId, el)}
                          src={audioUrl}
                          preload="metadata"
                          className="hidden"
                        />
                      )}
                    </div>
                    );
                  })()}

                  {/* Vidéo */}
                  {message.type === 'video' && (
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      <video
                        ref={(el) => setVideoRef('direct-video', el)}
                        src={message.file_url}
                        className="w-full max-h-[400px]"
                        controls
                        preload="metadata"
                        onPlay={() => setPlayingVideoId('direct-video')}
                        onPause={() => setPlayingVideoId(null)}
                      />
                    </div>
                  )}

                  {/* Fichier - exclure les fichiers audio */}
                  {message.type === 'file' &&
                   !message.file_name?.includes('vocal') &&
                   !message.file_name?.endsWith('.webm') &&
                   !message.file_name?.endsWith('.mp3') &&
                   !message.file_name?.endsWith('.wav') &&
                   !message.file_name?.endsWith('.ogg') &&
                   !message.file_name?.endsWith('.m4a') && (
                    <a
                      href={message.file_url}
                      download={message.file_name}
                      className="flex items-center gap-2 p-2 bg-background/10 rounded hover:bg-background/20 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-xs underline truncate">
                        {message.file_name}
                      </span>
                      {message.file_size && (
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(message.file_size)})
                        </span>
                      )}
                    </a>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <div className="text-xs opacity-70 mt-1">
                {message.timestamp}
                {isEditing && <span className="ml-2">{t('messageItem.modifie')}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messageItem.supprimerCeMessage')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteForEveryone
                ? "Ce message sera supprimé pour tous les participants. Cette action est irréversible."
                : "Ce message sera supprimé uniquement pour vous. Les autres participants pourront toujours le voir."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteForEveryone(false)}>{t('messageItem.annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Preview Image */}
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          {previewImageUrl && (
            <img
              src={previewImageUrl}
              alt={t('messageItem.previsualisation')}
              className="w-full h-auto rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

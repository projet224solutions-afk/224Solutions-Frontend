/**
 * 🎬 VIDEO UPLOAD PREVIEW COMPONENT
 * Composant réutilisable pour upload vidéo avec validation de durée et aperçu
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Video,
  X,
  Upload,
  Play,
  Pause,
  AlertTriangle,
  Loader2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoUploadPreviewProps {
  maxDuration?: number; // En secondes
  maxSizeMB?: number;
  onVideoSelect: (file: File | null, url: string | null) => void;
  currentVideoUrl?: string | null;
  className?: string;
  label?: string;
  helpText?: string;
}

export function VideoUploadPreview({
  maxDuration = 5,
  maxSizeMB = 20,
  onVideoSelect,
  currentVideoUrl,
  className,
  label = "Vidéo de présentation",
  helpText
}: VideoUploadPreviewProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentVideoUrl || null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isValidDuration, setIsValidDuration] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mettre à jour si currentVideoUrl change
  useEffect(() => {
    if (currentVideoUrl && !videoFile) {
      setPreviewUrl(currentVideoUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideoUrl]);

  // Nettoyer l'URL au démontage
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type
    if (!file.type.startsWith('video/')) {
      toast.error('Veuillez sélectionner une vidéo');
      return;
    }

    // Vérifier la taille
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`La vidéo est trop volumineuse (max ${maxSizeMB}MB)`);
      return;
    }

    setIsLoading(true);

    try {
      // Obtenir la durée
      const videoDuration = await getVideoDuration(file);
      const valid = videoDuration <= maxDuration;

      setDuration(videoDuration);
      setIsValidDuration(valid);

      if (!valid) {
        toast.error(
          `La vidéo doit faire maximum ${formatMaxDurationLabel(maxDuration)} (actuelle: ${formatDuration(videoDuration)})`,
          { duration: 5000 }
        );
        if (event.target) event.target.value = '';
        setIsLoading(false);
        return;
      }

      // Nettoyer l'ancienne preview
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      // Créer la nouvelle preview
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setPreviewUrl(url);
      onVideoSelect(file, url);

      toast.success('Vidéo ajoutée avec succès');
    } catch (error) {
      console.error('Erreur lecture vidéo:', error);
      toast.error('Erreur lors du chargement de la vidéo');
    } finally {
      setIsLoading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleRemove = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setVideoFile(null);
    setPreviewUrl(null);
    setDuration(null);
    setIsValidDuration(true);
    setIsPlaying(false);
    onVideoSelect(null, null);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMaxDurationLabel = (seconds: number) => {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
    }

    if (seconds >= 60) {
      return `${Math.floor(seconds / 60)} min`;
    }

    return `${seconds}s`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            (max {formatMaxDurationLabel(maxDuration)})
          </span>
        </div>
      )}

      {previewUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-border bg-black aspect-video">
          <video
            ref={videoRef}
            src={previewUrl}
            className="w-full h-full object-contain"
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
            playsInline
          />

          {/* Overlay contrôles */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity cursor-pointer",
              isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"
            )}
            onClick={togglePlay}
          >
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-primary" />
              ) : (
                <Play className="w-6 h-6 text-primary ml-1" />
              )}
            </div>
          </div>

          {/* Badge durée */}
          {duration !== null && (
            <div className={cn(
              "absolute bottom-2 left-2 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1",
              isValidDuration
                ? "bg-black/70 text-white"
                : "bg-destructive text-destructive-foreground"
            )}>
              <Clock className="w-3 h-3" />
              {formatDuration(duration)} / {maxDuration}s
            </div>
          )}

          {/* Bouton supprimer */}
          <Button
            size="sm"
            variant="destructive"
            onClick={handleRemove}
            className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full"
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Avertissement durée */}
          {!isValidDuration && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-xs">
              <AlertTriangle className="w-3 h-3" />
              Trop longue
            </div>
          )}
        </div>
      ) : (
        <label className={cn(
          "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all",
          "hover:border-primary/50 hover:bg-primary/5",
          isLoading ? "border-primary bg-primary/5" : "border-border"
        )}>
          {isLoading ? (
            <>
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
              <span className="text-sm text-muted-foreground">Chargement...</span>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Ajouter une vidéo
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Maximum {formatMaxDurationLabel(maxDuration)} • {maxSizeMB}MB max
              </span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isLoading}
          />
        </label>
      )}

      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}

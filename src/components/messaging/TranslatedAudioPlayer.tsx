/**
 * 🎙️ COMPOSANT LECTEUR AUDIO TRADUIT - 224SOLUTIONS
 * Affiche un message audio avec support de traduction automatique
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Globe, FileText, Loader2 } from 'lucide-react';
import { Message } from '@/types/communication.types';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/services/translationService';
import { useAudioTranslation } from '@/hooks/useAudioTranslation';
import { cn } from '@/lib/utils';

interface TranslatedAudioPlayerProps {
  message: Message;
  className?: string;
  showTranscription?: boolean;
  compact?: boolean;
}

export const TranslatedAudioPlayer: React.FC<TranslatedAudioPlayerProps> = ({
  message,
  className = '',
  showTranscription = false,
  compact = false
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showText, setShowText] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    playAudioForMessage,
    stopAudio,
    isAudioTranslated,
    getDisplayAudioUrl,
    getTranscription,
    isTranslating
  } = useAudioTranslation();

  const isTranslated = isAudioTranslated(message);
  const audioUrl = getDisplayAudioUrl(message);

  // Charger les métadonnées audio
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
    }
  }, [audioUrl]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing audio:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLanguageName = (code?: string): string => {
    if (!code) return '';
    return SUPPORTED_LANGUAGES[code as SupportedLanguage] || code;
  };

  // Texte à afficher (transcription ou traduction)
  const displayText = message.translated_text || message.transcribed_text;

  return (
    <div className={cn(
      'rounded-lg p-3',
      compact ? 'max-w-[200px]' : 'max-w-[300px]',
      className
    )}>
      {/* Lecteur audio caché */}
      <audio
        ref={audioRef}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Contrôles du lecteur */}
      <div className="flex items-center gap-3">
        {/* Bouton Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={isLoading || isTranslating}
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            isPlaying
              ? 'bg-[#ff4000] hover:bg-[#ff4000]'
              : 'bg-blue-500 hover:bg-blue-600',
            (isLoading || isTranslating) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLoading || isTranslating ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>

        {/* Barre de progression et temps */}
        <div className="flex-1 min-w-0">
          {/* Waveform/Progress */}
          <div className="relative h-8 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:bg-white
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:cursor-pointer"
              style={{
                background: `linear-gradient(to right, #04439e ${(currentTime / (duration || 1)) * 100}%, #4b5563 ${(currentTime / (duration || 1)) * 100}%)`
              }}
            />
          </div>

          {/* Temps */}
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Icône volume */}
        <Volume2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {/* Indicateur de traduction */}
      <div className="flex items-center justify-between mt-2">
        {isTranslated && (
          <div className="flex items-center gap-1 text-xs text-blue-400">
            <Globe className="w-3 h-3" />
            <span>Traduit depuis {getLanguageName(message.original_language)}</span>
          </div>
        )}

        {/* Bouton transcription */}
        {displayText && showTranscription && (
          <button
            onClick={() => setShowText(!showText)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors ml-auto"
          >
            <FileText className="w-3 h-3" />
            <span>{showText ? 'Masquer' : 'Voir le texte'}</span>
          </button>
        )}
      </div>

      {/* Transcription/Traduction */}
      {showText && displayText && (
        <div className="mt-2 p-2 bg-black/20 rounded text-sm text-gray-300">
          <p className="whitespace-pre-wrap">{displayText}</p>
          {message.original_language && message.original_language !== message.target_language && (
            <p className="text-xs text-gray-500 mt-1 italic">
              Original: {message.transcribed_text}
            </p>
          )}
        </div>
      )}

      {/* Statut de traduction en cours */}
      {message.audio_translation_status === 'pending' && (
        <div className="flex items-center gap-2 mt-2 text-xs text-[#ff4000]">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Traduction en cours...</span>
        </div>
      )}
    </div>
  );
};

/**
 * Version compacte pour les listes de messages
 */
export const CompactAudioPlayer: React.FC<{
  message: Message;
  onPlay?: () => void;
}> = ({ message, onPlay }) => {
  const { isAudioTranslated, getDisplayAudioUrl } = useAudioTranslation();
  const isTranslated = isAudioTranslated(message);

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
      <button
        onClick={onPlay}
        className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center"
      >
        <Play className="w-4 h-4 text-white ml-0.5" />
      </button>

      <div className="flex-1">
        <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full w-0 bg-blue-500" />
        </div>
      </div>

      {isTranslated && (
        <Globe className="w-4 h-4 text-primary" aria-label="Audio traduit" />
      )}
    </div>
  );
};

export default TranslatedAudioPlayer;

/**
 * 🎙️ HOOK DE TRADUCTION AUDIO - 224SOLUTIONS
 * Gère la traduction automatique des messages vocaux
 */

import { useState, useCallback, useEffect } from 'react';
import {
  audioTranslationService,
  AudioTranslationResult
} from '@/services/audioTranslationService';
import { SupportedLanguage } from '@/services/translationService';
import { supabase } from '@/integrations/supabase/client';

interface UseAudioTranslationOptions {
  autoTranslate?: boolean;
  context?: 'general' | 'commerce' | 'delivery' | 'payment' | 'support';
}

interface AudioPlaybackState {
  messageId: string | null;
  isPlaying: boolean;
  isTranslated: boolean;
  transcribedText?: string;
}

interface UseAudioTranslationReturn {
  // État
  isTranslating: boolean;
  currentPlayback: AudioPlaybackState;
  userLanguage: SupportedLanguage;

  // Actions
  translateAudioMessage: (
    audioUrl: string,
    messageId?: string,
    sourceLanguage?: string
  ) => Promise<AudioTranslationResult>;

  playAudioForMessage: (
    messageId: string,
    fallbackUrl: string
  ) => Promise<void>;

  stopAudio: () => void;

  getDisplayAudioUrl: (message: {
    id: string;
    file_url?: string;
    translated_audio_url?: string;
    audio_translation_status?: string;
    target_language?: string;
  }) => string;

  isAudioTranslated: (message: {
    audio_translation_status?: string;
    target_language?: string;
  }) => boolean;

  // Transcription
  getTranscription: (messageId: string) => Promise<string | null>;
}

export function useAudioTranslation(
  options: UseAudioTranslationOptions = {}
): UseAudioTranslationReturn {
  const { autoTranslate = true, context = 'general' } = options;

  const [isTranslating, setIsTranslating] = useState(false);
  const [userLanguage, setUserLanguage] = useState<SupportedLanguage>('fr');
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [currentPlayback, setCurrentPlayback] = useState<AudioPlaybackState>({
    messageId: null,
    isPlaying: false,
    isTranslated: false
  });

  // Charger la langue préférée de l'utilisateur
  useEffect(() => {
    const loadUserLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', user.id)
        .single();

      if (profile?.preferred_language) {
        setUserLanguage(profile.preferred_language as SupportedLanguage);
      }
    };
    loadUserLanguage();
  }, []);

  // Nettoyer l'audio au démontage
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
      }
    };
  }, [currentAudio]);

  // Traduire un message audio
  const translateAudioMessage = useCallback(async (
    audioUrl: string,
    messageId?: string,
    sourceLanguage?: string
  ): Promise<AudioTranslationResult> => {
    setIsTranslating(true);
    try {
      const result = await audioTranslationService.translateAudio(
        audioUrl,
        userLanguage,
        messageId,
        sourceLanguage,
        context
      );
      return result;
    } finally {
      setIsTranslating(false);
    }
  }, [userLanguage, context]);

  // Jouer l'audio approprié pour un message
  const playAudioForMessage = useCallback(async (
    messageId: string,
    fallbackUrl: string
  ): Promise<void> => {
    // Arrêter l'audio actuel
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Pas d'utilisateur, jouer l'audio original
        const audio = new Audio(fallbackUrl);
        audio.play();
        setCurrentAudio(audio);
        setCurrentPlayback({
          messageId,
          isPlaying: true,
          isTranslated: false
        });

        audio.onended = () => {
          setCurrentPlayback(prev => ({ ...prev, isPlaying: false }));
        };
        return;
      }

      // Obtenir l'audio approprié
      const { audioUrl, isTranslated, transcribedText } =
        await audioTranslationService.getAudioForUser(messageId, user.id);

      const urlToPlay = audioUrl || fallbackUrl;
      if (!urlToPlay) return;

      const audio = new Audio(urlToPlay);

      // Gérer les événements
      audio.onplay = () => {
        setCurrentPlayback({
          messageId,
          isPlaying: true,
          isTranslated,
          transcribedText
        });
      };

      audio.onended = () => {
        setCurrentPlayback(prev => ({ ...prev, isPlaying: false }));
      };

      audio.onerror = () => {
        console.error('Audio playback error');
        // Fallback à l'audio original
        if (isTranslated && fallbackUrl) {
          const fallbackAudio = new Audio(fallbackUrl);
          fallbackAudio.play();
          setCurrentAudio(fallbackAudio);
          setCurrentPlayback({
            messageId,
            isPlaying: true,
            isTranslated: false
          });
        }
      };

      await audio.play();
      setCurrentAudio(audio);

    } catch (error) {
      console.error('Error playing audio:', error);
      // Fallback
      const audio = new Audio(fallbackUrl);
      audio.play();
      setCurrentAudio(audio);
      setCurrentPlayback({
        messageId,
        isPlaying: true,
        isTranslated: false
      });
    }
  }, [currentAudio]);

  // Arrêter l'audio
  const stopAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentPlayback(prev => ({ ...prev, isPlaying: false }));
    }
  }, [currentAudio]);

  // Obtenir l'URL audio à afficher pour un message
  const getDisplayAudioUrl = useCallback((message: {
    id: string;
    file_url?: string;
    translated_audio_url?: string;
    audio_translation_status?: string;
    target_language?: string;
  }): string => {
    // Si traduction complète et langue correspond
    if (
      message.audio_translation_status === 'completed' &&
      message.translated_audio_url &&
      message.target_language === userLanguage
    ) {
      return message.translated_audio_url;
    }
    return message.file_url || '';
  }, [userLanguage]);

  // Vérifier si l'audio affiché est traduit
  const isAudioTranslated = useCallback((message: {
    audio_translation_status?: string;
    target_language?: string;
  }): boolean => {
    return (
      message.audio_translation_status === 'completed' &&
      message.target_language === userLanguage
    );
  }, [userLanguage]);

  // Obtenir la transcription d'un message
  const getTranscription = useCallback(async (
    messageId: string
  ): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('transcribed_text, translated_text, target_language')
        .eq('id', messageId)
        .single();

      if (!data) return null;

      // Retourner le texte traduit si disponible et correspond à la langue
      if (data.translated_text && data.target_language === userLanguage) {
        return data.translated_text;
      }
      return data.transcribed_text || null;
    } catch (error) {
      console.error('Error getting transcription:', error);
      return null;
    }
  }, [userLanguage]);

  return {
    isTranslating,
    currentPlayback,
    userLanguage,
    translateAudioMessage,
    playAudioForMessage,
    stopAudio,
    getDisplayAudioUrl,
    isAudioTranslated,
    getTranscription
  };
}

export default useAudioTranslation;

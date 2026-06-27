/**
 * 🎙️ SERVICE DE TRADUCTION AUDIO - 224SOLUTIONS
 * Traduction automatique des messages vocaux entre utilisateurs de langues différentes
 * Pipeline: Audio → Speech-to-Text → Traduction → Text-to-Speech → Audio traduit
 */

import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from './backendApi';
import { SupportedLanguage } from './translationService';

export interface AudioTranslationResult {
  success: boolean;
  transcribedText?: string;
  translatedText?: string;
  translatedAudioUrl?: string;
  translatedAudioBase64?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  wasTranslated?: boolean;
  error?: string;
}

export interface AudioMessage {
  id: string;
  audioUrl: string;
  originalLanguage?: string;
  targetLanguage?: string;
  translatedAudioUrl?: string;
  transcribedText?: string;
  translatedText?: string;
  audioTranslationStatus: 'none' | 'pending' | 'text_only' | 'completed' | 'failed';
}

class AudioTranslationService {
  private static instance: AudioTranslationService;
  private translationQueue: Map<string, Promise<AudioTranslationResult>> = new Map();

  private constructor() {}

  static getInstance(): AudioTranslationService {
    if (!AudioTranslationService.instance) {
      AudioTranslationService.instance = new AudioTranslationService();
    }
    return AudioTranslationService.instance;
  }

  /**
   * Traduire un message audio
   */
  async translateAudio(
    audioUrl: string,
    targetLanguage: SupportedLanguage,
    messageId?: string,
    sourceLanguage?: string,
    context: 'general' | 'commerce' | 'delivery' | 'payment' | 'support' = 'general'
  ): Promise<AudioTranslationResult> {
    // Éviter les traductions en double
    const queueKey = `${audioUrl}_${targetLanguage}`;
    if (this.translationQueue.has(queueKey)) {
      return this.translationQueue.get(queueKey)!;
    }

    const translationPromise = this.performTranslation(
      audioUrl,
      targetLanguage,
      messageId,
      sourceLanguage,
      context
    );

    this.translationQueue.set(queueKey, translationPromise);

    try {
      const result = await translationPromise;
      return result;
    } finally {
      this.translationQueue.delete(queueKey);
    }
  }

  /**
   * Effectuer la traduction via l'Edge Function
   */
  private async performTranslation(
    audioUrl: string,
    targetLanguage: string,
    messageId?: string,
    sourceLanguage?: string,
    context?: string
  ): Promise<AudioTranslationResult> {
    try {
      console.log('🎙️ Starting audio translation (backend):', { audioUrl, targetLanguage });

      // Pipeline 100% backend Node.js (Whisper STT → traduction → TTS).
      const data: any = await backendFetch('/edge-functions/translate-audio', {
        method: 'POST',
        body: { audioUrl, targetLanguage, sourceLanguage, messageId, context }
      });

      if (!data?.success) {
        console.error('Audio translation error:', data?.error);
        return {
          success: false,
          error: data?.error || 'Erreur de traduction audio'
        };
      }

      return {
        success: data.success,
        transcribedText: data.transcribedText,
        translatedText: data.translatedText,
        translatedAudioUrl: data.translatedAudioUrl,
        translatedAudioBase64: data.translatedAudioBase64,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        wasTranslated: data.wasTranslated
      };
    } catch (error: any) {
      console.error('Audio translation error:', error);
      return {
        success: false,
        error: error.message || 'Erreur de traduction audio'
      };
    }
  }

  /**
   * Traduire un audio depuis un Blob/File
   */
  async translateAudioBlob(
    audioBlob: Blob,
    targetLanguage: SupportedLanguage,
    messageId?: string,
    sourceLanguage?: string
  ): Promise<AudioTranslationResult> {
    try {
      // Convertir le blob en base64
      const audioBase64 = await this.blobToBase64(audioBlob);

      const { data, error } = await supabase.functions.invoke('translate-audio', {
        body: {
          audioBase64,
          targetLanguage,
          sourceLanguage,
          messageId
        }
      });

      if (error) throw error;

      return {
        success: data.success,
        transcribedText: data.transcribedText,
        translatedText: data.translatedText,
        translatedAudioUrl: data.translatedAudioUrl,
        translatedAudioBase64: data.translatedAudioBase64,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        wasTranslated: data.wasTranslated
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erreur de traduction audio'
      };
    }
  }

  /**
   * Convertir un Blob en base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Enlever le préfixe data:audio/xxx;base64,
        const base64Data = base64.split(',')[1] || base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Obtenir l'URL audio appropriée pour un utilisateur
   */
  async getAudioForUser(
    messageId: string,
    userId: string
  ): Promise<{ audioUrl: string; isTranslated: boolean; transcribedText?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_audio_for_user', {
        p_message_id: messageId,
        p_user_id: userId
      });

      if (error) throw error;

      const result = data?.[0] as any;
      return {
        audioUrl: result?.audio_url || '',
        isTranslated: result?.is_translated || false,
        transcribedText: result?.transcribed_text || result?.display_text
      };
    } catch (error) {
      console.error('Error getting audio for user:', error);
      return { audioUrl: '', isTranslated: false };
    }
  }

  /**
   * Vérifier si une traduction audio est nécessaire
   */
  async needsAudioTranslation(
    senderId: string,
    recipientId: string
  ): Promise<boolean> {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, preferred_language')
        .in('id', [senderId, recipientId]);

      if (!profiles || profiles.length < 2) return false;

      const senderLang = profiles.find(p => p.id === senderId)?.preferred_language || 'fr';
      const recipientLang = profiles.find(p => p.id === recipientId)?.preferred_language || 'fr';

      return senderLang !== recipientLang;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Obtenir les messages audio en attente de traduction
   */
  async getPendingAudioTranslations(limit: number = 10): Promise<AudioMessage[]> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_pending_audio_translations', {
        p_limit: limit
      });

      if (error) throw error;

      return (data || []).map((msg: any) => ({
        id: msg.message_id,
        audioUrl: msg.audio_url,
        originalLanguage: msg.original_language,
        targetLanguage: msg.target_language,
        audioTranslationStatus: 'pending' as const
      }));
    } catch (error) {
      console.error('Error getting pending translations:', error);
      return [];
    }
  }

  /**
   * Traiter les messages audio en attente (batch processing)
   */
  async processPendingTranslations(): Promise<number> {
    const pending = await this.getPendingAudioTranslations();
    let processed = 0;

    for (const message of pending) {
      try {
        await this.translateAudio(
          message.audioUrl,
          message.targetLanguage as SupportedLanguage,
          message.id,
          message.originalLanguage
        );
        processed++;
      } catch (error) {
        console.error(`Failed to translate message ${message.id}:`, error);
      }
    }

    return processed;
  }

  /**
   * Créer un lecteur audio avec l'URL appropriée
   */
  createAudioPlayer(audioUrl: string): HTMLAudioElement {
    const audio = new Audio(audioUrl);
    audio.preload = 'metadata';
    return audio;
  }

  /**
   * Jouer l'audio traduit ou original selon l'utilisateur
   */
  async playAudioForUser(
    messageId: string,
    userId: string,
    fallbackUrl?: string
  ): Promise<HTMLAudioElement | null> {
    try {
      const { audioUrl, isTranslated } = await this.getAudioForUser(messageId, userId);
      const url = audioUrl || fallbackUrl;

      if (!url) return null;

      const audio = this.createAudioPlayer(url);

      // Log pour debug
      console.log(`🎧 Playing ${isTranslated ? 'translated' : 'original'} audio`);

      return audio;
    } catch (error) {
      console.error('Error playing audio:', error);
      return null;
    }
  }
}

// Export singleton
export const audioTranslationService = AudioTranslationService.getInstance();

// Export helper functions
export const translateAudio = (
  audioUrl: string,
  targetLanguage: SupportedLanguage,
  messageId?: string,
  sourceLanguage?: string
) => audioTranslationService.translateAudio(audioUrl, targetLanguage, messageId, sourceLanguage);

export const getAudioForUser = (messageId: string, userId: string) =>
  audioTranslationService.getAudioForUser(messageId, userId);

export const needsAudioTranslation = (senderId: string, recipientId: string) =>
  audioTranslationService.needsAudioTranslation(senderId, recipientId);

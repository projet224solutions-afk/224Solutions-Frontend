/**
 * 🌍 HOOK DE TRADUCTION DES MESSAGES - 224SOLUTIONS
 * Gère la traduction automatique des messages de chat entre utilisateurs
 */

import { useState, useEffect, useCallback } from 'react';
import { translationService, SupportedLanguage, SUPPORTED_LANGUAGES, TranslationResult } from '@/services/translationService';
import { Message } from '@/types/communication.types';

interface UseMessageTranslationOptions {
  autoTranslate?: boolean;
  context?: 'general' | 'commerce' | 'delivery' | 'payment' | 'support';
}

interface UseMessageTranslationReturn {
  userLanguage: SupportedLanguage;
  setUserLanguage: (lang: SupportedLanguage) => Promise<boolean>;
  translateMessage: (content: string, sourceLang?: string) => Promise<TranslationResult>;
  getDisplayContent: (message: Message) => string;
  isTranslated: (message: Message) => boolean;
  showOriginal: (messageId: string) => void;
  hideOriginal: (messageId: string) => void;
  isShowingOriginal: (messageId: string) => boolean;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  isLoading: boolean;
}

export function useMessageTranslation(options: UseMessageTranslationOptions = {}): UseMessageTranslationReturn {
  const { autoTranslate = true, context = 'general' } = options;

  const [userLanguage, setUserLanguageState] = useState<SupportedLanguage>('fr');
  const [showOriginalIds, setShowOriginalIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Charger la langue préférée de l'utilisateur
  useEffect(() => {
    const loadUserLanguage = async () => {
      const lang = await translationService.getUserPreferredLanguage();
      setUserLanguageState(lang);
    };
    loadUserLanguage();
  }, []);

  // Mettre à jour la langue préférée
  const setUserLanguage = useCallback(async (lang: SupportedLanguage): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await translationService.setUserPreferredLanguage(lang);
      if (success) {
        setUserLanguageState(lang);
      }
      return success;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Traduire un message
  const translateMessage = useCallback(async (
    content: string,
    sourceLang?: string
  ): Promise<TranslationResult> => {
    return translationService.translateMessage({
      content,
      sourceLanguage: sourceLang,
      targetLanguage: userLanguage,
      context
    });
  }, [userLanguage, context]);

  // Obtenir le contenu à afficher pour un message
  const getDisplayContent = useCallback((message: Message): string => {
    // Si l'utilisateur veut voir l'original
    if (showOriginalIds.has(message.id)) {
      return message.content;
    }

    // Si une traduction est disponible et correspond à la langue de l'utilisateur
    if (
      message.translation_status === 'completed' &&
      message.translated_content &&
      message.target_language === userLanguage
    ) {
      return message.translated_content;
    }

    // Sinon, afficher le contenu original
    return message.display_content || message.content;
  }, [showOriginalIds, userLanguage]);

  // Vérifier si un message est affiché traduit
  const isTranslated = useCallback((message: Message): boolean => {
    if (showOriginalIds.has(message.id)) {
      return false;
    }
    return (
      message.translation_status === 'completed' &&
      message.translated_content !== null &&
      message.translated_content !== undefined &&
      message.target_language === userLanguage
    );
  }, [showOriginalIds, userLanguage]);

  // Afficher l'original d'un message
  const showOriginal = useCallback((messageId: string) => {
    setShowOriginalIds(prev => new Set(prev).add(messageId));
  }, []);

  // Cacher l'original (revenir à la traduction)
  const hideOriginal = useCallback((messageId: string) => {
    setShowOriginalIds(prev => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
  }, []);

  // Vérifier si on affiche l'original
  const isShowingOriginal = useCallback((messageId: string): boolean => {
    return showOriginalIds.has(messageId);
  }, [showOriginalIds]);

  return {
    userLanguage,
    setUserLanguage,
    translateMessage,
    getDisplayContent,
    isTranslated,
    showOriginal,
    hideOriginal,
    isShowingOriginal,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isLoading
  };
}

export default useMessageTranslation;

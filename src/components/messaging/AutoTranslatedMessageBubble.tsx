/**
 * 🌍 BULLE DE MESSAGE AVEC TRADUCTION AUTOMATIQUE - 224SOLUTIONS
 * Affiche un message avec traduction automatique selon la langue de l'utilisateur
 */

import React, { useState, useEffect } from 'react';
import { Globe, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from '@/types/communication.types';
import { SUPPORTED_LANGUAGES, SupportedLanguage, translationService } from '@/services/translationService';
import { useTranslation } from '@/hooks/useTranslation';

interface AutoTranslatedMessageBubbleProps {
  message: Message;
  userLanguage: SupportedLanguage;
  isOwn: boolean;
  className?: string;
  onTranslationComplete?: (translatedContent: string) => void;
}

export const AutoTranslatedMessageBubble: React.FC<AutoTranslatedMessageBubbleProps> = ({
  message,
  userLanguage,
  isOwn,
  className = '',
  onTranslationComplete
}) => {
  const { t } = useTranslation();
  const [displayContent, setDisplayContent] = useState(message.content);
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalLanguage, setOriginalLanguage] = useState<string | null>(null);

  // Traduire automatiquement le message si nécessaire
  useEffect(() => {
    const translateMessage = async () => {
      // Si c'est notre propre message, pas besoin de traduire
      if (isOwn) {
        setDisplayContent(message.content);
        setIsTranslated(false);
        return;
      }

      // Si le message a déjà une traduction dans la bonne langue
      // Vérifie les deux noms de colonnes: translated_text (DB) et translated_content (alias)
      const existingTranslation = message.translated_text || message.translated_content;
      if (
        existingTranslation &&
        message.target_language === userLanguage
      ) {
        setDisplayContent(existingTranslation);
        setOriginalLanguage(message.original_language || null);
        setIsTranslated(true);
        return;
      }

      // On NE court-circuite PAS avec l'heuristique client (peu fiable sur les
      // messages courts/sans accents). On laisse le backend détecter et décider :
      // il renvoie wasTranslated=false (sans appeler OpenAI) si c'est déjà la
      // bonne langue. Résultat mis en cache + persisté → pas de re-appel.
      setIsTranslating(true);
      try {
        const result = await translationService.translateMessage({
          content: message.content,
          sourceLanguage: undefined,
          targetLanguage: userLanguage,
          messageId: message.id,
          context: 'general'
        });

        if (result.wasTranslated) {
          setDisplayContent(result.translatedContent);
          setOriginalLanguage(result.sourceLanguage);
          setIsTranslated(true);
          onTranslationComplete?.(result.translatedContent);
        } else {
          setDisplayContent(message.content);
          setIsTranslated(false);
        }
      } catch (error) {
        console.error('[AutoTranslate] Erreur:', error);
        setDisplayContent(message.content);
        setIsTranslated(false);
      } finally {
        setIsTranslating(false);
      }
    };

    translateMessage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.content, userLanguage, isOwn, message.translation_status, message.translated_content, message.target_language, message.original_language, onTranslationComplete]);

  const getLanguageName = (code?: string): string => {
    if (!code) return '';
    return SUPPORTED_LANGUAGES[code as SupportedLanguage] || code.toUpperCase();
  };

  const currentContent = showOriginal ? message.content : displayContent;

  return (
    <div className={cn("relative", className)}>
      {/* Indicateur de traduction en cours */}
      {isTranslating && (
        <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{t('common.loading') || 'Loading...'}</span>
        </div>
      )}

      {/* Contenu du message */}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
        {currentContent}
      </p>

      {/* Indicateur de traduction et bouton voir original */}
      {isTranslated && !isOwn && (
        <div className="flex items-center gap-1 mt-1.5">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className={cn(
              "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
              showOriginal
                ? "bg-primary/20 text-primary hover:bg-primary/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Globe className="w-2.5 h-2.5" />
            {showOriginal ? (
              <>
                <span>Original ({getLanguageName(originalLanguage)})</span>
                <EyeOff className="w-2.5 h-2.5 ml-0.5" />
              </>
            ) : (
              <>
                <span>{t('messaging.translated') || 'Translated'}</span>
                <Eye className="w-2.5 h-2.5 ml-0.5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Badge compact pour indiquer la langue d'un message
 */
interface LanguageIndicatorProps {
  languageCode?: string;
  isTranslated?: boolean;
  className?: string;
}

export const LanguageIndicator: React.FC<LanguageIndicatorProps> = ({
  languageCode,
  isTranslated = false,
  className = ''
}) => {
  if (!languageCode) return null;

  const getLanguageName = (code: string): string => {
    return SUPPORTED_LANGUAGES[code as SupportedLanguage] || code.toUpperCase();
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded",
        isTranslated
          ? "bg-primary/10 text-primary"
          : "bg-muted/50 text-muted-foreground",
        className
      )}
    >
      <Globe className="w-2 h-2" />
      {getLanguageName(languageCode)}
    </span>
  );
};

export default AutoTranslatedMessageBubble;

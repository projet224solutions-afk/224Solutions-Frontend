/**
 * 🌍 COMPOSANT MESSAGE TRADUIT - 224SOLUTIONS
 * Affiche un message avec support de traduction et option "Voir l'original"
 */

import React from 'react';
import { Globe, Eye, EyeOff } from 'lucide-react';
import { Message } from '@/types/communication.types';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/services/translationService';

interface TranslatedMessageProps {
  message: Message;
  displayContent: string;
  isTranslated: boolean;
  isShowingOriginal: boolean;
  onShowOriginal: () => void;
  onHideOriginal: () => void;
  className?: string;
}

export const TranslatedMessage: React.FC<TranslatedMessageProps> = ({
  message,
  displayContent,
  isTranslated,
  isShowingOriginal,
  onShowOriginal,
  onHideOriginal,
  className = ''
}) => {
  const getLanguageName = (code?: string): string => {
    if (!code) return '';
    return SUPPORTED_LANGUAGES[code as SupportedLanguage] || code;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Contenu du message */}
      <p className="whitespace-pre-wrap break-words">{displayContent}</p>

      {/* Indicateur de traduction */}
      {isTranslated && !isShowingOriginal && (
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={onShowOriginal}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
            title={`Traduit depuis ${getLanguageName(message.original_language)}`}
          >
            <Globe className="w-3 h-3" />
            <span>Traduit</span>
            <Eye className="w-3 h-3 ml-1" />
          </button>
        </div>
      )}

      {/* Bouton pour revenir à la traduction */}
      {isShowingOriginal && isTranslated && (
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={onHideOriginal}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            title="Voir la traduction"
          >
            <Globe className="w-3 h-3" />
            <span>Original ({getLanguageName(message.original_language)})</span>
            <EyeOff className="w-3 h-3 ml-1" />
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Badge indiquant la langue d'un message
 */
interface LanguageBadgeProps {
  languageCode?: string;
  isTranslated?: boolean;
  size?: 'sm' | 'md';
}

export const LanguageBadge: React.FC<LanguageBadgeProps> = ({
  languageCode,
  isTranslated = false,
  size = 'sm'
}) => {
  if (!languageCode) return null;

  const getLanguageName = (code: string): string => {
    return SUPPORTED_LANGUAGES[code as SupportedLanguage] || code.toUpperCase();
  };

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${
        isTranslated
          ? 'bg-blue-500/20 text-blue-300'
          : 'bg-gray-500/20 text-gray-400'
      }`}
    >
      <Globe className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {getLanguageName(languageCode)}
    </span>
  );
};

export default TranslatedMessage;

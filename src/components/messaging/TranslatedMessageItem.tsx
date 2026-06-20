/**
 * 🌍 MessageItem + traduction automatique des messages REÇUS vers la langue conversationnelle.
 *
 * Enveloppe MessageItem (conserve audio/fichiers/réponses) et, pour un message TEXTE reçu
 * (pas le sien), traduit le contenu vers `targetLanguage` via le backend (translationService,
 * résultat mis en cache/persisté). N'altère JAMAIS ses propres messages ni les non-texte.
 */
import { useEffect, useState } from 'react';
import MessageItem from '@/components/communication/MessageItem';
import { translationService, SupportedLanguage } from '@/services/translationService';
import { Globe } from 'lucide-react';

interface TranslatedMessageItemProps {
  /** Objet message au format attendu par MessageItem (content = texte à afficher). */
  message: any;
  /** Texte original (source) à traduire si le message est reçu. */
  rawContent: string;
  isOwn: boolean;
  messageId: string;
  targetLanguage: SupportedLanguage;
  onReply?: () => void;
  onDelete?: (msgId: string, deleteForEveryone: boolean) => void;
}

export function TranslatedMessageItem({
  message, rawContent, isOwn, messageId, targetLanguage, onReply, onDelete,
}: TranslatedMessageItemProps) {
  const [content, setContent] = useState<string>(message.content);
  const [translated, setTranslated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // On ne traduit que les messages TEXTE reçus d'un autre, non vides.
    if (isOwn || message.type !== 'text' || !rawContent?.trim()) {
      setContent(message.content);
      setTranslated(false);
      return;
    }
    (async () => {
      try {
        const res = await translationService.translateMessage({
          content: rawContent,
          sourceLanguage: undefined,    // laisser le backend détecter et décider
          targetLanguage,
          messageId,
          context: 'general',
        });
        if (cancelled) return;
        if (res.wasTranslated) {
          setContent(res.translatedContent);
          setTranslated(true);
        } else {
          setContent(rawContent);
          setTranslated(false);
        }
      } catch {
        if (!cancelled) { setContent(rawContent); setTranslated(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [rawContent, isOwn, messageId, targetLanguage, message.type, message.content]);

  return (
    <div className="relative">
      <MessageItem message={{ ...message, content }} onReply={onReply} onDelete={onDelete} />
      {translated && (
        <div className={`flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 ${isOwn ? 'justify-end pr-2' : 'pl-2'}`}>
          <Globe className="w-2.5 h-2.5" /> traduit
        </div>
      )}
    </div>
  );
}

export default TranslatedMessageItem;

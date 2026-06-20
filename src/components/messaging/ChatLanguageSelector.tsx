import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🌍 Sélecteur de LANGUE CONVERSATIONNELLE — l'utilisateur choisit la langue dans laquelle
 * il reçoit ses messages (traduction auto), changeable à tout moment. Indépendant de l'UI.
 * S'appuie sur useChatLanguage (persiste profil + localStorage + synchro inter-composants).
 */
import { Globe } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useChatLanguage } from '@/hooks/useChatLanguage';
import { toast } from 'sonner';

interface ChatLanguageSelectorProps {
  /** Affiche un libellé court à côté de l'icône (par défaut: icône seule, compacte). */
  showLabel?: boolean;
  className?: string;
}

export function ChatLanguageSelector({ showLabel = false, className }: ChatLanguageSelectorProps) {
  const { t } = useTranslation();
  const { chatLanguage, setChatLanguage, languages } = useChatLanguage();

  const entries = Object.entries(languages); // [code, libellé]

  return (
    <Select
      value={chatLanguage}
      onValueChange={(v) => {
        setChatLanguage(v as any);
        toast.success(`Messages traduits en ${languages[v] || v}`);
      }}
    >
      <SelectTrigger className={`h-9 gap-1.5 ${showLabel ? 'w-[150px]' : 'w-auto px-2'} ${className || ''}`} aria-label={t('chatLanguageSelector.langueDesMessages')}>
        <Globe className="w-4 h-4 shrink-0 text-muted-foreground" />
        {showLabel ? <SelectValue /> : <span className="text-xs font-medium uppercase">{chatLanguage}</span>}
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {entries.map(([code, label]) => (
          <SelectItem key={code} value={code}>
            <span className="text-xs text-muted-foreground uppercase mr-2">{code}</span>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default ChatLanguageSelector;

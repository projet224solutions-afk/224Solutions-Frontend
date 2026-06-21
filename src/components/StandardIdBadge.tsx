/**
 * 🆔 COMPOSANT: BADGE ID STANDARDISÉ
 * Affiche un ID au format AAA0001 avec style et copyable
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from "@/hooks/useTranslation";
import { Hash, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StandardIdBadgeProps {
  standardId: string | null | undefined;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  copyable?: boolean;
  className?: string;
}

/**
 * Badge pour afficher les IDs standardisés 224SOLUTIONS
 */
export function StandardIdBadge({
  standardId,
  variant = 'default',
  size = 'md',
  showIcon = true,
  copyable = true,
  className
}: StandardIdBadgeProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const formattedId = standardId ? standardId.toUpperCase().trim() : '';

  const handleCopy = async () => {
    if (!formattedId || !copyable) return;

    try {
      await navigator.clipboard.writeText(formattedId);
      setCopied(true);
      toast.success(t('standardIdBadge.idCopie'), {
        description: formattedId
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      toast.error(t('standardIdBadge.echecCopieId'));
    }
  };

  if (!formattedId) {
    return (
      <Badge variant="outline" className={className}>
        <Hash className="w-3 h-3 mr-1" />
        N/A
      </Badge>
    );
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  // Déterminer le format d'affichage
  const is224Format = formattedId.startsWith('224-');

  return (
    <Badge
      variant={variant}
      className={cn(
        'font-mono font-semibold tracking-wider',
        sizeClasses[size],
        copyable && 'cursor-pointer hover:opacity-80 transition-opacity',
        is224Format && 'bg-orange-500/10/10 border-orange-500/30',
        className
      )}
      onClick={handleCopy}
    >
      {showIcon && <Hash className="w-3 h-3 mr-1.5" />}
      {is224Format ? (
        <>
          <span className="font-bold" style={{ color: 'hsl(15 100% 50%)' }}>224</span>
          <span className="text-muted-foreground">-</span>
          <span className="font-bold" style={{ color: 'hsl(15 100% 50%)' }}>{formattedId.substring(4, 7)}</span>
          <span className="text-muted-foreground">-</span>
          <span className="font-bold" style={{ color: 'hsl(15 100% 50%)' }}>{formattedId.substring(8)}</span>
        </>
      ) : (
        <>
          <span className="text-primary font-bold">{formattedId.substring(0, 3)}</span>
          <span className="text-muted-foreground">{formattedId.substring(3)}</span>
        </>
      )}
      {copyable && (
        copied ? (
          <Check className="w-3 h-3 ml-1.5 text-[#ff4000]" />
        ) : (
          <Copy className="w-3 h-3 ml-1.5 opacity-50" />
        )
      )}
    </Badge>
  );
}

export default StandardIdBadge;

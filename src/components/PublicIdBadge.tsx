/**
 * 🔧 COMPOSANT: BADGE D'AFFICHAGE ID PUBLIC
 * Affiche un ID public au format LLLDDDD avec style
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from "@/hooks/useTranslation";
import { Hash, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { formatPublicId } from '@/utils/publicIdFormatter';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PublicIdBadgeProps {
  publicId: string | null | undefined;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  copyable?: boolean;
  className?: string;
}

export function PublicIdBadge({
  publicId,
  variant = 'secondary',
  size = 'md',
  showIcon = true,
  copyable = true,
  className
}: PublicIdBadgeProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const formattedId = formatPublicId(publicId);

  if (!formattedId) {
    return null;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!copyable) return;

    try {
      await navigator.clipboard.writeText(formattedId);
      setCopied(true);
      toast.success(`ID copié: ${formattedId}`);

      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      toast.error(t('publicIdBadge.erreurLorsDeLaCopie'));
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        'font-mono font-semibold tracking-wider gap-1.5',
        sizeClasses[size],
        copyable && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={copyable ? handleCopy : undefined}
      title={copyable ? 'Cliquer pour copier' : formattedId}
    >
      {showIcon && <Hash className="w-3 h-3" />}
      <span>{formattedId}</span>
      {copyable && (
        copied ? (
          <Check className="w-3 h-3 text-[#ff4000]" />
        ) : (
          <Copy className="w-3 h-3 opacity-60" />
        )
      )}
    </Badge>
  );
}

export default PublicIdBadge;

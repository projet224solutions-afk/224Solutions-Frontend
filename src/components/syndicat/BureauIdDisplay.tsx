import { Badge } from '@/components/ui/badge';
import { useTranslation } from "@/hooks/useTranslation";
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface BureauIdDisplayProps {
  bureauCode: string;
  bureauName?: string;
  className?: string;
  layout?: 'horizontal' | 'vertical';
}

export function BureauIdDisplay({
  bureauCode,
  bureauName,
  className = '',
  layout = 'horizontal'
}: BureauIdDisplayProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(bureauCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (layout === 'vertical') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {bureauName && <span className="font-semibold text-foreground">{bureauName}</span>}
        <Badge
          variant="default"
          className="w-fit cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleCopy}
        >
          <span className="font-mono font-bold">{bureauCode}</span>
          {copied ? (
            <Check className="w-3 h-3 ml-2" />
          ) : (
            <Copy className="w-3 h-3 ml-2" />
          )}
        </Badge>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg ${className}`}>
      <span className="text-xs font-medium text-primary">ID Bureau:</span>
      <span
        className="text-xs font-mono font-bold text-primary cursor-pointer hover:underline"
        onClick={handleCopy}
        title={t('bureauIdDisplay.cliquerPourCopier')}
      >
        {bureauCode}
      </span>
      {copied && <Check className="w-3 h-3 text-[#ff4000]" />}
    </div>
  );
}
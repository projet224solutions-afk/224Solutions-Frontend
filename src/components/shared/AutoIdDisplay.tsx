import { useTranslation } from "@/hooks/useTranslation";
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { RoleType, formatIdForDisplay } from "@/lib/autoIdGenerator";

interface AutoIdDisplayProps {
  id: string | null | undefined;
  roleType: RoleType;
  showCopy?: boolean;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

/**
 * Composant d'affichage d'ID automatique
 * S'intègre partout sans modifier le code existant
 */
export function AutoIdDisplay({
  id,
  roleType,
  showCopy = true,
  className = '',
  variant = 'outline'
}: AutoIdDisplayProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!id) return;

    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success(t('autoIdDisplay.idCopieDansLePresse'));
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      toast.error(t('autoIdDisplay.erreurLorsDeLaCopie'));
    }
  };

  const displayId = formatIdForDisplay(id, roleType);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant={variant} className="font-mono">
        {displayId}
      </Badge>
      {showCopy && id && (
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Copier l'ID"
        >
          {copied ? (
            <Check className="w-3 h-3 text-[#ff4000]" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
}

interface AutoIdCardProps {
  id: string | null | undefined;
  roleType: RoleType;
  label?: string;
}

/**
 * Carte d'affichage d'ID avec label
 */
export function AutoIdCard({ id, roleType, label }: AutoIdCardProps) {
  const { t } = useTranslation();
  const getRoleLabel = (type: RoleType): string => {
    const labels: Record<RoleType, string> = {
      agent: 'Code Agent',
      vendor: 'Code Vendeur',
      bureau: 'Code Bureau',
      driver: 'Code Chauffeur',
      taxi: 'Code Taxi-Moto',
      livreur: 'Code Livreur',
      client: 'Code Client',
      pdg: 'Code PDG',
      transitaire: 'Code Transitaire',
      worker: 'Code Employé'
    };
    return labels[type];
  };

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">
        {label || getRoleLabel(roleType)}
      </p>
      <AutoIdDisplay id={id} roleType={roleType} variant="secondary" />
    </div>
  );
}

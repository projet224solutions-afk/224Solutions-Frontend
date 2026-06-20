/**
 * QUICK TRANSFER BUTTON - VERSION UNIFIÉE
 * Utilise le nouveau système de transfert standardisé
 */

import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedTransferDialog } from "./UnifiedTransferDialog";
import { useUserCode } from "@/hooks/useUserCode";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";

interface QuickTransferButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showText?: boolean;
}

export function QuickTransferButton({
  variant = "default",
  size = "default",
  className = "",
  showText = true
}: QuickTransferButtonProps) {
  const { t } = useTranslation();
  const { userCode, loading } = useUserCode();

  // Si pas de code, afficher un bouton désactivé
  if (!userCode) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {showText && <span className="ml-2">Transfert rapide</span>}
      </Button>
    );
  }

  // Utiliser le composant unifié
  return (
    <UnifiedTransferDialog
      senderCode={userCode}
      variant={variant}
      size={size}
      className={className}
      showText={showText}
      onSuccess={() => {
        toast.success(t('quickTransferButton.transfertReussi'));
      }}
    />
  );
}

/**
 * AGENT KYC STATUS BADGE - 224SOLUTIONS
 * Badge de statut KYC pour l'interface agent
 */

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { ShieldCheck, Shield, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AgentKYCStatusProps {
  kyc_status?: 'verified' | 'pending' | 'rejected' | 'unverified';
}

export const AgentKYCStatus = ({ kyc_status = 'unverified' }: AgentKYCStatusProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleVerifyClick = () => {
    navigate('/agent/settings?tab=kyc');
  };

  // Agent vérifié
  if (kyc_status === 'verified') {
    return (
      <Badge variant="default" className="bg-[#ff4000] hover:bg-[#ff4000] gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>{t('agentKYCStatus.compteVerifie')}</span>
      </Badge>
    );
  }

  // Vérification en cours
  if (kyc_status === 'pending') {
    return (
      <Badge variant="default" className="bg-[#ff4000] hover:bg-[#ff4000] gap-1.5">
        <Shield className="h-3.5 w-3.5" />
        <span>{t('agentKYCStatus.verificationEnCours')}</span>
      </Badge>
    );
  }

  // Rejeté
  if (kyc_status === 'rejected') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>{t('agentKYCStatus.verifieRejete')}</span>
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={handleVerifyClick}
          className="h-7 text-xs"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  // Non vérifié (défaut)
  return (
    <div className="flex items-center gap-2">
      <Badge variant="destructive" className="gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5" />
        <span>{t('agentKYCStatus.nonVerifie')}</span>
      </Badge>
      <Button
        size="sm"
        variant="outline"
        onClick={handleVerifyClick}
        className="h-7 text-xs"
      >
        Vérifier maintenant
      </Button>
    </div>
  );
};

/**
 * Badge KYC Status pour interface vendeur
 * Affiche le statut de vérification KYC dans le header
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface VendorKYCStatusProps {
  kycStatus: 'verified' | 'pending' | 'rejected' | 'unverified' | null;
  className?: string;
}

export function VendorKYCStatus({ kycStatus, className = "" }: VendorKYCStatusProps) {
  const navigate = useNavigate();

  if (kycStatus === 'verified') {
    return (
      <Badge
        variant="default"
        className={`bg-orange-100 text-[#ff4000] border-orange-300 gap-1 ${className}`}
      >
        <ShieldCheck className="w-3 h-3" />
        KYC Vérifié
      </Badge>
    );
  }

  if (kycStatus === 'pending') {
    return (
      <Badge
        variant="default"
        className={`bg-orange-100 text-[#ff4000] border-orange-300 gap-1 ${className}`}
      >
        <Shield className="w-3 h-3" />
        KYC En cours
      </Badge>
    );
  }

  if (kycStatus === 'rejected') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="destructive" className="gap-1">
          <ShieldAlert className="w-3 h-3" />
          KYC Refusé
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            console.log('Navigation vers KYC settings pour réessayer');
            navigate('/vendeur/settings?tab=kyc');
          }}
          className="h-7 text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  // unverified or null
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="w-3 h-3" />
        KYC Non vérifié
      </Badge>
      <Button
        size="sm"
        variant="default"
        onClick={() => {
          console.log('Navigation vers KYC settings');
          navigate('/vendeur/settings?tab=kyc');
        }}
        className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        Vérifier maintenant
      </Button>
    </div>
  );
}

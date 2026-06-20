/**
 * Badge de statut KYC pour les Bureaux Syndicats
 * Affiche le statut de vérification du bureau
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Shield, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BureauKYCStatusProps {
  status: 'verified' | 'pending' | 'rejected' | 'unverified';
  bureauId?: string;
  className?: string;
}

export function BureauKYCStatus({ status, bureauId, className }: BureauKYCStatusProps) {
  const _navigate = useNavigate();

  const handleVerifyClick = () => {
    // Ne rien faire pour l'instant, la vérification KYC se fait dans l'onglet Settings du dashboard
    // Le badge est informatif uniquement
  };

  if (status === 'verified') {
    return (
      <Badge className={`bg-[#ff4000] hover:bg-[#ff4000] text-white gap-1 ${className}`}>
        <ShieldCheck className="w-3 h-3" />
        Bureau vérifié
      </Badge>
    );
  }

  if (status === 'pending') {
    return (
      <Badge className={`bg-[#ff4000] hover:bg-[#ff4000] text-white gap-1 ${className}`}>
        <Shield className="w-3 h-3" />
        Vérification en cours...
      </Badge>
    );
  }

  if (status === 'rejected') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge className="bg-[#ff4000] hover:bg-[#ff4000] text-white gap-1">
          <ShieldAlert className="w-3 h-3" />
          Vérification rejetée
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={handleVerifyClick}
          className="text-xs h-7"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  // unverified
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="w-3 h-3" />
        Bureau non vérifié
      </Badge>
      <Button
        size="sm"
        variant="outline"
        onClick={handleVerifyClick}
        className="text-xs h-7"
      >
        Vérifier maintenant
      </Button>
    </div>
  );
}

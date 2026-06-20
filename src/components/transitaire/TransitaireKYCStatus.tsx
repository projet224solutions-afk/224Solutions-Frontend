/**
 * Badge de statut KYC pour les Transitaires Internationaux
 * Affiche le statut de vérification du transitaire
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Shield, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TransitaireKYCStatusProps {
  status?: 'verified' | 'pending' | 'rejected' | 'unverified';
  className?: string;
}

export function TransitaireKYCStatus({
  status = 'unverified',
  className = ''
}: TransitaireKYCStatusProps) {
  const navigate = useNavigate();

  const handleVerifyClick = () => {
    // Navigate vers la page de vérification KYC du transitaire
    navigate('/transitaire/settings?tab=kyc');
  };

  // verified - Transitaire vérifié
  if (status === 'verified') {
    return (
      <Badge className={`bg-[#ff4000] hover:bg-[#ff4000] text-white gap-1 ${className}`}>
        <ShieldCheck className="w-3 h-3" />
        Transitaire certifié
      </Badge>
    );
  }

  // pending - Vérification en cours
  if (status === 'pending') {
    return (
      <Badge className={`bg-[#ff4000] hover:bg-[#ff4000] text-white gap-1 ${className}`}>
        <Shield className="w-3 h-3" />
        Certification en cours...
      </Badge>
    );
  }

  // rejected - Vérification rejetée
  if (status === 'rejected') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge className="bg-[#ff4000] hover:bg-[#ff4000] text-white gap-1">
          <ShieldAlert className="w-3 h-3" />
          Certification rejetée
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

  // unverified - Par défaut, non vérifié
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="w-3 h-3" />
        Transitaire non certifié
      </Badge>
      <Button
        size="sm"
        variant="outline"
        onClick={handleVerifyClick}
        className="text-xs h-7"
      >
        Certifier maintenant
      </Button>
    </div>
  );
}

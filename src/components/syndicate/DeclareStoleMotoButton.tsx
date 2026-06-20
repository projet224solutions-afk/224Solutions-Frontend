/**
 * BOUTON DÉCLARATION MOTO VOLÉE
 * Bouton visible pour les rôles autorisés (Bureau Syndicat, Admin)
 * Redirige vers la page dédiée de déclaration
 * 224Solutions - Système de Sécurité
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

interface DeclareStoleMotoButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  vehicleId?: string;
  plateNumber?: string;
}

export default function DeclareStoleMotoButton({
  variant = 'destructive',
  size = 'default',
  className = '',
  vehicleId,
  plateNumber
}: DeclareStoleMotoButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    // Construire l'URL avec les paramètres si disponibles
    let url = '/stolen-moto-declaration';
    const params = new URLSearchParams();

    if (vehicleId) {
      params.append('id', vehicleId);
    }
    if (plateNumber) {
      params.append('plate', plateNumber);
    }

    if (params.toString()) {
      url += '?' + params.toString();
    }

    navigate(url);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`bg-[#ff4000] hover:bg-[#ff4000] text-white ${className}`}
    >
      <ShieldAlert className="w-4 h-4 mr-2" />
      Déclarer Moto Volée
    </Button>
  );
}

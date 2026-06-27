/**
 * CERTIFIED VENDOR BADGE
 * Badge affichant le statut de certification d'un vendeur
 * 224SOLUTIONS
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { VendorCertificationStatus, getCertificationStatusLabel } from '@/types/vendorCertification';

interface CertifiedVendorBadgeProps {
  status: VendorCertificationStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<VendorCertificationStatus, {
  icon: typeof CheckCircle2;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}> = {
  CERTIFIE: {
    icon: CheckCircle2,
    variant: 'default',
    className: 'bg-[#04439e] hover:bg-[#04439e] text-white'
  },
  NON_CERTIFIE: {
    icon: Clock,
    variant: 'secondary',
    className: 'bg-gray-500 hover:bg-gray-600 text-white'
  },
  SUSPENDU: {
    icon: AlertTriangle,
    variant: 'destructive',
    className: 'bg-[#ff4000] hover:bg-[#ff4000] text-white'
  }
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5'
};

export function CertifiedVendorBadge({
  status,
  showIcon = true,
  size = 'md',
  className = ''
}: CertifiedVendorBadgeProps) {
  const config = statusConfig[status] || statusConfig.NON_CERTIFIE;
  const Icon = config.icon;
  const label = getCertificationStatusLabel(status);

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${sizeClasses[size]} ${className} inline-flex items-center gap-1`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />}
      {label}
    </Badge>
  );
}

export default CertifiedVendorBadge;

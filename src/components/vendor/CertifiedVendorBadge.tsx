/**
 * CERTIFIED VENDOR BADGE
 * Badge visuel "Vendeur certifié ✅"
 * Affichage sur profil, boutique, produits
 * 224SOLUTIONS
 */

import React from 'react';
import { Shield, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VendorCertificationStatus } from '@/types/vendorCertification';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface CertifiedVendorBadgeProps {
  status: VendorCertificationStatus;
  verifiedAt?: string | null;
  variant?: 'default' | 'compact' | 'detailed';
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function CertifiedVendorBadge({
  status,
  verifiedAt,
  variant = 'default',
  size = 'sm',
  showTooltip = true,
  className
}: CertifiedVendorBadgeProps) {
  const { t } = useTranslation();

  // Ne rien afficher si non certifié (pour les vues publiques)
  if (status === 'NON_CERTIFIE' && variant !== 'detailed') {
    return null;
  }

  const getBadgeConfig = () => {
    switch (status) {
      case 'CERTIFIE':
        return {
          icon: CheckCircle2,
          label: t('certifiedVendor.certified'),
          color: 'bg-[#04439e] text-white border-[#04439e]',
          iconColor: 'text-white',
          tooltipText: verifiedAt
            ? `${t('certifiedVendor.certifiedOnPrefix')} ${new Date(verifiedAt).toLocaleDateString('fr-FR')}`
            : t('certifiedVendor.certifiedBy')
        };
      case 'SUSPENDU':
        return {
          icon: AlertTriangle,
          label: t('certifiedVendor.suspended'),
          color: 'bg-[#ff4000] text-white border-[#ff4000]',
          iconColor: 'text-white',
          tooltipText: t('certifiedVendor.suspendedTooltip')
        };
      case 'NON_CERTIFIE':
      default:
        return {
          icon: XCircle,
          label: t('certifiedVendor.notCertified'),
          color: 'bg-gray-400 text-white border-gray-500',
          iconColor: 'text-white',
          tooltipText: t('certifiedVendor.notCertifiedTooltip')
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  // Variante compacte (juste icône)
  if (variant === 'compact') {
    const badge = (
      <div className={cn(
        "inline-flex items-center justify-center rounded-full p-1",
        config.color,
        className
      )}>
        <Icon className="w-3 h-3" />
      </div>
    );

    if (!showTooltip) return badge;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{config.tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Variante détaillée (avec statut et date)
  if (variant === 'detailed') {
    return (
      <div className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border",
        config.color,
        className
      )}>
        <Icon className="w-4 h-4" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{config.label}</span>
          {verifiedAt && status === 'CERTIFIE' && (
            <span className="text-xs opacity-90">
              {t('certifiedVendor.since')} {new Date(verifiedAt).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Variante par défaut (taille ajustable)
  const sizeStyles = {
    sm: { pad: 'px-2 py-1', icon: 'w-3.5 h-3.5', text: 'text-xs' },
    md: { pad: 'px-2.5 py-1', icon: 'w-4 h-4', text: 'text-sm' },
    lg: { pad: 'px-3 py-1.5', icon: 'w-5 h-5', text: 'text-base' },
  }[size];

  const badge = (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold shadow-sm",
        sizeStyles.pad,
        config.color,
        className
      )}
    >
      <Icon className={sizeStyles.icon} />
      <span className={sizeStyles.text}>{config.label}</span>
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{config.tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Export d'un composant simplifié pour icône seule
export function CertifiedIcon({
  status,
  className
}: {
  status: VendorCertificationStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  if (status !== 'CERTIFIE') return null;

  return (
    <CheckCircle2
      className={cn("text-[#04439e]", className)}
      aria-label={t('certifiedVendor.certified')}
    />
  );
}

// Export d'un shield icon pour grandes tailles
export function CertificationShield({
  status,
  size = 'md',
  className
}: {
  status: VendorCertificationStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (status !== 'CERTIFIE') return null;

  const sizeClass = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  }[size];

  return (
    <div className={cn(
      "relative inline-flex items-center justify-center",
      className
    )}>
      <Shield className={cn(
        "text-[#04439e] fill-blue-50",
        sizeClass
      )} />
      <CheckCircle2 className={cn(
        "absolute text-[#04439e]",
        size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8'
      )} />
    </div>
  );
}

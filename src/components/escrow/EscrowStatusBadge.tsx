/**
 * BADGE DE STATUT ESCROW
 * Affiche visuellement le statut d'une transaction escrow
 */

import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { Shield, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface EscrowStatusBadgeProps {
  status: 'pending' | 'held' | 'released' | 'refunded' | 'disputed';
  amount?: number;
  showAmount?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function EscrowStatusBadge({
  status,
  amount,
  showAmount = false,
  size = 'md'
}: EscrowStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          label: 'En attente',
          icon: Clock,
          variant: 'secondary' as const,
          color: 'text-orange-600'
        };
      case 'held':
        return {
          label: 'Fonds bloqués',
          icon: Shield,
          variant: 'default' as const,
          color: 'text-primary'
        };
      case 'released':
        return {
          label: 'Payé',
          icon: CheckCircle2,
          variant: 'default' as const,
          color: 'text-[#ff4000]'
        };
      case 'refunded':
        return {
          label: 'Remboursé',
          icon: XCircle,
          variant: 'destructive' as const,
          color: 'text-[#ff4000]'
        };
      case 'disputed':
        return {
          label: 'Litige',
          icon: AlertTriangle,
          variant: 'destructive' as const,
          color: 'text-[#ff4000]'
        };
      default:
        return {
          label: status,
          icon: Shield,
          variant: 'outline' as const,
          color: 'text-muted-foreground'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4'
  };

  return (
    <Badge
      variant={config.variant}
      className={`${sizeClasses[size]} gap-1.5 ${config.color}`}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
      {showAmount && amount && (
        <span className="ml-1 font-bold">
          <Money amount={amount || 0} from="GNF" />
        </span>
      )}
    </Badge>
  );
}

/**
 * TOOLTIP EXPLICATIF ESCROW
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EscrowTooltipProps {
  status: 'pending' | 'held' | 'released' | 'refunded' | 'disputed';
  children: React.ReactNode;
}

export function EscrowTooltip({ status, children }: EscrowTooltipProps) {
  const getTooltipMessage = () => {
    switch (status) {
      case 'pending':
        return 'La transaction est en attente de confirmation de paiement.';
      case 'held':
        return 'Les fonds sont bloqués de manière sécurisée et seront libérés après confirmation de la livraison/service.';
      case 'released':
        return 'Les fonds ont été transférés au vendeur/prestataire.';
      case 'refunded':
        return 'La transaction a été annulée et les fonds ont été remboursés.';
      case 'disputed':
        return 'Un litige est en cours sur cette transaction.';
      default:
        return 'Statut de la transaction escrow.';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <p className="text-xs">{getTooltipMessage()}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

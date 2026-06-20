/**
 * COMPOSANT D'AFFICHAGE DE PRIX LOCAL
 * Affiche automatiquement les prix dans la devise locale de l'utilisateur
 * Convertit en temps réel avec les taux du jour
 */

import React from 'react';
import { useConvertedPrice } from '@/hooks/usePriceConverter';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LocalPriceProps {
  /** Montant dans la devise source */
  amount: number;
  /** Devise source (ex: "USD", "EUR") */
  currency: string;
  /** Classes CSS additionnelles */
  className?: string;
  /** Afficher le prix original en petit */
  showOriginal?: boolean;
  /** Taille du texte */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Afficher un skeleton pendant le chargement */
  showSkeleton?: boolean;
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg font-semibold',
  xl: 'text-2xl font-bold',
};

export function LocalPrice({
  amount,
  currency,
  className,
  showOriginal = false,
  size = 'md',
  showSkeleton = true,
}: LocalPriceProps) {
  const safeAmount = typeof amount === 'string' ? parseFloat(String(amount).replace(/\s/g, '')) || 0 : (Number(amount) || 0);
  const converted = useConvertedPrice(safeAmount, currency);

  // Afficher un skeleton pendant le chargement
  if (!converted) {
    if (showSkeleton) {
      return <Skeleton className={cn('h-5 w-20', className)} />;
    }
    // Fallback: afficher le prix original
    return (
      <span className={cn(sizeClasses[size], className)}>
        {amount.toLocaleString()} {currency}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex flex-col', className)}>
      <span className={cn(sizeClasses[size])}>
        {converted.formatted}
      </span>
      {showOriginal && converted.wasConverted && (
        <span className="text-xs text-muted-foreground">
          ({converted.originalFormatted})
        </span>
      )}
    </span>
  );
}

/**
 * Composant pour afficher une gamme de prix
 */
interface LocalPriceRangeProps {
  minAmount: number;
  maxAmount: number;
  currency: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LocalPriceRange({
  minAmount,
  maxAmount,
  currency,
  className,
  size = 'md',
}: LocalPriceRangeProps) {
  const minConverted = useConvertedPrice(minAmount, currency);
  const maxConverted = useConvertedPrice(maxAmount, currency);

  if (!minConverted || !maxConverted) {
    return <Skeleton className={cn('h-5 w-32', className)} />;
  }

  // Si même montant, afficher un seul prix
  if (minAmount === maxAmount) {
    return (
      <span className={cn(sizeClasses[size], className)}>
        {minConverted.formatted}
      </span>
    );
  }

  return (
    <span className={cn(sizeClasses[size], className)}>
      {minConverted.formatted} - {maxConverted.formatted}
    </span>
  );
}

/**
 * HOC pour wrapper un composant avec le prix local
 */
export function withLocalPrice<P extends { amount: number; currency: string }>(
  WrappedComponent: React.ComponentType<P & { localPrice: ReturnType<typeof useConvertedPrice> }>
) {
  return function WithLocalPriceComponent(props: P) {
    const localPrice = useConvertedPrice(props.amount, props.currency);
    return <WrappedComponent {...props} localPrice={localPrice} />;
  };
}

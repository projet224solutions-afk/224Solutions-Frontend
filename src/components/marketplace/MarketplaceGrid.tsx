/**
 * MARKETPLACE GRID - Grille Responsive Professionnelle
 * 224Solutions - Standard International E-Commerce
 *
 * Spécifications:
 * - Mobile (≤600px): 3 colonnes
 * - Tablette (601-1024px): 4 colonnes
 * - Desktop: 4-8 colonnes selon largeur écran
 * - Utilise auto-fit avec minmax pour adaptation fluide
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MarketplaceGridProps {
  children: ReactNode;
  className?: string;
}

export function MarketplaceGrid({ children, className }: MarketplaceGridProps) {
  return (
    <div
      className={cn(
        'marketplace-grid',
        className
      )}
    >
      {children}
    </div>
  );
}

export default MarketplaceGrid;

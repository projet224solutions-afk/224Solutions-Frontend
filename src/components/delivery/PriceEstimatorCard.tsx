/**
 * CARTE D'ESTIMATION DE PRIX - Type Uber
 * Affichage détaillé du prix de livraison
 */

import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Money } from '@/components/Money';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Navigation, TrendingUp, Info } from 'lucide-react';
import type { PriceEstimate } from '@/services/pricing/PricingService';

interface PriceEstimatorCardProps {
  estimate: PriceEstimate | null;
  loading?: boolean;
}

export function PriceEstimatorCard({ estimate, loading }: PriceEstimatorCardProps) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Card className="bg-orange-500/10/10 border-orange-500/20">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!estimate) return null;

  return (
    <Card className="bg-orange-500/10/10 border-orange-500/20">
      <CardContent className="p-6 space-y-4">
        {/* Prix total */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <DollarSign className="h-6 w-6 text-orange-600" />
            <span className="text-sm font-medium text-muted-foreground">{t('priceEstimatorCard.prixEstime')}</span>
          </div>
          <div className="text-4xl font-bold text-orange-600">
            <Money amount={estimate.totalPrice} from="GNF" />
          </div>
          <Badge variant="outline" className="mt-2 gap-1">
            <Navigation className="h-3 w-3" />
            {estimate.distanceKm.toFixed(1)} km
          </Badge>
        </div>

        <Separator />

        {/* Détails du prix */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('priceEstimatorCard.prixDeBase')}</span>
            <span className="font-medium"><Money amount={estimate.breakdown.base} from="GNF" /></span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Distance ({estimate.distanceKm.toFixed(1)} km)</span>
            <span className="font-medium"><Money amount={estimate.breakdown.distance} from="GNF" /></span>
          </div>
          {estimate.breakdown.surge > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Ajustement
              </span>
              <span className="font-medium text-orange-600">
                +<Money amount={estimate.breakdown.surge} from="GNF" />
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('priceEstimatorCard.fraisDeService')}</span>
            <span className="font-medium"><Money amount={estimate.breakdown.serviceFee} from="GNF" /></span>
          </div>
        </div>

        <Separator />

        {/* Note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            Le prix final peut varier légèrement en fonction des conditions de circulation et de la disponibilité.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

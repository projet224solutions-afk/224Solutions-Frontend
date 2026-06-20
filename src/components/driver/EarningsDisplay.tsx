/**
 * COMPOSANT AFFICHAGE DES GAINS
 * Stats de revenus du livreur
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { TrendingUp, Package, Calendar, DollarSign } from 'lucide-react';

interface EarningsDisplayProps {
  totalEarnings: number;
  todayEarnings: number;
  todayDeliveries: number;
  weekEarnings: number;
  weekDeliveries: number;
  monthEarnings: number;
  monthDeliveries: number;
}

export function EarningsDisplay({
  totalEarnings,
  todayEarnings,
  todayDeliveries,
  weekEarnings,
  weekDeliveries,
  monthEarnings,
  monthDeliveries,
}: EarningsDisplayProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Gains */}
      <Card className="bg-gradient-to-br from-[#ff4000]/10 to-[#ff4000]/5 border-[#ff4000]/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#ff4000]" />
            Gains Totaux
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[#ff4000]">
            <Money amount={totalEarnings} from="GNF" />
          </div>
        </CardContent>
      </Card>

      {/* Aujourd'hui */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Aujourd'hui
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            <Money amount={todayEarnings} from="GNF" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <Package className="h-3 w-3 inline mr-1" />
            {todayDeliveries} livraisons
          </p>
        </CardContent>
      </Card>

      {/* Cette Semaine */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Cette Semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            <Money amount={weekEarnings} from="GNF" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <Package className="h-3 w-3 inline mr-1" />
            {weekDeliveries} livraisons
          </p>
        </CardContent>
      </Card>

      {/* Ce Mois */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#04439e]" />
            Ce Mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[#04439e]">
            <Money amount={monthEarnings} from="GNF" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <Package className="h-3 w-3 inline mr-1" />
            {monthDeliveries} livraisons
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

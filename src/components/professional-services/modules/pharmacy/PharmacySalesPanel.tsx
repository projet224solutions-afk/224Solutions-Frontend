/**
 * Panneau ventes pharmacie — inspiré Walgreens analytics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, TrendingDown, DollarSign, Eye,
  ShoppingCart, Calendar, ArrowUpRight
} from 'lucide-react';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import type { ServiceHealthStats, RecentHealthSale } from '@/hooks/useServiceHealthStats';

interface PharmacySalesPanelProps {
  stats: ServiceHealthStats;
  recentSales: RecentHealthSale[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
  confirmed: { label: 'Confirmée', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  completed: { label: 'Terminée', color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
  delivered: { label: 'Livrée', color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
  cancelled: { label: 'Annulée', color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
  processing: { label: 'En cours', color: 'bg-blue-100 text-[#04439e] dark:bg-[#04439e]/30 dark:text-[#04439e]' },
};

export function PharmacySalesPanel({ stats, recentSales }: PharmacySalesPanelProps) {
  const { t } = useTranslation();
  const formatCurrency = useFormatCurrency();
  const navigate = useNavigate();

  const revenueBreakdown = [
    { label: "Aujourd'hui", value: stats.sales.todayRevenue, icon: Calendar },
    { label: 'Cette semaine', value: stats.sales.weekRevenue, icon: TrendingUp },
    { label: 'Ce mois', value: stats.sales.monthRevenue, icon: TrendingUp },
    { label: 'Total', value: stats.sales.totalRevenue, icon: DollarSign, highlight: true },
  ];

  return (
    <div className="space-y-4">
      {/* Revenue breakdown cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {revenueBreakdown.map((item) => (
          <Card key={item.label} className={item.highlight ? 'bg-primary/5 border-primary/20' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`w-4 h-4 ${item.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              </div>
              <div className={`text-lg md:text-xl font-bold ${item.highlight ? 'text-primary' : ''}`}>
                {formatCurrency(item.value)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent sales */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Dernières ventes
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/vendeur/orders')}>
              Tout voir <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t('pharmacySalesPanel.aucuneVenteEnregistree')}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{t('pharmacySalesPanel.lesVentesApparaitrontIciAutomatiquement')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSales.map((sale, idx) => {
                const status = statusConfig[sale.status] || { label: sale.status, color: 'bg-muted' };
                return (
                  <div
                    key={sale.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {sale.customer_name || 'Client anonyme'}
                        </span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${status.color}`}>
                          {status.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(sale.created_at), 'dd MMM yyyy · HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="font-semibold text-sm">{formatCurrency(sale.total_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * KPI Cards pharmacie — inspiré Boots/CVS Health dashboard
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Users,
  ShoppingCart, Pill, Clock
} from 'lucide-react';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import type { ServiceHealthStats } from '@/hooks/useServiceHealthStats';

interface PharmacyKPICardsProps {
  stats: ServiceHealthStats;
}

export function PharmacyKPICards({ stats }: PharmacyKPICardsProps) {
  const { t } = useTranslation();
  const formatCurrency = useFormatCurrency();

  const kpis = [
    {
      title: t('pharmacyKpi.revenue'),
      value: formatCurrency(stats.sales.totalRevenue),
      subtitle: `${formatCurrency(stats.sales.todayRevenue)} ${t('pharmacyKpi.today')}`,
      icon: TrendingUp,
      accent: '',
      iconBg: 'bg-[#ff4000]/10',
      iconColor: 'text-[#ff4000]',
    },
    {
      title: t('pharmacyKpi.orders'),
      value: stats.sales.totalOrders.toString(),
      subtitle: `${stats.sales.totalOrders > 0 ? formatCurrency(stats.sales.totalRevenue / stats.sales.totalOrders) : '0'} ${t('pharmacyKpi.avg')}`,
      icon: ShoppingCart,
      accent: '',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
    },
    {
      title: t('pharmacyKpi.products'),
      value: stats.stock.totalProducts.toString(),
      subtitle: `${stats.stock.activeProducts} ${t('pharmacyKpi.active')}`,
      icon: Pill,
      accent: '',
      iconBg: 'bg-[#04439e]/10',
      iconColor: 'text-[#04439e]',
      badge: stats.stock.outOfStockCount > 0
        ? { text: `${stats.stock.outOfStockCount} ${t('pharmacyKpi.outOfStock')}`, variant: 'destructive' as const }
        : undefined,
    },
    {
      title: t('pharmacyKpi.stockAlerts'),
      value: stats.stock.lowStockCount.toString(),
      subtitle: `${stats.stock.outOfStockCount} ${t('pharmacyKpi.inRupture')}`,
      icon: AlertTriangle,
      accent: '',
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-600',
      urgent: stats.stock.lowStockCount > 0,
    },
    {
      title: t('pharmacyKpi.patients'),
      value: stats.clients.total.toString(),
      subtitle: t('pharmacyKpi.patientFile'),
      icon: Users,
      accent: '',
      iconBg: 'bg-[#04439e]/10',
      iconColor: 'text-[#04439e]',
    },
    {
      title: t('pharmacyKpi.prescriptions'),
      value: stats.prescriptions.total.toString(),
      subtitle: `${stats.prescriptions.pending} ${t('pharmacyKpi.pending')}`,
      icon: Clock,
      accent: '',
      iconBg: 'bg-[#ff4000]/10',
      iconColor: 'text-[#ff4000]',
      badge: stats.prescriptions.pending > 0
        ? { text: `${stats.prescriptions.pending} ${t('pharmacyKpi.pending')}`, variant: 'secondary' as const }
        : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <Card
          key={kpi.title}
          className={`relative overflow-hidden hover:shadow-lg transition-all duration-300 group ${
            kpi.urgent ? 'ring-1 ring-orange-300 dark:ring-orange-700' : ''
          }`}
        >
          {/* Top accent bar */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.accent}`} />

          <CardContent className="p-3 md:p-4 pt-4">
            <div className="flex items-start justify-between mb-2">
              <div className={`w-9 h-9 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>
                <kpi.icon className={`w-4.5 h-4.5 ${kpi.iconColor}`} />
              </div>
              {kpi.badge && (
                <Badge variant={kpi.badge.variant} className="text-[9px] px-1.5 py-0 h-4">
                  {kpi.badge.text}
                </Badge>
              )}
            </div>

            <div className="text-xl md:text-2xl font-bold tracking-tight leading-none mb-0.5">
              {kpi.value}
            </div>
            <div className="text-[10px] md:text-xs text-muted-foreground font-medium">
              {kpi.title}
            </div>
            <div className="text-[9px] md:text-[10px] text-muted-foreground/70 mt-0.5">
              {kpi.subtitle}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

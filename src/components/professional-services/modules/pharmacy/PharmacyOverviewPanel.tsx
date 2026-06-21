/**
 * Vue d'ensemble pharmacie — inspiré CVS Health Executive Dashboard
 * Revenue + Stock + Clients en un coup d'œil
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp, Package, Users, Pill, Activity,
  ArrowUp, ArrowDown, Clock, CheckCircle, AlertTriangle
} from 'lucide-react';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import type { ServiceHealthStats, RecentHealthSale } from '@/hooks/useServiceHealthStats';

interface PharmacyOverviewPanelProps {
  stats: ServiceHealthStats;
  recentSales: RecentHealthSale[];
}

export function PharmacyOverviewPanel({ stats, recentSales }: PharmacyOverviewPanelProps) {
  const { t } = useTranslation();
  const formatCurrency = useFormatCurrency();
  const inStock = stats.stock.totalProducts - stats.stock.outOfStockCount - stats.stock.lowStockCount;
  const stockPercent = stats.stock.totalProducts > 0 ? Math.round((inStock / stats.stock.totalProducts) * 100) : 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Revenue card — Main */}
      <Card className="lg:col-span-2 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            {t('pharmacyOverview.commercialPerformance')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t('pharmacyOverview.today')}</span>
              <div className="text-lg font-bold">{formatCurrency(stats.sales.todayRevenue)}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t('pharmacyOverview.week')}</span>
              <div className="text-lg font-bold">{formatCurrency(stats.sales.weekRevenue)}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t('pharmacyOverview.month')}</span>
              <div className="text-lg font-bold">{formatCurrency(stats.sales.monthRevenue)}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t('pharmacyOverview.total')}</span>
              <div className="text-lg font-bold text-primary">{formatCurrency(stats.sales.totalRevenue)}</div>
            </div>
          </div>

          {/* Mini stats bar */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t flex-wrap">
            <div className="flex items-center gap-1.5 text-sm">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{stats.sales.totalOrders} {t('pharmacyOverview.ordersWord')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{stats.clients.total} {t('pharmacyOverview.patientsWord')}</span>
            </div>
            {stats.sales.totalOrders > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <TrendingUp className="w-4 h-4 text-[#ff4000]" />
                <span className="text-muted-foreground">
                  {t('pharmacyOverview.avgCart')} {formatCurrency(stats.sales.totalRevenue / stats.sales.totalOrders)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stock health card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary" />
            {t('pharmacyOverview.stockStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Circular score indicator */}
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center ${
              stockPercent >= 80 ? 'border-[#ff4000]' :
              stockPercent >= 50 ? 'border-orange-500' : 'border-[#ff4000]'
            }`}>
              <span className={`text-lg font-bold ${
                stockPercent >= 80 ? 'text-[#ff4000]' :
                stockPercent >= 50 ? 'text-orange-600' : 'text-[#ff4000]'
              }`}>
                {stockPercent}%
              </span>
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-sm font-medium">
                {stockPercent >= 80 ? t('pharmacyOverview.stockOptimal') :
                 stockPercent >= 50 ? t('pharmacyOverview.stockWarning') : t('pharmacyOverview.stockCritical')}
              </div>
              <div className="text-xs text-muted-foreground">
                {inStock} / {stats.stock.totalProducts} {t('pharmacyOverview.productsInStock')}
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#ff4000]" />
                <span className="text-muted-foreground">{t('pharmacyOverview.normal')}</span>
              </span>
              <span className="font-semibold">{inStock}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-muted-foreground">{t('pharmacyOverview.low')}</span>
              </span>
              <span className="font-semibold text-orange-600">{stats.stock.lowStockCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#ff4000]" />
                <span className="text-muted-foreground">{t('pharmacyOverview.outOfStock')}</span>
              </span>
              <span className="font-semibold text-[#ff4000]">{stats.stock.outOfStockCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

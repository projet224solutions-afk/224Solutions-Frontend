import { useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card } from '@/components/ui/card';
import { useVendorAnalytics } from '@/hooks/useVendorAnalytics';
import { useMoneyFormat } from '@/components/Money';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { TrendingUp, Target, Package } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function VendorAnalyticsDashboard() {
  const { t } = useTranslation();
  const { analytics, loading } = useVendorAnalytics();
  const { format, userCurrency } = useMoneyFormat();
  const { convert } = usePriceConverter();

  // Données du graphique converties (GNF stocké → devise de l'utilisateur, taux BCRG)
  const weekChartData = useMemo(
    () => (analytics?.week ?? []).map(d => ({ ...d, total_sales: convert(d.total_sales, 'GNF').convertedAmount })),
    [analytics?.week, convert]
  );

  // Format compact pour l'axe Y (ex: 15k, 1,2M) avec le code devise de l'utilisateur
  const compactAxis = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ${userCurrency}`;
    if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k ${userCurrency}`;
    return `${Math.round(v)} ${userCurrency}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analytics) return null;

  const stats = [
    {
      title: "Ventes Aujourd'hui",
      value: format(analytics.today.totalSales, 'GNF'),
      subtitle: `POS: ${analytics.today.posOrders} • En ligne: ${analytics.today.onlineOrders}`,
      icon: TrendingUp,
      color: 'text-[#ff4000]'
    },
    {
      title: "Taux de Conversion",
      value: `${analytics.today.conversionRate.toFixed(1)}%`,
      icon: Target,
      color: 'text-[#04439e]'
    },
    {
      title: "Produits Actifs",
      value: analytics.activeProductsCount,
      icon: Package,
      color: 'text-orange-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* KPIs - grille responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="p-4 border-2 border-[#ff4000]">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-black font-medium truncate">{stat.title}</p>
                <p className="text-lg font-bold mt-1 truncate text-black">{stat.value}</p>
                {'subtitle' in stat && stat.subtitle && (
                  <p className="text-[10px] text-black/70 mt-0.5">{stat.subtitle}</p>
                )}
              </div>
              <stat.icon className={`h-6 w-6 flex-shrink-0 ml-2 ${stat.color}`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Graphique des ventes + Top Produits - côte à côte en paysage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Graphique des ventes (7 derniers jours) */}
        <Card className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">Ventes - 7 derniers jours</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={weekChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={compactAxis} width={70} />
              <Tooltip
                formatter={(value: number) => format(value, 'GNF')}
                labelFormatter={(label) => new Date(label).toLocaleDateString('fr-FR')}
              />
              <Area
                type="monotone"
                dataKey="total_sales"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Top Produits */}
        <Card className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">{t('vendorAnalyticsDashboard.topProduits')}</h3>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {analytics.topProducts.map((product, index) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full font-bold text-sm">
                    {index + 1}
                  </div>
                  <span className="font-medium text-sm sm:text-base line-clamp-1">{product.name}</span>
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap ml-2">{product.sales} ventes</span>
              </div>
            ))}
            {analytics.topProducts.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Aucune vente enregistrée
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

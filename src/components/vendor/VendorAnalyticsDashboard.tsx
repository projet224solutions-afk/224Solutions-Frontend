import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useVendorAnalytics } from '@/hooks/useVendorAnalytics';
import { useMoneyFormat } from '@/components/Money';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { backendFetch } from '@/services/backendApi';
import { TrendingUp, Target, Package, ShoppingCart, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function VendorAnalyticsDashboard() {
  const { t } = useTranslation();
  const { analytics, loading } = useVendorAnalytics();
  const { format, userCurrency } = useMoneyFormat();
  const { convert } = usePriceConverter();

  // ✅ Checklist de visibilité marketplace (depuis le backend — route gatée par JWT)
  const [visibilityChecklist, setVisibilityChecklist] = useState<Array<{
    done: boolean; action: string; impact: string; priority: number;
  }>>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);

  useEffect(() => {
    setChecklistLoading(true);
    backendFetch<any>('/api/marketplace-visibility/vendor/me', { method: 'GET' })
      .then((res) => {
        const list = res?.data?.checklist;
        if (Array.isArray(list) && list.length) setVisibilityChecklist(list);
      })
      .catch(() => { /* silencieux */ })
      .finally(() => setChecklistLoading(false));
  }, []);

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

  const lowStockCount = analytics.lowStockProducts?.length || 0;
  const stats = [
    {
      title: "Ventes Aujourd'hui",
      value: format(analytics.today.totalSales, 'GNF'),
      subtitle: `POS: ${analytics.today.posOrders} • En ligne: ${analytics.today.onlineOrders}`,
      icon: TrendingUp,
      color: 'text-[#ff4000]'
    },
    {
      title: "CA du mois (30j)",
      value: format(analytics.monthRevenue, 'GNF'),
      subtitle: `${analytics.totalMonthOrders} commande${analytics.totalMonthOrders > 1 ? 's' : ''}`,
      icon: TrendingUp,
      color: 'text-[#16a34a]'
    },
    {
      title: "Panier moyen",
      value: format(analytics.avgOrderValue, 'GNF'),
      subtitle: '30 derniers jours',
      icon: ShoppingCart,
      color: 'text-[#04439e]'
    },
    {
      title: "Taux de paiement",
      value: `${analytics.today.conversionRate.toFixed(1)}%`,
      subtitle: 'commandes payées / total',
      icon: Target,
      color: 'text-[#04439e]'
    },
    {
      title: "Produits Actifs",
      value: analytics.activeProductsCount,
      subtitle: lowStockCount > 0 ? `⚠️ ${lowStockCount} en stock bas` : 'Stocks OK',
      icon: Package,
      color: lowStockCount > 0 ? 'text-amber-600' : 'text-[#16a34a]'
    }
  ];

  return (
    <div className="space-y-6">
      {/* KPIs - grille responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
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

      {/* ✅ Checklist de visibilité marketplace */}
      {(checklistLoading || visibilityChecklist.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#04439e]" />
              Score de visibilité marketplace
              {checklistLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {visibilityChecklist.map((item) => (
              <div
                key={item.priority}
                className={`flex items-start gap-3 p-2.5 rounded-lg text-sm transition-colors ${
                  item.done ? 'bg-[#16a34a]/5' : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <span className="text-base mt-0.5 flex-shrink-0">{item.done ? '✅' : '⬜'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium leading-relaxed ${
                    item.done ? 'text-[#16a34a] line-through opacity-70' : 'text-slate-700'
                  }`}>
                    {item.action}
                  </p>
                </div>
                {!item.done && (
                  <Badge className="text-[10px] border-0 bg-[#04439e]/10 text-[#04439e] flex-shrink-0">
                    {item.impact}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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

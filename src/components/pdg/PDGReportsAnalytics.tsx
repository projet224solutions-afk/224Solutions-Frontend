import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Download, Users, ShoppingCart, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePDGReportsData } from '@/hooks/usePDGReportsData';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePriceConverter } from '@/hooks/usePriceConverter';

export default function PDGReportsAnalytics() {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { analyticsData, stats, topProducts, topVendors, loading, exportToCSV } = usePDGReportsData(timeRange);
  const fc = useFormatCurrency();
  const { convert, userCurrency } = usePriceConverter();
  const compactAxis = (v: number) => {
    const c = convert(v, 'GNF').convertedAmount;
    if (Math.abs(c) >= 1_000_000) return `${(c / 1_000_000).toFixed(1)}M ${userCurrency}`;
    if (Math.abs(c) >= 1_000) return `${(c / 1_000).toFixed(0)}K ${userCurrency}`;
    return `${Math.round(c)} ${userCurrency}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Rapports & Analytiques</h2>
          <p className="text-muted-foreground mt-1">{t('pDGReportsAnalytics.vueDEnsembleDesPerformances')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={timeRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('7d')}
          >
            7 jours
          </Button>
          <Button
            variant={timeRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('30d')}
          >
            30 jours
          </Button>
          <Button
            variant={timeRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('90d')}
          >
            90 jours
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* KPIs Principaux */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenu Total</CardTitle>
            <TrendingUp className="w-4 h-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fc(stats.totalRevenue, 'GNF')}</div>
            <div className="flex items-center gap-1 mt-1">
              {stats.revenueGrowth >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-[#ff4000]" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-[#ff4000]" />
              )}
              <p className={`text-xs ${stats.revenueGrowth >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                {Math.abs(stats.revenueGrowth).toFixed(1)}% vs période précédente
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransactions.toLocaleString()}</div>
            <div className="flex items-center gap-1 mt-1">
              {stats.transactionsGrowth >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-[#ff4000]" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-[#ff4000]" />
              )}
              <p className={`text-xs ${stats.transactionsGrowth >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                {Math.abs(stats.transactionsGrowth).toFixed(1)}% vs période précédente
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nouveaux Utilisateurs</CardTitle>
            <Users className="w-4 h-4 text-[#04439e]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <div className="flex items-center gap-1 mt-1">
              {stats.usersGrowth >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-[#ff4000]" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-[#ff4000]" />
              )}
              <p className={`text-xs ${stats.usersGrowth >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                {Math.abs(stats.usersGrowth).toFixed(1)}% vs période précédente
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('pDGReportsAnalytics.commandes')}</CardTitle>
            <ShoppingCart className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Valeur moy: {fc(stats.averageTransactionValue, 'GNF')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('pDGReportsAnalytics.evolutionDuRevenu')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={compactAxis} width={72} />
                <Tooltip formatter={(value: number) => fc(value)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#04439e" name="Revenu" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transactions Quotidiennes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="transactions" fill="#82ca9d" name="Transactions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Produits et Vendeurs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('pDGReportsAnalytics.top5Produits')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sales} ventes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{fc(product.revenue, 'GNF')}</p>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun produit vendu sur cette période
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Vendeurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topVendors.map((vendor, index) => (
                <div key={vendor.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{vendor.name}</p>
                      <p className="text-sm text-muted-foreground">{vendor.sales} commandes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{fc(vendor.revenue, 'GNF')}</p>
                  </div>
                </div>
              ))}
              {topVendors.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune vente sur cette période
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

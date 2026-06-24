import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3, Calendar, TrendingUp, TrendingDown,
  Download, FileText, DollarSign, Package, ShoppingCart,
  Clock, Users, CreditCard
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface ReportData {
  sales: number;
  orders: number;
  expenses: number;
  profit: number;
  creditSales: number;
  returns: number;
}

const _COLORS = ['#ff4000', '#04439e', '#ff4000', '#ff4000', '#04439e'];

export default function VendorReportsManager() {
  const { t } = useTranslation();
  const { vendorId, userId } = useCurrentVendor();
  const fc = useFormatCurrency();
  const { convert, userCurrency } = usePriceConverter();
  // Axe Y compact (montants stockés en GNF → devise utilisateur, taux BCRG)
  const compactAxis = (v: number) => {
    const c = convert(v, 'GNF').convertedAmount;
    if (Math.abs(c) >= 1_000_000) return `${(c / 1_000_000).toFixed(1)}M ${userCurrency}`;
    if (Math.abs(c) >= 1_000) return `${(c / 1_000).toFixed(0)}K ${userCurrency}`;
    return `${Math.round(c)} ${userCurrency}`;
  };
  const { toast } = useToast();
  const [_loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState<ReportData>({
    sales: 0,
    orders: 0,
    expenses: 0,
    profit: 0,
    creditSales: 0,
    returns: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end = now;

    switch (period) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'custom':
        start = customRange.start ? new Date(customRange.start) : new Date(now.setMonth(now.getMonth() - 1));
        end = customRange.end ? new Date(customRange.end) : new Date();
        break;
      default:
        start = new Date(now.setMonth(now.getMonth() - 1));
    }

    return { start, end };
  };

  const loadReportData = async () => {
    if (!vendorId) return;
    setLoading(true);

    const { start, end } = getDateRange();
    const startStr = start.toISOString();
    const endStr = end.toISOString();

    try {
      // Ventes
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, total_amount, created_at')
        .eq('vendor_id', vendorId)
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      const totalSales = ordersData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const totalOrders = ordersData?.length || 0;

      // Dépenses - skip if table doesn't exist
      const totalExpenses = 0;

      // Ventes à crédit
      const { data: creditData } = await supabase
        .from('vendor_credit_sales')
        .select('remaining_amount')
        .eq('vendor_id', vendorId)
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      const totalCreditSales = creditData?.reduce((sum, c) => sum + (c.remaining_amount || 0), 0) || 0;

      // Retours
      const { data: returnsData } = await supabase
        .from('sale_returns')
        .select('refund_amount')
        .eq('vendor_id', vendorId)
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      const totalReturns = returnsData?.reduce((sum, r) => sum + (r.refund_amount || 0), 0) || 0;

      // Top produits
      const { data: topProductsData } = await supabase
        .from('order_items')
        .select(`
          product_id,
          quantity,
          products!inner(name, vendor_id)
        `)
        .eq('products.vendor_id', vendorId);

      const productSalesMap = new Map();
      topProductsData?.forEach((item: any) => {
        const existing = productSalesMap.get(item.product_id) || { name: item.products?.name, sales: 0 };
        existing.sales += item.quantity || 1;
        productSalesMap.set(item.product_id, existing);
      });

      const topProds = Array.from(productSalesMap.values())
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      // Données pour le graphique
      const chartDataMap = new Map();
      ordersData?.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        const existing = chartDataMap.get(date) || { date, sales: 0, orders: 0 };
        existing.sales += order.total_amount || 0;
        existing.orders += 1;
        chartDataMap.set(date, existing);
      });

      setReportData({
        sales: totalSales,
        orders: totalOrders,
        expenses: totalExpenses,
        profit: totalSales - totalExpenses - totalReturns,
        creditSales: totalCreditSales,
        returns: totalReturns
      });

      setChartData(Array.from(chartDataMap.values()));
      setTopProducts(topProds);
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, period, customRange]);

  const exportReport = () => {
    const { start, end } = getDateRange();
    // Export CSV (s'ouvre nativement dans Excel) — sans dépendance externe.
    // BOM UTF-8 + séparateur ';' (Excel FR) + CRLF pour une compatibilité maximale.
    const esc = (v: any) => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: string[][] = [
      ['Rapport de synthèse'],
      ['Période', `${start.toLocaleDateString('fr-FR')} - ${end.toLocaleDateString('fr-FR')}`],
      [],
      ['Indicateur', 'Valeur (GNF)'],
      ['Ventes totales', String(reportData.sales)],
      ['Nombre de commandes', String(reportData.orders)],
      ['Dépenses', String(reportData.expenses)],
      ['Retours/Remboursements', String(reportData.returns)],
      ['Créances en cours', String(reportData.creditSales)],
      ['Bénéfice net', String(reportData.profit)],
      [],
      ['Top produits', 'Ventes'],
      ...topProducts.map((p) => [p.name, String(p.sales)]),
      [],
      ['Généré le', new Date().toLocaleString('fr-FR')],
    ];
    const csv = '﻿' + rows.map((row) => row.map(esc).join(';')).join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: '✅ Rapport Excel (CSV) téléchargé' });
  };

  const periodLabels = {
    today: "Aujourd'hui",
    week: '7 derniers jours',
    month: '30 derniers jours',
    year: 'Cette année',
    custom: 'Personnalisé'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Rapports de Synthèse
          </h2>
          <p className="text-sm text-muted-foreground">
            Analysez vos performances par période
          </p>
        </div>
        <Button onClick={exportReport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Sélection période */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'year', 'custom'] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {periodLabels[p]}
              </Button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex gap-4 mt-4">
              <div className="flex-1">
                <label className="text-sm font-medium">{t('vendorReportsManager.dateDebut')}</label>
                <Input
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Date fin</label>
                <Input
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-xs text-muted-foreground">Ventes</p>
                <p className="text-lg font-bold text-[#ff4000]">{reportData.sales.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">{t('vendorReportsManager.commandes')}</p>
                <p className="text-lg font-bold">{reportData.orders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-xs text-muted-foreground">{t('vendorReportsManager.depenses')}</p>
                <p className="text-lg font-bold text-[#ff4000]">{reportData.expenses.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">{t('vendorReportsManager.creances')}</p>
                <p className="text-lg font-bold text-orange-600">{reportData.creditSales.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#04439e]" />
              <div>
                <p className="text-xs text-muted-foreground">Retours</p>
                <p className="text-lg font-bold text-[#04439e]">{reportData.returns.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={reportData.profit >= 0 ? 'bg-orange-50 dark:bg-[#ff4000]' : 'bg-orange-50 dark:bg-[#ff4000]'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-5 h-5 ${reportData.profit >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`} />
              <div>
                <p className="text-xs text-muted-foreground">{t('vendorReportsManager.beneficeNet')}</p>
                <p className={`text-lg font-bold ${reportData.profit >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                  {reportData.profit.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution des ventes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('vendorReportsManager.evolutionDesVentes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={compactAxis} width={70} />
                <Tooltip formatter={(value: number) => fc(value)} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Produits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('vendorReportsManager.top5Produits')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full font-bold text-sm">
                      {index + 1}
                    </div>
                    <span className="font-medium text-sm truncate max-w-[200px]">{product.name}</span>
                  </div>
                  <Badge variant="secondary">{product.sales} ventes</Badge>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucune donnée disponible
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

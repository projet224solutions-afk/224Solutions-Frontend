import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AnalyticsData {
  period: string;
  revenue: number;
  transactions: number;
  users: number;
  orders: number;
}

export interface ReportStats {
  totalRevenue: number;
  totalTransactions: number;
  totalUsers: number;
  totalOrders: number;
  averageTransactionValue: number;
  revenueGrowth: number;
  transactionsGrowth: number;
  usersGrowth: number;
}

export interface TopProduct {
  id: string;
  name: string;
  sales: number;
  revenue: number;
}

export interface TopVendor {
  id: string;
  name: string;
  sales: number;
  revenue: number;
}

export const usePDGReportsData = (timeRange: '7d' | '30d' | '90d' = '30d') => {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [stats, setStats] = useState<ReportStats>({
    totalRevenue: 0,
    totalTransactions: 0,
    totalUsers: 0,
    totalOrders: 0,
    averageTransactionValue: 0,
    revenueGrowth: 0,
    transactionsGrowth: 0,
    usersGrowth: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendor[]>([]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Période précédente pour comparaison
      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - daysAgo);

      // Charger les transactions de la période actuelle
      const { data: currentTransactions } = await supabase
        .from('wallet_transactions')
        .select('amount, created_at, status')
        .gte('created_at', startDate.toISOString())
        .eq('status', 'completed');

      // Charger les transactions de la période précédente
      const { data: previousTransactions } = await supabase
        .from('wallet_transactions')
        .select('amount, created_at, status')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString())
        .eq('status', 'completed');

      // Charger les profils de la période actuelle
      const { data: currentProfiles } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString());

      // Charger les profils de la période précédente
      const { data: previousProfiles } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      // Charger les commandes
      const { data: currentOrders } = await supabase
        .from('orders')
        .select('id, total_amount, created_at, status')
        .gte('created_at', startDate.toISOString());

      // Grouper les données par jour
      const dataByDay = new Map<string, { revenue: number; transactions: number; users: number; orders: number }>();

      // Initialiser tous les jours avec des valeurs à 0
      for (let i = 0; i < daysAgo; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (daysAgo - i - 1));
        const dateKey = date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
        dataByDay.set(dateKey, { revenue: 0, transactions: 0, users: 0, orders: 0 });
      }

      // Agréger les transactions
      currentTransactions?.forEach(tx => {
        const date = new Date(tx.created_at);
        const dateKey = date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
        const data = dataByDay.get(dateKey);
        if (data) {
          data.revenue += Number(tx.amount || 0);
          data.transactions += 1;
        }
      });

      // Agréger les nouveaux utilisateurs
      currentProfiles?.forEach(profile => {
        const date = new Date(profile.created_at);
        const dateKey = date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
        const data = dataByDay.get(dateKey);
        if (data) {
          data.users += 1;
        }
      });

      // Agréger les commandes
      currentOrders?.forEach(order => {
        const date = new Date(order.created_at);
        const dateKey = date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
        const data = dataByDay.get(dateKey);
        if (data) {
          data.orders += 1;
        }
      });

      // Convertir en tableau
      const analyticsArray: AnalyticsData[] = Array.from(dataByDay.entries()).map(([period, data]) => ({
        period,
        revenue: data.revenue,
        transactions: data.transactions,
        users: data.users,
        orders: data.orders
      }));

      setAnalyticsData(analyticsArray);

      // Calculer les statistiques
      const currentRevenue = currentTransactions?.reduce((sum, tx) => sum + Number(tx.amount || 0), 0) || 0;
      const previousRevenue = previousTransactions?.reduce((sum, tx) => sum + Number(tx.amount || 0), 0) || 0;
      const currentTxCount = currentTransactions?.length || 0;
      const previousTxCount = previousTransactions?.length || 0;
      const currentUsersCount = currentProfiles?.length || 0;
      const previousUsersCount = previousProfiles?.length || 0;

      const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
      const transactionsGrowth = previousTxCount > 0 ? ((currentTxCount - previousTxCount) / previousTxCount) * 100 : 0;
      const usersGrowth = previousUsersCount > 0 ? ((currentUsersCount - previousUsersCount) / previousUsersCount) * 100 : 0;

      setStats({
        totalRevenue: currentRevenue,
        totalTransactions: currentTxCount,
        totalUsers: currentUsersCount,
        totalOrders: currentOrders?.length || 0,
        averageTransactionValue: currentTxCount > 0 ? currentRevenue / currentTxCount : 0,
        revenueGrowth,
        transactionsGrowth,
        usersGrowth,
      });

      // Charger les top produits
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .limit(10);

      if (products) {
        const productsWithSales = await Promise.all(
          products.map(async (product) => {
            const { data: orders } = await supabase
              .from('order_items')
              .select('*')
              .eq('product_id', product.id);

            const sales = orders?.length || 0;
            const revenue = orders?.reduce((sum, item: any) => sum + Number(item.subtotal || 0), 0) || 0;

            return {
              id: product.id,
              name: product.name,
              sales,
              revenue
            };
          })
        );

        setTopProducts(productsWithSales.sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      }

      // Charger les top vendeurs
      const { data: vendors } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('role', 'vendeur')
        .limit(10);

      if (vendors) {
        const vendorsWithSales = await Promise.all(
          vendors.map(async (vendor) => {
            const { data: orders } = await supabase
              .from('orders')
              .select('total_amount')
              .eq('vendor_id', vendor.id)
              .gte('created_at', startDate.toISOString());

            const sales = orders?.length || 0;
            const revenue = orders?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;

            return {
              id: vendor.id,
              name: `${vendor.first_name || ''} ${vendor.last_name || ''}`.trim() || 'Vendeur inconnu',
              sales,
              revenue
            };
          })
        );

        setTopVendors(vendorsWithSales.sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      }

    } catch (error) {
      console.error('Erreur chargement analytics:', error);
      toast.error('Erreur lors du chargement des analytics');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // Exporter les données en CSV
  const exportToCSV = useCallback(() => {
    try {
      const csvContent = [
        ['Période', 'Revenu (GNF)', 'Transactions', 'Nouveaux utilisateurs', 'Commandes'].join(','),
        ...analyticsData.map(row => [
          row.period,
          row.revenue,
          row.transactions,
          row.users,
          row.orders
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `analytics_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success('Rapport exporté avec succès');
      return true;
    } catch (error) {
      console.error('Erreur export CSV:', error);
      toast.error('Erreur lors de l\'export');
      return false;
    }
  }, [analyticsData, timeRange]);

  // Charger les données au montage et quand timeRange change
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    analyticsData,
    stats,
    topProducts,
    topVendors,
    loading,
    exportToCSV,
    refetch: loadAnalytics,
  };
};

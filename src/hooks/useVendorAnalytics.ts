import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentVendor } from './useCurrentVendor';

export interface VendorAnalytics {
  date: string;
  totalSales: number;
  totalOrders: number;
  posOrders: number;
  onlineOrders: number;
  conversionRate: number;
}

export interface DailySales {
  date: string;
  total_sales: number;
  total_orders: number;
}

export interface AnalyticsSummary {
  today: VendorAnalytics;
  week: DailySales[];
  month: DailySales[];
  topProducts: Array<{
    id: string;
    name: string;
    sales: number;
  }>;
  activeProductsCount: number;
}

export const useVendorAnalytics = () => {
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    if (!vendorId || vendorLoading) return;

    try {
      setLoading(true);
      console.log('📊 useVendorAnalytics - Loading for vendorId:', vendorId);

      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Récupérer les ventes d'aujourd'hui depuis orders + pos_sales (POS hors-ligne)
      const { data: todayOrdersRaw, error: todayError } = await supabase
        .from('orders')
        .select('id, total_amount, payment_status, source')
        .eq('vendor_id', vendorId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      if (todayError) console.error('Error loading today orders:', todayError);

      const { data: todayPosRaw } = await supabase
        .from('pos_sales')
        .select('id, total_amount, status')
        .eq('vendor_id', vendorId)
        .gte('sold_at', `${today}T00:00:00`)
        .lt('sold_at', `${today}T23:59:59`);

      const todayPos = (todayPosRaw || [])
        .filter((s: any) => s.status !== 'cancelled')
        .map((s: any) => ({ total_amount: s.total_amount || 0, payment_status: 'paid', source: 'pos' }));
      const todayOrders = [...(todayOrdersRaw || []), ...todayPos];

      // CA = uniquement les ventes PAYÉES (les POS sont payées par nature)
      const todaySales = todayOrders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const paidOrders = todayOrders.filter(o => o.payment_status === 'paid').length;
      const todayOrdersCount = todayOrders.length;
      const posOrders = todayOrders.filter(o => o.source === 'pos').length;
      const onlineOrders = todayOrders.filter(o => o.source !== 'pos').length;
      // Taux de conversion = commandes payées / commandes totales
      const conversionRate = todayOrdersCount > 0
        ? (paidOrders / todayOrdersCount) * 100
        : 0;
      // Agrégateur jour → { ventes, nb } (crée l'entrée si absente)
      const aggregate = (
        map: Map<string, { total_sales: number; total_orders: number }>,
        dateStr: string,
        amount: number
      ) => {
        const e = map.get(dateStr) || { total_sales: 0, total_orders: 0 };
        map.set(dateStr, { total_sales: e.total_sales + amount, total_orders: e.total_orders + 1 });
      };

      // Ventes PAYÉES des 7 derniers jours (orders payées + POS) groupées par jour
      const { data: weekOrders, error: weekError } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .eq('vendor_id', vendorId)
        .eq('payment_status', 'paid')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (weekError) console.error('Error loading week orders:', weekError);

      const { data: weekPos } = await supabase
        .from('pos_sales')
        .select('sold_at, total_amount, status')
        .eq('vendor_id', vendorId)
        .gte('sold_at', sevenDaysAgo.toISOString());

      const weekDataMap = new Map<string, { total_sales: number; total_orders: number }>();
      // Initialiser tous les jours de la semaine (pour afficher 0)
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        weekDataMap.set(d.toISOString().split('T')[0], { total_sales: 0, total_orders: 0 });
      }
      (weekOrders || []).forEach(o => aggregate(weekDataMap, new Date(o.created_at).toISOString().split('T')[0], o.total_amount || 0));
      (weekPos || []).filter((s: any) => s.status !== 'cancelled').forEach((s: any) => aggregate(weekDataMap, new Date(s.sold_at).toISOString().split('T')[0], s.total_amount || 0));

      const weekData: DailySales[] = Array.from(weekDataMap.entries()).map(([date, data]) => ({
        date,
        total_sales: data.total_sales,
        total_orders: data.total_orders
      }));

      // Ventes PAYÉES des 30 derniers jours (orders payées + POS)
      const { data: monthOrders } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .eq('vendor_id', vendorId)
        .eq('payment_status', 'paid')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      const { data: monthPos } = await supabase
        .from('pos_sales')
        .select('sold_at, total_amount, status')
        .eq('vendor_id', vendorId)
        .gte('sold_at', thirtyDaysAgo.toISOString());

      const monthDataMap = new Map<string, { total_sales: number; total_orders: number }>();
      (monthOrders || []).forEach(o => aggregate(monthDataMap, new Date(o.created_at).toISOString().split('T')[0], o.total_amount || 0));
      (monthPos || []).filter((s: any) => s.status !== 'cancelled').forEach((s: any) => aggregate(monthDataMap, new Date(s.sold_at).toISOString().split('T')[0], s.total_amount || 0));

      const monthData: DailySales[] = Array.from(monthDataMap.entries()).map(([date, data]) => ({
        date,
        total_sales: data.total_sales,
        total_orders: data.total_orders
      }));

      // Récupérer les top produits vendus
      const { data: topProductsData, error: topError } = await supabase
        .from('order_items')
        .select(`
          product_id,
          quantity,
          products!inner(id, name, vendor_id)
        `)
        .eq('products.vendor_id', vendorId);

      if (topError) console.error('Error loading top products:', topError);

      // Agréger les ventes par produit
      const productSalesMap = new Map<string, { id: string; name: string; sales: number }>();
      topProductsData?.forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.products?.name || 'Produit inconnu';
        const existing = productSalesMap.get(productId);
        if (existing) {
          existing.sales += item.quantity || 1;
        } else {
          productSalesMap.set(productId, {
            id: productId,
            name: productName,
            sales: item.quantity || 1
          });
        }
      });

      const topProducts = Array.from(productSalesMap.values())
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      // Récupérer le nombre de produits actifs (physiques + numériques)
      const { count: activePhysicalCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('is_active', true);

      const { count: activeDigitalCount } = await supabase
        .from('digital_products')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('status', 'published');

      const activeProductsCount = (activePhysicalCount || 0) + (activeDigitalCount || 0);

      const todayAnalytics: VendorAnalytics = {
        date: today,
        totalSales: todaySales,
        totalOrders: todayOrdersCount,
        posOrders,
        onlineOrders,
        conversionRate: conversionRate
      };

      console.log('📊 Analytics loaded:', {
        todaySales,
        todayOrdersCount,
        weekDataLength: weekData.length,
        topProductsLength: topProducts.length
      });

      setAnalytics({
        today: todayAnalytics,
        week: weekData,
        month: monthData,
        topProducts,
        activeProductsCount: activeProductsCount
      });
    } catch (error) {
      console.error('Erreur chargement analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorLoading) return; // attendre la résolution du profil vendeur
    if (!vendorId) {
      setLoading(false); // profil introuvable, arrêter le spinner
      return;
    }
    loadAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, vendorLoading]);

  return {
    analytics,
    loading,
    reload: loadAnalytics
  };
};

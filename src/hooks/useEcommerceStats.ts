import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';

interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
}

interface SalesStats {
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  averageOrderValue: number;
}

export interface EcommerceStats {
  orders: OrderStats;
  ordersPos: OrderStats;
  ordersOnline: OrderStats;
  products: {
    total: number;
    active: number;
    inactive: number;
    lowStock: number;
  };
  clients: {
    total: number;
    newThisMonth: number;
  };
  sales: SalesStats;
  salesPos: SalesStats;
  salesOnline: SalesStats;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_name?: string;
  source?: string;
}

export interface TopProduct {
  id: string;
  name: string;
  total_sold: number;
  revenue: number;
  image?: string;
}

function calculateOrderStats(orders: any[]): OrderStats {
  return {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => ['confirmed', 'processing', 'preparing', 'ready', 'in_transit'].includes(o.status)).length,
    delivered: orders.filter(o => ['delivered', 'completed'].includes(o.status)).length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };
}

function calculateSalesStats(orders: any[], startOfDay: Date, startOfWeek: Date, startOfMonth: Date): SalesStats {
  const paidOrders = orders.filter(o => o.payment_status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const todayOrders = paidOrders.filter(o => new Date(o.created_at) >= startOfDay);
  const weekOrders = paidOrders.filter(o => new Date(o.created_at) >= startOfWeek);
  const monthOrders = paidOrders.filter(o => new Date(o.created_at) >= startOfMonth);

  return {
    totalRevenue,
    todayRevenue: todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    weekRevenue: weekOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    monthRevenue: monthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    averageOrderValue: paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0,
  };
}

export function useEcommerceStats() {
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const [stats, setStats] = useState<EcommerceStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      setError(null);

      // Load orders stats with source
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, payment_status, source')
        .eq('vendor_id', vendorId);

      if (ordersError) throw ordersError;

      const orders = ordersData || [];
      const posOrders = orders.filter(o => o.source === 'pos');
      const onlineOrders = orders.filter(o => o.source === 'online');

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calculate stats for all, POS, and Online
      const orderStats = calculateOrderStats(orders);
      const orderStatsPos = calculateOrderStats(posOrders);
      const orderStatsOnline = calculateOrderStats(onlineOrders);

      const salesStats = calculateSalesStats(orders, startOfDay, startOfWeek, startOfMonth);
      const salesStatsPos = calculateSalesStats(posOrders, startOfDay, startOfWeek, startOfMonth);
      const salesStatsOnline = calculateSalesStats(onlineOrders, startOfDay, startOfWeek, startOfMonth);

      // Load products stats
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, is_active, stock_quantity')
        .eq('vendor_id', vendorId);

      if (productsError) throw productsError;

      const products = productsData || [];
      const productStats = {
        total: products.length,
        active: products.filter(p => p.is_active).length,
        inactive: products.filter(p => !p.is_active).length,
        lowStock: products.filter(p => (p.stock_quantity || 0) <= 5 && p.is_active).length,
      };

      // Load clients stats - basé sur les customers des commandes du vendeur
      const { data: ordersCustomersData } = await supabase
        .from('orders')
        .select('customer_id, created_at')
        .eq('vendor_id', vendorId)
        .not('customer_id', 'is', null);

      // Compter les clients uniques
      const uniqueCustomerIds = new Set((ordersCustomersData || []).map(o => o.customer_id));
      const clientsThisMonth = (ordersCustomersData || []).filter(o =>
        new Date(o.created_at) >= startOfMonth
      );
      const uniqueCustomersThisMonth = new Set(clientsThisMonth.map(o => o.customer_id));

      const clientStats = {
        total: uniqueCustomerIds.size,
        newThisMonth: uniqueCustomersThisMonth.size,
      };

      setStats({
        orders: orderStats,
        ordersPos: orderStatsPos,
        ordersOnline: orderStatsOnline,
        products: productStats,
        clients: clientStats,
        sales: salesStats,
        salesPos: salesStatsPos,
        salesOnline: salesStatsOnline,
      });

      // Load recent orders with customer info and source
      const { data: recentOrdersData } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, total_amount, created_at, source,
          customers(profiles(first_name, last_name))
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentOrders((recentOrdersData || []).map(o => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total_amount: o.total_amount,
        created_at: o.created_at,
        source: o.source,
        customer_name: o.customers?.profiles
          ? `${o.customers.profiles.first_name || ''} ${o.customers.profiles.last_name || ''}`.trim() || 'Client anonyme'
          : 'Client anonyme',
      })));

      // Load top products
      const { data: topProductsData } = await supabase
        .from('order_items')
        .select(`
          product_id, quantity, total_price,
          products!inner(id, name, images, vendor_id)
        `)
        .eq('products.vendor_id', vendorId);

      if (topProductsData) {
        const productMap = new Map<string, TopProduct>();
        topProductsData.forEach(item => {
          const existing = productMap.get(item.product_id);
          if (existing) {
            existing.total_sold += item.quantity;
            existing.revenue += item.total_price;
          } else {
            productMap.set(item.product_id, {
              id: item.product_id,
              name: item.products?.name || 'Produit inconnu',
              total_sold: item.quantity,
              revenue: item.total_price,
              image: item.products?.images?.[0],
            });
          }
        });

        setTopProducts(
          Array.from(productMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)
        );
      }

    } catch (err) {
      console.error('Error loading ecommerce stats:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (vendorLoading) return;

    if (!vendorId) {
      // Pas de vendorId = pas de stats, mais on arrête le loading
      setLoading(false);
      return;
    }

    loadStats();
  }, [vendorId, vendorLoading, loadStats]);

  return {
    stats,
    recentOrders,
    topProducts,
    loading: loading || vendorLoading,
    error,
    refresh: loadStats,
  };
}

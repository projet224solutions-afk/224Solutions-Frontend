/**
 * Hook: Statistiques E-commerce par VENDOR_ID
 * Utilise directement vendor_id pour les requêtes (pas professional_service_id)
 * Pour les vendeurs sans service professionnel configuré
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export interface VendorEcommerceStats {
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

export interface RecentVendorOrder {
  id: string;
  booking_number?: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_name?: string;
  source?: string;
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
  const paidOrders = orders.filter(o => o.payment_status === 'paid' || o.status === 'completed');
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

const defaultStats: VendorEcommerceStats = {
  orders: { total: 0, pending: 0, confirmed: 0, delivered: 0, cancelled: 0 },
  ordersPos: { total: 0, pending: 0, confirmed: 0, delivered: 0, cancelled: 0 },
  ordersOnline: { total: 0, pending: 0, confirmed: 0, delivered: 0, cancelled: 0 },
  products: { total: 0, active: 0, inactive: 0, lowStock: 0 },
  clients: { total: 0, newThisMonth: 0 },
  sales: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, averageOrderValue: 0 },
  salesPos: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, averageOrderValue: 0 },
  salesOnline: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, averageOrderValue: 0 },
};

export function useVendorEcommerceStats(vendorId: string | null) {
  const [stats, setStats] = useState<VendorEcommerceStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentVendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!vendorId) {
      console.log('⚠️ useVendorEcommerceStats - Pas de vendorId fourni');
      setStats(defaultStats);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('📊 Chargement stats e-commerce pour vendorId:', vendorId);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // 1. Charger les commandes depuis la table orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, payment_status, customer_id, source')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('❌ Erreur chargement orders:', ordersError);
      }

      // 1bis. Ventes POS hors-ligne (table pos_sales) — mappées en pseudo-commandes
      // pour être incluses dans le CA et les stats (source='pos', payées).
      const { data: posSalesData } = await supabase
        .from('pos_sales')
        .select('id, total_amount, sold_at, status')
        .eq('vendor_id', vendorId);

      const posAsOrders = (posSalesData || [])
        .filter((s: any) => s.status !== 'cancelled')
        .map((s: any) => ({
          id: `pos:${s.id}`,
          status: 'delivered',
          total_amount: s.total_amount || 0,
          created_at: s.sold_at,
          payment_status: 'paid',
          customer_id: null,
          source: 'pos',
        }));

      const allOrders = ([...(ordersData || []), ...posAsOrders]) as any[];
      console.log('📦 Orders trouvées:', (ordersData || []).length, '| ventes POS hors-ligne:', posAsOrders.length);

      // 2. Charger les produits
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, is_active, stock_quantity')
        .eq('vendor_id', vendorId);

      if (productsError) {
        console.error('❌ Erreur chargement products:', productsError);
      }

      const products = productsData || [];
      console.log('📦 Produits trouvés:', products.length);

      const productStats = {
        total: products.length,
        active: products.filter(p => p.is_active !== false).length,
        inactive: products.filter(p => p.is_active === false).length,
        lowStock: products.filter(p => (p.stock_quantity || 0) <= 5 && p.is_active !== false).length,
      };

      // 3. Calculer les stats des commandes
      const allOrderStats = calculateOrderStats(allOrders);
      const allSalesStats = calculateSalesStats(allOrders, startOfDay, startOfWeek, startOfMonth);

      // Séparer POS vs Online
      const posOrders = allOrders.filter(o => o.source === 'pos');
      const onlineOrders = allOrders.filter(o => o.source !== 'pos');
      const posOrderStats = calculateOrderStats(posOrders);
      const onlineOrderStats = calculateOrderStats(onlineOrders);
      const posSalesStats = calculateSalesStats(posOrders, startOfDay, startOfWeek, startOfMonth);
      const onlineSalesStats = calculateSalesStats(onlineOrders, startOfDay, startOfWeek, startOfMonth);

      // 4. Compter les clients uniques
      const uniqueCustomerIds = new Set(allOrders.filter(o => o.customer_id).map(o => o.customer_id));
      const recentCustomers = allOrders
        .filter(o => o.customer_id && new Date(o.created_at) >= startOfMonth)
        .map(o => o.customer_id);
      const newUniqueThisMonth = new Set(recentCustomers);

      const clientStats = {
        total: uniqueCustomerIds.size,
        newThisMonth: newUniqueThisMonth.size,
      };

      setStats({
        orders: allOrderStats,
        ordersPos: posOrderStats,
        ordersOnline: onlineOrderStats,
        products: productStats,
        clients: clientStats,
        sales: allSalesStats,
        salesPos: posSalesStats,
        salesOnline: onlineSalesStats,
      });

      // 5. Récentes commandes pour l'affichage
      setRecentOrders(
        allOrders.slice(0, 10).map(o => ({
          id: o.id,
          booking_number: `ORD-${o.id.slice(0, 8).toUpperCase()}`,
          status: o.status,
          total_amount: o.total_amount || 0,
          created_at: o.created_at,
          source: o.source || 'online',
        }))
      );

    } catch (err) {
      console.error('❌ Erreur inattendue:', err);
      setError('Erreur de chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    recentOrders,
    loading,
    error,
    refresh: loadStats,
  };
}
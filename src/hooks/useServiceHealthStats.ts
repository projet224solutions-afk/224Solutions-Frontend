/**
 * Hook: Statistiques Santé/Pharmacie par SERVICE PROFESSIONNEL
 * Utilise professional_service_id pour les requêtes sur les produits, ventes, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StockStats {
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface SalesStats {
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalOrders: number;
}

export interface ServiceHealthStats {
  stock: StockStats;
  sales: SalesStats;
  clients: {
    total: number;
  };
  prescriptions: {
    total: number;
    pending: number;
  };
  hasData: boolean;
}

export interface RecentHealthSale {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_name?: string;
  items_count?: number;
}

const defaultStats: ServiceHealthStats = {
  stock: { totalProducts: 0, activeProducts: 0, lowStockCount: 0, outOfStockCount: 0 },
  sales: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, totalOrders: 0 },
  clients: { total: 0 },
  prescriptions: { total: 0, pending: 0 },
  hasData: false,
};

export function useServiceHealthStats(serviceId?: string) {
  const [stats, setStats] = useState<ServiceHealthStats | null>(null);
  const [recentSales, setRecentSales] = useState<RecentHealthSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!serviceId) {
      setStats(defaultStats);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get user_id and vendor_id
      const { data: serviceData } = await supabase
        .from('professional_services')
        .select('user_id')
        .eq('id', serviceId)
        .single();

      const userId = serviceData?.user_id;
      let vendorId: string | null = null;

      if (userId) {
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', userId)
          .single();
        vendorId = vendorData?.id || null;
      }

      // 1. Stock - from service_products + products
      let allProducts: any[] = [];

      const { data: serviceProducts } = await supabase
        .from('service_products')
        .select('id, is_available, stock_quantity')
        .eq('professional_service_id', serviceId);

      if (serviceProducts) {
        allProducts = serviceProducts.map(p => ({
          id: p.id,
          is_active: p.is_available,
          stock: p.stock_quantity ?? 0,
        }));
      }

      if (vendorId) {
        const { data: vendorProducts } = await supabase
          .from('products')
          .select('id, is_active, stock_quantity')
          .eq('vendor_id', vendorId);

        if (vendorProducts) {
          allProducts = [
            ...allProducts,
            ...vendorProducts.map(p => ({
              id: p.id,
              is_active: p.is_active,
              stock: p.stock_quantity ?? 0,
            })),
          ];
        }
      }

      const stockStats: StockStats = {
        totalProducts: allProducts.length,
        activeProducts: allProducts.filter(p => p.is_active !== false).length,
        lowStockCount: allProducts.filter(p => p.stock > 0 && p.stock <= 5).length,
        outOfStockCount: allProducts.filter(p => p.stock <= 0).length,
      };

      // 2. Sales - from service_bookings + orders
      let allOrders: any[] = [];

      const { data: bookingsData } = await supabase
        .from('service_bookings')
        .select('id, status, total_amount, scheduled_date, client_id')
        .eq('professional_service_id', serviceId)
        .order('scheduled_date', { ascending: false });

      if (bookingsData) {
        allOrders = bookingsData.map(b => ({
          id: b.id,
          status: b.status,
          total_amount: b.total_amount || 0,
          created_at: b.scheduled_date,
          customer_name: null,
        }));
      }

      if (vendorId) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('id, status, total_amount, created_at')
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (ordersData) {
          allOrders = [
            ...allOrders,
            ...ordersData.map(o => ({
              id: o.id,
              status: o.status,
              total_amount: o.total_amount || 0,
              created_at: o.created_at,
              customer_name: null,
            })),
          ];
        }
      }

      const completedOrders = allOrders.filter(o =>
        ['completed', 'delivered', 'confirmed'].includes(o.status)
      );
      const totalRevenue = completedOrders.reduce((s, o) => s + o.total_amount, 0);
      const todayOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfDay);
      const weekOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfWeek);
      const monthOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfMonth);

      const salesStats: SalesStats = {
        totalRevenue,
        todayRevenue: todayOrders.reduce((s, o) => s + o.total_amount, 0),
        weekRevenue: weekOrders.reduce((s, o) => s + o.total_amount, 0),
        monthRevenue: monthOrders.reduce((s, o) => s + o.total_amount, 0),
        totalOrders: allOrders.length,
      };

      // 3. Clients count
      let clientsCount = 0;
      if (vendorId) {
        const { count } = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId);
        clientsCount = count || 0;
      }

      const hasData = allProducts.length > 0 || allOrders.length > 0 || clientsCount > 0;

      setStats({
        stock: stockStats,
        sales: salesStats,
        clients: { total: clientsCount },
        prescriptions: { total: 0, pending: 0 },
        hasData,
      });

      setRecentSales(
        allOrders.slice(0, 10).map(o => ({
          id: o.id,
          status: o.status,
          total_amount: o.total_amount,
          created_at: o.created_at,
          customer_name: o.customer_name,
        }))
      );
    } catch (err) {
      console.error('❌ Erreur stats santé:', err);
      setError('Erreur de chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, recentSales, loading, error, refresh: loadStats };
}

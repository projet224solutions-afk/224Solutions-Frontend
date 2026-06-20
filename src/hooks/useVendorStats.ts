/**
 * 🔧 HOOK: STATISTIQUES VENDEUR
 * 🚀 Optimisé: polling intelligent, select ciblé, visibilitychange
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { cacheData, getCachedData } from '@/lib/offlineDB';

const CACHE_KEY_VENDOR_STATS = 'vendor_stats';
const CACHE_TTL_STATS = 30 * 60 * 1000;
const POLL_INTERVAL = 60000; // 🚀 60s instead of 30s

export interface VendorStats {
  vendorId: string | null;
  revenue: number;
  orders_count: number;
  customers_count: number;
  products_count: number;
  pending_orders: number;
  low_stock_products: number;
}

export function useVendorStats() {
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (!vendorId || isFetchingRef.current) return;
    isFetchingRef.current = true;

    const cacheKey = `${CACHE_KEY_VENDOR_STATS}_${vendorId}`;

    try {
      setLoading(prev => prev); // Don't flash loading on refetch
      setError(null);

      // 🚀 Parallel with targeted selects
      const [revenueResult, ordersResult, customersResult, productsResult, pendingResult, lowStockResult, posSalesResult] = await Promise.allSettled([
        supabase.from('orders').select('total_amount').eq('vendor_id', vendorId).eq('payment_status', 'paid'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId).eq('is_active', true),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId).eq('status', 'pending'),
        supabase.from('products').select('id, stock_quantity, low_stock_threshold').eq('vendor_id', vendorId).eq('is_active', true),
        supabase.from('pos_sales').select('total_amount, status').eq('vendor_id', vendorId),
      ]);

      // Ventes POS hors-ligne (pos_sales) — payées par nature, à inclure dans le CA + nb de ventes
      const posSales = posSalesResult.status === 'fulfilled' && posSalesResult.value.data
        ? (posSalesResult.value.data as any[]).filter((s) => s.status !== 'cancelled') : [];
      const posRevenue = posSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

      const ordersPaidRevenue = revenueResult.status === 'fulfilled' && revenueResult.value.data
        ? revenueResult.value.data.reduce((sum, order) => sum + (order.total_amount || 0), 0) : 0;
      const revenue = ordersPaidRevenue + posRevenue;
      const lowStockCount = lowStockResult.status === 'fulfilled' && lowStockResult.value.data
        ? lowStockResult.value.data.filter((p) => p.stock_quantity <= (p.low_stock_threshold || 0)).length : 0;

      const newStats: VendorStats = {
        vendorId,
        revenue,
        orders_count: (ordersResult.status === 'fulfilled' ? (ordersResult.value.count || 0) : 0) + posSales.length,
        customers_count: customersResult.status === 'fulfilled' ? (customersResult.value.count || 0) : 0,
        products_count: productsResult.status === 'fulfilled' ? (productsResult.value.count || 0) : 0,
        pending_orders: pendingResult.status === 'fulfilled' ? (pendingResult.value.count || 0) : 0,
        low_stock_products: lowStockCount
      };

      setStats(newStats);
      await cacheData(cacheKey, newStats, CACHE_TTL_STATS);
    } catch (err: any) {
      console.error('Erreur chargement stats:', err);
      try {
        const cachedStats = await getCachedData<VendorStats>(cacheKey);
        if (cachedStats) { setStats(cachedStats); setError(null); isFetchingRef.current = false; return; }
      } catch {}
      setError(err.message || 'Erreur');
      setStats({ vendorId, revenue: 0, orders_count: 0, customers_count: 0, products_count: 0, pending_orders: 0, low_stock_products: 0 });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [vendorId]);

  useEffect(() => {
    if (vendorLoading || !vendorId) { setLoading(false); return; }

    fetchStats();

    // 🚀 Only poll when tab is visible
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => { void fetchStats(); }, POLL_INTERVAL);
    };
    const stopPolling = () => { if (interval) { clearInterval(interval); interval = null; } };

    const handleVisibility = () => {
      if (document.hidden) { stopPolling(); } else { fetchStats(); startPolling(); }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [vendorId, vendorLoading, fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}

export default useVendorStats;

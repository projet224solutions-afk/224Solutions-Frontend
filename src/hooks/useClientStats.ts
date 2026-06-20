/**
 * HOOK CLIENT STATS - 224SOLUTIONS
 * Statistiques optimisées avec requêtes SQL pour l'interface Client
 * Résout correctement customer_id via la table customers
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ClientStats {
  // Orders
  total_orders: number;
  active_orders: number;
  completed_orders: number;
  cancelled_orders: number;

  // Financial
  total_spent: number;
  average_order_value: number;
  cart_value: number;
  pending_payments: number;

  // Engagement
  favorites_count: number;
  reviews_submitted: number;
  refunds_requested: number;
  loyalty_points: number;

  // Recent activity
  last_order_date: string | null;
  days_since_last_order: number;
}

export function useClientStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 0. RÉSOUDRE LE CUSTOMER_ID depuis la table customers
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const customerId = customerData?.id;

      // 1. ORDERS STATS - Utiliser customer_id (pas user.id)
      let ordersData: any[] = [];
      if (customerId) {
        const { data } = await supabase
          .from('orders')
          .select('id, status, total_amount, created_at')
          .eq('customer_id', customerId);
        ordersData = data || [];
      }

      const totalOrders = ordersData.length;
      const activeOrders = ordersData.filter(o =>
        ['pending', 'processing', 'shipped', 'confirmed'].includes(o.status)
      ).length;
      const completedOrders = ordersData.filter(o =>
        ['delivered', 'completed'].includes(o.status)
      ).length;
      const cancelledOrders = ordersData.filter(o => o.status === 'cancelled').length;

      // 2. FINANCIAL STATS
      const totalSpent = ordersData.reduce((sum, o) =>
        o.status !== 'cancelled' ? sum + (o.total_amount || 0) : sum, 0
      );
      const paidOrders = completedOrders || totalOrders - cancelledOrders;
      const averageOrderValue = paidOrders > 0 ? totalSpent / paidOrders : 0;

      // 3. CART VALUE - Requête séparée sans join FK (pas de FK carts→products)
      let cartValue = 0;
      if (customerId) {
        const { data: cartItems } = await supabase
          .from('carts')
          .select('product_id, quantity')
          .eq('customer_id', customerId);

        if (cartItems && cartItems.length > 0) {
          const productIds = cartItems.map(c => c.product_id);
          const { data: productsData } = await supabase
            .from('products')
            .select('id, price')
            .in('id', productIds);

          const priceMap = new Map(
            (productsData || []).map(p => [p.id, p.price || 0])
          );

          cartValue = cartItems.reduce((sum, item) =>
            sum + (item.quantity * (priceMap.get(item.product_id) || 0)), 0
          );
        }
      }

      // 4. PENDING PAYMENTS
      let pendingPaymentsTotal = 0;
      if (customerId) {
        const { data: pendingPayments } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('customer_id', customerId)
          .eq('payment_status', 'pending');

        pendingPaymentsTotal = (pendingPayments || []).reduce((sum, o) =>
          sum + (o.total_amount || 0), 0
        );
      }

      // 5. FAVORITES COUNT - wishlists utilise user_id (auth.uid)
      const { count: favoritesCount } = await supabase
        .from('wishlists')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // 6. REVIEWS SUBMITTED
      const { count: reviewsCount } = await supabase
        .from('product_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // 7. LAST ORDER DATE
      const lastOrder = ordersData.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      const lastOrderDate = lastOrder?.created_at || null;
      const daysSinceLastOrder = lastOrderDate
        ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      setStats({
        total_orders: totalOrders,
        active_orders: activeOrders,
        completed_orders: completedOrders,
        cancelled_orders: cancelledOrders,
        total_spent: totalSpent,
        average_order_value: averageOrderValue,
        cart_value: cartValue,
        pending_payments: pendingPaymentsTotal,
        favorites_count: favoritesCount || 0,
        reviews_submitted: reviewsCount || 0,
        refunds_requested: 0,
        loyalty_points: 0,
        last_order_date: lastOrderDate,
        days_since_last_order: daysSinceLastOrder
      });
    } catch (err: any) {
      console.error('❌ Erreur chargement stats client:', err);
      setError(err.message);
      // Fallback avec valeurs à 0
      setStats({
        total_orders: 0,
        active_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        total_spent: 0,
        average_order_value: 0,
        cart_value: 0,
        pending_payments: 0,
        favorites_count: 0,
        reviews_submitted: 0,
        refunds_requested: 0,
        loyalty_points: 0,
        last_order_date: null,
        days_since_last_order: 0
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    refresh: loadStats
  };
}

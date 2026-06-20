/**
 * Hook: Statistiques Restaurant par SERVICE PROFESSIONNEL
 * Utilise professional_service_id pour les requêtes sur restaurant_orders, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrderStats {
  total: number;
  pending: number;
  preparing: number;
  ready: number;
  delivered: number;
  cancelled: number;
}

interface SalesStats {
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
}

export interface ServiceRestaurantStats {
  orders: OrderStats;
  ordersDineIn: OrderStats;
  ordersDelivery: OrderStats;
  ordersTakeaway: OrderStats;
  sales: SalesStats;
  salesDineIn: SalesStats;
  salesDelivery: SalesStats;
  salesTakeaway: SalesStats;
  menuItems: {
    total: number;
    active: number;
  };
  tables: {
    total: number;
    occupied: number;
  };
  reservations: {
    today: number;
    pending: number;
  };
  reviews: {
    rating: number;   // note moyenne agrégée (professional_services.rating)
    count: number;    // nombre d'avis (professional_services.total_reviews)
  };
  hasData: boolean;
}

export interface RecentRestaurantOrder {
  id: string;
  order_number?: string;
  status: string;
  total: number;
  created_at: string;
  customer_name?: string;
  order_type?: string;
  table_number?: string;
}

function calculateOrderStats(orders: any[]): OrderStats {
  return {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    delivered: orders.filter(o => ['delivered', 'completed'].includes(o.status)).length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };
}

function calculateSalesStats(orders: any[], startOfDay: Date, startOfWeek: Date, startOfMonth: Date): SalesStats {
  const completedOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status));
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const todayOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfDay);
  const weekOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfWeek);
  const monthOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfMonth);

  return {
    totalRevenue,
    todayRevenue: todayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    weekRevenue: weekOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    monthRevenue: monthOrders.reduce((sum, o) => sum + (o.total || 0), 0),
  };
}

const defaultStats: ServiceRestaurantStats = {
  orders: { total: 0, pending: 0, preparing: 0, ready: 0, delivered: 0, cancelled: 0 },
  ordersDineIn: { total: 0, pending: 0, preparing: 0, ready: 0, delivered: 0, cancelled: 0 },
  ordersDelivery: { total: 0, pending: 0, preparing: 0, ready: 0, delivered: 0, cancelled: 0 },
  ordersTakeaway: { total: 0, pending: 0, preparing: 0, ready: 0, delivered: 0, cancelled: 0 },
  sales: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0 },
  salesDineIn: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0 },
  salesDelivery: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0 },
  salesTakeaway: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0 },
  menuItems: { total: 0, active: 0 },
  tables: { total: 0, occupied: 0 },
  reservations: { today: 0, pending: 0 },
  reviews: { rating: 0, count: 0 },
  hasData: false,
};

export function useServiceRestaurantStats(serviceId?: string) {
  const [stats, setStats] = useState<ServiceRestaurantStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentRestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!serviceId) {
      console.log('⚠️ useServiceRestaurantStats - Pas de serviceId fourni');
      setStats(defaultStats);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🍽️ Chargement stats restaurant pour serviceId:', serviceId);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // 1. Récupérer le user_id + la note agrégée du service professionnel
      //    (rating/total_reviews maintenus par le trigger recompute_service_rating).
      const { data: serviceData } = await supabase
        .from('professional_services')
        .select('user_id, rating, total_reviews')
        .eq('id', serviceId)
        .single();

      const userId = serviceData?.user_id;
      console.log('👤 User ID du service restaurant:', userId);

      // 2. Charger les commandes restaurant
      const { data: ordersData, error: ordersError } = await supabase
        .from('restaurant_orders')
        .select('id, status, total, order_type, created_at, customer_name, table_number')
        .eq('professional_service_id', serviceId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.log('⚠️ Table restaurant_orders peut ne pas exister:', ordersError.message);
      }

      const orders = ordersData || [];
      console.log('📦 Commandes restaurant (service) trouvées:', orders.length);

      // 2b. NE PAS charger les commandes legacy depuis orders
      // Les commandes restaurant sont UNIQUEMENT dans restaurant_orders avec professional_service_id
      // La table orders est réservée aux commandes e-commerce
      console.log('ℹ️ Restaurant: n\'utilise PAS les commandes legacy (table orders)')

      console.log('📦 Total commandes restaurant:', orders.length);

      const dineInOrders = orders.filter(o => o.order_type === 'dine_in' || o.order_type === 'sur_place');
      const deliveryOrders = orders.filter(o => o.order_type === 'delivery' || o.order_type === 'livraison');
      const takeawayOrders = orders.filter(o => o.order_type === 'takeaway' || o.order_type === 'emporter');

      // Calculate stats
      const orderStats = calculateOrderStats(orders);
      const orderStatsDineIn = calculateOrderStats(dineInOrders);
      const orderStatsDelivery = calculateOrderStats(deliveryOrders);
      const orderStatsTakeaway = calculateOrderStats(takeawayOrders);

      const salesStats = calculateSalesStats(orders, startOfDay, startOfWeek, startOfMonth);
      const salesStatsDineIn = calculateSalesStats(dineInOrders, startOfDay, startOfWeek, startOfMonth);
      const salesStatsDelivery = calculateSalesStats(deliveryOrders, startOfDay, startOfWeek, startOfMonth);
      const salesStatsTakeaway = calculateSalesStats(takeawayOrders, startOfDay, startOfWeek, startOfMonth);

      // 3. Charger les PLATS du menu — table réelle restaurant_menu_items (PAS service_products,
      //    qui est l'e-commerce et reste vide pour les restaurants → comptait toujours 0).
      const { data: menuData, error: menuError } = await supabase
        .from('restaurant_menu_items')
        .select('id, is_available')
        .eq('professional_service_id', serviceId);
      if (menuError) console.log('⚠️ Erreur chargement menu:', menuError.message);
      const menuItems: any[] = menuData || [];
      console.log('🍔 Total plats menu:', menuItems.length);

      // 3b. Tables (réelles) + réservations (réelles) — étaient codées en dur à 0.
      const [{ data: tablesData }, { data: resaData }] = await Promise.all([
        supabase.from('restaurant_tables').select('id, status, current_order_id, is_active').eq('professional_service_id', serviceId),
        supabase.from('restaurant_reservations').select('id, reservation_date, status').eq('professional_service_id', serviceId),
      ]);
      const tables = (tablesData || []).filter((t: any) => t.is_active !== false);
      const occupiedTables = tables.filter((t: any) => t.status === 'occupied' || t.current_order_id).length;
      const todayStr = startOfDay.toISOString().slice(0, 10);
      const resaToday = (resaData || []).filter((r: any) => String(r.reservation_date || '').slice(0, 10) === todayStr).length;
      const resaPending = (resaData || []).filter((r: any) => r.status === 'pending').length;

      const hasData = orders.length > 0 || menuItems.length > 0 || tables.length > 0 || (resaData?.length || 0) > 0;

      setStats({
        orders: orderStats,
        ordersDineIn: orderStatsDineIn,
        ordersDelivery: orderStatsDelivery,
        ordersTakeaway: orderStatsTakeaway,
        sales: salesStats,
        salesDineIn: salesStatsDineIn,
        salesDelivery: salesStatsDelivery,
        salesTakeaway: salesStatsTakeaway,
        menuItems: {
          total: menuItems.length,
          active: menuItems.filter(m => m.is_available !== false).length,
        },
        tables: {
          total: tables.length,
          occupied: occupiedTables,
        },
        reservations: {
          today: resaToday,
          pending: resaPending,
        },
        reviews: {
          rating: Number((serviceData as any)?.rating) || 0,
          count: Number((serviceData as any)?.total_reviews) || 0,
        },
        hasData,
      });

      // Récentes commandes
      setRecentOrders(
        orders.slice(0, 10).map(o => ({
          id: o.id,
          order_number: `REST-${o.id.slice(0, 6).toUpperCase()}`,
          status: o.status,
          total: o.total || 0,
          created_at: o.created_at,
          customer_name: o.customer_name,
          order_type: o.order_type,
          table_number: o.table_number,
        }))
      );

    } catch (err) {
      console.error('❌ Erreur inattendue:', err);
      setError('Erreur de chargement des statistiques restaurant');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

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

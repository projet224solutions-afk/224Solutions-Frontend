/**
 * Hook: Statistiques E-commerce par SERVICE PROFESSIONNEL
 * Utilise professional_service_id pour les requêtes
 * Alternative à useEcommerceStats qui utilise vendor_id
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

export interface ServiceEcommerceStats {
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

export interface RecentServiceOrder {
  id: string;
  booking_number?: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_name?: string;
  source?: string;
}

export interface TopServiceProduct {
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

const defaultStats: ServiceEcommerceStats = {
  orders: { total: 0, pending: 0, confirmed: 0, delivered: 0, cancelled: 0 },
  ordersPos: { total: 0, pending: 0, confirmed: 0, delivered: 0, cancelled: 0 },
  ordersOnline: { total: 0, pending: 0, confirmed: 0, delivered: 0, cancelled: 0 },
  products: { total: 0, active: 0, inactive: 0, lowStock: 0 },
  clients: { total: 0, newThisMonth: 0 },
  sales: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, averageOrderValue: 0 },
  salesPos: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, averageOrderValue: 0 },
  salesOnline: { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, averageOrderValue: 0 },
};

export function useServiceEcommerceStats(serviceId?: string) {
  const [stats, setStats] = useState<ServiceEcommerceStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentServiceOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopServiceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!serviceId) {
      console.log('⚠️ useServiceEcommerceStats - Pas de serviceId fourni');
      setStats(defaultStats);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('📊 Chargement stats e-commerce pour serviceId:', serviceId);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // 1. Charger les réservations/commandes du service professionnel
      // Note: 'source' et 'customer_id' peuvent ne pas exister dans service_bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('service_bookings')
        .select('id, status, total_amount, created_at, payment_status, client_id')
        .eq('professional_service_id', serviceId)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('❌ Erreur chargement bookings:', bookingsError);
      }

      const bookings = (bookingsData || []) as any[];
      console.log('📦 Bookings trouvés:', bookings.length);

      // 2. Récupérer le user_id et vendor_id du service professionnel
      const { data: serviceData } = await supabase
        .from('professional_services')
        .select('user_id')
        .eq('id', serviceId)
        .single();

      const userId = serviceData?.user_id;
      console.log('👤 User ID du service:', userId);

      // 3. Charger les produits - PRIORITÉ: table products (vendor) + service_products
      let allProducts: any[] = [];

      // 3a. Charger depuis service_products (liés au service professionnel)
      const { data: serviceProductsData } = await supabase
        .from('service_products')
        .select('id, is_available, stock_quantity')
        .eq('professional_service_id', serviceId);

      if (serviceProductsData) {
        allProducts = [...serviceProductsData];
        console.log('📦 Service products trouvés:', serviceProductsData.length);
      }

      // 3b. Charger depuis products (liés au vendor via user_id)
      if (userId) {
        // D'abord récupérer le vendor_id
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (vendorData?.id) {
          const { data: vendorProducts } = await supabase
            .from('products')
            .select('id, is_active, stock_quantity')
            .eq('vendor_id', vendorData.id);

          if (vendorProducts) {
            // Convertir au même format
            const normalizedVendorProducts = vendorProducts.map(p => ({
              id: p.id,
              is_available: p.is_active,
              stock_quantity: p.stock_quantity
            }));
            allProducts = [...allProducts, ...normalizedVendorProducts];
            console.log('📦 Vendor products trouvés:', vendorProducts.length);
          }
        }
      }

      console.log('📦 Total produits:', allProducts.length);

      const productStats = {
        total: allProducts.length,
        active: allProducts.filter(p => p.is_available !== false).length,
        inactive: allProducts.filter(p => p.is_available === false).length,
        lowStock: allProducts.filter(p => (p.stock_quantity || 0) <= 5 && p.is_available !== false).length,
      };

      // 4. Charger les commandes depuis la table orders (pour service e-commerce uniquement)
      let allOrders = [...bookings];

      if (userId) {
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (vendorData?.id) {
          // Charger les commandes e-commerce depuis la table orders
          const { data: legacyOrders } = await supabase
            .from('orders')
            .select('id, status, total_amount, created_at, payment_status, customer_id, source')
            .eq('vendor_id', vendorData.id)
            .order('created_at', { ascending: false });

          if (legacyOrders) {
            // Convertir au format compatible
            const normalizedOrders = legacyOrders.map(o => ({
              ...o,
              client_id: o.customer_id
            }));
            allOrders = [...allOrders, ...normalizedOrders];
            console.log('📦 E-commerce orders trouvés:', legacyOrders.length);
          }
        }
      }

      // Recalculer les stats avec toutes les commandes e-commerce
      const allOrderStats = calculateOrderStats(allOrders);
      const allSalesStats = calculateSalesStats(allOrders, startOfDay, startOfWeek, startOfMonth);

      // Séparer POS vs Online pour les commandes legacy
      const posOrders = allOrders.filter(o => (o as any).source === 'pos');
      const onlineOrders = allOrders.filter(o => (o as any).source !== 'pos');
      const posOrderStats = calculateOrderStats(posOrders);
      const onlineOrderStats = calculateOrderStats(onlineOrders);
      const posSalesStats = calculateSalesStats(posOrders, startOfDay, startOfWeek, startOfMonth);
      const onlineSalesStats = calculateSalesStats(onlineOrders, startOfDay, startOfWeek, startOfMonth);

      // 5. Compter les clients uniques (depuis toutes les commandes)
      const uniqueCustomerIds = new Set(allOrders.filter(b => b.client_id).map(b => b.client_id));
      const recentCustomers = allOrders
        .filter(b => b.client_id && new Date(b.created_at) >= startOfMonth)
        .map(b => b.client_id);
      const newUniqueThisMonth = new Set(recentCustomers);

      const clientStats = {
        total: uniqueCustomerIds.size,
        newThisMonth: newUniqueThisMonth.size,
      };

      // Utiliser les stats recalculées avec toutes les données e-commerce
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

      // 6. Récentes commandes pour l'affichage (toutes sources)
      setRecentOrders(
        allOrders.slice(0, 10).map(b => ({
          id: b.id,
          booking_number: `ORD-${b.id.slice(0, 8).toUpperCase()}`,
          status: b.status,
          total_amount: b.total_amount || 0,
          created_at: b.created_at,
          source: (b as any).source || 'online',
        }))
      );

      // 5. Top produits (pour l'instant placeholder)
      // TODO: Implémenter avec les lignes de commande quand disponibles
      setTopProducts([]);

    } catch (err) {
      console.error('❌ Erreur inattendue:', err);
      setError('Erreur de chargement des statistiques');
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
    topProducts,
    loading,
    error,
    refresh: loadStats,
  };
}

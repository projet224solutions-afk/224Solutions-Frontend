/**
 * Hook: Gestion des commandes restaurant
 * Commandes en temps réel avec filtres par type et statut
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RestaurantOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant_name: string | null;
  special_instructions: string | null;
  status: 'pending' | 'preparing' | 'ready' | 'served';
}

export interface RestaurantOrder {
  id: string;
  professional_service_id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  table_number: string | null;
  order_type: 'dine_in' | 'delivery' | 'takeaway';
  items: any;
  subtotal: number;
  tax: number;
  total: number;
  discount_amount: number;
  tip_amount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method: string;
  delivery_address: string | null;
  delivery_instructions: string | null;
  notes: string | null;
  kitchen_notes: string | null;
  assigned_staff_id: string | null;
  source: 'pos' | 'online' | 'qr_code' | 'phone';
  started_preparing_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  order_items?: RestaurantOrderItem[];
}

export function useRestaurantOrders(serviceId: string) {
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('restaurant_orders')
        .select('*')
        .eq('professional_service_id', serviceId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setOrders((data as RestaurantOrder[]) || []);

    } catch (err: any) {
      console.error('Erreur chargement commandes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  const createOrder = async (data: Partial<RestaurantOrder>) => {
    // Générer un numéro de commande
    const orderNumber = `CMD-${Date.now().toString(36).toUpperCase()}`;

    // Récupérer l'ID de l'utilisateur connecté pour le suivi client
    const { data: authData } = await supabase.auth.getUser();
    const customerUserId = authData?.user?.id || null;

    const { data: newOrder, error } = await supabase
      .from('restaurant_orders')
      .insert([{
        ...data,
        professional_service_id: serviceId,
        order_number: orderNumber,
        customer_user_id: customerUserId,
      }])
      .select()
      .single();

    if (error) throw error;
    setOrders(prev => [newOrder as RestaurantOrder, ...prev]);
    return newOrder;
  };

  const updateOrder = async (id: string, data: Partial<RestaurantOrder>) => {
    const { data: updated, error } = await supabase
      .from('restaurant_orders')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setOrders(prev => prev.map(o => o.id === id ? updated as RestaurantOrder : o));
    return updated;
  };

  const updateOrderStatus = async (id: string, status: RestaurantOrder['status']) => {
    const updates: Partial<RestaurantOrder> = { status };

    // Ajouter les timestamps selon le statut
    const now = new Date().toISOString();
    if (status === 'preparing') updates.started_preparing_at = now;
    if (status === 'ready') updates.ready_at = now;
    if (status === 'completed' || status === 'delivered') updates.completed_at = now;

    return updateOrder(id, updates);
  };

  const cancelOrder = async (id: string, reason: string) => {
    return updateOrder(id, {
      status: 'cancelled',
      cancelled_reason: reason,
      completed_at: new Date().toISOString()
    });
  };

  const getActiveOrders = () =>
    orders.filter(o => !['completed', 'cancelled'].includes(o.status));

  const getOrdersByStatus = (status: RestaurantOrder['status']) =>
    orders.filter(o => o.status === status);

  const getOrdersByType = (type: RestaurantOrder['order_type']) =>
    orders.filter(o => o.order_type === type);

  const getOrderStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(o => new Date(o.created_at) >= today);

    return {
      total: orders.length,
      today: todayOrders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      completed: orders.filter(o => o.status === 'completed').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      todayRevenue: todayOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total || 0), 0),
    };
  };

  useEffect(() => {
    loadOrders();
    if (!serviceId) return;
    // ⚡ Temps réel (Meituan-like) : toute nouvelle commande / changement de statut recharge la liste.
    const channel = supabase
      .channel(`resto-orders-${serviceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_orders', filter: `professional_service_id=eq.${serviceId}` },
        () => { void loadOrders(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadOrders, serviceId]);

  return {
    orders,
    loading,
    error,
    refresh: loadOrders,
    createOrder,
    updateOrder,
    updateOrderStatus,
    cancelOrder,
    getActiveOrders,
    getOrdersByStatus,
    getOrdersByType,
    getOrderStats,
  };
}

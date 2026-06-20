/**
 * HOOK: STATISTIQUES PAR SERVICE PROFESSIONNEL
 * Récupère les statistiques spécifiques à un service professionnel
 * Gère les différents types de services (restaurant, beauté, fitness, etc.)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProfessionalServiceStats {
  serviceId: string;
  serviceTypeCode?: string;
  // Stats génériques
  revenue: number;
  ordersCount: number;
  customersCount: number;
  productsCount: number;
  pendingCount: number;
  // Périodes
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  // Breakdown POS/Online (ou sur place/livraison)
  revenuePos: number;
  revenueOnline: number;
  ordersPos: number;
  ordersOnline: number;
  // Nouveaux clients
  newCustomersThisMonth: number;
  // Indicateur si le service a des données
  hasData: boolean;
}

interface UseProfessionalServiceStatsProps {
  serviceId?: string;
  serviceTypeCode?: string;
}

const defaultStats: ProfessionalServiceStats = {
  serviceId: '',
  revenue: 0,
  ordersCount: 0,
  customersCount: 0,
  productsCount: 0,
  pendingCount: 0,
  todayRevenue: 0,
  weekRevenue: 0,
  monthRevenue: 0,
  revenuePos: 0,
  revenueOnline: 0,
  ordersPos: 0,
  ordersOnline: 0,
  newCustomersThisMonth: 0,
  hasData: false,
};

export function useProfessionalServiceStats({ serviceId, serviceTypeCode }: UseProfessionalServiceStatsProps) {
  const [stats, setStats] = useState<ProfessionalServiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!serviceId) {
      console.log('⚠️ useProfessionalServiceStats - Pas de serviceId fourni');
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('📊 Chargement stats pour serviceId:', serviceId, 'type:', serviceTypeCode);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const serviceStats: ProfessionalServiceStats = { ...defaultStats, serviceId, serviceTypeCode };

      // Récupérer des stats en fonction du type de service
      const code = serviceTypeCode?.toLowerCase() || '';
      console.log('🔍 Code de service détecté:', code);

      if (code.includes('beauty') || code.includes('salon') || code.includes('spa') || code.includes('coiffure')) {
        // Stats pour salon de beauté
        const [appointmentsResult, servicesResult, staffResult] = await Promise.allSettled([
          supabase
            .from('beauty_appointments')
            .select('id, status, total_price, appointment_date')
            .eq('professional_service_id', serviceId),
          supabase
            .from('beauty_services')
            .select('id, is_active')
            .eq('professional_service_id', serviceId),
          supabase
            .from('beauty_staff')
            .select('id')
            .eq('professional_service_id', serviceId)
        ]);

        if (appointmentsResult.status === 'fulfilled' && appointmentsResult.value.data) {
          const appointments = appointmentsResult.value.data;
          const completedAppointments = appointments.filter(a => a.status === 'completed');

          serviceStats.ordersCount = appointments.length;
          serviceStats.pendingCount = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length;
          serviceStats.revenue = completedAppointments.reduce((sum, a) => sum + (a.total_price || 0), 0);

          serviceStats.todayRevenue = completedAppointments
            .filter(a => new Date(a.appointment_date) >= startOfDay)
            .reduce((sum, a) => sum + (a.total_price || 0), 0);
          serviceStats.monthRevenue = completedAppointments
            .filter(a => new Date(a.appointment_date) >= startOfMonth)
            .reduce((sum, a) => sum + (a.total_price || 0), 0);

          serviceStats.hasData = appointments.length > 0;
        }

        if (servicesResult.status === 'fulfilled' && servicesResult.value.data) {
          serviceStats.productsCount = servicesResult.value.data.filter(s => s.is_active).length;
          if (servicesResult.value.data.length > 0) serviceStats.hasData = true;
        }

        if (staffResult.status === 'fulfilled' && staffResult.value.data) {
          serviceStats.customersCount = staffResult.value.data.length;
        }

      } else if (code.includes('restaurant') || code.includes('food') || code.includes('alimentation') || code.includes('resto')) {
        // Stats pour restaurant
        const [ordersResult, stockResult] = await Promise.allSettled([
          supabase
            .from('restaurant_orders')
            .select('id, status, total, order_type, created_at')
            .eq('professional_service_id', serviceId),
          supabase
            .from('restaurant_stock')
            .select('id')
            .eq('professional_service_id', serviceId)
        ]);

        if (ordersResult.status === 'fulfilled' && ordersResult.value.data) {
          const orders = ordersResult.value.data;
          const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');

          serviceStats.ordersCount = orders.length;
          serviceStats.pendingCount = orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status || '')).length;
          serviceStats.revenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);

          const dineIn = completedOrders.filter(o => o.order_type === 'dine_in' || o.order_type === 'sur_place');
          const delivery = completedOrders.filter(o => o.order_type === 'delivery' || o.order_type === 'takeaway' || o.order_type === 'livraison');

          serviceStats.revenuePos = dineIn.reduce((sum, o) => sum + (o.total || 0), 0);
          serviceStats.revenueOnline = delivery.reduce((sum, o) => sum + (o.total || 0), 0);
          serviceStats.ordersPos = dineIn.length;
          serviceStats.ordersOnline = delivery.length;

          serviceStats.todayRevenue = completedOrders
            .filter(o => new Date(o.created_at || '') >= startOfDay)
            .reduce((sum, o) => sum + (o.total || 0), 0);
          serviceStats.monthRevenue = completedOrders
            .filter(o => new Date(o.created_at || '') >= startOfMonth)
            .reduce((sum, o) => sum + (o.total || 0), 0);

          serviceStats.hasData = orders.length > 0;
        }

        if (stockResult.status === 'fulfilled' && stockResult.value.data) {
          serviceStats.productsCount = stockResult.value.data.length;
          if (stockResult.value.data.length > 0) serviceStats.hasData = true;
        }

      } else if (code.includes('fitness') || code.includes('gym') || code.includes('sport')) {
        // Stats pour salle de sport
        const [classesResult, membershipsResult] = await Promise.allSettled([
          supabase
            .from('fitness_classes')
            .select('id, is_active')
            .eq('professional_service_id', serviceId),
          supabase
            .from('fitness_memberships')
            .select('id, status, created_at, price')
            .eq('professional_service_id', serviceId)
        ]);

        if (classesResult.status === 'fulfilled' && classesResult.value.data) {
          serviceStats.productsCount = classesResult.value.data.filter(c => c.is_active).length;
          if (classesResult.value.data.length > 0) serviceStats.hasData = true;
        }

        if (membershipsResult.status === 'fulfilled' && membershipsResult.value.data) {
          const memberships = membershipsResult.value.data;
          serviceStats.customersCount = memberships.filter(m => m.status === 'active').length;
          serviceStats.revenue = memberships.reduce((sum, m) => sum + (m.price || 0), 0);
          serviceStats.newCustomersThisMonth = memberships
            .filter(m => new Date(m.created_at || '') >= startOfMonth)
            .length;
          if (memberships.length > 0) serviceStats.hasData = true;
        }

      } else if (code.includes('education') || code.includes('school') || code.includes('formation')) {
        // Stats pour établissement éducatif
        const [coursesResult] = await Promise.allSettled([
          supabase
            .from('education_courses')
            .select('id, is_active')
            .eq('professional_service_id', serviceId)
        ]);

        if (coursesResult.status === 'fulfilled' && coursesResult.value.data) {
          serviceStats.productsCount = coursesResult.value.data.filter(c => c.is_active).length;
          if (coursesResult.value.data.length > 0) serviceStats.hasData = true;
        }

      } else if (code.includes('ecommerce') || code.includes('boutique') || code.includes('shop') || code.includes('commerce')) {
        // Stats pour boutique e-commerce
        console.log('🛒 Service e-commerce détecté - serviceId:', serviceId);

        // Vérifier d'abord si ce service a des produits dans service_products
        const { data: productsData, error: productsError } = await supabase
          .from('service_products')
          .select('id, is_available, price')
          .eq('professional_service_id', serviceId);

        console.log('📦 Produits (service_products) trouvés:', productsData?.length || 0, 'erreur:', productsError);

        if (productsData && productsData.length > 0) {
          serviceStats.productsCount = productsData.filter(p => p.is_available).length;
          serviceStats.hasData = true;
        }

        // Vérifier les commandes/réservations liées au professional_service
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('service_bookings')
          .select('id, status, total_amount, created_at')
          .eq('professional_service_id', serviceId);

        console.log('📋 Réservations (service_bookings) trouvées:', bookingsData?.length || 0, 'erreur:', bookingsError);

        if (bookingsData && bookingsData.length > 0) {
          const completedBookings = bookingsData.filter(b => b.status === 'completed');
          serviceStats.ordersCount = bookingsData.length;
          serviceStats.pendingCount = bookingsData.filter(b => b.status === 'pending' || b.status === 'confirmed').length;
          serviceStats.revenue = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

          serviceStats.todayRevenue = completedBookings
            .filter(b => new Date(b.created_at) >= startOfDay)
            .reduce((sum, b) => sum + (b.total_amount || 0), 0);
          serviceStats.monthRevenue = completedBookings
            .filter(b => new Date(b.created_at) >= startOfMonth)
            .reduce((sum, b) => sum + (b.total_amount || 0), 0);

          serviceStats.hasData = true;
        }
      } else {
        // Service générique ou nouveau - retourner des stats vides
        console.log(`⚠️ Service type '${serviceTypeCode}' non reconnu - initializing with empty stats`);
        serviceStats.hasData = false;
      }

      console.log('✅ Stats finales:', serviceStats);
      setStats(serviceStats);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du chargement des statistiques';
      console.error('Erreur chargement stats service:', err);
      setError(errorMessage);
      setStats({ ...defaultStats, serviceId });
    } finally {
      setLoading(false);
    }
  }, [serviceId, serviceTypeCode]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}

export default useProfessionalServiceStats;

/**
 * 🏪🛡️ HOOK DONNÉES VENDEUR - VERSION ENTERPRISE ROBUSTE
 * Gestion complète des données vendeur avec protection maximale
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { circuitBreaker, CircuitState } from '@/lib/circuitBreaker';
import { retryWithBackoff, RetryConfig } from '@/lib/retryWithBackoff';
import { toast } from 'sonner';

export interface VendorStats {
  vendorId: string;
  revenue: number;
  profit: number;
  orders_count: number;
  orders_pending: number;
  customers_count: number;
  products_count: number;
  low_stock_count: number;
  overdue_payments: number;
}

export interface Prospect {
  id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  company?: string;
  status: string;
  estimated_value: number;
  success_probability: number;
  notes?: string;
  next_followup_date?: string;
  created_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  minimum_order_amount: number;
  usage_limit?: number;
  used_count: number;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  requester_id: string;
  vendor_id?: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Configuration robuste
const RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true
};

const MUTATION_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  initialDelayMs: 1500,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
  jitter: true
};

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// Hook Stats Vendeur Robuste
export function useVendorStatsRobust() {
  const { user } = useAuth();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [circuitState, setCircuitState] = useState<CircuitState>('CLOSED');

  const cacheRef = useRef<CacheEntry<VendorStats> | null>(null);
  const circuitName = 'vendor-stats';

  // Subscribe to circuit state changes
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(circuitName, setCircuitState);
    return unsubscribe;
  }, []);

  const fetchStats = useCallback(async (silent = false) => {
    if (!user) return;

    // Vérifier le cache
    if (cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_TTL) {
      setStats(cacheRef.current.data);
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setError(null);

      const result = await circuitBreaker.execute(circuitName, async () => {
        return await retryWithBackoff(async () => {
          // Get vendor ID
          const { data: vendor, error: vendorError } = await supabase
            .from('vendors')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (vendorError) throw vendorError;
          if (!vendor) throw new Error('Profil vendeur non trouvé');

          // Fetch all stats in parallel
          const [ordersResult, productsResult, lowStockResult, overdueResult, customersResult] =
            await Promise.all([
              supabase
                .from('orders')
                .select('total_amount, status')
                .eq('vendor_id', vendor.id),
              supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('vendor_id', vendor.id)
                .eq('is_active', true),
              supabase
                .from('inventory')
                .select('*, products!inner(*)', { count: 'exact', head: true })
                .eq('products.vendor_id', vendor.id)
                .lt('quantity', 10),
              supabase
                .from('payment_schedules')
                .select('id, orders!inner(vendor_id)', { count: 'exact', head: true })
                .eq('orders.vendor_id', vendor.id)
                .eq('payment_schedules.status', 'overdue'),
              supabase
                .from('orders')
                .select('customer_id', { count: 'exact', head: true })
                .eq('vendor_id', vendor.id)
            ]);

          const orders = ordersResult.data || [];
          const revenue = orders.reduce((acc, order) => acc + (order.total_amount || 0), 0);

          return {
            vendorId: vendor.id,
            revenue,
            profit: revenue * 0.2,
            orders_count: orders.length,
            orders_pending: orders.filter(o => o.status === 'pending').length,
            customers_count: customersResult.count || 0,
            products_count: productsResult.count || 0,
            low_stock_count: lowStockResult.count || 0,
            overdue_payments: overdueResult.count || 0
          };
        }, RETRY_CONFIG);
      });

      if (result) {
        setStats(result);
        cacheRef.current = { data: result, timestamp: Date.now() };
      }

    } catch (err: any) {
      console.error('❌ Erreur stats vendeur:', err);
      setError(err.message);

      // Utiliser le cache stale en cas d'erreur
      if (cacheRef.current) {
        setStats(cacheRef.current.data);
        if (!silent) toast.warning('Données potentiellement obsolètes');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Actualisation périodique
  useEffect(() => {
    const interval = setInterval(() => fetchStats(true), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
    circuitState,
    isHealthy: circuitState === 'CLOSED'
  };
}

// Hook Prospects Robuste
export function useProspectsRobust() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const vendorIdRef = useRef<string | null>(null);
  const prospectsCircuitName = 'vendor-prospects';

  const getVendorId = useCallback(async (): Promise<string | null> => {
    if (vendorIdRef.current) return vendorIdRef.current;
    if (!user) return null;

    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (vendor) {
      vendorIdRef.current = vendor.id;
    }
    return vendor?.id || null;
  }, [user]);

  const fetchProspects = useCallback(async (silent = false) => {
    if (!user) return;

    try {
      if (!silent) setLoading(true);
      setError(null);

      const result = await circuitBreaker.execute(prospectsCircuitName, async () => {
        return await retryWithBackoff(async () => {
          const vendorId = await getVendorId();
          if (!vendorId) return [];

          const { data, error } = await supabase
            .from('prospects')
            .select('*')
            .eq('vendor_id', vendorId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data || [];
        }, RETRY_CONFIG);
      });

      setProspects(result || []);

    } catch (err: any) {
      console.error('❌ Erreur prospects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, getVendorId]);

  const createProspect = useCallback(async (
    prospectData: Omit<Prospect, 'id' | 'created_at'>
  ): Promise<Prospect | null> => {
    setProcessing(true);

    try {
      const vendorId = await getVendorId();
      if (!vendorId) throw new Error('Vendor not found');

      const result = await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .from('prospects')
          .insert([{ ...prospectData, vendor_id: vendorId }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }, MUTATION_RETRY_CONFIG);

      if (result) {
        setProspects(prev => [result as Prospect, ...prev]);
        toast.success('Prospect créé avec succès');
      }

      return result as Prospect;

    } catch (err: any) {
      console.error('❌ Erreur création prospect:', err);
      setError(err.message);
      toast.error('Erreur lors de la création');
      return null;
    } finally {
      setProcessing(false);
    }
  }, [getVendorId]);

  const updateProspect = useCallback(async (
    id: string,
    updates: Partial<Prospect>
  ): Promise<boolean> => {
    setProcessing(true);

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .from('prospects')
          .update(updates)
          .eq('id', id);

        if (error) throw error;
      }, MUTATION_RETRY_CONFIG);

      setProspects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      toast.success('Prospect mis à jour');
      return true;

    } catch (err: any) {
      console.error('❌ Erreur mise à jour prospect:', err);
      setError(err.message);
      toast.error('Erreur lors de la mise à jour');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  const deleteProspect = useCallback(async (id: string): Promise<boolean> => {
    setProcessing(true);

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .from('prospects')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }, MUTATION_RETRY_CONFIG);

      setProspects(prev => prev.filter(p => p.id !== id));
      toast.success('Prospect supprimé');
      return true;

    } catch (err: any) {
      console.error('❌ Erreur suppression prospect:', err);
      toast.error('Erreur lors de la suppression');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  return {
    prospects,
    loading,
    error,
    processing,
    createProspect,
    updateProspect,
    deleteProspect,
    refetch: fetchProspects
  };
}

// Hook Codes Promo Robuste
export function usePromoCodesRobust() {
  const { user } = useAuth();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const vendorIdRef = useRef<string | null>(null);

  const getVendorId = useCallback(async (): Promise<string | null> => {
    if (vendorIdRef.current) return vendorIdRef.current;
    if (!user) return null;

    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (vendor) {
      vendorIdRef.current = vendor.id;
    }
    return vendor?.id || null;
  }, [user]);

  const fetchPromoCodes = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      await retryWithBackoff(async () => {
        const vendorId = await getVendorId();
        if (!vendorId) return;

        const { data, error } = await supabase
          .from('promo_codes')
          .select('*')
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPromoCodes(data || []);
      }, RETRY_CONFIG);

    } catch (err: any) {
      console.error('❌ Erreur codes promo:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, getVendorId]);

  const createPromoCode = useCallback(async (
    codeData: Omit<PromoCode, 'id' | 'used_count'>
  ): Promise<PromoCode | null> => {
    setProcessing(true);

    try {
      const vendorId = await getVendorId();
      if (!vendorId) throw new Error('Vendor not found');

      const result = await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .from('promo_codes')
          .insert([{ ...codeData, vendor_id: vendorId }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }, MUTATION_RETRY_CONFIG);

      if (result) {
        setPromoCodes(prev => [result as PromoCode, ...prev]);
        toast.success('Code promo créé');
      }

      return result as PromoCode;

    } catch (err: any) {
      console.error('❌ Erreur création code promo:', err);
      setError(err.message);
      toast.error('Erreur lors de la création');
      return null;
    } finally {
      setProcessing(false);
    }
  }, [getVendorId]);

  const togglePromoCode = useCallback(async (
    id: string,
    isActive: boolean
  ): Promise<boolean> => {
    setProcessing(true);

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .from('promo_codes')
          .update({ is_active: isActive })
          .eq('id', id);

        if (error) throw error;
      }, MUTATION_RETRY_CONFIG);

      setPromoCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: isActive } : c));
      toast.success(isActive ? 'Code activé' : 'Code désactivé');
      return true;

    } catch (err: any) {
      console.error('❌ Erreur toggle code promo:', err);
      toast.error('Erreur lors de la modification');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  useEffect(() => {
    fetchPromoCodes();
  }, [fetchPromoCodes]);

  return {
    promoCodes,
    loading,
    error,
    processing,
    createPromoCode,
    togglePromoCode,
    refetch: fetchPromoCodes
  };
}

// Hook Tickets Support Robuste
export function useSupportTicketsRobust() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const vendorIdRef = useRef<string | null>(null);

  const getVendorId = useCallback(async (): Promise<string | null> => {
    if (vendorIdRef.current) return vendorIdRef.current;
    if (!user) return null;

    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (vendor) {
      vendorIdRef.current = vendor.id;
    }
    return vendor?.id || null;
  }, [user]);

  const fetchTickets = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      await retryWithBackoff(async () => {
        const vendorId = await getVendorId();
        if (!vendorId) return;

        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTickets(data || []);
      }, RETRY_CONFIG);

    } catch (err: any) {
      console.error('❌ Erreur tickets support:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, getVendorId]);

  const updateTicketStatus = useCallback(async (
    id: string,
    status: string
  ): Promise<boolean> => {
    setProcessing(true);

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .from('support_tickets')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;
      }, MUTATION_RETRY_CONFIG);

      setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      toast.success('Statut mis à jour');
      return true;

    } catch (err: any) {
      console.error('❌ Erreur mise à jour ticket:', err);
      toast.error('Erreur lors de la mise à jour');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    loading,
    error,
    processing,
    updateTicketStatus,
    refetch: fetchTickets
  };
}

// Export principal avec tous les hooks
export {
  useVendorStatsRobust as useVendorStats,
  useProspectsRobust as useProspects,
  usePromoCodesRobust as usePromoCodes,
  useSupportTicketsRobust as useSupportTickets
};

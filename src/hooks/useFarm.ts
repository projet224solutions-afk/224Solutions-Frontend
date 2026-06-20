/**
 * 🌾 Hooks AGRICULTURE — produits fermiers (catalogue + traçabilité) et commandes temps réel.
 * Lecture/écriture RLS (l'agriculteur gère son service). Commandes : abonnement Realtime.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FarmProduct {
  id: string; professional_service_id: string; name: string; category: string | null; description: string | null;
  unit: string; price: number; stock_quantity: number; low_stock_threshold: number; photos: string[];
  season: string | null; origin: string | null; organic: boolean;
  planting_date: string | null; harvest_date: string | null; culture_method: 'bio' | 'traitement' | 'conventionnel';
  farm_name: string | null; farm_latitude: number | null; farm_longitude: number | null;
  is_active: boolean; created_at: string;
}

export interface FarmOrder {
  id: string; professional_service_id: string; buyer_user_id: string | null;
  customer_name: string | null; customer_phone: string | null; items: any[]; total: number;
  delivery_type: string; status: 'nouveau' | 'confirme' | 'prepare' | 'expedie' | 'livre' | 'annule';
  notes: string | null; created_at: string;
}

export function useFarmProducts(serviceId?: string) {
  const [products, setProducts] = useState<FarmProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('farm_products').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setProducts(((data as unknown as FarmProduct[]) ?? []).map((p) => ({ ...p, photos: Array.isArray(p.photos) ? p.photos : [] })));
    setLoading(false);
  }, [serviceId]);

  useEffect(() => { void load(); }, [load]);

  const createProduct = useCallback(async (payload: Partial<FarmProduct>) => {
    if (!serviceId) return null;
    const { data, error } = await supabase.from('farm_products').insert({ ...payload, professional_service_id: serviceId } as any).select().single();
    if (error) { toast.error(error.message); return null; }
    toast.success('Produit publié');
    await load();
    return data as FarmProduct;
  }, [serviceId, load]);

  const updateProduct = useCallback(async (id: string, patch: Partial<FarmProduct>) => {
    const { error } = await supabase.from('farm_products').update({ ...patch, updated_at: new Date().toISOString() } as any).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
  }, [load]);

  const toggleActive = useCallback(async (p: FarmProduct) => {
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
    await supabase.from('farm_products').update({ is_active: !p.is_active, updated_at: new Date().toISOString() }).eq('id', p.id);
  }, []);

  const removeProduct = useCallback(async (id: string) => {
    setProducts((prev) => prev.filter((x) => x.id !== id));
    await supabase.from('farm_products').delete().eq('id', id);
  }, []);

  const lowStock = useMemo(() => products.filter((p) => p.is_active && p.stock_quantity <= p.low_stock_threshold), [products]);

  return { products, lowStock, loading, reload: load, createProduct, updateProduct, toggleActive, removeProduct };
}

const ACTIVE_ORDER = ['nouveau', 'confirme', 'prepare', 'expedie'];

export function useFarmOrders(serviceId?: string) {
  const [orders, setOrders] = useState<FarmOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('farm_orders').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: true });
    setOrders(((data as unknown as FarmOrder[]) ?? []).map((o) => ({ ...o, items: Array.isArray(o.items) ? o.items : [] })));
    setLoading(false);
  }, [serviceId]);

  useEffect(() => {
    void load();
    if (!serviceId) return;
    const ch = supabase
      .channel(`farm-orders-${serviceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_orders', filter: `professional_service_id=eq.${serviceId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [serviceId, load]);

  const setStatus = useCallback(async (id: string, status: FarmOrder['status']) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, status } : o));
      return ['livre', 'annule'].includes(status) ? next.filter((o) => o.id !== id) : next;
    });
    const { error } = await supabase.from('farm_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); await load(); return false; }
    return true;
  }, [load]);

  const columns = useMemo(() => ({
    nouvelles: orders.filter((o) => o.status === 'nouveau'),
    preparation: orders.filter((o) => o.status === 'confirme' || o.status === 'prepare'),
    expediees: orders.filter((o) => o.status === 'expedie'),
  }), [orders]);

  return { orders, columns, loading, reload: load, setStatus, active: orders.filter((o) => ACTIVE_ORDER.includes(o.status)) };
}

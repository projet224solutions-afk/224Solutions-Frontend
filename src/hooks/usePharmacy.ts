/**
 * Hooks du service Pharmacie (côté pharmacien). Les ordonnances/commandes passent par le backend
 * `/api/v2/pharmacy` (validation manuelle, paiement atomique côté serveur) ; le catalogue de
 * médicaments est géré en Supabase direct (RLS pharmacien).
 */
import { useState, useCallback, useEffect, useId } from 'react';
import { backendFetch } from '@/services/backendApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PrescriptionMed { name: string; dosage?: string; quantity: number; price: number; available?: boolean; note?: string; }
export interface Prescription {
  id: string; client_id: string | null; pharmacy_id: string; photos: string[];
  status: 'pending' | 'reviewing' | 'validated' | 'quoted' | 'refused' | 'expired';
  pharmacist_notes: string | null; refuse_reason: string | null;
  medications_validated: PrescriptionMed[]; total_quoted: number | null; delivery_fee: number | null;
  delivery_type: 'delivery' | 'pickup' | null; delivery_address: string | null;
  customer_name: string | null; customer_phone: string | null; created_at: string;
}
export interface PharmacyOrder {
  id: string; client_id: string | null; pharmacy_id: string; prescription_id: string | null;
  amount: number; medications: any[]; delivery_type: 'delivery' | 'pickup' | null; delivery_address: string | null;
  status: 'preparing' | 'ready' | 'delivering' | 'delivered' | 'collected' | 'cancelled';
  created_at: string;
}
export interface Medication {
  id: string; pharmacy_id: string; name: string; dosage: string | null; form: string | null;
  price: number | null; stock: number; requires_prescription: boolean; generic_equivalents: string[];
  low_stock_threshold: number; is_active: boolean;
  // Conformité (migration 20260628000006) : niveau de contrôle + péremption + lot
  control_level?: 'none' | 'prescription' | 'controlled' | 'narcotic';
  expiry_date?: string | null; batch_number?: string | null;
}

/** File d'ordonnances du pharmacien + actions (valider / refuser). */
export function usePharmacyPrescriptions(serviceId: string) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = useId();

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await backendFetch<any>(`/api/v2/pharmacy/prescriptions?service_id=${encodeURIComponent(serviceId)}`, { method: 'GET' });
      if (res.success) setPrescriptions(((res as any).data ?? []) as Prescription[]);
    } catch { /* transitoire */ } finally { setLoading(false); }
  }, [serviceId]);

  useEffect(() => {
    void load();
    if (!serviceId) return;
    // Temps réel : nouvelle ordonnance / changement → recharge.
    const ch = supabase.channel(`pharmacy-presc-${serviceId}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions', filter: `pharmacy_id=eq.${serviceId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load, serviceId, uid]);

  const validate = useCallback(async (id: string, medications: PrescriptionMed[], notes?: string, deliveryFee?: number): Promise<boolean> => {
    const res = await backendFetch<any>(`/api/v2/pharmacy/prescriptions/${id}/validate`, { method: 'POST', body: { medications, notes, delivery_fee: deliveryFee } });
    if (!res.success) { toast.error((res as any).error || 'Validation impossible'); return false; }
    toast.success('Ordonnance validée — devis envoyé au client'); await load(); return true;
  }, [load]);

  const refuse = useCallback(async (id: string, reason: string): Promise<boolean> => {
    const res = await backendFetch<any>(`/api/v2/pharmacy/prescriptions/${id}/refuse`, { method: 'POST', body: { reason } });
    if (!res.success) { toast.error((res as any).error || 'Refus impossible'); return false; }
    toast.success('Ordonnance refusée'); await load(); return true;
  }, [load]);

  return { prescriptions, loading, reload: load, validate, refuse };
}

/** Commandes payées à préparer + avancement de statut. */
export function usePharmacyOrders(serviceId: string) {
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = useId();

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await backendFetch<any>(`/api/v2/pharmacy/orders?service_id=${encodeURIComponent(serviceId)}`, { method: 'GET' });
      if (res.success) setOrders(((res as any).data ?? []) as PharmacyOrder[]);
    } catch { /* transitoire */ } finally { setLoading(false); }
  }, [serviceId]);

  useEffect(() => {
    void load();
    if (!serviceId) return;
    const ch = supabase.channel(`pharmacy-orders-${serviceId}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pharmacy_orders', filter: `pharmacy_id=eq.${serviceId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load, serviceId, uid]);

  const setStatus = useCallback(async (id: string, status: PharmacyOrder['status']) => {
    const res = await backendFetch<any>(`/api/v2/pharmacy/orders/${id}/status`, { method: 'POST', body: { status } });
    if (!res.success) { toast.error((res as any).error || 'Mise à jour impossible'); return; }
    await load();
  }, [load]);

  return { orders, loading, reload: load, setStatus };
}

/** Catalogue de médicaments (Supabase direct, RLS pharmacien). */
export function usePharmacyMedications(serviceId: string) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('pharmacy_medications').select('*').eq('pharmacy_id', serviceId).order('name');
    setMedications((data as Medication[]) || []);
    setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);

  const upsert = useCallback(async (med: Partial<Medication> & { id?: string }) => {
    const payload: any = {
      pharmacy_id: serviceId, name: med.name, dosage: med.dosage ?? null, form: med.form ?? null,
      price: med.price ?? 0, stock: med.stock ?? 0, requires_prescription: med.requires_prescription ?? true,
      generic_equivalents: med.generic_equivalents ?? [], low_stock_threshold: med.low_stock_threshold ?? 5,
      is_active: med.is_active ?? true, updated_at: new Date().toISOString(),
      // Conformité : contrôle / péremption / lot
      control_level: med.control_level ?? 'none',
      expiry_date: med.expiry_date ?? null, batch_number: med.batch_number ?? null,
    };
    const q = med.id
      ? supabase.from('pharmacy_medications').update(payload).eq('id', med.id)
      : supabase.from('pharmacy_medications').insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return false; }
    toast.success(med.id ? 'Médicament mis à jour' : 'Médicament ajouté'); await load(); return true;
  }, [serviceId, load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('pharmacy_medications').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    await load();
  }, [load]);

  return { medications, loading, reload: load, upsert, remove };
}

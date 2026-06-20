/**
 * Hooks CLIENT du service Pharmacie : découverte des pharmacies (public), envoi d'ordonnance,
 * suivi de ses ordonnances/commandes, paiement du devis. Le prix est TOUJOURS le devis du
 * pharmacien (le backend lit total_quoted, jamais un montant du client).
 */
import { useState, useCallback, useEffect, useId } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Prescription, PharmacyOrder } from '@/hooks/usePharmacy';

const PHARMA_TYPE = 'b8f7e6d5-c4a3-4b21-9e0f-1a2b3c4d5e6f';

export interface PharmacyCard {
  id: string; business_name: string; logo_url: string | null; cover_image_url: string | null;
  address: string | null; city: string | null; rating: number | null; total_reviews: number | null;
  latitude: number | null; longitude: number | null; opening_hours: any; metadata: any;
  on_call: boolean;
}

/** Liste publique des pharmacies (+ marquage « de garde » aujourd'hui). Visible sans connexion. */
export function usePharmaciesDiscovery() {
  const [pharmacies, setPharmacies] = useState<PharmacyCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: svcs } = await supabase
        .from('professional_services')
        .select('id, business_name, logo_url, cover_image_url, address, city, rating, total_reviews, latitude, longitude, opening_hours, metadata')
        .eq('service_type_id', PHARMA_TYPE).eq('status', 'active');
      const list = (svcs || []) as any[];
      // Pharmacies de garde aujourd'hui.
      const today = new Date().toISOString().slice(0, 10);
      const { data: oncall } = await supabase.from('pharmacy_oncall').select('pharmacy_id').eq('oncall_date', today);
      const onCallSet = new Set((oncall || []).map((o: any) => o.pharmacy_id));
      setPharmacies(list.map((s) => ({ ...s, on_call: onCallSet.has(s.id) })));
    } catch { /* public, dégrade en liste vide */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return { pharmacies, loading, reload: load };
}

/** Ordonnances du client (envoi + suivi) + paiement du devis. */
export function useClientPrescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = useId();

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [pr, or] = await Promise.all([
        backendFetch<any>('/api/v2/pharmacy/prescriptions', { method: 'GET' }),
        backendFetch<any>('/api/v2/pharmacy/orders', { method: 'GET' }),
      ]);
      if (pr.success) setPrescriptions(((pr as any).data ?? []) as Prescription[]);
      if (or.success) setOrders(((or as any).data ?? []) as PharmacyOrder[]);
    } catch { /* transitoire */ } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    void load();
    if (!user?.id) return;
    const ch = supabase.channel(`client-presc-${user.id}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions', filter: `client_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load, user?.id, uid]);

  /** Envoie une ordonnance scannée à une pharmacie. */
  const sendPrescription = useCallback(async (input: {
    pharmacy_id: string; photos: string[]; delivery_type: 'delivery' | 'pickup'; delivery_address?: string;
    customer_name?: string; customer_phone?: string;
  }): Promise<boolean> => {
    const res = await backendFetch<any>('/api/v2/pharmacy/prescriptions', { method: 'POST', body: input });
    if (!res.success) { toast.error((res as any).error || 'Envoi impossible'); return false; }
    toast.success('Ordonnance envoyée — le pharmacien va la vérifier'); await load(); return true;
  }, [load]);

  /** Paie le devis d'une ordonnance validée (prix = devis pharmacien, côté serveur). */
  const payPrescription = useCallback(async (prescriptionId: string): Promise<boolean> => {
    const res = await backendFetch<any>('/api/v2/pharmacy/order', { method: 'POST', body: { prescription_id: prescriptionId } });
    if (!res.success) {
      toast.error((res as any).error?.includes?.('SOLDE') ? 'Solde insuffisant — rechargez votre wallet' : (res as any).error || 'Paiement refusé');
      return false;
    }
    toast.success('Paiement effectué — la pharmacie prépare votre commande'); await load(); return true;
  }, [load]);

  return { prescriptions, orders, loading, reload: load, sendPrescription, payPrescription };
}

/**
 * Upload d'une photo d'ordonnance dans le bucket PRIVÉ `prescriptions`, sous le dossier
 * de l'utilisateur (<uid>/...). Renvoie le CHEMIN (pas d'URL publique : donnée médicale).
 * L'affichage se fait via URL signée backend (usePrescriptionPhotos).
 */
export async function uploadPrescriptionPhoto(file: File, userId: string): Promise<{ path: string } | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('prescriptions').upload(path, file, {
    contentType: file.type || 'image/jpeg', upsert: false,
  });
  if (error) { toast.error("Échec de l'upload de l'ordonnance"); return null; }
  return { path };
}

/** Résout les URLs signées (5 min) des photos d'une ordonnance via le backend (accès gaté). */
export function usePrescriptionPhotos(prescriptionId: string | null, enabled = true) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!prescriptionId || !enabled) { setUrls([]); return; }
    setLoading(true);
    try {
      const res = await backendFetch<any>(`/api/v2/pharmacy/prescriptions/${prescriptionId}/photos`, { method: 'GET' });
      if (res.success) setUrls(((res as any).data ?? []) as string[]);
    } catch { /* transitoire */ } finally { setLoading(false); }
  }, [prescriptionId, enabled]);
  useEffect(() => { void load(); }, [load]);
  return { urls, loading, reload: load };
}

export interface MedicationReminder {
  id: string; client_id: string | null; medication_name: string;
  times: string[]; frequency: string | null; duration_days: number | null;
  start_date: string; active: boolean; created_at: string;
}

/** Rappels de prise de médicaments du client (CRUD via backend). Aucun conseil médical :
 *  le client saisit lui-même nom + heures ; le système rappelle l'heure via une notification. */
export function useMedicationReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await backendFetch<any>('/api/v2/pharmacy/reminders', { method: 'GET' });
      if (res.success) setReminders(((res as any).data ?? []) as MedicationReminder[]);
    } catch { /* transitoire */ } finally { setLoading(false); }
  }, [user?.id]);
  useEffect(() => { void load(); }, [load]);

  const addReminder = useCallback(async (input: {
    medication_name: string; times: string[]; frequency?: string; duration_days?: number | null;
  }): Promise<boolean> => {
    const res = await backendFetch<any>('/api/v2/pharmacy/reminders', { method: 'POST', body: input });
    if (!res.success) { toast.error((res as any).error || 'Création impossible'); return false; }
    toast.success('Rappel créé'); await load(); return true;
  }, [load]);

  const removeReminder = useCallback(async (id: string): Promise<void> => {
    const res = await backendFetch<any>(`/api/v2/pharmacy/reminders/${id}`, { method: 'DELETE' });
    if (!res.success) { toast.error((res as any).error || 'Suppression impossible'); return; }
    await load();
  }, [load]);

  return { reminders, loading, reload: load, addReminder, removeReminder };
}

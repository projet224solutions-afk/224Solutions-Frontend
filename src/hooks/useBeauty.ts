/**
 * 💇 Hooks BEAUTÉ — services (durée en minutes) + rendez-vous temps réel + créneaux.
 * Schéma LIVE : beauty_services/appointments utilisent `professional_service_id`,
 * `duration_minutes`, `total_price`. Le découpage de l'agenda dépend de la durée du service.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';

export interface BeautyService {
  id: string; professional_service_id: string; name: string; description: string | null;
  duration_minutes: number; price: number; category: string | null; is_active: boolean;
  image_url?: string | null; video_url?: string | null;
  deposit_required?: number; is_home_service?: boolean; home_service_extra_fee?: number;
}
export interface BeautyAppointment {
  id: string; professional_service_id: string; beauty_service_id: string | null; staff_id: string | null;
  customer_name: string; customer_phone: string | null; customer_email: string | null;
  customer_user_id: string | null; appointment_date: string; appointment_time: string;
  duration_minutes: number; total_price: number; no_show_fee: number;
  status: string; notes: string | null; created_at: string;
}

export const CATEGORY_COLORS: Record<string, string> = {
  coiffure: 'bg-blue-500', coupe: 'bg-blue-500', coloration: 'bg-orange-500',
  soins: 'bg-green-500', soin: 'bg-green-500', maquillage: 'bg-purple-500',
  ongles: 'bg-pink-500', epilation: 'bg-rose-500', general: 'bg-slate-500', default: 'bg-slate-500',
};
export const colorFor = (cat?: string | null) => CATEGORY_COLORS[(cat || '').toLowerCase()] || CATEGORY_COLORS.default;

export function useBeautyServices(serviceId?: string) {
  const [services, setServices] = useState<BeautyService[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('beauty_services').select('*').eq('professional_service_id', serviceId).order('category', { ascending: true });
    setServices((data as unknown as BeautyService[]) ?? []);
    setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);

  const createService = useCallback(async (payload: Partial<BeautyService> & { name: string; duration_minutes: number; price: number }) => {
    if (!serviceId) return false;
    const { error } = await supabase.from('beauty_services').insert({ ...payload, professional_service_id: serviceId } as any);
    if (error) { toast.error(error.message); return false; }
    toast.success('Service ajouté'); await load(); return true;
  }, [serviceId, load]);
  const updateService = useCallback(async (id: string, patch: Partial<BeautyService>) => {
    const { error } = await supabase.from('beauty_services').update(patch as any).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await load(); return true;
  }, [load]);
  const toggleService = useCallback(async (s: BeautyService) => {
    setServices((p) => p.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
    await supabase.from('beauty_services').update({ is_active: !s.is_active }).eq('id', s.id);
  }, []);
  const removeService = useCallback(async (id: string) => {
    setServices((p) => p.filter((x) => x.id !== id));
    await supabase.from('beauty_services').delete().eq('id', id);
  }, []);

  return { services, loading, reload: load, createService, updateService, toggleService, removeService };
}

export function useBeautyAppointments(serviceId?: string) {
  const [appointments, setAppointments] = useState<BeautyAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const from = new Date(); from.setDate(from.getDate() - 1);
    const { data } = await supabase.from('beauty_appointments').select('*').eq('professional_service_id', serviceId)
      .gte('appointment_date', from.toISOString().slice(0, 10)).order('appointment_date', { ascending: true });
    setAppointments((data as unknown as BeautyAppointment[]) ?? []);
    setLoading(false);
  }, [serviceId]);

  useEffect(() => {
    void load();
    if (!serviceId) return;
    const ch = supabase.channel(`beauty-appt-${serviceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beauty_appointments', filter: `professional_service_id=eq.${serviceId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [serviceId, load]);

  const setStatus = useCallback(async (id: string, status: string) => {
    setAppointments((p) => p.map((x) => (x.id === id ? { ...x, status } : x)));
    const { error } = await supabase.from('beauty_appointments').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); await load(); }
  }, [load]);

  const createManual = useCallback(async (payload: { beauty_service_id: string; customer_name: string; customer_phone?: string; appointment_date: string; appointment_time: string; duration_minutes: number; total_price: number; status?: string }) => {
    if (!serviceId) return false;
    const { error } = await supabase.from('beauty_appointments').insert({ ...payload, professional_service_id: serviceId, status: payload.status || 'confirmed' } as any);
    if (error) { toast.error(error.message); return false; }
    toast.success('Rendez-vous créé'); await load(); return true;
  }, [serviceId, load]);

  const markNoShow = useCallback(async (id: string) => {
    const res = await backendFetch(`/api/v2/beauty/appointment/${id}/no-show`, { method: 'POST', body: {} });
    if (res.success) { toast.success('No-show enregistré'); await load(); }
    else toast.error(res.error || 'Action impossible');
    return res.success;
  }, [load]);

  return { appointments, loading, reload: load, setStatus, createManual, markNoShow };
}

/** Créneaux disponibles (pas de 15 min) selon la durée du service et les plages occupées [start,end] (minutes). */
export function computeFreeSlots(durationMin: number, busy: [number, number][], openHour = 9, closeHour = 20): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const out: string[] = [];
  for (let t = openHour * 60; t + durationMin <= closeHour * 60; t += 15) {
    if (!busy.some(([s, e]) => t < e && t + durationMin > s)) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARAMÈTRES PRESTATAIRE (walk-in, annulation, fidélité, heure de rappel)
// ─────────────────────────────────────────────────────────────────────────────
export interface BeautySettings {
  professional_service_id: string; accepts_walkin: boolean; cancel_window_hours: number;
  noshow_penalty_pct: number; loyalty_threshold: number; loyalty_reward: string | null; reminder_day_before_hour: number;
}
export function useBeautySettings(serviceId?: string) {
  const [settings, setSettings] = useState<BeautySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('beauty_settings').select('*').eq('professional_service_id', serviceId).maybeSingle();
    setSettings((data as any) ?? { professional_service_id: serviceId, accepts_walkin: false, cancel_window_hours: 24, noshow_penalty_pct: 50, loyalty_threshold: 10, loyalty_reward: null, reminder_day_before_hour: 18 });
    setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);
  const save = useCallback(async (patch: Partial<BeautySettings>) => {
    if (!serviceId) return;
    const next = { ...(settings || {}), ...patch, professional_service_id: serviceId };
    setSettings(next as BeautySettings);
    const { error } = await supabase.from('beauty_settings').upsert(next as any, { onConflict: 'professional_service_id' });
    if (error) toast.error(error.message); else toast.success('Paramètres enregistrés');
  }, [serviceId, settings]);
  return { settings, loading, save };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIDÉLITÉ (compteur de visites par client)
// ─────────────────────────────────────────────────────────────────────────────
export interface BeautyLoyalty { id: string; client_user_id: string | null; visits_count: number; visits_threshold: number; last_rewarded_at: string | null; }
export function useBeautyLoyalty(serviceId?: string) {
  const [rows, setRows] = useState<BeautyLoyalty[]>([]);
  const load = useCallback(async () => {
    if (!serviceId) return;
    const { data } = await supabase.from('beauty_loyalty').select('*').eq('professional_service_id', serviceId).order('visits_count', { ascending: false });
    setRows((data as any) ?? []);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);
  const reward = useCallback(async (id: string) => {
    await supabase.from('beauty_loyalty').update({ visits_count: 0, last_rewarded_at: new Date().toISOString() }).eq('id', id);
    toast.success('Récompense délivrée'); await load();
  }, [load]);
  return { rows, reload: load, reward };
}

// ─────────────────────────────────────────────────────────────────────────────
// GALERIE avant/après (publique ou privée par client)
// ─────────────────────────────────────────────────────────────────────────────
export interface BeautyGalleryItem {
  id: string; professional_service_id: string; client_user_id: string | null; before_url: string | null;
  after_url: string | null; image_url: string | null; service_category: string | null; description: string | null;
  is_public: boolean; is_pinned: boolean; created_at: string;
}
export function useBeautyGallery(serviceId?: string) {
  const [items, setItems] = useState<BeautyGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('beauty_gallery').select('*').eq('professional_service_id', serviceId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    setItems((data as any) ?? []); setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);
  const add = useCallback(async (payload: Partial<BeautyGalleryItem>) => {
    if (!serviceId) return;
    const { error } = await supabase.from('beauty_gallery').insert({ ...payload, professional_service_id: serviceId } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Réalisation ajoutée'); await load();
  }, [serviceId, load]);
  const togglePublic = useCallback(async (it: BeautyGalleryItem) => {
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, is_public: !x.is_public } : x)));
    await supabase.from('beauty_gallery').update({ is_public: !it.is_public }).eq('id', it.id);
  }, []);
  const remove = useCallback(async (id: string) => {
    setItems((p) => p.filter((x) => x.id !== id));
    await supabase.from('beauty_gallery').delete().eq('id', id);
  }, []);
  return { items, loading, reload: load, add, togglePublic, remove };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORFAITS
// ─────────────────────────────────────────────────────────────────────────────
export interface BeautyPackage { id: string; name: string; description: string | null; service_ids: string[]; total_duration_minutes: number; price: number; original_price: number; is_active: boolean; }
export function useBeautyPackages(serviceId?: string) {
  const [packages, setPackages] = useState<BeautyPackage[]>([]);
  const load = useCallback(async () => {
    if (!serviceId) return;
    const { data } = await supabase.from('beauty_packages').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setPackages((data as any) ?? []);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);
  const create = useCallback(async (payload: Partial<BeautyPackage>) => {
    if (!serviceId) return;
    const { error } = await supabase.from('beauty_packages').insert({ ...payload, professional_service_id: serviceId } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Forfait créé'); await load();
  }, [serviceId, load]);
  const remove = useCallback(async (id: string) => { setPackages((p) => p.filter((x) => x.id !== id)); await supabase.from('beauty_packages').delete().eq('id', id); }, []);
  return { packages, reload: load, create, remove };
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTES CLIENT (privées)
// ─────────────────────────────────────────────────────────────────────────────
export function useBeautyClientNotes(serviceId?: string, clientUserId?: string | null) {
  const [note, setNote] = useState<any>(null);
  const load = useCallback(async () => {
    if (!serviceId || !clientUserId) { setNote(null); return; }
    const { data } = await supabase.from('beauty_client_notes').select('*').eq('professional_service_id', serviceId).eq('client_user_id', clientUserId).maybeSingle();
    setNote(data ?? null);
  }, [serviceId, clientUserId]);
  useEffect(() => { void load(); }, [load]);
  const save = useCallback(async (patch: { notes?: string; allergies?: string; preferences?: string }) => {
    if (!serviceId) return;
    const row = { professional_service_id: serviceId, client_user_id: clientUserId, ...patch, updated_at: new Date().toISOString() };
    const { error } = note?.id
      ? await supabase.from('beauty_client_notes').update(patch as any).eq('id', note.id)
      : await supabase.from('beauty_client_notes').insert(row as any);
    if (error) toast.error(error.message); else { toast.success('Note enregistrée'); await load(); }
  }, [serviceId, clientUserId, note, load]);
  return { note, save };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS (dérivés des RDV)
// ─────────────────────────────────────────────────────────────────────────────
export function useBeautyAnalytics(serviceId?: string) {
  const { appointments } = useBeautyAppointmentsAll(serviceId);
  return useMemo(() => {
    const paid = appointments.filter((a) => a.status === 'completed' || a.status === 'confirmed');
    const now = new Date(); const month = now.getMonth(); const year = now.getFullYear();
    const monthAppts = paid.filter((a) => { const d = new Date(a.appointment_date); return d.getMonth() === month && d.getFullYear() === year; });
    const revenue = monthAppts.reduce((s, a) => s + (a.total_price || 0), 0);
    const avg = monthAppts.length ? Math.round(revenue / monthAppts.length) : 0;
    // Top services
    const byService = new Map<string, { count: number; revenue: number }>();
    paid.forEach((a) => { const k = a.beauty_service_id || '—'; const cur = byService.get(k) || { count: 0, revenue: 0 }; cur.count++; cur.revenue += a.total_price || 0; byService.set(k, cur); });
    // Remplissage par jour de semaine
    const byDow = Array.from({ length: 7 }, () => 0);
    paid.forEach((a) => { byDow[new Date(a.appointment_date).getDay()]++; });
    // No-shows
    const noShows = appointments.filter((a) => a.status === 'no_show');
    return {
      revenueMonth: revenue, countMonth: monthAppts.length, avgBasket: avg,
      topServices: [...byService.entries()].map(([k, v]) => ({ id: k, ...v })).sort((a, b) => b.count - a.count).slice(0, 10),
      byDow, noShowCount: noShows.length, noShowPenalties: noShows.reduce((s, a) => s + (a.penalty_applied || a.no_show_fee || 0), 0),
      weekly: weeklyRevenue(paid),
    };
  }, [appointments]);
}

function weeklyRevenue(appts: any[]) {
  const weeks: Record<string, number> = {};
  appts.forEach((a) => {
    const d = new Date(a.appointment_date); const onejan = new Date(d.getFullYear(), 0, 1);
    const w = Math.ceil((((d as any) - (onejan as any)) / 86400000 + onejan.getDay() + 1) / 7);
    const key = `S${w}`; weeks[key] = (weeks[key] || 0) + (a.total_price || 0);
  });
  return Object.entries(weeks).slice(-12).map(([label, revenue]) => ({ label, revenue }));
}

/** Actions client (annulation atomique avec pénalité, avis vérifié). */
export async function cancelBeautyAppointment(appointmentId: string) {
  return backendFetch<{ refunded: number; penalty: number }>(`/api/v2/beauty/appointment/${appointmentId}/cancel`, { method: 'POST', body: {} });
}
export async function submitBeautyReview(appointmentId: string, rating: number, text: string) {
  return backendFetch(`/api/v2/beauty/appointment/${appointmentId}/review`, { method: 'POST', body: { rating, text } });
}

/** Tous les RDV (sans filtre de date) — pour l'analytics et le CRM. */
export function useBeautyAppointmentsAll(serviceId?: string) {
  const [appointments, setAppointments] = useState<(BeautyAppointment & { penalty_applied?: number })[]>([]);
  const load = useCallback(async () => {
    if (!serviceId) return;
    const { data } = await supabase.from('beauty_appointments').select('*').eq('professional_service_id', serviceId).order('appointment_date', { ascending: false });
    setAppointments((data as any) ?? []);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);
  return { appointments, reload: load };
}

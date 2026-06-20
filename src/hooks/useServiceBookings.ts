/**
 * 📅 Hook de RÉSERVATIONS de proximité (RDV) — partagé par les modules « sur rendez-vous »
 * (Ménage, Fitness, Coach, Réparation, Photo, Éducation…).
 * - Lecture directe via RLS (le prestataire voit les RDV de son service).
 * - Écritures (création, changement de statut) via le BACKEND (RPC atomiques durcies).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface ServiceBooking {
  id: string; service_id: string | null; provider_id: string; client_id: string | null;
  customer_name: string | null; customer_phone: string | null;
  service_code: string | null; service_label: string | null;
  scheduled_date: string | null; scheduled_time: string | null; duration_minutes: number | null;
  address: string | null; price: number; status: BookingStatus;
  recurring: boolean; frequency: string | null; notes: string | null; created_at: string;
}

export interface NewBooking {
  service_id: string;
  customer_name?: string; customer_phone?: string;
  service_code?: string; service_label?: string;
  scheduled_date?: string; scheduled_time?: string; duration_minutes?: number;
  address?: string; price?: number; recurring?: boolean; frequency?: string; notes?: string;
}

export function useServiceBookings(serviceId?: string) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    let q = (supabase as any).from('proximity_bookings').select('*').order('scheduled_date', { ascending: false });
    if (serviceId) q = q.eq('service_id', serviceId);
    const { data } = await q;
    setBookings((data as unknown as ServiceBooking[]) ?? []);
    setLoading(false);
  }, [user?.id, serviceId]);

  useEffect(() => { void load(); }, [load]);

  const createBooking = useCallback(async (payload: NewBooking) => {
    const res = await backendFetch('/api/v2/bookings', { method: 'POST', body: payload });
    if (res.success) { toast.success('Réservation enregistrée'); await load(); }
    else toast.error(res.error || 'Réservation impossible');
    return res.success;
  }, [load]);

  const setStatus = useCallback(async (id: string, status: BookingStatus) => {
    const res = await backendFetch(`/api/v2/bookings/${id}/status`, { method: 'POST', body: { status } });
    if (res.success) { toast.success('Statut mis à jour'); await load(); }
    else toast.error(res.error || 'Mise à jour impossible');
    return res.success;
  }, [load]);

  // Statistiques réelles dérivées des réservations.
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const active = bookings.filter((b) => b.status !== 'cancelled');
    return {
      todayBookings: active.filter((b) => b.scheduled_date === today).length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      completedThisWeek: bookings.filter((b) => b.status === 'completed' && new Date(b.created_at) >= weekAgo).length,
      revenue: bookings.filter((b) => b.status === 'completed').reduce((s, b) => s + (Number(b.price) || 0), 0),
    };
  }, [bookings]);

  return { bookings, loading, reload: load, createBooking, setStatus, stats };
}

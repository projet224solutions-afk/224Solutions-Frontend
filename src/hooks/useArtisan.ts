/**
 * Hooks ARTISAN partagés (4 métiers).
 * - Lecture des devis/interventions (RLS : chacun voit les siens) via le client Supabase.
 * - Création de devis par l'artisan (RLS artisan_write).
 * - Transitions sensibles (accept devis, valider intervention) via le BACKEND (RPC service_role).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import type { ArtisanService, QuoteItem } from '@/lib/artisan/calculator';

export interface ArtisanQuote {
  id: string; artisan_id: string; client_id: string | null; service_type: ArtisanService;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'refused' | 'expired';
  items: QuoteItem[]; total_ht: number | null; tax_rate: number | null; total_ttc: number | null;
  photos: string[]; notes: string | null; valid_until: string | null; pdf_url: string | null; created_at: string;
}

export interface ArtisanIntervention {
  id: string; artisan_id: string; client_id: string | null; quote_id: string | null; service_type: ArtisanService;
  status: 'scheduled' | 'en_route' | 'on_site' | 'completed' | 'validated' | 'cancelled';
  photos_before: string[]; photos_after: string[]; notes_artisan: string | null;
  client_validated_at: string | null; started_at: string | null; completed_at: string | null; created_at: string;
  deposit_amount?: number; deposit_paid_at?: string | null; balance_paid_at?: string | null;
  amount_paid?: number; commission_total?: number;
}

export interface ArtisanRequest {
  id: string; client_id: string; service_type: ArtisanService; title: string; description: string | null;
  photos: string[]; address: string | null; city: string | null; latitude: number | null; longitude: number | null;
  urgency: 'normal' | 'urgent' | 'immediate'; preferred_date: string | null;
  status: 'open' | 'quoted' | 'assigned' | 'closed' | 'cancelled'; accepted_quote_id: string | null;
  quotes_count: number; created_at: string;
}

export interface NewArtisanRequest {
  service_type: ArtisanService; title: string; description?: string; photos?: string[];
  address?: string; city?: string; latitude?: number; longitude?: number;
  urgency?: 'normal' | 'urgent' | 'immediate'; preferred_date?: string | null;
}

/** CÔTÉ CLIENT : ses demandes (lecture RLS) + création (backend, validée). */
export function useClientArtisanRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ArtisanRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any).from('artisan_requests').select('*').eq('client_id', user.id).order('created_at', { ascending: false });
    setRequests((data as unknown as ArtisanRequest[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const createRequest = useCallback(async (payload: NewArtisanRequest) => {
    const res = await backendFetch('/api/v2/artisan/requests', { method: 'POST', body: payload });
    if (res.success) { toast.success('Demande publiée — les artisans vont vous envoyer des devis'); await load(); }
    else toast.error(res.error || 'Publication impossible');
    return res;
  }, [load]);

  return { requests, loading, reload: load, createRequest };
}

/** CÔTÉ CLIENT : les devis reçus pour UNE demande (comparaison côte à côte) + acceptation. */
export function useQuotesForRequest(requestId: string | null) {
  const [quotes, setQuotes] = useState<ArtisanQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!requestId) { setQuotes([]); setLoading(false); return; }
    const { data } = await (supabase as any).from('artisan_quotes').select('*').eq('request_id', requestId).order('total_ttc', { ascending: true });
    setQuotes((data as unknown as ArtisanQuote[]) ?? []);
    setLoading(false);
  }, [requestId]);

  useEffect(() => { void load(); }, [load]);

  const acceptQuote = useCallback(async (quoteId: string) => {
    const res = await backendFetch(`/api/v2/artisan/quote/${quoteId}/accept`, { method: 'POST', body: {} });
    if (res.success) { toast.success('Devis accepté — intervention programmée'); await load(); }
    else toast.error(res.error || 'Acceptation impossible');
    return res.success;
  }, [load]);

  return { quotes, loading, reload: load, acceptQuote };
}

/** CÔTÉ ARTISAN : job board des demandes ouvertes de ses métiers + dépôt de devis. */
export function useOpenArtisanRequests() {
  const [requests, setRequests] = useState<ArtisanRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await backendFetch('/api/v2/artisan/requests/open', { method: 'GET' });
    setRequests(res.success ? (((res as any).requests as ArtisanRequest[]) ?? []) : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submitQuote = useCallback(async (
    requestId: string,
    payload: { items: QuoteItem[]; total_ht: number; tax_rate?: number; total_ttc: number; photos?: string[]; notes?: string; valid_until?: string | null },
  ) => {
    const res = await backendFetch(`/api/v2/artisan/requests/${requestId}/quote`, { method: 'POST', body: payload });
    if (res.success) { toast.success('Devis envoyé au client'); await load(); }
    else toast.error(res.error || 'Envoi du devis impossible');
    return res.success;
  }, [load]);

  return { requests, loading, reload: load, submitQuote };
}

export function useArtisanQuotes(role: 'artisan' | 'client' = 'artisan') {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<ArtisanQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const col = role === 'artisan' ? 'artisan_id' : 'client_id';
    const { data } = await (supabase as any).from('artisan_quotes').select('*').eq(col, user.id).order('created_at', { ascending: false });
    setQuotes((data as unknown as ArtisanQuote[]) ?? []);
    setLoading(false);
  }, [user?.id, role]);

  useEffect(() => { void load(); }, [load]);

  /** L'artisan crée un devis (RLS artisan_write). */
  const createQuote = useCallback(async (q: Partial<ArtisanQuote>) => {
    if (!user?.id) return null;
    const { data, error } = await (supabase as any).from('artisan_quotes')
      .insert({ ...q, artisan_id: user.id } as any).select().single();
    if (error) { toast.error(error.message); return null; }
    await load();
    return data;
  }, [user?.id, load]);

  /** Le client accepte un devis (backend, RPC atomique). */
  const acceptQuote = useCallback(async (quoteId: string) => {
    const res = await backendFetch(`/api/v2/artisan/quote/${quoteId}/accept`, { method: 'POST', body: {} });
    if (res.success) { toast.success('Devis accepté'); await load(); }
    else toast.error(res.error || 'Acceptation impossible');
    return res.success;
  }, [load]);

  return { quotes, loading, reload: load, createQuote, acceptQuote };
}

export function useArtisanInterventions(role: 'artisan' | 'client' = 'artisan') {
  const { user } = useAuth();
  const [interventions, setInterventions] = useState<ArtisanIntervention[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const col = role === 'artisan' ? 'artisan_id' : 'client_id';
    const { data } = await (supabase as any).from('artisan_interventions').select('*').eq(col, user.id).order('created_at', { ascending: false });
    setInterventions((data as unknown as ArtisanIntervention[]) ?? []);
    setLoading(false);
  }, [user?.id, role]);

  useEffect(() => { void load(); }, [load]);

  /** L'artisan met à jour photos/statut (RLS artisan_update). */
  const update = useCallback(async (id: string, patch: Partial<ArtisanIntervention>) => {
    const { error } = await (supabase as any).from('artisan_interventions').update(patch as any).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
  }, [load]);

  /** Le client valide l'intervention (backend, garde photos obligatoires). */
  const validate = useCallback(async (id: string) => {
    const res = await backendFetch(`/api/v2/artisan/intervention/${id}/validate`, { method: 'POST', body: {} });
    if (res.success) { toast.success('Intervention validée'); await load(); }
    else toast.error(res.error || 'Validation impossible');
    return res.success;
  }, [load]);

  /** Le client paie l'acompte (défaut 30%) depuis son wallet (backend atomique). */
  const payDeposit = useCallback(async (id: string, depositPct = 30) => {
    const res = await backendFetch(`/api/v2/artisan/intervention/${id}/deposit`, { method: 'POST', body: { deposit_pct: depositPct } });
    if (res.success) { toast.success('Acompte payé'); await load(); }
    else toast.error(res.error || 'Paiement de l\'acompte impossible');
    return res.success;
  }, [load]);

  /** Le client paie le solde après validation (backend atomique). */
  const payBalance = useCallback(async (id: string) => {
    const res = await backendFetch(`/api/v2/artisan/intervention/${id}/balance`, { method: 'POST', body: {} });
    if (res.success) { toast.success('Solde payé — merci !'); await load(); }
    else toast.error(res.error || 'Paiement du solde impossible');
    return res.success;
  }, [load]);

  return { interventions, loading, reload: load, update, validate, payDeposit, payBalance };
}

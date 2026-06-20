/**
 * 🧾 Hooks DEVIS & PORTFOLIO — socle des services « sur projet » (Maison, Photo,
 * Freelance, Réparation, Informatique). Le prestataire gère devis + galerie ; le
 * client paie/valide via backend atomique (direct ou escrow).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch, generateIdempotencyKey } from '@/services/backendApi';
import { toast } from 'sonner';

export interface QuoteLineItem { label: string; qty: number; unit_price: number; }
export interface ServiceQuote {
  id: string; professional_service_id: string; client_user_id: string | null; client_name: string | null;
  client_phone: string | null; title: string; description: string | null; line_items: QuoteLineItem[];
  total_amount: number; escrow: boolean; escrow_status: 'none' | 'held' | 'released';
  status: 'draft' | 'sent' | 'paid' | 'completed' | 'cancelled'; created_at: string; paid_at: string | null; completed_at: string | null;
}
export interface PortfolioItem { id: string; professional_service_id: string; title: string; description: string | null; image_url: string; category: string | null; created_at: string; }

/** Devis du prestataire (temps réel) + création/annulation. */
export function useServiceQuotes(serviceId?: string) {
  const [quotes, setQuotes] = useState<ServiceQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('service_quotes').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setQuotes(((data as unknown as ServiceQuote[]) ?? []).map((q) => ({ ...q, line_items: Array.isArray(q.line_items) ? q.line_items : [] })));
    setLoading(false);
  }, [serviceId]);

  useEffect(() => {
    void load();
    if (!serviceId) return;
    const ch = supabase.channel(`quotes-${serviceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_quotes', filter: `professional_service_id=eq.${serviceId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [serviceId, load]);

  const createQuote = useCallback(async (payload: Partial<ServiceQuote>) => {
    if (!serviceId) return null;
    const total = (payload.line_items ?? []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
    const { data, error } = await supabase.from('service_quotes').insert({
      professional_service_id: serviceId, title: payload.title, description: payload.description,
      client_name: payload.client_name, client_phone: payload.client_phone, line_items: payload.line_items ?? [],
      total_amount: total, escrow: !!payload.escrow, status: 'sent',
    } as any).select().single();
    if (error) { toast.error(error.message); return null; }
    toast.success('Devis créé'); await load(); return data as ServiceQuote;
  }, [serviceId, load]);

  const cancelQuote = useCallback(async (id: string) => {
    await supabase.from('service_quotes').update({ status: 'cancelled' }).eq('id', id);
    await load();
  }, [load]);

  const stats = useMemo(() => ({
    sent: quotes.filter((q) => q.status === 'sent').length,
    paid: quotes.filter((q) => q.status === 'paid' || q.status === 'completed').length,
    revenue: quotes.filter((q) => q.status === 'paid' || q.status === 'completed').reduce((s, q) => s + (q.total_amount || 0), 0),
    escrowHeld: quotes.filter((q) => q.escrow_status === 'held').reduce((s, q) => s + (q.total_amount || 0), 0),
  }), [quotes]);

  return { quotes, loading, reload: load, createQuote, cancelQuote, stats };
}

/** Galerie de réalisations du prestataire. */
export function useServicePortfolio(serviceId?: string) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('service_portfolio').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setItems((data as unknown as PortfolioItem[]) ?? []);
    setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);

  const addItem = useCallback(async (payload: Partial<PortfolioItem>) => {
    if (!serviceId || !payload.image_url) return;
    const { error } = await supabase.from('service_portfolio').insert({ ...payload, professional_service_id: serviceId } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Réalisation ajoutée'); await load();
  }, [serviceId, load]);

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    await supabase.from('service_portfolio').delete().eq('id', id);
  }, []);

  return { items, loading, reload: load, addItem, removeItem };
}

/** Lecture d'un devis partagé (page publique). */
export async function getSharedQuote(quoteId: string) {
  const { data } = await supabase.rpc('get_shared_quote', { p_quote_id: quoteId });
  return data as any;
}

/** Le client paie un devis (atomique). */
export async function payQuote(quoteId: string) {
  return backendFetch<{ escrow: boolean; already?: boolean }>(`/api/v2/quotes/${quoteId}/pay`, { method: 'POST', body: {}, idempotencyKey: generateIdempotencyKey() });
}

/** Le client valide un devis escrow → libère les fonds. */
export async function releaseQuote(quoteId: string) {
  return backendFetch(`/api/v2/quotes/${quoteId}/release`, { method: 'POST', body: {}, idempotencyKey: generateIdempotencyKey() });
}

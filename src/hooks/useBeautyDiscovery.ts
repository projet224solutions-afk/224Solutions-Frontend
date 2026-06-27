/**
 * 💇 Découverte BEAUTÉ (client) — liste des salons avec cartes riches (note, prix à
 * partir de, badges À domicile / Walk-in / Nouveau) + favoris. Tri : note puis récence.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface BeautyProvider {
  id: string; business_name: string; logo_url: string | null; cover_image_url: string | null; address: string | null;
  created_at: string; minPrice: number; hasHome: boolean; acceptsWalkin: boolean; rating: number; reviews: number; categories: string[];
}

export function useBeautyProviders() {
  const [providers, setProviders] = useState<BeautyProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 1) id du type de service beauté
      const { data: st } = await supabase.from('service_types').select('id').eq('code', 'beaute').maybeSingle();
      const typeId = (st as any)?.id;
      if (!typeId) { setLoading(false); return; }

      const { data: svcs } = await supabase.from('professional_services')
        .select('id, business_name, logo_url, cover_image_url, address, created_at')
        .eq('service_type_id', typeId).eq('status', 'active').limit(100);
      const list = (svcs as any[]) || [];
      const ids = list.map((s) => s.id);
      if (ids.length === 0) { setProviders([]); setLoading(false); return; }

      const [bs, settings, stats] = await Promise.all([
        supabase.from('beauty_services').select('professional_service_id, price, category, is_home_service, is_active').in('professional_service_id', ids),
        supabase.from('beauty_settings').select('professional_service_id, accepts_walkin').in('professional_service_id', ids),
        // Note agrégée via RPC public (la RLS bloque la lecture directe des RDV des autres).
        supabase.rpc('get_beauty_provider_stats', { p_service_ids: ids }),
      ]);
      const svcRows = (bs.data as any[]) || [];
      const setRows = new Map(((settings.data as any[]) || []).map((r) => [r.professional_service_id, r.accepts_walkin]));
      const statMap = new Map(((stats.data as any[]) || []).map((r) => [r.professional_service_id, { avg: Number(r.avg_rating) || 0, count: Number(r.review_count) || 0 }]));

      const result: BeautyProvider[] = list.map((s) => {
        const mine = svcRows.filter((x) => x.professional_service_id === s.id && x.is_active);
        const prices = mine.map((x) => Number(x.price) || 0).filter((p) => p > 0);
        const st = statMap.get(s.id);
        return {
          id: s.id, business_name: s.business_name || 'Salon', logo_url: s.logo_url, cover_image_url: s.cover_image_url,
          address: s.address, created_at: s.created_at,
          minPrice: prices.length ? Math.min(...prices) : 0,
          hasHome: mine.some((x) => x.is_home_service),
          acceptsWalkin: !!setRows.get(s.id),
          rating: st?.avg || 0,
          reviews: st?.count || 0,
          categories: [...new Set(mine.map((x) => x.category).filter(Boolean))] as string[],
        };
      }).filter((p) => p.minPrice > 0); // au moins une prestation publiable

      result.sort((a, b) => (b.rating - a.rating) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setProviders(result); setLoading(false);
    })();
  }, []);

  return { providers, loading };
}

export function isNewProvider(createdAt: string) {
  return (Date.now() - new Date(createdAt).getTime()) < 30 * 86400000;
}

/** Avis vérifiés d'un salon (RPC public, sans PII). */
export async function getBeautyReviews(serviceId: string) {
  const { data } = await supabase.rpc('get_beauty_provider_reviews', { p_service_id: serviceId });
  return (data as any[]) || [];
}
/** Répartition des notes (5★/4★…) d'un salon. */
export async function getBeautyRatingBreakdown(serviceId: string) {
  const { data } = await supabase.rpc('get_beauty_rating_breakdown', { p_service_id: serviceId });
  return (data as Record<string, number>) || {};
}

export function useBeautyFavorites() {
  const { user } = useAuth();
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) { setFavIds(new Set()); return; }
    const { data } = await supabase.from('beauty_favorites').select('professional_service_id').eq('client_user_id', user.id);
    setFavIds(new Set(((data as any[]) || []).map((r) => r.professional_service_id)));
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const toggle = useCallback(async (serviceId: string) => {
    if (!user) { toast.error('Connectez-vous pour ajouter aux favoris'); return; }
    const isFav = favIds.has(serviceId);
    setFavIds((prev) => { const n = new Set(prev); if (isFav) { n.delete(serviceId); } else { n.add(serviceId); } return n; });
    if (isFav) await supabase.from('beauty_favorites').delete().eq('client_user_id', user.id).eq('professional_service_id', serviceId);
    else await supabase.from('beauty_favorites').insert({ client_user_id: user.id, professional_service_id: serviceId });
  }, [user, favIds]);

  return { favIds, toggle, reload: load };
}

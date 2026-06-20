/**
 * Hook de DÉCOUVERTE des restaurants (marketplace client).
 * STRATÉGIE RÉSILIENTE :
 *  1) on tente l'endpoint backend `/api/v2/restaurant/marketplace` (calcul COMPLET en service-role :
 *     tier d'abonnement + commandes du jour + livreurs en ligne, invisibles côté client via RLS).
 *  2) si le backend est INJOIGNABLE (dev sans serveur, API publique down), on se rabat sur une lecture
 *     Supabase directe des données PUBLIQUES (restaurants, promos, plats, horaires, avis agrégés) →
 *     la page marche toujours, sans le tier/populaire (défaut). Aucune erreur bloquante.
 */

import { useState, useEffect, useCallback } from 'react';
import { backendFetch } from '@/services/backendApi';
import { supabase } from '@/integrations/supabase/client';

export interface DiscoveryRestaurant {
  id: string;
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  cuisine: string | null;
  rating: number;
  total_reviews: number;
  city: string | null;
  neighborhood: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  isOpen: boolean;
  isNew: boolean;
  isPopular: boolean;
  ordersToday: number;
  planTier: number;
  minPrice: number | null;
  menuCount: number;
  dietaryTags: string[];
  promoLabel: string | null;
  hasPromo: boolean;
  freeDelivery: boolean;
  deliveryFee: number;
  etaBaseMinutes: number;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NEW_DAYS = 14;

function computeIsOpen(opening: any): boolean {
  if (!opening || typeof opening !== 'object') return true;
  const now = new Date();
  const h = opening[DAYS[now.getDay()]];
  if (!h || h.closed) return false;
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (!h.open || hm >= h.open) && (!h.close || hm <= h.close);
}
function promoToLabel(p: any): string {
  if (p.promo_type === 'percentage') return `-${p.value}%`;
  if (p.promo_type === 'free_delivery') return 'Livraison offerte';
  return '2 = 1';
}

/** Repli : agrégation côté client des données PUBLIQUES (sans tier/populaire, en RLS). */
async function loadFromSupabase(): Promise<DiscoveryRestaurant[]> {
  const { data: st } = await supabase.from('service_types').select('id').eq('code', 'restaurant').maybeSingle();
  if (!st?.id) return [];
  const { data: svc } = await supabase
    .from('professional_services')
    .select('id, business_name, logo_url, cover_image_url, rating, total_reviews, city, neighborhood, description, opening_hours, metadata, created_at, latitude, longitude')
    .eq('service_type_id', st.id).neq('status', 'suspended').limit(200);
  const services = svc || [];
  const ids = services.map((s) => s.id);
  if (ids.length === 0) return [];

  const [{ data: promos }, { data: items }] = await Promise.all([
    supabase.from('restaurant_promotions').select('professional_service_id, promo_type, value, start_time, end_time').in('professional_service_id', ids).eq('is_active', true),
    supabase.from('restaurant_menu_items').select('professional_service_id, price, dietary_tags').in('professional_service_id', ids).eq('is_available', true),
  ]);

  const nowHM = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const inWindow = (p: any) => (!p.start_time || nowHM >= p.start_time) && (!p.end_time || nowHM <= p.end_time);
  const promoByResto = new Map<string, any>(); const freeDeliv = new Set<string>();
  for (const p of promos || []) {
    if (!inWindow(p)) continue;
    if (p.promo_type === 'free_delivery') freeDeliv.add(p.professional_service_id);
    const cur = promoByResto.get(p.professional_service_id);
    if (!cur || (p.promo_type === 'percentage' && (cur.promo_type !== 'percentage' || p.value > cur.value))) promoByResto.set(p.professional_service_id, p);
  }
  const agg = new Map<string, { min: number | null; tags: Set<string>; count: number }>();
  for (const it of items || []) {
    const a = agg.get(it.professional_service_id) || { min: null, tags: new Set<string>(), count: 0 };
    a.count += 1; const pr = Number(it.price) || 0;
    if (pr > 0 && (a.min === null || pr < a.min)) a.min = pr;
    for (const tg of (it.dietary_tags || [])) a.tags.add(String(tg).toLowerCase());
    agg.set(it.professional_service_id, a);
  }

  const list = services.map((s) => {
    const a = agg.get(s.id); const promo = promoByResto.get(s.id); const meta = (s.metadata || {}) as any;
    const createdAt = s.created_at ? new Date(s.created_at) : null;
    return {
      id: s.id, name: s.business_name || 'Restaurant', logo_url: s.logo_url,
      cover_image_url: s.cover_image_url || s.logo_url, cuisine: meta.cuisine || null,
      rating: Number(s.rating) || 0, total_reviews: Number(s.total_reviews) || 0,
      city: s.city, neighborhood: s.neighborhood, description: s.description,
      lat: s.latitude != null ? Number(s.latitude) : null, lng: s.longitude != null ? Number(s.longitude) : null,
      isOpen: computeIsOpen(s.opening_hours),
      isNew: !!createdAt && (Date.now() - createdAt.getTime()) < NEW_DAYS * 86400000,
      isPopular: false, ordersToday: 0, planTier: 0,
      minPrice: a?.min ?? null, menuCount: a?.count ?? 0, dietaryTags: a ? [...a.tags] : [],
      promoLabel: promo ? promoToLabel(promo) : null, hasPromo: !!promo,
      freeDelivery: freeDeliv.has(s.id) || Number(meta.delivery_fee) === 0,
      deliveryFee: Number(meta.delivery_fee) || 0, etaBaseMinutes: Number(meta.delivery_eta_minutes) || 20,
    };
  });
  list.sort((x, y) => Number(y.hasPromo) - Number(x.hasPromo) || Number(y.isOpen) - Number(x.isOpen) || y.rating - x.rating);
  return list;
}

export function useRestaurantsDiscovery() {
  const [restaurants, setRestaurants] = useState<DiscoveryRestaurant[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // 1) Backend (calcul complet).
    try {
      const res = await backendFetch<{ success: boolean; restaurants: DiscoveryRestaurant[]; availableDrivers?: number; error?: string }>('/api/v2/restaurant/marketplace', { allowAnonymous: true });
      const data: any = (res as any).data ?? res;
      if (data?.success !== false && Array.isArray(data?.restaurants)) {
        setRestaurants(data.restaurants);
        setAvailableDrivers(Number(data?.availableDrivers) || 0);
        setLoading(false);
        return;
      }
      throw new Error(data?.error || 'Réponse backend invalide');
    } catch (backendErr) {
      // 2) Repli Supabase direct (données publiques) — la page reste fonctionnelle.
      console.warn('[useRestaurantsDiscovery] backend injoignable, repli Supabase:', (backendErr as any)?.message);
      try {
        const list = await loadFromSupabase();
        setRestaurants(list);
        setAvailableDrivers(0);
      } catch (e: any) {
        console.error('[useRestaurantsDiscovery] repli échoué', e);
        setError(e.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { restaurants, availableDrivers, loading, error, refresh: load };
}

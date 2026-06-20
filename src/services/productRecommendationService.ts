/**
 * 🧠 SERVICE DE RECOMMANDATION PRODUITS - 224SOLUTIONS
 * Système intelligent inspiré d'Alibaba/Amazon
 */

import { supabase } from '@/integrations/supabase/client';

type ActionType = 'view' | 'search' | 'cart' | 'purchase' | 'wishlist';

interface RecommendedProduct {
  product_id: string;
  name: string;
  price: number;
  images: string[];
  rating: number | null;
  category_id?: string;
  vendor_id?: string | null;
  vendor_user_id?: string | null;
  vendor_name?: string | null;
}

/**
 * Enrichit une liste de produits recommandés avec l'info vendeur
 * (nom de boutique + user_id pour la certification). 1 seule requête batch.
 * Colonnes anon-safe (vendors: id, user_id, business_name sont accordées au public).
 */
async function enrichWithVendor<T extends RecommendedProduct>(items: T[]): Promise<T[]> {
  try {
    const ids = [...new Set(items.map(i => i.product_id).filter(Boolean))];
    if (!ids.length) return items;
    const { data } = await supabase
      .from('products')
      .select('id, vendor_id, vendors(id, user_id, business_name)')
      .in('id', ids);
    const map = new Map<string, { vendor_id: string | null; vendor_user_id: string | null; vendor_name: string }>();
    (data || []).forEach((p: any) => {
      const v = Array.isArray(p.vendors) ? p.vendors[0] : p.vendors;
      map.set(p.id, {
        vendor_id: p.vendor_id || v?.id || null,
        vendor_user_id: v?.user_id || null,
        vendor_name: v?.business_name || '',
      });
    });
    return items.map(it => ({ ...it, ...(map.get(it.product_id) || {}) }));
  } catch (err) {
    console.warn('[Recommendations] enrichWithVendor error:', err);
    return items;
  }
}

// Poids par type d'interaction
const WEIGHTS: Record<ActionType, number> = {
  view: 1,
  search: 2,
  cart: 5,
  purchase: 10,
  wishlist: 3,
};

// ==========================================
// 📊 TRACKING DES INTERACTIONS
// ==========================================

export async function trackInteraction(
  productId: string,
  actionType: ActionType,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase
      .from('user_product_interactions') as any)
      .insert({
        user_id: user.id,
        product_id: productId,
        interaction_type: actionType,
        interaction_weight: WEIGHTS[actionType],
        metadata: metadata || {}
      });
  } catch (err) {
    console.warn('[Recommendations] Track error:', err);
  }
}

export async function trackSearch(
  query: string,
  resultProductIds?: string[]
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !resultProductIds?.length) return;

    const inserts = resultProductIds.slice(0, 5).map(pid => ({
      user_id: user.id,
      product_id: pid,
      interaction_type: 'search' as const,
      interaction_weight: WEIGHTS.search,
      metadata: { query, total_results: resultProductIds.length }
    }));

    await (supabase.from('user_product_interactions') as any).insert(inserts);
  } catch (err) {
    console.warn('[Recommendations] Track search error:', err);
  }
}

// ==========================================
// 🎯 RECOMMANDATIONS
// ==========================================

export async function getSimilarProducts(
  productId: string,
  limit = 10
): Promise<RecommendedProduct[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_similar_products', { p_product_id: productId, p_limit: limit });
    if (error) throw error;
    return enrichWithVendor((data || []).map((d: any) => ({ ...d, product_id: d.product_id || d.id })) as RecommendedProduct[]);
  } catch (err) {
    console.warn('[Recommendations] Similar products error:', err);
    return getFallbackProducts(limit, productId);
  }
}

export async function getPersonalizedRecommendations(
  limit = 12
): Promise<(RecommendedProduct & { reason: string })[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return getPopularProducts(limit);

    const { data, error } = await supabase
      .rpc('get_personalized_recommendations', { p_user_id: user.id, p_limit: limit });
    if (error) throw error;
    if (!data?.length) return getPopularProducts(limit);
    return enrichWithVendor((data || []).map((d: any) => ({ ...d, product_id: d.product_id || d.id })) as (RecommendedProduct & { reason: string })[]);
  } catch (err) {
    console.warn('[Recommendations] Personalized error:', err);
    return getPopularProducts(limit);
  }
}

export async function getAlsoBoughtProducts(
  productId: string,
  limit = 8
): Promise<RecommendedProduct[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_also_bought_products', { p_product_id: productId, p_limit: limit });
    if (error) throw error;
    return enrichWithVendor((data || []).map((d: any) => ({ ...d, product_id: d.product_id || d.id })) as RecommendedProduct[]);
  } catch (err) {
    console.warn('[Recommendations] Also bought error:', err);
    return [];
  }
}

export async function getPopularInCategory(
  categoryId: string,
  limit = 10,
  excludeProductId?: string
): Promise<RecommendedProduct[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_popular_in_category', {
        p_category_id: categoryId,
        p_limit: limit,
        p_exclude_product_id: excludeProductId || null
      });
    if (error) throw error;
    return enrichWithVendor((data || []).map((d: any) => ({ ...d, product_id: d.product_id || d.id })) as RecommendedProduct[]);
  } catch (err) {
    console.warn('[Recommendations] Popular in category error:', err);
    return [];
  }
}

// ==========================================
// 🔄 FALLBACKS
// ==========================================

async function getPopularProducts(limit = 12): Promise<(RecommendedProduct & { reason: string })[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, images, rating, category_id, vendor_id, vendors(id, user_id, business_name, business_type)')
      .eq('is_active', true)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(limit * 2);
    if (error) {
      console.warn('[Recommendations] Popular products error:', error);
      throw error;
    }
    // Exclure uniquement les boutiques physiques sans vente en ligne (physical)
    // hybrid (physique+enligne), digital, null → inclus
    const filtered = (data || []).filter(p => {
      const vendor = (p as any).vendors;
      return vendor?.business_type !== 'physical';
    }).slice(0, limit);
    console.log('[Recommendations] Popular products loaded:', filtered.length);
    return filtered.map(p => {
      const v = Array.isArray((p as any).vendors) ? (p as any).vendors[0] : (p as any).vendors;
      return {
        product_id: p.id, name: p.name, price: p.price,
        images: p.images || [], rating: p.rating, category_id: p.category_id, reason: 'popular',
        vendor_id: (p as any).vendor_id || v?.id || null,
        vendor_user_id: v?.user_id || null,
        vendor_name: v?.business_name || '',
      };
    });
  } catch { return []; }
}

async function getFallbackProducts(limit: number, excludeId?: string): Promise<RecommendedProduct[]> {
  try {
    let query = supabase
      .from('products')
      .select('id, name, price, images, rating, category_id, vendor_id, vendors(id, user_id, business_name, business_type)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit * 2);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    // Exclure uniquement les boutiques physiques sans vente en ligne (physical)
    const filtered = (data || []).filter(p => {
      const vendor = (p as any).vendors;
      return vendor?.business_type !== 'physical';
    }).slice(0, limit);
    return filtered.map(p => {
      const v = Array.isArray((p as any).vendors) ? (p as any).vendors[0] : (p as any).vendors;
      return {
        product_id: p.id, name: p.name, price: p.price,
        images: p.images || [], rating: p.rating, category_id: p.category_id,
        vendor_id: (p as any).vendor_id || v?.id || null,
        vendor_user_id: v?.user_id || null,
        vendor_name: v?.business_name || '',
      };
    });
  } catch { return []; }
}

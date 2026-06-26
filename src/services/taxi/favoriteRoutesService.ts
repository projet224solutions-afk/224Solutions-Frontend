/**
 * SERVICE DESTINATIONS FAVORITES — Taxi-Moto 224Solutions
 * CRUD des routes favorites du client + compteur d'usage.
 * Table `user_favorite_routes` (migration 20250930200000) — RLS : chaque
 * utilisateur ne voit/gère que ses propres routes.
 */

import { supabase } from '@/integrations/supabase/client';

export interface FavoriteRoute {
  id: string;
  name: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  usageCount: number;
}

/** Routes favorites de l'utilisateur, les plus utilisées d'abord (max 5). */
export async function getFavoriteRoutes(): Promise<FavoriteRoute[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return [];

  const { data, error } = await supabase
    .from('user_favorite_routes' as any)
    .select('*')
    .eq('user_id', session.session.user.id)
    .order('usage_count', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[FavoriteRoutes] Load error:', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    pickupAddress: r.pickup_address,
    pickupLat: Number(r.pickup_latitude),
    pickupLng: Number(r.pickup_longitude),
    destinationAddress: r.destination_address,
    destinationLat: Number(r.destination_latitude),
    destinationLng: Number(r.destination_longitude),
    usageCount: r.usage_count || 0,
  }));
}

/** Sauvegarde une nouvelle route favorite (anti-doublon sur la destination). */
export async function saveFavoriteRoute(params: {
  name: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
}): Promise<{ success: boolean; error?: string }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return { success: false, error: 'Non authentifié' };

  const { data: existing } = await supabase
    .from('user_favorite_routes' as any)
    .select('id')
    .eq('user_id', session.session.user.id)
    .eq('destination_address', params.destinationAddress)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Cette destination est déjà dans vos favoris' };
  }

  const { error } = await supabase
    .from('user_favorite_routes' as any)
    .insert({
      user_id: session.session.user.id,
      name: params.name,
      pickup_address: params.pickupAddress,
      pickup_latitude: params.pickupLat,
      pickup_longitude: params.pickupLng,
      destination_address: params.destinationAddress,
      destination_latitude: params.destinationLat,
      destination_longitude: params.destinationLng,
      usage_count: 0,
    } as any);

  if (error) {
    console.error('[FavoriteRoutes] Save error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Supprime une route favorite (RLS garantit l'ownership, on re-filtre par sécurité). */
export async function deleteFavoriteRoute(id: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return;
  await supabase
    .from('user_favorite_routes' as any)
    .delete()
    .eq('id', id)
    .eq('user_id', session.session.user.id);
}

/**
 * Incrémente le compteur d'usage après réservation depuis un favori.
 * Read-modify-write (+1) — non bloquant, la course se crée même si ça échoue.
 * (Pas de RPC dédiée en base ; la course de la valeur est négligeable pour un favori.)
 */
export async function incrementRouteUsage(id: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('user_favorite_routes' as any)
      .select('usage_count')
      .eq('id', id)
      .maybeSingle();
    const current = Number((data as any)?.usage_count ?? 0);
    await supabase
      .from('user_favorite_routes' as any)
      .update({ usage_count: current + 1 } as any)
      .eq('id', id);
  } catch (err) {
    console.warn('[FavoriteRoutes] increment non bloquant:', err);
  }
}

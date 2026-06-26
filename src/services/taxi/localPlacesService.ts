/**
 * LIEUX LOCAUX AUTO-APPRIS — 224Solutions Taxi-Moto
 * Recherche des lieux que l'app a appris des courses réelles (table local_places).
 * La capture est 100% automatique côté serveur (trigger à la complétion d'une
 * course). Ici on ne fait que LIRE pour proposer ces lieux dans la destination.
 */
import { supabase } from '@/integrations/supabase/client';

export interface LocalPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  usageCount: number;
}

/** Cherche les lieux locaux appris correspondant au texte tapé (min 2 caractères). */
export async function searchLocalPlaces(query: string, limit = 5): Promise<LocalPlace[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const { data, error } = await supabase.rpc('search_local_places' as any, {
      p_query: query.trim(),
      p_limit: limit,
    });
    if (error) {
      console.warn('[LocalPlaces] search error:', error);
      return [];
    }
    return ((data as any[]) || []).map((r) => ({
      id: r.id,
      name: r.name,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      usageCount: r.usage_count || 0,
    }));
  } catch (err) {
    console.warn('[LocalPlaces] search exception:', err);
    return [];
  }
}

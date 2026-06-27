/**
 * Favoris restaurant du client (CONNECTÉ uniquement). Stocke l'ensemble des ids de restaurants
 * favoris + bascule add/remove dans `restaurant_favorites` (RLS : privé par utilisateur).
 * Déconnecté → set vide ; toggle renvoie false (la page invite à se connecter).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useRestaurantFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setFavorites(new Set()); return; }
    setLoading(true);
    const { data } = await supabase
      .from('restaurant_favorites')
      .select('professional_service_id')
      .eq('user_id', user.id);
    setFavorites(new Set((data || []).map((r: any) => r.professional_service_id)));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const isFavorite = useCallback((serviceId: string) => favorites.has(serviceId), [favorites]);

  /** Bascule un favori. Renvoie false si déconnecté (à charge de l'appelant d'inviter à se connecter). */
  const toggleFavorite = useCallback(async (serviceId: string): Promise<boolean> => {
    if (!user?.id) return false;
    const has = favorites.has(serviceId);
    // Optimiste
    setFavorites((prev) => { const n = new Set(prev); if (has) { n.delete(serviceId); } else { n.add(serviceId); } return n; });
    if (has) {
      const { error } = await supabase.from('restaurant_favorites').delete().eq('user_id', user.id).eq('professional_service_id', serviceId);
      if (error) setFavorites((prev) => new Set(prev).add(serviceId)); // rollback
    } else {
      const { error } = await supabase.from('restaurant_favorites').insert({ user_id: user.id, professional_service_id: serviceId });
      if (error) setFavorites((prev) => { const n = new Set(prev); n.delete(serviceId); return n; }); // rollback
    }
    return true;
  }, [user?.id, favorites]);

  return { favorites, isFavorite, toggleFavorite, loading, isLoggedIn: !!user?.id, refresh: load };
}

/**
 * Hook global pour auto-remplir les coordonnées GPS manquantes
 * Fonctionne pour vendors ET professional_services
 */
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useAutoFillGps() {
  const { user } = useAuth();
  const attemptedRef = useRef(false);

  const autoFillGps = useCallback(async () => {
    if (!user?.id || attemptedRef.current) return;
    attemptedRef.current = true;

    if (!navigator.geolocation) return;

    // Vérifier si l'utilisateur a des enregistrements sans GPS
    const [{ data: vendors }, { data: services }] = await Promise.all([
      supabase
        .from('vendors')
        .select('id, latitude, longitude')
        .eq('user_id', user.id)
        .or('latitude.is.null,longitude.is.null')
        .limit(10),
      supabase
        .from('professional_services')
        .select('id, latitude, longitude')
        .eq('user_id', user.id)
        .or('latitude.is.null,longitude.is.null')
        .limit(10),
    ]);

    const vendorsToFix = vendors?.filter(v => v.latitude == null || v.longitude == null) || [];
    const servicesToFix = services?.filter(s => s.latitude == null || s.longitude == null) || [];

    if (vendorsToFix.length === 0 && servicesToFix.length === 0) return;

    // Obtenir la position GPS
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        const _updates: Promise<unknown>[] = [];

        for (const v of vendorsToFix) {
          try {
            await supabase.from('vendors').update({ latitude, longitude }).eq('id', v.id);
            console.log('✅ GPS auto-fill vendor:', v.id);
          } catch { /* skip */ }
        }

        for (const s of servicesToFix) {
          try {
            await supabase.from('professional_services').update({ latitude, longitude }).eq('id', s.id);
            console.log('✅ GPS auto-fill service:', s.id);
          } catch { /* skip */ }
        }
      },
      (err) => console.log('GPS auto-fill skipped:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [user?.id]);

  return { autoFillGps };
}

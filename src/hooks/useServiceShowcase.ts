/**
 * 🖼️ Hooks VITRINE — items publiables au marketplace (image + vidéo) pour les services
 * sans catalogue (Sport, Ménage…) + détection du plan Premium (vidéo réservée au Premium).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ServiceSubscriptionService } from '@/services/serviceSubscriptionService';
import { toast } from 'sonner';

export interface ShowcaseItem {
  id: string; professional_service_id: string; title: string; description: string | null;
  image_url: string | null; video_url: string | null; price: number; category: string | null; is_active: boolean; created_at: string;
}

export function useServiceShowcase(serviceId?: string) {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('service_showcase').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setItems((data as unknown as ShowcaseItem[]) ?? []);
    setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);

  const addItem = useCallback(async (payload: Partial<ShowcaseItem>) => {
    if (!serviceId || !payload.image_url) { toast.error('Une image est requise'); return; }
    const { error } = await supabase.from('service_showcase').insert({ ...payload, professional_service_id: serviceId } as any);
    if (error) {
      // Le trigger d'enforcement DB rejette une vidéo sans abonnement Premium actif.
      toast.error(/VIDEO_PREMIUM_REQUIS/.test(error.message)
        ? 'L’ajout de vidéos nécessite un abonnement Premium actif. Les photos restent gratuites.'
        : error.message);
      return;
    }
    toast.success('Publié sur le marketplace'); await load();
  }, [serviceId, load]);

  const toggle = useCallback(async (it: ShowcaseItem) => {
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, is_active: !x.is_active } : x)));
    await supabase.from('service_showcase').update({ is_active: !it.is_active }).eq('id', it.id);
  }, []);

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    await supabase.from('service_showcase').delete().eq('id', id);
  }, []);

  return { items, loading, reload: load, addItem, toggle, removeItem };
}

/** Le service est-il sur le plan le plus cher (Premium) ? (vidéo réservée au Premium) */
export function useIsPremiumPlan(serviceId?: string) {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!serviceId) { setLoading(false); return; }
      const sub = await ServiceSubscriptionService.getServiceSubscription(serviceId);
      // Source de vérité UNIQUE = le flag can_upload_video du plan (aligné sur l'enforcement DB
      // et ServiceMediaManager). On NE se base PLUS sur le nom du plan (incohérent).
      if (alive) { setIsPremium((sub as any)?.can_upload_video === true); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [serviceId]);

  return { isPremium, loading };
}

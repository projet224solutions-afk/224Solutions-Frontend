/**
 * 🍽️ Suivi de commande client EN TEMPS RÉEL (timeline 5 étapes).
 * S'abonne au statut de la `restaurant_orders` → chaque changement (accepté, en préparation,
 * prête, livrée) apparaît en direct côté client, sans rechargement.
 * (Pour la livraison, le suivi GPS du livreur réutilise le système taxi/livraison existant.)
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Check, Clock, ChefHat, PackageCheck, Utensils, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const STEPS = [
  { key: 'sent', labelKey: 'restaurantTracker.sent', match: ['pending'], Icon: Clock },
  { key: 'accepted', labelKey: 'restaurantTracker.accepted', match: ['confirmed'], Icon: Check },
  { key: 'preparing', labelKey: 'restaurantTracker.preparing', match: ['preparing'], Icon: ChefHat },
  { key: 'ready', labelKey: 'restaurantTracker.ready', match: ['ready'], Icon: PackageCheck },
  { key: 'done', labelKey: 'restaurantTracker.done', match: ['completed', 'delivered'], Icon: Utensils },
];

export function RestaurantOrderTracker({ orderId }: { orderId: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    let alive = true;
    void supabase.from('restaurant_orders').select('status').eq('id', orderId).single()
      .then(({ data }) => { if (alive && data) setStatus((data as any).status); });
    const ch = supabase
      .channel(`resto-track-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurant_orders', filter: `id=eq.${orderId}` }, (p: any) => setStatus(p.new.status))
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(ch); };
  }, [orderId]);

  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <X className="h-4 w-4" />{t('restaurantTracker.cancelled')}
      </div>
    );
  }

  const activeStep = (() => {
    const i = STEPS.findIndex((s) => s.match.includes(status));
    if (i >= 0) return i;
    return status === 'confirmed' ? 1 : 0;
  })();
  const finished = status === 'completed' || status === 'delivered';

  return (
    <div className="space-y-2">
      {STEPS.map((s, i) => {
        const reached = i <= activeStep;
        const isCurrent = i === activeStep && !finished;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${reached ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              <s.Icon className="h-4 w-4" />
            </div>
            <span className={`text-sm ${reached ? 'font-medium' : 'text-muted-foreground'}`}>{t(s.labelKey)}</span>
            {isCurrent && <span className="ml-auto animate-pulse text-xs font-medium text-[#ff4000]">{t('restaurantTracker.inProgress')}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default RestaurantOrderTracker;

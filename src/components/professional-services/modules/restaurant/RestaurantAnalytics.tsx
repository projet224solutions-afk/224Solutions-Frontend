import { useTranslation } from "@/hooks/useTranslation";
/**
 * 📊 Analytics restaurant — KPIs + heures de pointe + top 10 plats.
 * Données réelles depuis `restaurant_orders` (7 derniers jours).
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, ShoppingBag, Receipt, Star } from 'lucide-react';

const PAID = ['confirmed', 'preparing', 'ready', 'completed', 'delivered'];

export function RestaurantAnalytics({ serviceId, rating, reviewsCount }: { serviceId: string; rating?: number; reviewsCount?: number }) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - 7);
      const { data } = await supabase
        .from('restaurant_orders')
        .select('total, status, items, created_at')
        .eq('professional_service_id', serviceId)
        .gte('created_at', since.toISOString());
      if (alive) { setOrders(data || []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [serviceId]);

  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todays = orders.filter((o) => new Date(o.created_at) >= today);
    const paid = todays.filter((o) => PAID.includes(o.status));
    const ca = paid.reduce((s, o) => s + (Number(o.total) || 0), 0);
    // Commandes du jour = commandes réelles (on exclut les annulées, qui ne sont pas une activité).
    const nb = todays.filter((o) => o.status !== 'cancelled').length;
    return { ca, nb, avg: paid.length ? ca / paid.length : 0 };
  }, [orders]);

  const hourly = useMemo(() => {
    const b = Array.from({ length: 24 }, (_, h) => ({ h: `${h}h`, commandes: 0 }));
    orders.forEach((o) => { b[new Date(o.created_at).getHours()].commandes++; });
    return b.filter((x) => x.commandes > 0).length ? b : b.slice(8, 23); // focus heures utiles si vide
  }, [orders]);

  const topDishes = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    orders.forEach((o) => (Array.isArray(o.items) ? o.items : []).forEach((it: any) => {
      const name = it.name ?? it.product_name ?? 'Article';
      const qty = Number(it.quantity) || 1;
      const price = (Number(it.price ?? it.unit_price) || 0) * qty;
      const cur = map.get(name) || { name, qty: 0, revenue: 0 };
      cur.qty += qty; cur.revenue += price; map.set(name, cur);
    }));
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [orders]);

  if (loading) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  const Kpi = ({ label, value, Icon }: { label: string; value: React.ReactNode; Icon: any }) => (
    <Card><CardHeader className="flex flex-row items-center justify-between pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle><Icon className="h-4 w-4 text-[#ff4000]" /></CardHeader><CardContent><div className="text-xl font-bold">{value}</div></CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t('restaurantAnalytics.caDuJour')} value={<Money amount={kpis.ca} />} Icon={TrendingUp} />
        <Kpi label={t('restaurantAnalytics.commandesDuJour')} value={kpis.nb} Icon={ShoppingBag} />
        <Kpi label="Panier moyen" value={<Money amount={Math.round(kpis.avg)} />} Icon={Receipt} />
        <Kpi
          label={reviewsCount ? `Note moyenne (${reviewsCount} avis)` : 'Note moyenne'}
          value={reviewsCount ? `${(rating ?? 0).toFixed(1)}/5` : '—'}
          Icon={Star}
        />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t('restaurantAnalytics.commandesParHeure7J')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourly}>
              <XAxis dataKey="h" fontSize={10} interval={1} />
              <YAxis fontSize={10} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="commandes" fill="#ff4000" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 plats (7 j)</CardTitle></CardHeader>
        <CardContent>
          {topDishes.length === 0 ? <p className="text-sm text-muted-foreground">{t('restaurantAnalytics.pasEncoreDeDonnees')}</p> : (
            <ol className="space-y-1">
              {topDishes.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-muted-foreground">{i + 1}.</span>
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-muted-foreground">{d.qty}×</span>
                  <span className="font-semibold text-[#ff4000]"><Money amount={d.revenue} /></span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RestaurantAnalytics;

/**
 * 🍽️ ÉCRAN 1 — TABLEAU DE BORD COMMANDES TEMPS RÉEL (Meituan-like).
 * 3 colonnes : NOUVELLES (rouge) → EN PRÉPARATION (orange) → PRÊTES (vert).
 * - Temps réel via le hook (Supabase Realtime) + SON d'alerte à chaque nouvelle commande.
 * - Compte à rebours 3 min ; au-delà → annulation/remboursement ATOMIQUE par le job backend.
 * - ⚠️ Accepter / Refuser / Prête / Récupérée passent par les ENDPOINTS BACKEND ATOMIQUES
 *   (/api/v2/restaurant/order/:id/...) → un REFUS rembourse réellement le client (RPC).
 * - Barre de statut : OUVERT / TRÈS CHARGÉ, compteur du jour, temps de livraison, MODE CHARGÉ.
 */

import { useEffect, useRef, useState } from 'react';
import { useRestaurantOrders, type RestaurantOrder } from '@/hooks/useRestaurantOrders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Money } from '@/components/Money';
import { Check, X, Loader2, Bell, BellOff, ChefHat, PackageCheck, Volume2 } from 'lucide-react';
import { backendFetch } from '@/services/backendApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

const ACCEPT_WINDOW = 180;     // 3 min pour accepter (secondes)
const PREP_ALERT_MIN = 25;     // au-delà → timer rouge (préparation trop longue)
const READY_ALERT_MIN = 10;    // PRÊTE depuis > 10 min sans récupération → alerte

// Type de commande : emoji + libellé exactement comme le spec.
const TYPE_META: Record<string, { emoji: string; labelKey: string }> = {
  delivery: { emoji: '🛵', labelKey: 'restoKanban.typeDelivery' }, livraison: { emoji: '🛵', labelKey: 'restoKanban.typeDelivery' },
  takeaway: { emoji: '🏃', labelKey: 'restoKanban.typeTakeaway' }, emporter: { emoji: '🏃', labelKey: 'restoKanban.typeTakeaway' },
  dine_in: { emoji: '🪑', labelKey: 'restoKanban.typeDineIn' }, sur_place: { emoji: '🪑', labelKey: 'restoKanban.typeDineIn' },
};
const REFUSE_REASON_KEYS = ['restoKanban.refuseStock', 'restoKanban.refuseBusy', 'restoKanban.refuseClosed'];

function shortNum(o: RestaurantOrder): string {
  return (o.order_number?.replace(/[^0-9]/g, '').slice(-4)) || o.id.slice(0, 4).toUpperCase();
}
function itemsOf(o: RestaurantOrder): { name: string; quantity: number; options?: string }[] {
  const arr = Array.isArray(o.items) ? o.items : (o.order_items || []);
  return (arr as any[]).map((it) => ({ name: it.name ?? it.product_name ?? '', quantity: it.quantity ?? 1, options: it.options ?? it.variant_name ?? it.special_instructions }));
}
function minutesSince(iso?: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function RestaurantOrdersKanban({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { getOrdersByStatus, getOrderStats, refresh, loading } = useRestaurantOrders(serviceId);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [busyMode, setBusyMode] = useState<boolean>(() => { try { return localStorage.getItem(`resto_busy_${serviceId}`) === '1'; } catch { return false; } });
  const [refuse, setRefuse] = useState<RestaurantOrder | null>(null);
  const prevCount = useRef<number | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Le Kanban ne traite que les commandes CLIENT (à accepter → préparer → livrer/servir).
  // Les ventes de CAISSE comptoir (source 'pos'/'pos_offline') sont déjà finalisées et encaissées
  // par le restaurateur lui-même → elles ne doivent JAMAIS apparaître comme « à accepter ».
  const isClientOrder = (o: RestaurantOrder) => !['pos', 'pos_offline'].includes(o.source as string);
  const nouvelles = getOrdersByStatus('pending').filter(isClientOrder);
  const preparation = [...getOrdersByStatus('confirmed'), ...getOrdersByStatus('preparing')].filter(isClientOrder);
  const pretes = getOrdersByStatus('ready').filter(isClientOrder);
  const stats = getOrderStats();
  const baseEta = 30 + (busyMode ? 10 : 0); // temps de livraison affiché aux clients

  // SON d'alerte à chaque NOUVELLE commande (compte qui augmente).
  useEffect(() => {
    if (prevCount.current !== null && nouvelles.length > prevCount.current && soundOn) {
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        const ctx = new Ctx();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.18, ctx.currentTime);
        o.start(); o.stop(ctx.currentTime + 0.25);
        setTimeout(() => { try { ctx.close(); } catch { /* */ } }, 400);
      } catch { /* audio indisponible */ }
      toast.info(t('restoKanban.newOrderToast'));
    }
    prevCount.current = nouvelles.length;
  }, [nouvelles.length, soundOn]);

  const toggleBusy = (on: boolean) => { setBusyMode(on); try { localStorage.setItem(`resto_busy_${serviceId}`, on ? '1' : '0'); } catch { /* */ } };

  // Une erreur « réseau / backend injoignable » (vs erreur MÉTIER 4xx renvoyée par le backend).
  const isNetworkError = (e?: string) =>
    !e || /réseau|indisponible|injoignable|timeout|annul|network|failed to fetch/i.test(e);

  /**
   * Action sur une commande : BACKEND D'ABORD (atomique/autorisé). Si le backend est INJOIGNABLE
   * (réseau), on REPLIE sur Supabase direct (la RLS « owner access » autorise le restaurateur à
   * modifier ses commandes) → le restaurateur peut toujours gérer ses commandes même backend down.
   * ⚠️ Le refus d'une commande PAYÉE exige le backend (remboursement atomique) — pas de repli.
   */
  const run = async (o: RestaurantOrder, path: string, body: any, ok: string, fallback: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(o.id);
    try {
      let networkFailed = false;
      try {
        const res = await backendFetch(`/api/v2/restaurant/order/${o.id}/${path}`, { method: 'POST', body });
        if (res.success) { toast.success(ok); await refresh(); return; }
        if (!isNetworkError(res.error)) { toast.error(res.error || t('restoKanban.actionImpossible')); return; } // erreur métier
        networkFailed = true;
      } catch { networkFailed = true; }

      if (networkFailed) {
        const { error } = await fallback();
        if (error) { toast.error(error.message); return; }
        toast.success(ok);
        await refresh();
      }
    } finally { setBusy(null); }
  };

  const nowIso = () => new Date().toISOString();
  const upd = (id: string, patch: Record<string, any>) =>
    supabase.from('restaurant_orders').update({ ...patch, updated_at: nowIso() }).eq('id', id);

  const accept = (o: RestaurantOrder) => run(o, 'accept', { estimated_prep_minutes: 20 }, t('restoKanban.orderAccepted'),
    () => upd(o.id, { status: 'preparing', accepted_at: nowIso(), started_preparing_at: nowIso(), estimated_prep_minutes: 20 }));
  const setReady = (o: RestaurantOrder) => run(o, 'status', { status: 'ready' }, t('restoKanban.orderReady'),
    () => upd(o.id, { status: 'ready', ready_at: nowIso() }));
  const complete = (o: RestaurantOrder) => run(o, 'status', { status: 'completed' }, t('restoKanban.orderClosed'),
    () => upd(o.id, { status: 'completed', completed_at: nowIso() }));
  const doRefuse = (o: RestaurantOrder, reason: string) => {
    setRefuse(null);
    void run(o, 'cancel', { reason },
      o.payment_status === 'paid' ? t('restoKanban.refusedRefunded') : t('restoKanban.refused'),
      async () => {
        // Commande PAYÉE = remboursement atomique obligatoire → backend requis, pas de repli local.
        if (o.payment_status === 'paid') return { error: { message: t('restoKanban.refundOfflineError') } };
        return upd(o.id, { status: 'cancelled', cancelled_reason: reason, cancelled_at: nowIso() });
      });
  };

  const Countdown = ({ o }: { o: RestaurantOrder }) => {
    const remaining = Math.max(0, ACCEPT_WINDOW - Math.floor((now - new Date(o.created_at).getTime()) / 1000));
    const pct = (remaining / ACCEPT_WINDOW) * 100;
    return (
      <div className="mt-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all ${pct < 25 ? 'bg-red-500' : 'bg-[#ff4000]'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-0.5 text-[10px] font-medium text-red-600">{t('restoKanban.acceptWithin')} {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</div>
      </div>
    );
  };

  const OrderCard = ({ o, children, isNew }: { o: RestaurantOrder; children: React.ReactNode; isNew?: boolean }) => {
    const type = TYPE_META[o.order_type] || TYPE_META.dine_in;
    return (
      <Card className={`border ${isNew ? 'animate-in slide-in-from-top-2 duration-300' : ''}`}>
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">#{shortNum(o)}</span>
            <Badge variant="outline" className="gap-1 text-[10px]">{type.emoji} {o.table_number ? `${t('restoKanban.table')} ${o.table_number}` : t(type.labelKey)}</Badge>
            <span className="ml-auto text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <ul className="space-y-0.5 text-sm">
            {itemsOf(o).map((it, i) => (
              <li key={i}><b>{it.quantity}×</b> {it.name || t('restoKanban.itemFallback')}{it.options ? <span className="text-xs text-muted-foreground"> ({it.options})</span> : null}</li>
            ))}
          </ul>
          {o.notes && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">📝 {o.notes}</p>}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{o.customer_name || (o.table_number ? `${t('restoKanban.table')} ${o.table_number}` : t('restoKanban.clientFallback'))}</span>
            <span className="font-bold text-[#ff4000]"><Money amount={o.total || 0} /></span>
          </div>
          {children}
        </CardContent>
      </Card>
    );
  };

  const Column = ({ title, color, Icon, count, children }: { title: string; color: string; Icon: any; count: number; children: React.ReactNode }) => (
    <div className="flex-1 space-y-2">
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${color}`}>
        <Icon className="h-4 w-4" />{title}<span className="ml-auto rounded-full bg-white/70 px-2 text-xs">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );

  if (loading) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {/* Barre de statut */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <Badge className={busyMode ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}>
          ● {busyMode ? t('restoKanban.veryBusy') : t('restoKanban.open')}
        </Badge>
        <span className="text-sm text-muted-foreground">{t('restoKanban.deliveryShown')} <b className="text-foreground">~{baseEta} {t('restoKanban.minWord')}</b></span>
        <span className="text-sm text-muted-foreground">{t('restoKanban.todayOrders')} <b className="text-foreground">{stats.today}</b></span>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs"><Volume2 className="h-4 w-4" /> {t('restoKanban.sound')}
            <Switch checked={soundOn} onCheckedChange={setSoundOn} />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium">{t('restoKanban.busyMode')}
            <Switch checked={busyMode} onCheckedChange={toggleBusy} />
          </label>
        </div>
      </div>

      {!soundOn && <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><BellOff className="h-3 w-3" /> {t('restoKanban.soundOff')}</p>}

      <div className="flex flex-col gap-4 lg:flex-row">
        <Column title={t('restoKanban.colNew')} color="bg-red-100 text-red-700" Icon={Bell} count={nouvelles.length}>
          {nouvelles.length === 0 && <p className="px-1 text-xs text-muted-foreground">{t('restoKanban.noNewOrders')}</p>}
          {nouvelles.map((o) => (
            <OrderCard key={o.id} o={o} isNew>
              <Countdown o={o} />
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" disabled={busy === o.id} onClick={() => accept(o)}><Check className="mr-1 h-4 w-4" />{t('restoKanban.accept')}</Button>
                <Button size="sm" variant="outline" className="text-red-600" disabled={busy === o.id} onClick={() => setRefuse(o)}><X className="mr-1 h-4 w-4" />{t('restoKanban.refuse')}</Button>
              </div>
            </OrderCard>
          ))}
        </Column>

        <Column title={t('restoKanban.colPreparing')} color="bg-orange-100 text-orange-700" Icon={ChefHat} count={preparation.length}>
          {preparation.length === 0 && <p className="px-1 text-xs text-muted-foreground">{t('restoKanban.nothingPreparing')}</p>}
          {preparation.map((o) => {
            const mins = minutesSince(o.started_preparing_at || o.created_at);
            const late = mins >= PREP_ALERT_MIN;
            return (
              <OrderCard key={o.id} o={o}>
                <div className={`mt-1 text-xs font-medium ${late ? 'text-red-600' : 'text-muted-foreground'}`}>{t('restoKanban.preparingSince')} {mins} {t('restoKanban.minWord')}{late ? t('restoKanban.tooLong') : ''}</div>
                <Button size="sm" className="mt-2 w-full bg-[#ff4000] hover:bg-[#e03900]" disabled={busy === o.id} onClick={() => setReady(o)}><PackageCheck className="mr-1 h-4 w-4" />{t('restoKanban.ready')}</Button>
              </OrderCard>
            );
          })}
        </Column>

        <Column title={t('restoKanban.colReady')} color="bg-green-100 text-green-700" Icon={PackageCheck} count={pretes.length}>
          {pretes.length === 0 && <p className="px-1 text-xs text-muted-foreground">{t('restoKanban.noReadyOrders')}</p>}
          {pretes.map((o) => {
            const mins = minutesSince(o.ready_at);
            const waitingDriver = ['delivery', 'livraison'].includes(o.order_type);
            const alert = waitingDriver && mins >= READY_ALERT_MIN;
            return (
              <OrderCard key={o.id} o={o}>
                <div className={`mt-1 text-xs ${alert ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                  {waitingDriver ? `${t('restoKanban.waitingDriver')}${alert ? ` (${mins} ${t('restoKanban.minWord')} — ${t('restoKanban.alertWord')})` : ''}` : o.table_number ? `${t('restoKanban.bringToTable')} ${o.table_number}` : t('restoKanban.clientPickup')}
                </div>
                <Button size="sm" variant="outline" className="mt-2 w-full" disabled={busy === o.id} onClick={() => complete(o)}><Check className="mr-1 h-4 w-4" />{o.table_number ? t('restoKanban.served') : waitingDriver ? t('restoKanban.delivered') : t('restoKanban.pickedUp')}</Button>
              </OrderCard>
            );
          })}
        </Column>
      </div>

      {/* Motif de refus */}
      <Dialog open={!!refuse} onOpenChange={(o) => !o && setRefuse(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>{t('restoKanban.refuseOrderTitle')}{refuse && shortNum(refuse)}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('restoKanban.refundInfo')}</p>
          <div className="space-y-2">
            {REFUSE_REASON_KEYS.map((rk) => (
              <Button key={rk} variant="outline" className="w-full justify-start" disabled={!!busy} onClick={() => refuse && doRefuse(refuse, t(rk))}>{t(rk)}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RestaurantOrdersKanban;

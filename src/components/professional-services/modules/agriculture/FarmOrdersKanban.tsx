import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🌾 Kanban commandes agriculteur EN TEMPS RÉEL — Nouvelles → Préparation → Expédiées.
 * Réutilise useFarmOrders (abonnement Realtime). Transitions RLS-gardées.
 */

import { useState } from 'react';
import { useFarmOrders, type FarmOrder } from '@/hooks/useFarm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { Bell, Package, Truck, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function FarmOrdersKanban({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { columns, loading, setStatus } = useFarmOrders(serviceId);
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, status: FarmOrder['status']) => {
    setBusy(id);
    try { await setStatus(id, status); } catch { toast.error('Action impossible'); } finally { setBusy(null); }
  };

  const OrderCard = ({ o, actions }: { o: FarmOrder; actions: React.ReactNode }) => (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{o.customer_name || 'Client'}</span>
          <Badge variant="outline" className="text-[10px]">{o.delivery_type}</Badge>
          <span className="ml-auto text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
        </div>
        <ul className="space-y-0.5 text-sm">
          {(o.items || []).map((it: any, i: number) => (
            <li key={i}><b>{it.quantity ?? 1}×</b> {it.product ?? it.name ?? 'Produit'} {it.unit ? <span className="text-xs text-muted-foreground">({it.unit})</span> : null}</li>
          ))}
        </ul>
        {o.customer_phone && <div className="text-xs text-muted-foreground">{o.customer_phone}</div>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="font-bold text-[#ff4000]"><Money amount={o.total || 0} /></span>
        </div>
        {actions}
      </CardContent>
    </Card>
  );

  const Column = ({ title, color, Icon, items, render }: { title: string; color: string; Icon: any; items: FarmOrder[]; render: (o: FarmOrder) => React.ReactNode }) => (
    <div className="flex-1 space-y-2">
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${color}`}><Icon className="h-4 w-4" />{title}<span className="ml-auto rounded-full bg-white/60 px-2 text-xs">{items.length}</span></div>
      <div className="space-y-2">{items.length === 0 ? <p className="px-1 text-xs text-muted-foreground">—</p> : items.map(render)}</div>
    </div>
  );

  if (loading) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Column title="NOUVELLES" color="bg-red-100 text-red-700" Icon={Bell} items={columns.nouvelles} render={(o) => (
        <OrderCard key={o.id} o={o} actions={
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" disabled={busy === o.id} onClick={() => act(o.id, 'confirme')}><Check className="h-4 w-4 mr-1" />Confirmer</Button>
            <Button size="sm" variant="outline" className="text-red-600" disabled={busy === o.id} onClick={() => act(o.id, 'annule')}><X className="h-4 w-4 mr-1" />Refuser</Button>
          </div>
        } />
      )} />

      <Column title={t('farmOrdersKanban.preparation')} color="bg-orange-100 text-orange-700" Icon={Package} items={columns.preparation} render={(o) => (
        <OrderCard key={o.id} o={o} actions={
          o.status === 'confirme'
            ? <Button size="sm" className="w-full" disabled={busy === o.id} onClick={() => act(o.id, 'prepare')}><Package className="h-4 w-4 mr-1" />{t('farmOrdersKanban.enPreparation')}</Button>
            : <Button size="sm" className="w-full" disabled={busy === o.id} onClick={() => act(o.id, 'expedie')}><Truck className="h-4 w-4 mr-1" />{t('farmOrdersKanban.expedier')}</Button>
        } />
      )} />

      <Column title={t('farmOrdersKanban.expediees')} color="bg-green-100 text-green-700" Icon={Truck} items={columns.expediees} render={(o) => (
        <OrderCard key={o.id} o={o} actions={
          <Button size="sm" variant="outline" className="w-full" disabled={busy === o.id} onClick={() => act(o.id, 'livre')}><Check className="h-4 w-4 mr-1" />{t('farmOrdersKanban.marquerLivree')}</Button>
        } />
      )} />
    </div>
  );
}

export default FarmOrdersKanban;

import { useTranslation } from "@/hooks/useTranslation";
/**
 * Préparation des commandes pharmacie (Kanban) : Payées (à préparer) → Prêtes → Remises/Livrées.
 * « Marquer prête » → notifie le client ; si livraison, le dispatch coursier se fera en Phase 5.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { usePharmacyOrders, type PharmacyOrder } from '@/hooks/usePharmacy';
import { Loader2, PackageCheck, Truck, Store, ChefHat } from 'lucide-react';

export function PharmacyPreparationKanban({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { orders, loading, setStatus } = usePharmacyOrders(serviceId);
  const preparing = orders.filter((o) => o.status === 'preparing');
  const ready = orders.filter((o) => o.status === 'ready' || o.status === 'delivering');
  const done = orders.filter((o) => ['delivered', 'collected'].includes(o.status));

  const Card2 = ({ o, action }: { o: PharmacyOrder; action?: React.ReactNode }) => (
    <Card><CardContent className="space-y-1.5 p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold">#{o.id.slice(0, 6).toUpperCase()}</span>
        <Badge variant="outline" className="gap-1 text-[10px]">{o.delivery_type === 'delivery' ? <><Truck className="h-3 w-3" />{t('pharmacyPreparationKanban.livraison')}</> : <><Store className="h-3 w-3" />Retrait</>}</Badge>
        <span className="ml-auto font-semibold text-primary text-sm"><Money amount={o.amount} /></span>
      </div>
      <ul className="text-xs text-muted-foreground">
        {(Array.isArray(o.medications) ? o.medications : []).slice(0, 6).map((m: any, i: number) => (
          <li key={i}>{m.quantity ?? 1}× {m.name}{m.dosage ? ` (${m.dosage})` : ''}</li>
        ))}
      </ul>
      {action}
    </CardContent></Card>
  );

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  const Col = ({ title, color, Icon, items, action }: any) => (
    <div className="flex-1 space-y-2">
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${color}`}><Icon className="h-4 w-4" />{title}<span className="ml-auto rounded-full bg-white/70 px-2 text-xs">{items.length}</span></div>
      <div className="space-y-2">
        {items.length === 0 && <p className="px-1 text-xs text-muted-foreground">{t('pharmacyPreparationKanban.aucuneCommande')}</p>}
        {items.map((o: PharmacyOrder) => <Card2 key={o.id} o={o} action={action?.(o)} />)}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Col title={t('pharmacyPreparationKanban.aPreparer')} color="bg-blue-100 text-blue-700" Icon={ChefHat} items={preparing}
        action={(o: PharmacyOrder) => <Button size="sm" className="w-full" onClick={() => setStatus(o.id, 'ready')}>{t('pharmacyPreparationKanban.marquerPrete')}</Button>} />
      <Col title={t('pharmacyPreparationKanban.pretes')} color="bg-emerald-100 text-emerald-700" Icon={PackageCheck} items={ready}
        action={(o: PharmacyOrder) => (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setStatus(o.id, o.delivery_type === 'delivery' ? 'delivered' : 'collected')}>
            {o.delivery_type === 'delivery' ? 'Marquer livrée' : 'Marquer remise'}
          </Button>
        )} />
      <Col title={t('pharmacyPreparationKanban.terminees')} color="bg-gray-100 text-gray-600" Icon={PackageCheck} items={done} />
    </div>
  );
}

export default PharmacyPreparationKanban;

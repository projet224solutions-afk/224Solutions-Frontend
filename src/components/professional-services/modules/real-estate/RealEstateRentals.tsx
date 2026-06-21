import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏠 Onglet LOCATIONS (bailleur) — baux actifs, caution sous escrow, quittances.
 * Le bailleur suit ses loyers encaissés et libère/retient la caution à la fin du bail.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { useRentalLeases, type RentalLease } from '@/hooks/useRentalLeases';
import { Home, Wallet, ShieldCheck, FileText, Loader2, KeyRound } from 'lucide-react';
import { useState } from 'react';

export function RealEstateRentals({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { leases, payments, loading, releaseDeposit, stats } = useRentalLeases(serviceId);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, refund: boolean) => { setBusy(id); await releaseDeposit(id, refund); setBusy(null); };
  const receiptsOf = (leaseId: string) => payments.filter((p) => p.lease_id === leaseId);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#ff4000]" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-[#04439e] text-white"><CardContent className="p-4"><Home className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{stats.active}</p><p className="text-xs opacity-80">Baux actifs</p></CardContent></Card>
        <Card className="bg-[#ff4000] text-white"><CardContent className="p-4"><Wallet className="h-4 w-4 opacity-80" /><p className="text-lg font-bold mt-1"><Money amount={stats.monthlyRevenue} from="GNF" /></p><p className="text-xs opacity-80">Loyers / mois</p></CardContent></Card>
        <Card className="bg-[#04439e] text-white"><CardContent className="p-4"><ShieldCheck className="h-4 w-4 opacity-80" /><p className="text-lg font-bold mt-1"><Money amount={stats.depositsHeld} from="GNF" /></p><p className="text-xs opacity-80">{t('realEstateRentals.cautionsEnSequestre')}</p></CardContent></Card>
      </div>

      {leases.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">{t('realEstateRentals.aucunBailLesLocationsDemarrees')}</p>}

      {leases.map((l: RentalLease) => (
        <Card key={l.id}><CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm">{l.tenant_name || 'Locataire'}</h4>
                <Badge className={l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>{l.status === 'active' ? 'En cours' : 'Terminé'}</Badge>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <ShieldCheck className="h-3 w-3" />Caution {l.deposit_status === 'held' ? 'séquestrée' : l.deposit_status === 'refunded' ? 'remboursée' : l.deposit_status === 'released' ? 'conservée' : '—'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{l.tenant_phone} · Loyer <Money amount={l.monthly_rent} from="GNF" /> · Caution <Money amount={l.deposit_amount} from="GNF" /></p>
            </div>
          </div>

          {/* Quittances */}
          <div className="flex flex-wrap gap-1">
            {receiptsOf(l.id).map((p) => (
              <Badge key={p.id} variant="outline" className="gap-1 text-[10px]"><FileText className="h-3 w-3" />{p.period_label}</Badge>
            ))}
          </div>

          {/* Libération de caution */}
          {l.status === 'active' && l.deposit_status === 'held' && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1" disabled={busy === l.id} onClick={() => act(l.id, true)}>
                {busy === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4 mr-1" />{t('realEstateRentals.finDeBailRembourserLa')}</>}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === l.id} onClick={() => { if (confirm('Retenir la caution (dégâts/impayés) ?')) act(l.id, false); }}>Retenir</Button>
            </div>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}

export default RealEstateRentals;

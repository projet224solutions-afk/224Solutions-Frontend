import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🚗 Espace MOBILITÉ réutilisable (VTC course / Livraison) — dispatch + suivi temps
 * réel + encaissement (espèces ou lien wallet). Utilisé par VTCModule & DeliveryModule.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Money } from '@/components/Money';
import { Plus, Wallet, Loader2, Check, X, Play, Copy, Banknote, MapPin, Navigation, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useMobilityJobs, type JobStatus } from '@/hooks/useMobilityJobs';

const NEXT: Record<string, { to: JobStatus; label: string } | undefined> = {
  pending: { to: 'accepted', label: 'Accepter' },
  accepted: { to: 'in_progress', label: "Démarrer" },
  in_progress: { to: 'completed', label: 'Terminer' },
};

export function MobilityWorkspace({ serviceId, jobType }: { serviceId: string; jobType: 'course' | 'livraison' }) {
  const { t } = useTranslation();
  const { jobs, loading, createJob, setStatus, markCashPaid, stats } = useMobilityJobs(serviceId, jobType);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({});

  const isCourse = jobType === 'course';

  const submit = async () => {
    // Validation prix > 0 (avant : un prix 0 / négatif / NaN passait)
    const parsedPrice = parseFloat(form.price);
    if (!form.pickup) { toast.error(t('mobilityWorkspace.adresseDeDepartRequise')); return; }
    if (!form.price || isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error(t('mobilityWorkspace.lePrixDoitEtreSuperieur'));
      return;
    }
    // Surge pricing (style Uber) : le multiplicateur est replié dans le prix final
    const finalPrice = Math.round(parsedPrice * (form.surgeMultiplier || 1.0));
    const ok = await createJob({
      customer_name: form.customer_name, customer_phone: form.customer_phone,
      pickup: form.pickup, destination: form.destination, vehicle_type: form.vehicle_type,
      package_label: form.package_label, price: finalPrice,
    });
    if (ok) { setShow(false); setForm({}); }
  };

  return (
    <div className="space-y-4">
      {/* Dashboard gains — style Uber Driver */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="bg-[#04439e] border-0 text-white"><CardContent className="p-3"><Navigation className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{stats.active}</p><p className="text-[11px] opacity-80">En cours</p></CardContent></Card>
        <Card className="bg-[#16a34a] border-0 text-white"><CardContent className="p-3"><Check className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{stats.completed}</p><p className="text-[11px] opacity-80">{t('mobilityWorkspace.terminees')}</p></CardContent></Card>
        <Card className="bg-[#ff4000] border-0 text-white"><CardContent className="p-3"><Wallet className="h-4 w-4 opacity-80" /><p className="text-base font-bold mt-1"><Money amount={stats.revenue} from="GNF" /></p><p className="text-[11px] opacity-80">{t('mobilityWorkspace.encaisse')}</p></CardContent></Card>
        <Card className="border-2 border-[#04439e]/20"><CardContent className="p-3">
          <TrendingUp className="h-4 w-4 text-[#04439e]" />
          <p className="text-xl font-bold mt-1 text-[#04439e]">{Math.min(100, Math.round((stats.revenue / 500000) * 100))}%</p>
          <p className="text-[11px] text-muted-foreground">{t('mobilityWorkspace.objectifDuJour')}</p>
          <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#04439e] rounded-full" style={{ width: `${Math.min(100, Math.round((stats.revenue / 500000) * 100))}%` }} /></div>
        </CardContent></Card>
      </div>

      <Dialog open={show} onOpenChange={setShow}>
        <DialogTrigger asChild><Button className="w-full"><Plus className="h-4 w-4 mr-1" />{isCourse ? 'Nouvelle course' : 'Nouvelle livraison'}</Button></DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isCourse ? 'Nouvelle course' : 'Nouvelle livraison'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t('mobilityWorkspace.client')}</Label><Input value={form.customer_name || ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>{t('mobilityWorkspace.telephone')}</Label><Input value={form.customer_phone || ''} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>{t('mobilityWorkspace.depart')}</Label><Input value={form.pickup || ''} onChange={(e) => setForm({ ...form, pickup: e.target.value })} placeholder={t('mobilityWorkspace.adresseDeDepart')} /></div>
            <div className="space-y-1"><Label>Destination</Label><Input value={form.destination || ''} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder={t('mobilityWorkspace.adresseDArrivee')} /></div>
            {isCourse
              ? <div className="space-y-1"><Label>{t('mobilityWorkspace.typeDeVehicule')}</Label><Input value={form.vehicle_type || ''} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} placeholder="Berline, Confort…" /></div>
              : <div className="space-y-1"><Label>Colis</Label><Input value={form.package_label || ''} onChange={(e) => setForm({ ...form, package_label: e.target.value })} placeholder={t('mobilityWorkspace.descriptionDuColis')} /></div>}
            {!isCourse && (
              <div className="space-y-1">
                <Label>{t('mobilityWorkspace.distanceEstimeeKm')}</Label>
                <Input type="number" min={0} step={0.1} value={form.distance_km || ''}
                  onChange={(e) => { const km = parseFloat(e.target.value) || 0; const calc = km <= 3 ? 10000 : km <= 7 ? 20000 : 35000; setForm({ ...form, distance_km: km, price: String(calc) }); }}
                  placeholder="Ex : 4.5" />
                <p className="text-[10px] text-muted-foreground">{t('mobilityWorkspace.prixCalculeAutomatiquementSelonLe')}</p>
              </div>
            )}
            <div className="space-y-1"><Label>Prix (GNF)</Label><Input type="number" value={form.price || ''} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            {isCourse && (
              <div className="space-y-1">
                <Label>Multiplicateur tarif</Label>
                <div className="flex flex-wrap gap-2">
                  {[{ mult: 1.0, label: 'Normal' }, { mult: 1.2, label: '×1.2' }, { mult: 1.5, label: '×1.5 🔥' }, { mult: 2.0, label: '×2 🔥🔥' }].map(({ mult, label }) => (
                    <button key={mult} type="button" onClick={() => setForm({ ...form, surgeMultiplier: mult })}
                      className={`rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition-all ${(form.surgeMultiplier || 1.0) === mult ? 'border-[#ff4000] bg-[#ff4000]/10 text-[#ff4000]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShow(false)}>{t('mobilityWorkspace.annuler')}</Button><Button onClick={submit}>{t('mobilityWorkspace.creer')}</Button></div>
        </DialogContent>
      </Dialog>

      {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#ff4000]" /></div>}
      {!loading && jobs.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Aucune {isCourse ? 'course' : 'livraison'} pour le moment.</p>}

      {jobs.map((j) => {
        const next = NEXT[j.status];
        return (
          <Card key={j.id}><CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-sm">{j.customer_name || 'Client'}</h4>
                  <Badge className={j.status === 'completed' ? 'bg-green-100 text-green-700' : j.status === 'cancelled' ? 'bg-muted text-muted-foreground' : j.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : j.status === 'accepted' ? 'bg-orange-100 text-[#ff4000]' : 'bg-yellow-100 text-yellow-700'}>{j.status}</Badge>
                  {j.paid && <Badge variant="outline" className="text-[10px]">{t('mobilityWorkspace.paye')}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{j.pickup} → {j.destination}</p>
              </div>
              <span className="font-bold text-[#ff4000] text-sm shrink-0"><Money amount={j.price} from="GNF" /></span>
            </div>
            <div className="flex flex-wrap gap-1">
              {next && <Button size="sm" variant={next.to === 'completed' ? 'default' : 'outline'} onClick={() => setStatus(j.id, next.to)}>{next.to === 'in_progress' ? <Play className="h-4 w-4 mr-1" /> : <Check className="h-4 w-4 mr-1" />}{next.label}</Button>}
              {['pending', 'accepted'].includes(j.status) && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setStatus(j.id, 'cancelled')}><X className="h-4 w-4 text-destructive" /></Button>}
              {!j.paid && j.status !== 'cancelled' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/course/${j.id}`); toast.success(t('mobilityWorkspace.lienDePaiementCopie')); }}><Copy className="h-4 w-4 mr-1" />Lien wallet</Button>
                  <Button size="sm" variant="outline" onClick={() => markCashPaid(j.id)}><Banknote className="h-4 w-4 mr-1" />{t('mobilityWorkspace.encaisseEspeces')}</Button>
                </>
              )}
            </div>
          </CardContent></Card>
        );
      })}
    </div>
  );
}

export default MobilityWorkspace;

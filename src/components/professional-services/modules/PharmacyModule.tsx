import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏥 MODULE PHARMACIE (côté pharmacien) — interface complète, intégrée comme les autres services
 * (wallet + copilot + abonnement + badge sécurité). Onglets : Ordonnances (validation = cœur),
 * Préparation, Catalogue, Garde & horaires, Analytics.
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Money } from '@/components/Money';
import { toast } from 'sonner';
import {
  FileText, ClipboardCheck, Pill, CalendarClock, TrendingUp, ShieldPlus,
  AlertTriangle, ShoppingBag, DollarSign, Stethoscope, Plus, Trash2, ShoppingCart,
} from 'lucide-react';
import { PharmacySafetyBadge } from '@/components/pharmacy/PharmacySafetyBadge';
import { PharmacyPrescriptionValidation } from '@/components/pharmacy/PharmacyPrescriptionValidation';
import { PharmacyPreparationKanban } from '@/components/pharmacy/PharmacyPreparationKanban';
import { PharmacyMedicationsCatalog } from '@/components/pharmacy/PharmacyMedicationsCatalog';
import { PharmacyPOS } from '@/components/pharmacy/PharmacyPOS';
import { usePharmacyPrescriptions, usePharmacyOrders, usePharmacyMedications } from '@/hooks/usePharmacy';

interface PharmacyModuleProps { serviceId: string; businessName?: string; }

export function PharmacyModule({ serviceId, businessName }: PharmacyModuleProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('prescriptions');
  const { prescriptions } = usePharmacyPrescriptions(serviceId);
  const { orders } = usePharmacyOrders(serviceId);
  const { medications } = usePharmacyMedications(serviceId);

  // Métriques.
  const toValidate = prescriptions.filter((p) => ['pending', 'reviewing'].includes(p.status)).length;
  const preparing = orders.filter((o) => o.status === 'preparing').length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const caToday = orders.filter((o) => new Date(o.created_at) >= today).reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const outOfStock = medications.filter((m) => m.stock <= 0).length;

  return (
    <div className="space-y-5">
      <PharmacySafetyBadge />

      {/* Header + toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff4000]/10"><Stethoscope className="h-5 w-5 text-[#ff4000]" /></div>
          <div><h2 className="text-xl font-bold leading-tight">{businessName || 'Ma Pharmacie'}</h2><p className="text-xs text-muted-foreground">{t('pharmacyModule.gestionPharmaceutique')}</p></div>
        </div>
        <PharmacyToggles serviceId={serviceId} />
      </div>

      {/* 4 métriques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label={t('pharmacyModule.ordonnancesAValider')} value={toValidate} Icon={FileText} alert={toValidate > 0} />
        <Metric label={t('pharmacyModule.enPreparation')} value={preparing} Icon={ShoppingBag} />
        <Metric label={t('pharmacyModule.caDuJour')} value={<Money amount={caToday} />} Icon={DollarSign} />
        <Metric label={t('pharmacyModule.medicamentsEnRupture')} value={outOfStock} Icon={AlertTriangle} alert={outOfStock > 0} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 h-auto w-full p-1.5 bg-muted/60">
          <TabsTrigger value="prescriptions" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm font-semibold bg-[#ff4000]/10 data-[state=active]:bg-[#ff4000] data-[state=active]:text-white">
            <ClipboardCheck className="w-5 h-5 sm:w-4 sm:h-4" /> Ordonnances{toValidate > 0 && <span className="ml-0.5 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{toValidate}</span>}
          </TabsTrigger>
          <TabsTrigger value="pos" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm"><ShoppingCart className="w-5 h-5 sm:w-4 sm:h-4" /> Caisse</TabsTrigger>
          <TabsTrigger value="preparation" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm"><ShoppingBag className="w-5 h-5 sm:w-4 sm:h-4" /> {t('pharmacyModule.preparation')}</TabsTrigger>
          <TabsTrigger value="catalog" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm"><Pill className="w-5 h-5 sm:w-4 sm:h-4" /> Catalogue</TabsTrigger>
          <TabsTrigger value="oncall" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm"><CalendarClock className="w-5 h-5 sm:w-4 sm:h-4" /> Garde</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm"><TrendingUp className="w-5 h-5 sm:w-4 sm:h-4" /> Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="prescriptions" className="mt-4"><PharmacyPrescriptionValidation serviceId={serviceId} /></TabsContent>
        <TabsContent value="pos" className="mt-4"><PharmacyPOS serviceId={serviceId} businessName={businessName} /></TabsContent>
        <TabsContent value="preparation" className="mt-4"><PharmacyPreparationKanban serviceId={serviceId} /></TabsContent>
        <TabsContent value="catalog" className="mt-4"><PharmacyMedicationsCatalog serviceId={serviceId} /></TabsContent>
        <TabsContent value="oncall" className="mt-4"><PharmacyOnCall serviceId={serviceId} /></TabsContent>
        <TabsContent value="analytics" className="mt-4"><PharmacyAnalytics prescriptions={prescriptions} orders={orders} medications={medications} /></TabsContent>
      </Tabs>
      {/* Le copilote « pharmacie » est fourni par le shell ServiceDashboard (module complet) —
          ne pas en rajouter ici (sinon double bulle flottante superposée). */}
    </div>
  );
}

function Metric({ label, value, Icon, alert }: { label: string; value: React.ReactNode; Icon: any; alert?: boolean }) {
  const { t } = useTranslation();
  return (
    <Card className={alert ? 'border-red-300' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle><Icon className={`h-4 w-4 ${alert ? 'text-red-500' : 'text-[#ff4000]'}`} /></CardHeader>
      <CardContent><div className={`text-xl font-bold ${alert ? 'text-red-600' : ''}`}>{value}</div></CardContent>
    </Card>
  );
}

/** Toggles « Pharmacie ouverte / de garde aujourd'hui ». Ouverte = metadata.is_open ;
 *  de garde = ligne pharmacy_oncall du jour. (Écran 1 du prompt.) */
function PharmacyToggles({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const [onCallToday, setOnCallToday] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [meta, setMeta] = useState<Record<string, any>>({});
  const todayStr = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    let alive = true;
    supabase.from('pharmacy_oncall').select('id').eq('pharmacy_id', serviceId).eq('oncall_date', todayStr).maybeSingle()
      .then(({ data }) => { if (alive) setOnCallToday(!!data); });
    supabase.from('professional_services').select('metadata').eq('id', serviceId).maybeSingle()
      .then(({ data }) => { if (alive) { const m = (data?.metadata as any) || {}; setMeta(m); setIsOpen(m.is_open !== false); } });
    return () => { alive = false; };
  }, [serviceId, todayStr]);
  const toggleOnCall = async (on: boolean) => {
    setOnCallToday(on);
    if (on) await supabase.from('pharmacy_oncall').upsert({ pharmacy_id: serviceId, oncall_date: todayStr }, { onConflict: 'pharmacy_id,oncall_date' });
    else await supabase.from('pharmacy_oncall').delete().eq('pharmacy_id', serviceId).eq('oncall_date', todayStr);
  };
  const toggleOpen = async (on: boolean) => {
    setIsOpen(on);
    await supabase.from('professional_services').update({ metadata: { ...meta, is_open: on }, updated_at: new Date().toISOString() }).eq('id', serviceId);
    setMeta((m) => ({ ...m, is_open: on }));
  };
  return (
    <div className="flex flex-wrap gap-2">
      <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
        <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-gray-400'}`} /> {isOpen ? 'Ouverte' : 'Fermée'}
        <Switch checked={isOpen} onCheckedChange={toggleOpen} />
      </label>
      <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
        <ShieldPlus className={`h-4 w-4 ${onCallToday ? 'text-red-600' : 'text-muted-foreground'}`} /> De garde
        <Switch checked={onCallToday} onCheckedChange={toggleOnCall} />
      </label>
    </div>
  );
}

const DAYS: { k: string; label: string }[] = [
  { k: 'monday', label: 'Lundi' }, { k: 'tuesday', label: 'Mardi' }, { k: 'wednesday', label: 'Mercredi' },
  { k: 'thursday', label: 'Jeudi' }, { k: 'friday', label: 'Vendredi' }, { k: 'saturday', label: 'Samedi' }, { k: 'sunday', label: 'Dimanche' },
];

/** Garde & horaires : horaires d'ouverture hebdomadaires + planification des dates de garde. */
function PharmacyOnCall({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const [dates, setDates] = useState<{ id: string; oncall_date: string }[]>([]);
  const [newDate, setNewDate] = useState('');
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    Object.fromEntries(DAYS.map((d) => [d.k, { open: '08:00', close: '20:00', closed: false }]))
  );
  const [savingHours, setSavingHours] = useState(false);
  const load = async () => {
    const { data } = await supabase.from('pharmacy_oncall').select('id, oncall_date').eq('pharmacy_id', serviceId).gte('oncall_date', new Date().toISOString().slice(0, 10)).order('oncall_date');
    setDates((data as any) || []);
    const { data: svc } = await supabase.from('professional_services').select('opening_hours').eq('id', serviceId).maybeSingle();
    if (svc?.opening_hours && typeof svc.opening_hours === 'object') setHours((h) => ({ ...h, ...(svc.opening_hours as any) }));
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [serviceId]);
  const setDay = (k: string, patch: any) => setHours((h) => ({ ...h, [k]: { ...h[k], ...patch } }));
  const saveHours = async () => {
    setSavingHours(true);
    const { error } = await supabase.from('professional_services').update({ opening_hours: hours, updated_at: new Date().toISOString() }).eq('id', serviceId);
    setSavingHours(false);
    toast[error ? 'error' : 'success'](error ? error.message : 'Horaires enregistrés');
  };
  const add = async () => {
    if (!newDate) return;
    const { error } = await supabase.from('pharmacy_oncall').upsert({ pharmacy_id: serviceId, oncall_date: newDate }, { onConflict: 'pharmacy_id,oncall_date' });
    if (error) { toast.error(error.message); return; }
    setNewDate(''); await load();
  };
  const del = async (id: string) => { await supabase.from('pharmacy_oncall').delete().eq('id', id); await load(); };
  return (
    <div className="space-y-4">
    <Card><CardContent className="space-y-3 py-4 block">
      <div className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-[#ff4000]" /> Horaires d'ouverture</div>
      <p className="text-xs text-muted-foreground">{t('pharmacyModule.cesHorairesSAffichentAux')}</p>
      <div className="space-y-1.5">
        {DAYS.map((d) => {
          const h = hours[d.k] || { open: '08:00', close: '20:00', closed: false };
          return (
            <div key={d.k} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0">{d.label}</span>
              <Switch checked={!h.closed} onCheckedChange={(on) => setDay(d.k, { closed: !on })} />
              {h.closed ? (
                <span className="text-muted-foreground">{t('pharmacyModule.fermee')}</span>
              ) : (
                <>
                  <Input type="time" value={h.open} onChange={(e) => setDay(d.k, { open: e.target.value })} className="h-8 max-w-[120px]" />
                  <span className="text-muted-foreground">→</span>
                  <Input type="time" value={h.close} onChange={(e) => setDay(d.k, { close: e.target.value })} className="h-8 max-w-[120px]" />
                </>
              )}
            </div>
          );
        })}
      </div>
      <Button size="sm" onClick={saveHours} disabled={savingHours} className="gap-1">{savingHours ? 'Enregistrement…' : 'Enregistrer les horaires'}</Button>
    </CardContent></Card>
    <Card><CardContent className="space-y-3 py-4 block">
      <div className="flex items-center gap-2 text-sm font-semibold"><ShieldPlus className="h-4 w-4 text-red-600" /> Gardes</div>
      <p className="text-sm text-muted-foreground">{t('pharmacyModule.planifiezVosGardesCesJours')}</p>
      <div className="flex gap-2"><Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="max-w-[200px]" /><Button onClick={add} className="gap-1"><Plus className="h-4 w-4" /> {t('pharmacyModule.ajouter')}</Button></div>
      <div className="space-y-1.5">
        {dates.length === 0 && <p className="text-sm text-muted-foreground">{t('pharmacyModule.aucuneGardePlanifiee')}</p>}
        {dates.map((d) => (
          <div key={d.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <CalendarClock className="h-4 w-4 text-[#ff4000]" /> {new Date(d.oncall_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => del(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </CardContent></Card>
    </div>
  );
}

/** Analytics simples : CA, ordonnances traitées, médicaments les plus demandés, ruptures. */
function PharmacyAnalytics({ prescriptions, orders, medications }: { prescriptions: any[]; orders: any[]; medications: any[] }) {
  const { t } = useTranslation();
  const stats = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthOrders = orders.filter((o) => new Date(o.created_at) >= monthStart);
    const caMonth = monthOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const map = new Map<string, number>();
    orders.forEach((o) => (Array.isArray(o.medications) ? o.medications : []).forEach((m: any) => map.set(m.name || '?', (map.get(m.name || '?') || 0) + (Number(m.quantity) || 1))));
    const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { caMonth, treated: prescriptions.filter((p) => ['quoted', 'validated'].includes(p.status)).length, refused: prescriptions.filter((p) => p.status === 'refused').length, top, ruptures: medications.filter((m) => m.stock <= 0).length };
  }, [prescriptions, orders, medications]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label={t('pharmacyModule.caDuMois')} value={<Money amount={stats.caMonth} />} Icon={DollarSign} />
        <Metric label={t('pharmacyModule.ordonnancesTraitees')} value={stats.treated} Icon={ClipboardCheck} />
        <Metric label={t('pharmacyModule.refusees')} value={stats.refused} Icon={FileText} />
        <Metric label="Ruptures" value={stats.ruptures} Icon={AlertTriangle} alert={stats.ruptures > 0} />
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t('pharmacyModule.medicamentsLesPlusDemandes')}</CardTitle></CardHeader>
        <CardContent>
          {stats.top.length === 0 ? <p className="text-sm text-muted-foreground">{t('pharmacyModule.pasEncoreDeDonnees')}</p> : (
            <ol className="space-y-1">{stats.top.map(([name, qty], i) => (
              <li key={name} className="flex items-center gap-2 text-sm"><span className="w-5 text-muted-foreground">{i + 1}.</span><span className="flex-1 truncate">{name}</span><span className="font-semibold text-[#ff4000]">{qty}×</span></li>
            ))}</ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PharmacyModule;

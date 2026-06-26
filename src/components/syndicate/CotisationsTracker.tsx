import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface DriverCotisation {
  driver_id: string; full_name: string; vehicle_plate: string | null;
  paid: boolean; paid_at: string | null; payment_method: string | null; amount: number | null;
}

const COTISATION_AMOUNT = 5_000;
const PAYMENT_METHODS = [
  { value: 'cash',         label: 'Espèces' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'mtn_money',    label: 'MTN Guinea' },
  { value: 'wallet',       label: 'Wallet 224' },
];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function CotisationsTracker({ bureauId }: { bureauId: string }) {
  const fc = useFormatCurrency();
  const now = new Date();
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [year, setYear]       = useState(now.getFullYear());
  const [drivers, setDrivers] = useState<DriverCotisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bureauId) return;
    setLoading(true);
    try {
      const { data: allDrivers } = await supabase
        .from('taxi_drivers').select('id, user_id, vehicle_plate').eq('bureau_id', bureauId);

      // Noms des chauffeurs via profiles (taxi_drivers n'a pas de colonne full_name)
      const userIds = (allDrivers || []).map((d: any) => d.user_id).filter(Boolean);
      const nameMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles').select('id, first_name, last_name').in('id', userIds);
        (profs || []).forEach((p: any) => {
          const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          if (name) nameMap.set(p.id, name);
        });
      }

      const { data: paid } = await (supabase as any)
        .from('bureau_cotisations').select('driver_id, paid_at, payment_method, amount')
        .eq('bureau_id', bureauId).eq('month', month).eq('year', year);
      const paidMap = new Map((paid || []).map((p: any) => [p.driver_id, p]));

      const merged: DriverCotisation[] = (allDrivers || []).map((d: any) => {
        const info = paidMap.get(d.id);
        return {
          driver_id: d.id,
          full_name: nameMap.get(d.user_id) || d.vehicle_plate || 'Chauffeur',
          vehicle_plate: d.vehicle_plate, paid: !!info,
          paid_at: info?.paid_at ?? null, payment_method: info?.payment_method ?? null,
          amount: info?.amount ?? null,
        };
      });
      merged.sort((a, b) => Number(a.paid) - Number(b.paid));
      setDrivers(merged);
    } catch (err) { console.error('[Cotisations]', err); }
    finally { setLoading(false); }
  }, [bureauId, month, year]);

  useEffect(() => { load(); }, [load]);

  const recordPayment = async (driverId: string, method: string) => {
    if (recording) return;
    setRecording(driverId);
    try {
      const { error } = await (supabase as any).from('bureau_cotisations').insert({
        bureau_id: bureauId, driver_id: driverId, amount: COTISATION_AMOUNT,
        month, year, payment_method: method, paid_at: new Date().toISOString(),
        recorded_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success('Cotisation enregistrée');
      load();
    } catch (err: any) {
      toast.error(err?.code === '23505' ? 'Déjà enregistrée ce mois' : (err?.message || 'Erreur'));
    } finally { setRecording(null); }
  };

  const paidCount = drivers.filter(d => d.paid).length;
  const total     = drivers.filter(d => d.paid).reduce((s, d) => s + (d.amount || COTISATION_AMOUNT), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue>{MONTHS[month-1]}</SelectValue></SelectTrigger>
          <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue>{year}</SelectValue></SelectTrigger>
          <SelectContent>{[2025,2026,2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-green-600">{paidCount}</p>
          <p className="text-[10px] text-muted-foreground">Ont payé</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-[#ff4000]">{drivers.length - paidCount}</p>
          <p className="text-[10px] text-muted-foreground">Doivent payer</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-sm font-bold text-[#04439e]">{fc(total, 'GNF')}</p>
          <p className="text-[10px] text-muted-foreground">Collecté</p>
        </CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#04439e]" /></div>
      ) : drivers.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Aucun chauffeur rattaché à ce bureau</div>
      ) : (
        <div className="space-y-2">
          {drivers.map(driver => (
            <div key={driver.driver_id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                driver.paid ? 'bg-green-50 border-green-200' : 'bg-card border-border'}`}>
              <div className="flex items-center gap-2.5">
                {driver.paid
                  ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  : <XCircle className="w-5 h-5 text-[#ff4000] flex-shrink-0" />}
                <div>
                  <p className="text-sm font-medium">{driver.full_name}</p>
                  {driver.vehicle_plate && <p className="text-[10px] text-muted-foreground">{driver.vehicle_plate}</p>}
                  {driver.paid && driver.paid_at && (
                    <p className="text-[10px] text-green-600">
                      {PAYMENT_METHODS.find(m => m.value === driver.payment_method)?.label}
                      {' — '}{new Date(driver.paid_at).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
              {!driver.paid && (
                <Select onValueChange={m => recordPayment(driver.driver_id, m)}
                  disabled={recording === driver.driver_id}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    {recording === driver.driver_id
                      ? <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                      : <SelectValue placeholder="Encaisser" />}
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

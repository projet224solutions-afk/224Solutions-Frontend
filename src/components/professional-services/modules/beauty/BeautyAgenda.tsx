import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💇 Agenda hebdomadaire BEAUTÉ (signature Fresha) — 7 jours, RDV en blocs colorés par
 * catégorie de service, créneaux selon la DURÉE. Clic bloc → détails + actions (confirmer,
 * terminer, no-show pénalité, annuler). Créneau libre / bouton → RDV manuel. Temps réel.
 */

import { useMemo, useState } from 'react';
import { useBeautyAppointments, useBeautyServices, colorFor, type BeautyAppointment } from '@/hooks/useBeauty';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Money } from '@/components/Money';
import { ChevronLeft, ChevronRight, Plus, Phone, Check, X, UserX, Loader2, Ban } from 'lucide-react';
import { toast } from 'sonner';

function startOfWeek(d: Date) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function BeautyAgenda({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { appointments, loading, setStatus, createManual, markNoShow } = useBeautyAppointments(serviceId);
  const { services } = useBeautyServices(serviceId);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<BeautyAppointment | null>(null);
  const [busyOnline, setBusyOnline] = useState(false); // « Mode occupé »
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ beauty_service_id: '', customer_name: '', customer_phone: '', appointment_date: iso(new Date()), appointment_time: '10:00' });
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);
  const byDay = useMemo(() => {
    const m: Record<string, BeautyAppointment[]> = {};
    days.forEach((d) => { m[iso(d)] = appointments.filter((a) => a.appointment_date === iso(d)).sort((x, y) => x.appointment_time.localeCompare(y.appointment_time)); });
    return m;
  }, [appointments, days]);

  const svc = (id: string | null) => services.find((s) => s.id === id);

  const submitNew = async () => {
    const s = svc(form.beauty_service_id);
    if (!form.customer_name.trim() || !form.beauty_service_id) { toast.error(t('beautyAgenda.clientEtServiceRequis')); return; }
    setSaving(true);
    const ok = await createManual({
      beauty_service_id: form.beauty_service_id, customer_name: form.customer_name, customer_phone: form.customer_phone || '—',
      appointment_date: form.appointment_date, appointment_time: form.appointment_time,
      duration_minutes: s?.duration_minutes || 30, total_price: s?.price || 0, status: 'confirmed',
    });
    setSaving(false);
    if (ok) { setNewOpen(false); setForm((f) => ({ ...f, customer_name: '', customer_phone: '' })); }
  };

  const act = async (fn: () => Promise<unknown>) => { setActing(true); try { await fn(); setSelected(null); } finally { setActing(false); } };

  if (loading) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => setWeekStart((w) => { const x = new Date(w); x.setDate(x.getDate() - 7); return x; })}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">{days[0].toLocaleDateString()} – {days[6].toLocaleDateString()}</span>
        <Button size="icon" variant="outline" onClick={() => setWeekStart((w) => { const x = new Date(w); x.setDate(x.getDate() + 7); return x; })}><ChevronRight className="h-4 w-4" /></Button>
        <Button size="sm" variant={busyOnline ? 'default' : 'outline'} className="ml-auto" onClick={() => setBusyOnline((b) => !b)}>
          <Ban className="h-4 w-4 mr-1" />{busyOnline ? 'Mode occupé ON' : 'Mode occupé'}
        </Button>
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" />{t('beautyAgenda.nouveauRdv')}</Button>
      </div>
      {busyOnline && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">{t('beautyAgenda.modeOccupeInformezVosClients')}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((d, i) => {
          const list = byDay[iso(d)] || [];
          const isToday = iso(d) === iso(new Date());
          return (
            <div key={i} className="min-h-[8rem] space-y-1 rounded-lg border p-1">
              <div className={`text-center text-xs font-semibold ${isToday ? 'text-[#ff4000]' : 'text-muted-foreground'}`}>{DAYS[i]} {d.getDate()}</div>
              {list.length === 0 && <button onClick={() => { setForm((f) => ({ ...f, appointment_date: iso(d) })); setNewOpen(true); }} className="w-full rounded border border-dashed py-1 text-[10px] text-muted-foreground hover:border-[#ff4000]">+ libre</button>}
              {list.map((a) => (
                <button key={a.id} onClick={() => setSelected(a)} className={`w-full rounded px-1.5 py-1 text-left text-[11px] text-white ${a.status === 'cancelled' || a.status === 'no_show' ? 'bg-slate-400 line-through' : colorFor(svc(a.beauty_service_id)?.category)}`}>
                  <div className="font-semibold">{a.appointment_time.slice(0, 5)} · {a.customer_name}</div>
                  <div className="truncate opacity-90">{svc(a.beauty_service_id)?.name || 'Service'}</div>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Détails RDV */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base">{t('beautyAgenda.rendezVous')}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><b>{selected.customer_name}</b> · {selected.appointment_time.slice(0, 5)} ({selected.duration_minutes} min)</div>
              <div className="text-muted-foreground">{svc(selected.beauty_service_id)?.name} · <Money amount={selected.total_price} /></div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{selected.customer_phone}</div>
              <Badge variant="outline" className="capitalize">{selected.status}</Badge>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {selected.status !== 'confirmed' && <Button size="sm" disabled={acting} onClick={() => act(() => setStatus(selected.id, 'confirmed'))}><Check className="h-4 w-4 mr-1" />Confirmer</Button>}
                <Button size="sm" variant="outline" disabled={acting} onClick={() => act(() => setStatus(selected.id, 'completed'))}><Check className="h-4 w-4 mr-1" />{t('beautyAgenda.termine')}</Button>
                <Button size="sm" variant="outline" className="text-amber-600" disabled={acting} onClick={() => act(() => markNoShow(selected.id))}><UserX className="h-4 w-4 mr-1" />No-show</Button>
                <Button size="sm" variant="outline" className="text-red-600" disabled={acting} onClick={() => act(() => setStatus(selected.id, 'cancelled'))}><X className="h-4 w-4 mr-1" />{t('beautyAgenda.annuler')}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nouveau RDV manuel */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base">{t('beautyAgenda.nouveauRendezVous')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('beautyAgenda.service')}</Label>
              <select className="w-full rounded-md border px-2 py-2 text-sm" value={form.beauty_service_id} onChange={(e) => setForm((f) => ({ ...f, beauty_service_id: e.target.value }))}>
                <option value="">Choisir…</option>
                {services.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min · {s.price} GNF)</option>)}
              </select>
            </div>
            <div><Label>{t('beautyAgenda.nomDuClient')}</Label><Input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} /></div>
            <div><Label>{t('beautyAgenda.telephone')}</Label><Input value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Date</Label><Input type="date" value={form.appointment_date} onChange={(e) => setForm((f) => ({ ...f, appointment_date: e.target.value }))} /></div>
              <div><Label>Heure</Label><Input type="time" step={900} value={form.appointment_time} onChange={(e) => setForm((f) => ({ ...f, appointment_time: e.target.value }))} /></div>
            </div>
            <Button onClick={submitNew} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Créer le RDV</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BeautyAgenda;

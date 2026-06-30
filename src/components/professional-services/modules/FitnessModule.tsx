import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏋️ MODULE SPORT / FITNESS / COACH — réel (Mindbody). Planning de séances de coaching
 * via le socle de réservations partagé (service_bookings). Wallet/Copilot/abonnement
 * fournis par le ServiceDashboard.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Money } from '@/components/Money';
import { Dumbbell, Plus, CalendarClock, Users, Wallet, Loader2, Check, X, Play, CalendarDays, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useServiceBookings } from '@/hooks/useServiceBookings';
import { ServiceShowcaseManager } from '@/components/service-common/ServiceShowcaseManager';

interface FitnessModuleProps { serviceId: string; businessName?: string; }

export function FitnessModule({ serviceId, businessName }: FitnessModuleProps) {
  const { t } = useTranslation();
  const { bookings, loading, createBooking, setStatus, stats } = useServiceBookings(serviceId);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({});

  const submit = async () => {
    if (!form.customer_name || !form.scheduled_date) { toast.error(t('fitnessModule.nomEtDateRequis')); return; }
    const ok = await createBooking({
      service_id: serviceId, customer_name: form.customer_name, customer_phone: form.customer_phone,
      service_code: form.service_code, service_label: form.service_label || 'Séance coaching', scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time, duration_minutes: Number(form.duration_minutes) || 60,
      price: Number(form.price) || 0, notes: form.notes,
    });
    if (ok) { setShow(false); setForm({}); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#04439e] rounded-xl"><Dumbbell className="w-8 h-8 text-white" /></div>
          <div>
            <h2 className="text-2xl font-bold">{businessName || 'Sport & Coaching'}</h2>
            <p className="text-muted-foreground">{t('fitnessModule.seancesAbonnements')}</p>
          </div>
        </div>
        <Dialog open={show} onOpenChange={setShow}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t('fitnessModule.seance')}</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t('fitnessModule.planifierUneSeance')}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>{t('fitnessModule.client')}</Label><Input value={form.customer_name || ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
                <div className="space-y-1"><Label>{t('fitnessModule.telephone')}</Label><Input value={form.customer_phone || ''} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
              </div>
              <div className="space-y-1">
                <Label>{t('fitnessModule.typeDeCours')}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'yoga', label: 'Yoga', icon: '🧘' }, { value: 'hiit', label: 'HIIT', icon: '⚡' },
                    { value: 'pilates', label: 'Pilates', icon: '🤸' }, { value: 'muscu', label: 'Muscu', icon: '💪' },
                    { value: 'cardio', label: 'Cardio', icon: '🏃' }, { value: 'boxe', label: 'Boxe', icon: '🥊' },
                    { value: 'natation', label: 'Natation', icon: '🏊' }, { value: 'individuel', label: 'Individuel', icon: '👤' },
                  ].map((ct) => (
                    <button key={ct.value} type="button"
                      onClick={() => setForm({ ...form, service_code: ct.value, service_label: ct.label })}
                      className={`flex flex-col items-center rounded-xl border-2 p-2 text-xs font-medium transition-all ${form.service_code === ct.value ? 'border-[#04439e] bg-[#04439e]/10 text-[#04439e]' : 'border-slate-200 hover:border-[#04439e]/50'}`}>
                      <span className="text-xl">{ct.icon}</span>{ct.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1"><Label>{t('fitnessModule.intituleOptionnel')}</Label><Input value={form.service_label || ''} onChange={(e) => setForm({ ...form, service_label: e.target.value })} placeholder="Ex: Coaching personnel" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.scheduled_date || ''} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} /></div>
                <div className="space-y-1"><Label>Heure</Label><Input type="time" value={form.scheduled_time || ''} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} /></div>
                <div className="space-y-1"><Label>{t('fitnessModule.dureeMin')}</Label><Input type="number" value={form.duration_minutes || ''} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="60" /></div>
              </div>
              <div className="space-y-1"><Label>Prix (GNF)</Label><Input type="number" value={form.price || ''} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShow(false)}>{t('fitnessModule.annuler')}</Button><Button onClick={submit}>Planifier</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#04439e] text-white"><CardContent className="p-4"><CalendarClock className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{stats.todayBookings}</p><p className="text-xs opacity-80">{t('fitnessModule.seancesAujourdHui')}</p></CardContent></Card>
        <Card className="bg-[#ff4000] text-white"><CardContent className="p-4"><Users className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{stats.pending}</p><p className="text-xs opacity-80">{t('fitnessModule.aConfirmer')}</p></CardContent></Card>
        <Card className="bg-[#04439e] text-white"><CardContent className="p-4"><Check className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{stats.completedThisWeek}</p><p className="text-xs opacity-80">{t('fitnessModule.termineesSemaine')}</p></CardContent></Card>
        <Card className="bg-[#ff4000] text-white"><CardContent className="p-4"><Wallet className="h-4 w-4 opacity-80" /><p className="text-base font-bold mt-1"><Money amount={stats.revenue} from="GNF" /></p><p className="text-xs opacity-80">Revenus</p></CardContent></Card>
      </div>

      <Tabs defaultValue="planning">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="planning"><CalendarDays className="h-4 w-4 mr-1" />Planning</TabsTrigger>
          <TabsTrigger value="vitrine"><ImagePlus className="h-4 w-4 mr-1" />Vitrine</TabsTrigger>
        </TabsList>
        <TabsContent value="planning" className="space-y-2">
        {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#ff4000]" /></div>}
        {!loading && bookings.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">{t('fitnessModule.aucuneSeancePlanifiee')}</p>}
        {bookings.map((b) => {
          const icon = ({ yoga: '🧘', hiit: '⚡', pilates: '🤸', muscu: '💪', cardio: '🏃', boxe: '🥊', natation: '🏊', individuel: '👤' } as Record<string, string>)[b.service_code || ''] || '🏋️';
          const statusColor = b.status === 'completed' ? 'bg-[#16a34a]/10 text-[#16a34a]' : b.status === 'confirmed' ? 'bg-[#04439e]/10 text-[#04439e]' : b.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : b.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700';
          const statusLabel = b.status === 'completed' ? 'Terminée' : b.status === 'confirmed' ? 'Confirmée' : b.status === 'in_progress' ? 'En cours' : b.status === 'cancelled' ? 'Annulée' : 'En attente';
          return (
          <Card key={b.id}><CardContent className="flex flex-wrap items-center gap-3 py-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#04439e]/10 text-xl">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm">{b.service_label || 'Séance'}</h4>
                <Badge className={`border-0 text-[10px] ${statusColor}`}>{statusLabel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{b.customer_name || 'Client'} · {b.scheduled_date} {b.scheduled_time} · {b.duration_minutes}min</p>
            </div>
            <span className="font-bold text-[#ff4000] text-sm"><Money amount={b.price} from="GNF" /></span>
            <div className="flex gap-1">
              {b.status === 'pending' && <Button size="sm" variant="outline" onClick={() => setStatus(b.id, 'confirmed')}><Check className="h-4 w-4" /></Button>}
              {b.status === 'confirmed' && <Button size="sm" variant="outline" onClick={() => setStatus(b.id, 'in_progress')}><Play className="h-4 w-4" /></Button>}
              {b.status === 'in_progress' && <Button size="sm" onClick={() => setStatus(b.id, 'completed')}><Check className="h-4 w-4 mr-1" />Terminer</Button>}
              {['pending', 'confirmed'].includes(b.status) && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setStatus(b.id, 'cancelled')}><X className="h-4 w-4 text-destructive" /></Button>}
            </div>
          </CardContent></Card>
          );
        })}
        </TabsContent>
        <TabsContent value="vitrine">
          <ServiceShowcaseManager serviceId={serviceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FitnessModule;

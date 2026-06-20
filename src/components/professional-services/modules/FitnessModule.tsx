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
import { Textarea } from '@/components/ui/textarea';
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
      service_label: form.service_label || 'Séance coaching', scheduled_date: form.scheduled_date,
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
              <div className="space-y-1"><Label>Type</Label><Input value={form.service_label || ''} onChange={(e) => setForm({ ...form, service_label: e.target.value })} placeholder="Ex: Coaching personnel, Cours collectif" /></div>
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
        <Card className="bg-gradient-to-br from-[#ff4000] to-[#04439e] text-white"><CardContent className="p-4"><Check className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{stats.completedThisWeek}</p><p className="text-xs opacity-80">{t('fitnessModule.termineesSemaine')}</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-[#04439e] to-[#ff4000] text-white"><CardContent className="p-4"><Wallet className="h-4 w-4 opacity-80" /><p className="text-base font-bold mt-1"><Money amount={stats.revenue} from="GNF" /></p><p className="text-xs opacity-80">Revenus</p></CardContent></Card>
      </div>

      <Tabs defaultValue="planning">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="planning"><CalendarDays className="h-4 w-4 mr-1" />Planning</TabsTrigger>
          <TabsTrigger value="vitrine"><ImagePlus className="h-4 w-4 mr-1" />Vitrine</TabsTrigger>
        </TabsList>
        <TabsContent value="planning" className="space-y-2">
        {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#ff4000]" /></div>}
        {!loading && bookings.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">{t('fitnessModule.aucuneSeancePlanifiee')}</p>}
        {bookings.map((b) => (
          <Card key={b.id}><CardContent className="flex flex-wrap items-center gap-3 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm">{b.customer_name}</h4>
                <Badge className={b.status === 'completed' ? 'bg-green-100 text-green-700' : b.status === 'cancelled' ? 'bg-muted text-muted-foreground' : b.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : b.status === 'confirmed' ? 'bg-orange-100 text-[#ff4000]' : 'bg-yellow-100 text-yellow-700'}>{b.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{b.service_label} · {b.scheduled_date} {b.scheduled_time} · {b.duration_minutes}min</p>
            </div>
            <span className="font-bold text-[#ff4000] text-sm"><Money amount={b.price} from="GNF" /></span>
            <div className="flex gap-1">
              {b.status === 'pending' && <Button size="sm" variant="outline" onClick={() => setStatus(b.id, 'confirmed')}><Check className="h-4 w-4" /></Button>}
              {b.status === 'confirmed' && <Button size="sm" variant="outline" onClick={() => setStatus(b.id, 'in_progress')}><Play className="h-4 w-4" /></Button>}
              {b.status === 'in_progress' && <Button size="sm" onClick={() => setStatus(b.id, 'completed')}><Check className="h-4 w-4 mr-1" />Terminer</Button>}
              {['pending', 'confirmed'].includes(b.status) && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setStatus(b.id, 'cancelled')}><X className="h-4 w-4 text-destructive" /></Button>}
            </div>
          </CardContent></Card>
        ))}
        </TabsContent>
        <TabsContent value="vitrine">
          <ServiceShowcaseManager serviceId={serviceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FitnessModule;

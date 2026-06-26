import { useTranslation } from "@/hooks/useTranslation";
/**
 * MODULE COACH SPORTIF — données réelles.
 * Séances via useServiceBookings (table proximity_bookings, écritures backend atomiques).
 * Clients dérivés des séances (par téléphone/nom). Programmes : à venir (pas de table dédiée).
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Money } from '@/components/Money';
import {
  Dumbbell, Users, Calendar, Target, TrendingUp, Plus,
  User, Activity, CheckCircle2, Play, X, MapPin, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useServiceBookings } from '@/hooks/useServiceBookings';

interface CoachModuleProps {
  serviceId: string;
  businessName?: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  confirmed: { label: "Confirmée", color: 'bg-[#04439e]/10 text-[#04439e]' },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-700' },
  completed: { label: "Terminée", color: 'bg-[#16a34a]/10 text-[#16a34a]' },
  cancelled: { label: "Annulée", color: 'bg-red-100 text-red-600' },
};

export function CoachModule({ serviceId, businessName }: CoachModuleProps) {
  const { t } = useTranslation();
  const { bookings, loading, createBooking, setStatus, stats } = useServiceBookings(serviceId);
  const [activeTab, setActiveTab] = useState('seances');
  const [showNewSession, setShowNewSession] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});

  // Clients dérivés des séances (par téléphone, sinon nom) — comme le fichier patients clinique.
  const clients = useMemo(() => {
    const map = new Map<string, { name: string; phone: string | null; visits: number; completed: number; last: string | null }>();
    for (const b of bookings) {
      const key = (b.customer_phone || b.customer_name || b.id) as string;
      const prev = map.get(key);
      map.set(key, {
        name: b.customer_name || 'Client',
        phone: b.customer_phone,
        visits: (prev?.visits || 0) + 1,
        completed: (prev?.completed || 0) + (b.status === 'completed' ? 1 : 0),
        last: !prev?.last || (b.scheduled_date || '') > prev.last ? (b.scheduled_date || prev?.last || null) : prev.last,
      });
    }
    return [...map.values()].sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  }, [bookings]);

  const completedTotal = bookings.filter((b) => b.status === 'completed').length;

  const submitSession = async () => {
    if (!form.customer_name || !form.scheduled_date) { toast.error(t('coachModule.nomDuClientEtDate')); return; }
    setSubmitting(true);
    const ok = await createBooking({
      service_id: serviceId,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      service_label: form.service_label || 'Séance coaching',
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time,
      duration_minutes: Number(form.duration_minutes) || 60,
      price: Number(form.price) || 0,
      address: form.address,
      notes: form.notes,
    });
    setSubmitting(false);
    if (ok) { setShowNewSession(false); setForm({}); }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#04439e] rounded-xl"><Dumbbell className="w-8 h-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || 'Coach Sportif'}</h2>
          <p className="text-muted-foreground">{t('coachModule.gestionDesSeancesClientsEt')}</p>
        </div>
      </div>

      {/* Statistiques réelles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#04439e]" /><span className="text-sm text-muted-foreground">Clients</span></div>
          <p className="text-2xl font-bold mt-1">{clients.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[#ff4000]" /><span className="text-sm text-muted-foreground">{t('coachModule.seancesAujourdHui')}</span></div>
          <p className="text-2xl font-bold mt-1">{stats.todayBookings}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-amber-600" /><span className="text-sm text-muted-foreground">En attente</span></div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#16a34a]" /><span className="text-sm text-muted-foreground">Revenus</span></div>
          <p className="text-2xl font-bold mt-1"><Money amount={stats.revenue} from="GNF" /></p>
        </CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="seances">{t('coachModule.seances')}</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="progress">Progression</TabsTrigger>
        </TabsList>

        {/* Séances — données réelles */}
        <TabsContent value="seances" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('coachModule.planningDesSeances')}</h3>
            <Dialog open={showNewSession} onOpenChange={setShowNewSession}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{t('coachModule.nouvelleSeance')}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t('coachModule.planifierUneSeance')}</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>{t('coachModule.client')}</Label><Input value={form.customer_name || ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
                    <div className="space-y-1"><Label>{t('coachModule.telephone')}</Label><Input value={form.customer_phone || ''} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
                  </div>
                  <div className="space-y-1"><Label>{t('coachModule.typeDeSeance')}</Label><Input value={form.service_label || ''} onChange={(e) => setForm({ ...form, service_label: e.target.value })} placeholder={t('coachModule.exMusculationCardioPreparation')} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Date *</Label><Input type="date" value={form.scheduled_date || ''} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Heure</Label><Input type="time" value={form.scheduled_time || ''} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>{t('coachModule.dureeMin')}</Label><Input type="number" value={form.duration_minutes || ''} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="60" /></div>
                    <div className="space-y-1"><Label>Prix (GNF)</Label><Input type="number" value={form.price || ''} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                  </div>
                  <div className="space-y-1"><Label>Lieu</Label><Input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Salle, parc, domicile…" /></div>
                  <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewSession(false)}>{t('coachModule.annuler')}</Button>
                  <Button onClick={submitSession} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Planifier</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#04439e]" /></div>
          ) : bookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('coachModule.aucuneSeancePlanifieeCreezVotre')}</p>
          ) : (
            <div className="space-y-3">
              {bookings.map((s) => {
                const meta = STATUS_META[s.status] || STATUS_META.pending;
                return (
                  <Card key={s.id}><CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#04439e]/10"><Activity className="h-5 w-5 text-[#04439e]" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm">{s.customer_name || 'Client'}</h4>
                        <Badge className={`border-0 text-[10px] ${meta.color}`}>{meta.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.service_label || 'Séance'}
                        {s.scheduled_date && ` · ${new Date(s.scheduled_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                        {s.scheduled_time && ` · ${s.scheduled_time}`}
                        {s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
                      </p>
                      {s.address && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />{s.address}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Money amount={s.price} from="GNF" className="text-sm font-bold text-[#ff4000]" />
                      <div className="flex gap-1">
                        {s.status === 'pending' && <Button size="sm" variant="outline" className="h-7" onClick={() => setStatus(s.id, 'confirmed')}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}
                        {s.status === 'confirmed' && <Button size="sm" variant="outline" className="h-7" onClick={() => setStatus(s.id, 'in_progress')}><Play className="h-3.5 w-3.5" /></Button>}
                        {s.status === 'in_progress' && <Button size="sm" className="h-7 bg-[#16a34a] hover:bg-[#16a34a]/90" onClick={() => setStatus(s.id, 'completed')}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Terminer</Button>}
                        {['pending', 'confirmed'].includes(s.status) && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStatus(s.id, 'cancelled')}><X className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </div>
                  </CardContent></Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Clients — dérivés des séances */}
        <TabsContent value="clients" className="space-y-4">
          <h3 className="font-semibold">Mes clients ({clients.length})</h3>
          {clients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('coachModule.vosClientsApparaitrontIciDes')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {clients.map((c, i) => (
                <Card key={i}><CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#04439e]/10"><User className="h-5 w-5 text-[#04439e]" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold">{c.visits} séance{c.visits > 1 ? 's' : ''}</p>
                    <p className="text-muted-foreground">{c.completed} terminée{c.completed > 1 ? 's' : ''}</p>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Progression — streak global + clients les plus actifs (style Keep) */}
        <TabsContent value="progress" className="space-y-4">
          <Card className="border-0 bg-[#ff4000] text-white">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="text-4xl">🔥</div>
              <div><p className="text-2xl font-bold">{completedTotal}</p><p className="text-sm opacity-80">{t('coachModule.seancesTotalesCompletees')}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('coachModule.clientsLesPlusActifs')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {clients.filter((c) => c.completed > 0).sort((a, b) => b.completed - a.completed).slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#04439e]/10 text-sm font-bold text-[#04439e]">{c.name.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#04439e]" style={{ width: `${Math.min(100, c.completed * 10)}%` }} /></div>
                  </div>
                  <p className="text-xs font-bold">{c.completed}</p>
                </div>
              ))}
              {clients.filter((c) => c.completed > 0).length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">{t('coachModule.terminezVosPremieresSeancesPour')}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CoachModule;

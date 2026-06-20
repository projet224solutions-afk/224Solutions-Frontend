/**
 * 💇 ÉCRAN 3 — CRM CLIENTS (Fresha). Liste + filtres (fidèles / inactifs / nouveaux) +
 * fiche client 4 onglets : Historique, Notes privées, Photos avant/après, Fidélité.
 */

import { useMemo, useState } from 'react';
import { useBeautyAppointmentsAll, useBeautyClientNotes, useBeautyLoyalty, useBeautyGallery } from '@/hooks/useBeauty';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Money } from '@/components/Money';
import { Progress } from '@/components/ui/progress';
import { Search, Phone, Star, Gift, History, StickyNote, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface ClientRow { key: string; userId: string | null; name: string; phone: string; visits: number; total: number; last: string; first: string; }

export function BeautyClients({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { appointments } = useBeautyAppointmentsAll(serviceId);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'loyal' | 'inactive' | 'new'>('all');
  const [selected, setSelected] = useState<ClientRow | null>(null);

  const clients = useMemo<ClientRow[]>(() => {
    const m = new Map<string, ClientRow>();
    appointments.filter((a) => a.status === 'completed' || a.status === 'confirmed').forEach((a) => {
      const key = a.customer_user_id || a.customer_phone || a.customer_name;
      const cur = m.get(key) || { key, userId: a.customer_user_id, name: a.customer_name, phone: a.customer_phone || '', visits: 0, total: 0, last: a.appointment_date, first: a.appointment_date };
      cur.visits++; cur.total += Number(a.total_price) || 0;
      if (a.appointment_date > cur.last) cur.last = a.appointment_date;
      if (a.appointment_date < cur.first) cur.first = a.appointment_date;
      m.set(key, cur);
    });
    const d60 = new Date(); d60.setDate(d60.getDate() - 60);
    const monthStart = new Date(); monthStart.setDate(1);
    return [...m.values()]
      .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
      .filter((c) => filter === 'all' || (filter === 'loyal' ? c.visits >= 5 : filter === 'inactive' ? new Date(c.last) < d60 : new Date(c.first) >= monthStart))
      .sort((a, b) => b.total - a.total);
  }, [appointments, q, filter]);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{t('beautyClients.myClients')} ({clients.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('beautyClients.searchPlaceholder')} className="pl-8" /></div>
          {(['all', 'loyal', 'inactive', 'new'] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
              {f === 'all' ? t('beautyClients.filterAll') : f === 'loyal' ? t('beautyClients.filterLoyal') : f === 'inactive' ? t('beautyClients.filterInactive') : t('beautyClients.filterNew')}
            </Button>
          ))}
        </div>
        {clients.length === 0 ? <p className="text-sm text-muted-foreground">{t('beautyClients.noClients')}</p> : (
          <div className="space-y-2">
            {clients.map((c) => (
              <button key={c.key} onClick={() => setSelected(c)} className="flex w-full items-center gap-3 rounded-lg border p-2 text-left text-sm hover:border-[#ff4000]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100 text-pink-700">{c.name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 font-medium">{c.name}{c.visits >= 5 && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</div>
                </div>
                <div className="ml-auto text-right"><div className="font-semibold"><Money amount={c.total} /></div><div className="text-xs text-muted-foreground">{c.visits} {t('beautyClients.visitsWord')}</div></div>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {selected && <ClientFiche serviceId={serviceId} client={selected} appointments={appointments} onClose={() => setSelected(null)} />}
    </Card>
  );
}

function ClientFiche({ serviceId, client, appointments, onClose }: { serviceId: string; client: ClientRow; appointments: any[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { note, save } = useBeautyClientNotes(serviceId, client.userId);
  const { rows } = useBeautyLoyalty(serviceId);
  const { items } = useBeautyGallery(serviceId);
  const [n, setN] = useState({ notes: '', allergies: '', preferences: '' });
  useMemo(() => { if (note) setN({ notes: note.notes || '', allergies: note.allergies || '', preferences: note.preferences || '' }); }, [note]);

  const history = appointments.filter((a) => (client.userId ? a.customer_user_id === client.userId : a.customer_phone === client.phone));
  const loyalty = rows.find((r) => r.client_user_id === client.userId);
  const photos = items.filter((it) => it.client_user_id === client.userId);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{client.name} · {client.visits} {t('beautyClients.visits')} · <Money amount={client.total} /></DialogTitle></DialogHeader>
        <Tabs defaultValue="history">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="history"><History className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="notes"><StickyNote className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="photos"><ImageIcon className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="loyalty"><Gift className="h-4 w-4" /></TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-2">
            {history.length === 0 && <p className="text-sm text-muted-foreground">{t('beautyClients.noAppointments')}</p>}
            {history.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div><div className="font-medium">{new Date(a.appointment_date).toLocaleDateString()} · {a.appointment_time?.slice(0, 5)}</div><Badge variant="outline" className="text-[10px]">{a.status}</Badge></div>
                <span className="font-semibold"><Money amount={a.total_price} /></span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="notes" className="space-y-2">
            <div><Label className="text-xs">{t('beautyClients.allergies')}</Label><Input value={n.allergies} onChange={(e) => setN((x) => ({ ...x, allergies: e.target.value }))} placeholder={t('beautyClients.allergiesPlaceholder')} /></div>
            <div><Label className="text-xs">{t('beautyClients.preferences')}</Label><Input value={n.preferences} onChange={(e) => setN((x) => ({ ...x, preferences: e.target.value }))} placeholder={t('beautyClients.preferencesPlaceholder')} /></div>
            <div><Label className="text-xs">{t('beautyClients.freeNote')}</Label><Textarea rows={3} value={n.notes} onChange={(e) => setN((x) => ({ ...x, notes: e.target.value }))} /></div>
            <p className="text-[11px] text-muted-foreground">{t('beautyClients.privateNote')}</p>
            <Button size="sm" onClick={() => save(n)}>{t('beautyClients.saveNote')}</Button>
          </TabsContent>

          <TabsContent value="photos">
            {photos.length === 0 ? <p className="text-sm text-muted-foreground">{t('beautyClients.noPhotos')}</p> : (
              <div className="grid grid-cols-3 gap-2">{photos.map((p) => <img key={p.id} src={p.after_url || p.image_url || p.before_url || ''} alt="" className="h-24 w-full rounded object-cover" />)}</div>
            )}
          </TabsContent>

          <TabsContent value="loyalty" className="space-y-2">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#ff4000]">{loyalty?.visits_count ?? 0}<span className="text-base text-muted-foreground">/{loyalty?.visits_threshold ?? 10}</span></div>
              <p className="text-sm text-muted-foreground">{t('beautyClients.visitsToReward')}</p>
            </div>
            <Progress value={loyalty ? Math.min(100, (loyalty.visits_count / (loyalty.visits_threshold || 10)) * 100) : 0} className="h-2" />
            {loyalty?.last_rewarded_at && <p className="text-xs text-center text-muted-foreground">{t('beautyClients.lastReward')} {new Date(loyalty.last_rewarded_at).toLocaleDateString()}</p>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default BeautyClients;

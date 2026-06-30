import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💇 MES RENDEZ-VOUS BEAUTÉ (client) — à venir & passés. Annuler (remboursement/pénalité),
 * laisser un avis (48h après), rebooker en 1 clic.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Money } from '@/components/Money';
import { cancelBeautyAppointment, submitBeautyReview } from '@/hooks/useBeauty';
import { ArrowLeft, Loader2, Star, CalendarClock, RotateCcw, X, Home } from 'lucide-react';
import { toast } from 'sonner';

export default function MyBeautyAppointments() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from('beauty_appointments')
      .select('*, service:beauty_services(name), salon:professional_services(business_name)')
      .eq('customer_user_id', user.id).order('appointment_date', { ascending: false });
    setRows((data as any[]) ?? []); setLoading(false);
  };
  useEffect(() => { void load();   }, [user]);

  const { upcoming, past } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      upcoming: rows.filter((r) => r.appointment_date >= today && !['cancelled', 'completed', 'no_show'].includes(r.status)),
      past: rows.filter((r) => r.appointment_date < today || ['cancelled', 'completed', 'no_show'].includes(r.status)),
    };
  }, [rows]);

  const cancel = async (id: string) => {
    if (!confirm(t('myBeautyAppointments.annulerCeRendezVousUne'))) return;
    setBusy(id);
    const res = await cancelBeautyAppointment(id);
    setBusy(null);
    if (res.success) { toast.success(`Annulé. Remboursé : ${(res.data?.refunded ?? 0).toLocaleString()} GNF`); await load(); }
    else toast.error(res.error || 'Erreur');
  };

  const sendReview = async (id: string) => {
    setBusy(id);
    const res = await submitBeautyReview(id, rating, text);
    setBusy(null);
    if (res.success) { toast.success(t('myBeautyAppointments.merciPourVotreAvis')); setReviewing(null); setText(''); setRating(5); await load(); }
    else toast.error(res.error || 'Erreur');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;
  if (!user) return <div className="p-6 text-center"><p className="text-muted-foreground">{t('myBeautyAppointments.connectezVousPourVoirVos')}</p><Button className="mt-3" onClick={() => navigate('/auth')}>Se connecter</Button></div>;

  const Row = ({ r, isPast }: { r: any; isPast: boolean }) => (
    <Card><CardContent className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm">{r.service?.name || 'Prestation'}</h4>
            <Badge className={r.status === 'completed' ? 'bg-green-100 text-green-700' : r.status === 'cancelled' ? 'bg-muted text-muted-foreground' : r.status === 'no_show' ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}>{r.status}</Badge>
            {r.booking_type === 'home' && <Badge variant="outline" className="gap-1 text-[10px]"><Home className="h-3 w-3" />Domicile</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{r.salon?.business_name} · {new Date(r.appointment_date).toLocaleDateString()} à {r.appointment_time?.slice(0, 5)}</p>
        </div>
        <span className="font-bold text-[#ff4000] text-sm"><Money amount={r.total_price} /></span>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isPast && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => cancel(r.id)}><X className="h-4 w-4 mr-1" />{t('myBeautyAppointments.annuler')}</Button>}
        <Button size="sm" variant="outline" onClick={() => navigate(`/beaute/${r.professional_service_id}`)}><RotateCcw className="h-4 w-4 mr-1" />Rebooker</Button>
        {isPast && r.status === 'completed' && !r.rating && <Button size="sm" onClick={() => setReviewing(reviewing === r.id ? null : r.id)}><Star className="h-4 w-4 mr-1" />{t('myBeautyAppointments.laisserUnAvis')}</Button>}
        {r.rating && <span className="flex items-center gap-1 text-sm text-amber-500">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />)}</span>}
      </div>

      {reviewing === r.id && (
        <div className="space-y-2 rounded-lg border p-2">
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((s) => <button key={s} onClick={() => setRating(s)}><Star className={`h-6 w-6 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} /></button>)}</div>
          <Textarea rows={2} placeholder={t('myBeautyAppointments.votreCommentaire')} value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" disabled={busy === r.id} onClick={() => sendReview(r.id)}>Publier l'avis</Button>
        </div>
      )}
    </CardContent></Card>
  );

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('myBeautyAppointments.retour')}</Button>
      <h1 className="text-xl font-bold flex items-center gap-2"><CalendarClock className="h-5 w-5 text-[#ff4000]" />{t('myBeautyAppointments.mesRendezVousBeaute')}</h1>

      {upcoming.length > 0 && <><p className="text-sm font-medium text-muted-foreground">{t('myBeautyAppointments.aVenir')}</p>{upcoming.map((r) => <Row key={r.id} r={r} isPast={false} />)}</>}
      {past.length > 0 && <><p className="text-sm font-medium text-muted-foreground pt-2">{t('myBeautyAppointments.passes')}</p>{past.map((r) => <Row key={r.id} r={r} isPast />)}</>}
      {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">{t('myBeautyAppointments.aucunRendezVousReservezAupres')}</p>}
    </div>
  );
}

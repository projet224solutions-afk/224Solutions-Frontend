import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💇 Réservation BEAUTÉ (côté client) — 4 étapes : service → date+créneau → récap → confirmer.
 * Les créneaux libres sont calculés selon la DURÉE du service et les plages occupées (RPC
 * get_beauty_busy_slots, sans PII). La réservation crée un beauty_appointment (RLS client).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { ArrowLeft, ArrowRight, Clock, Check, Loader2, Scissors, CalendarDays, Home, Store } from 'lucide-react';
import { toast } from 'sonner';
import { backendFetch, generateIdempotencyKey } from '@/services/backendApi';
import { Input } from '@/components/ui/input';

const pad = (n: number) => String(n).padStart(2, '0');
function freeSlots(durationMin: number, busy: [number, number][], openHour = 9, closeHour = 20): string[] {
  const out: string[] = [];
  for (let t = openHour * 60; t + durationMin <= closeHour * 60; t += 15) {
    if (!busy.some(([s, e]) => t < e && t + durationMin > s)) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
}

export default function BeautyBooking() {
  const { t } = useTranslation();
  const { serviceId } = useParams<{ serviceId: string }>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [svc, setSvc] = useState<any>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [time, setTime] = useState('');
  const [mode, setMode] = useState<'salon' | 'home'>('salon');
  const [address, setAddress] = useState('');
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ charged: number; remaining: number } | null>(null);

  // Total = prix + frais déplacement si domicile ; montant débité = dépôt si configuré.
  const extra = mode === 'home' ? Number(svc?.home_service_extra_fee || 0) : 0;
  const total = Number(svc?.price || 0) + extra;
  const deposit = Number(svc?.deposit_required || 0);
  const charged = deposit > 0 ? deposit : total;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!serviceId) return;
      const [{ data: s }, { data: svcs }] = await Promise.all([
        supabase.from('professional_services').select('business_name, logo_url, cover_image_url, address').eq('id', serviceId).maybeSingle(),
        supabase.from('beauty_services').select('*').eq('professional_service_id', serviceId).eq('is_active', true).order('category'),
      ]);
      if (!alive) return;
      setSalon(s); setServices(svcs || []); setLoading(false);
      // Présélection si on arrive depuis la page profil (?service=…)
      const preId = sp.get('service');
      const pre = (svcs || []).find((x: any) => x.id === preId);
      if (pre) { setSvc(pre); setStep(2); }
    })();
    return () => { alive = false; };
  }, [serviceId]);

  // Créneaux libres pour la date/service.
  useEffect(() => {
    if (!svc || step !== 2) return;
    let alive = true;
    (async () => {
      setSlotLoading(true);
      const { data } = await supabase.rpc('get_beauty_busy_slots', { p_service_id: serviceId, p_date: date });
      const busy = ((data as any[]) || []).map((r) => [r.start_min, r.end_min] as [number, number]);
      if (alive) { setSlots(freeSlots(svc.duration_minutes || 30, busy)); setSlotLoading(false); }
    })();
    return () => { alive = false; };
  }, [svc, date, step, serviceId]);

  const nextDays = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); }), []);

  const confirm = async () => {
    if (!user) { toast.error(t('beautyBooking.connectezVousPourReserver')); navigate('/auth'); return; }
    if (!svc || !time) return;
    if (mode === 'home' && !address.trim()) { toast.error(t('beautyBooking.saisissezVotreAdresse')); return; }
    setBooking(true);
    const res = await backendFetch<{ charged: number; remaining: number }>('/api/v2/beauty/book', {
      method: 'POST',
      body: {
        service_id: serviceId, beauty_service_id: svc.id,
        slot_date: date, slot_time: time, booking_type: mode,
        client_address: mode === 'home' ? address : null,
        customer_name: (user as any).user_metadata?.full_name || user.email || 'Client',
        customer_phone: (user as any).phone || null,
      },
      idempotencyKey: generateIdempotencyKey(),
    });
    setBooking(false);
    if (!res.success) { toast.error(res.error || 'Échec de la réservation'); return; }
    setResult({ charged: res.data?.charged ?? charged, remaining: res.data?.remaining ?? 0 });
    setDone(true);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;

  if (done) return (
    <div className="mx-auto max-w-md p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"><Check className="h-8 w-8 text-green-600" /></div>
      <h2 className="text-xl font-bold">{t('beautyBooking.rendezVousConfirme')}</h2>
      <p className="mt-1 text-muted-foreground">{svc?.name} · {new Date(date).toLocaleDateString()} à {time}{mode === 'home' ? ' · à domicile' : ''}</p>
      {result && <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">{t('beautyBooking.payeMaintenant')}</span><b className="text-[#ff4000]"><Money amount={result.charged} /></b></div>
        {result.remaining > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('beautyBooking.soldeAReglerApresLa')}</span><span><Money amount={result.remaining} /></span></div>}
      </div>}
      <p className="mt-2 text-sm text-muted-foreground">{t('beautyBooking.annulationGratuiteJusquA24h')}</p>
      <Button className="mt-4 w-full" onClick={() => navigate(-1)}>Terminer</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}><ArrowLeft className="h-4 w-4 mr-1" />{t('beautyBooking.retour')}</Button>
      <div>
        <h1 className="text-xl font-bold">{salon?.business_name || 'Salon'}</h1>
        <p className="text-sm text-muted-foreground">{salon?.address}</p>
      </div>
      <div className="flex gap-1">{[1, 2, 3].map((s) => <div key={s} className={`h-1.5 flex-1 rounded ${s <= step ? 'bg-[#ff4000]' : 'bg-muted'}`} />)}</div>

      {step === 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('beautyBooking.choisissezUnePrestation')}</p>
          {services.length === 0 && <p className="text-sm text-muted-foreground">{t('beautyBooking.aucunServiceDisponible')}</p>}
          {services.map((s) => (
            <button key={s.id} onClick={() => { setSvc(s); setStep(2); }} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:border-[#ff4000]">
              <Scissors className="h-4 w-4 text-[#ff4000]" />
              <div className="min-w-0"><div className="font-medium">{s.name}</div><div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{s.duration_minutes} min {s.category && <Badge variant="outline" className="capitalize text-[10px]">{s.category}</Badge>}</div></div>
              <div className="ml-auto font-bold text-[#ff4000]"><Money amount={s.price} /></div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && svc && (
        <div className="space-y-3">
          <p className="text-sm font-medium flex items-center gap-1"><CalendarDays className="h-4 w-4" />{t('beautyBooking.choisissezLaDate')}</p>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {nextDays.map((d) => {
              const dd = new Date(d);
              return <button key={d} onClick={() => { setDate(d); setTime(''); }} className={`flex-shrink-0 rounded-lg border px-3 py-2 text-center text-xs ${date === d ? 'border-[#ff4000] bg-[#ff4000]/5' : ''}`}><div className="font-semibold">{dd.toLocaleDateString(undefined, { weekday: 'short' })}</div><div>{dd.getDate()}/{dd.getMonth() + 1}</div></button>;
            })}
          </div>
          <p className="text-sm font-medium">{t('beautyBooking.creneauxDisponibles')}</p>
          {slotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : slots.length === 0 ? <p className="text-sm text-muted-foreground">{t('beautyBooking.aucunCreneauCeJourChoisissez')}</p> : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((sl) => <button key={sl} onClick={() => setTime(sl)} className={`rounded-lg border py-2 text-sm ${time === sl ? 'border-[#ff4000] bg-[#ff4000] text-white' : 'hover:border-[#ff4000]'}`}>{sl}</button>)}
            </div>
          )}
          <Button className="w-full" disabled={!time} onClick={() => setStep(3)}>Continuer<ArrowRight className="h-4 w-4 ml-1" /></Button>
        </div>
      )}

      {step === 3 && svc && (
        <div className="space-y-3">
          {/* Mode de prestation (si le salon propose le domicile) */}
          {svc.is_home_service && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode('salon')} className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm ${mode === 'salon' ? 'border-[#ff4000] bg-[#ff4000]/5' : ''}`}><Store className="h-4 w-4" />Au salon</button>
              <button onClick={() => setMode('home')} className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm ${mode === 'home' ? 'border-[#ff4000] bg-[#ff4000]/5' : ''}`}><Home className="h-4 w-4" />{t('beautyBooking.aDomicile')}</button>
            </div>
          )}
          {mode === 'home' && <Input placeholder={t('beautyBooking.votreAdresse')} value={address} onChange={(e) => setAddress(e.target.value)} />}

          <Card><CardContent className="space-y-2 p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Prestation</span><span className="font-medium">{svc.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('beautyBooking.duree')}</span><span>{svc.duration_minutes} min</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date & heure</span><span>{new Date(date).toLocaleDateString()} à {time}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Prix prestation</span><span><Money amount={svc.price} /></span></div>
            {extra > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('beautyBooking.fraisDeDeplacement')}</span><span><Money amount={extra} /></span></div>}
            <div className="flex justify-between border-t pt-2 text-base"><span className="text-muted-foreground">Total</span><b><Money amount={total} /></b></div>
            <div className="flex justify-between text-[#ff4000]"><span>{deposit > 0 ? 'Acompte à payer maintenant' : 'À payer maintenant (wallet)'}</span><b><Money amount={charged} /></b></div>
            {deposit > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>{t('beautyBooking.soldeApresPrestation')}</span><span><Money amount={total - charged} /></span></div>}
          </CardContent></Card>
          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">{t('beautyBooking.paiementParWalletAnnulationGratuite')}</p>
          <Button className="w-full" disabled={booking} onClick={confirm}>{booking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}Payer & confirmer</Button>
        </div>
      )}
    </div>
  );
}

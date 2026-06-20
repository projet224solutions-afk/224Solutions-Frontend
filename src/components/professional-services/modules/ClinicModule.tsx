/**
 * 🏥 MODULE CLINIQUE (côté établissement de santé) — interface professionnelle.
 *
 * Inspiré des standards des grandes cliniques (Mayo Clinic, Cleveland Clinic, Ping An Good
 * Doctor) : pilotage par rendez-vous, fichier patients, consultations, facturation.
 *
 * Données RÉELLES : réservations via useServiceBookings (table proximity_bookings, lecture RLS
 * prestataire + écritures backend /api/v2/bookings atomiques). Caisse = POS vendeur réutilisé
 * (offline + atomique). Aucune donnée fictive.
 *
 * Onglets : Vue d'ensemble · Rendez-vous (agenda) · Patients · Caisse.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Money } from '@/components/Money';
import {
  Stethoscope, RefreshCw, CalendarClock, Users, Activity, CreditCard,
  Clock, Phone, CheckCircle2, XCircle, PlayCircle, CalendarDays, UserRound,
} from 'lucide-react';
import { useServiceBookings, type BookingStatus, type ServiceBooking } from '@/hooks/useServiceBookings';
import POSSystemWrapper from '@/components/vendor/POSSystemWrapper';
import { useTranslation } from '@/hooks/useTranslation';

interface ClinicModuleProps { serviceId: string; businessName?: string; }

const STATUS_META: Record<BookingStatus, { labelKey: string; cls: string }> = {
  pending:     { labelKey: 'clinic.statusPending',    cls: 'bg-amber-500' },
  confirmed:   { labelKey: 'clinic.statusConfirmed',  cls: 'bg-blue-600' },
  in_progress: { labelKey: 'clinic.statusInProgress', cls: 'bg-violet-600' },
  completed:   { labelKey: 'clinic.statusCompleted',  cls: 'bg-emerald-600' },
  cancelled:   { labelKey: 'clinic.statusCancelled',  cls: 'bg-gray-400' },
};

export function ClinicModule({ serviceId, businessName }: ClinicModuleProps) {
  const { t } = useTranslation();
  const { bookings, loading, reload, setStatus, stats } = useServiceBookings(serviceId);
  const [tab, setTab] = useState('overview');

  const todayStr = new Date().toISOString().split('T')[0];
  const todays = useMemo(
    () => bookings.filter((b) => b.scheduled_date === todayStr && b.status !== 'cancelled')
      .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || '')),
    [bookings, todayStr],
  );

  // Fichier patients dérivé des rendez-vous (par téléphone, sinon nom).
  const patients = useMemo(() => {
    const map = new Map<string, { name: string; phone: string | null; visits: number; last: string | null }>();
    for (const b of bookings) {
      const key = (b.customer_phone || b.customer_name || b.client_id || b.id) as string;
      const prev = map.get(key);
      map.set(key, {
        name: b.customer_name || 'Patient',
        phone: b.customer_phone,
        visits: (prev?.visits || 0) + 1,
        last: !prev?.last || (b.scheduled_date || '') > prev.last ? (b.scheduled_date || prev?.last || null) : prev.last,
      });
    }
    return [...map.values()].sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  }, [bookings]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#04439e]/10">
            <Stethoscope className="h-5 w-5 text-[#04439e]" />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight">{businessName || t('clinic.myClinic')}</h2>
            <p className="text-xs text-muted-foreground">{t('clinic.subtitle')}</p>
          </div>
        </div>
        <Button onClick={reload} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden md:inline">{t('clinic.refresh')}</span>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={t('clinic.todayRdv')} value={stats.todayBookings} Icon={CalendarClock} />
        <Kpi label={t('clinic.statusPending')} value={stats.pending} Icon={Clock} alert={stats.pending > 0} />
        <Kpi label={t('clinic.completed7d')} value={stats.completedThisWeek} Icon={CheckCircle2} />
        <Kpi label={t('clinic.revenue')} value={<Money amount={stats.revenue} from="GNF" />} Icon={CreditCard} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 gap-1.5 h-auto w-full p-1.5 bg-muted/60">
          <TabsTrigger value="overview" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm"><Activity className="w-5 h-5 sm:w-4 sm:h-4" /> {t('clinic.tabOverview')}</TabsTrigger>
          <TabsTrigger value="appointments" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm font-semibold data-[state=active]:bg-[#04439e] data-[state=active]:text-white">
            <CalendarDays className="w-5 h-5 sm:w-4 sm:h-4" /> {t('clinic.tabAppointments')}{stats.pending > 0 && <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{stats.pending}</span>}
          </TabsTrigger>
          <TabsTrigger value="patients" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm"><Users className="w-5 h-5 sm:w-4 sm:h-4" /> {t('clinic.tabPatients')}</TabsTrigger>
          <TabsTrigger value="pos" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm"><CreditCard className="w-5 h-5 sm:w-4 sm:h-4" /> {t('clinic.tabPos')}</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble : agenda du jour */}
        <TabsContent value="overview" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#04439e]" /> {t('clinic.todayAppointments')}</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t('clinic.loading')}</p>
              ) : todays.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">{t('clinic.noTodayAppointments')}</p>
              ) : (
                <div className="space-y-2">
                  {todays.map((b) => <AppointmentRow key={b.id} b={b} onStatus={setStatus} compact />)}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Kpi label={t('clinic.registeredPatients')} value={patients.length} Icon={UserRound} />
            <Kpi label={t('clinic.confirmedRdv')} value={bookings.filter((b) => b.status === 'confirmed').length} Icon={CheckCircle2} />
            <Kpi label={t('clinic.totalRdv')} value={bookings.length} Icon={CalendarDays} />
          </div>
        </TabsContent>

        {/* Rendez-vous : agenda complet avec filtres */}
        <TabsContent value="appointments" className="mt-4">
          <AppointmentsAgenda bookings={bookings} loading={loading} onStatus={setStatus} />
        </TabsContent>

        {/* Patients */}
        <TabsContent value="patients" className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-[#04439e]" /> {t('clinic.patientFile')} ({patients.length})</CardTitle></CardHeader>
            <CardContent>
              {patients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">{t('clinic.noPatients')}</p>
              ) : (
                <div className="divide-y">
                  {patients.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#04439e]/10"><UserRound className="h-4 w-4 text-[#04439e]" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        {p.phone && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {p.phone}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold">{p.visits} {t('clinic.visitsWord')}</p>
                        {p.last && <p className="text-[11px] text-muted-foreground">{new Date(p.last + 'T00:00:00').toLocaleDateString('fr-FR')}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Caisse : facturation des consultations / actes (POS réutilisé, offline) */}
        <TabsContent value="pos" className="mt-4">
          <div className="rounded-xl border bg-blue-50/50 dark:bg-[#04439e]/10 border-blue-200 dark:border-[#04439e]/40 p-3 mb-4 flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4 text-[#04439e] flex-shrink-0" />
            <span className="text-muted-foreground">{t('clinic.posInfo')}</span>
          </div>
          <POSSystemWrapper />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, Icon, alert }: { label: string; value: React.ReactNode; Icon: any; alert?: boolean }) {
  return (
    <Card className={alert ? 'border-amber-300' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${alert ? 'text-amber-500' : 'text-[#04439e]'}`} />
      </CardHeader>
      <CardContent><div className={`text-xl font-bold ${alert ? 'text-amber-600' : ''}`}>{value}</div></CardContent>
    </Card>
  );
}

function AppointmentRow({ b, onStatus, compact }: { b: ServiceBooking; onStatus: (id: string, s: BookingStatus) => void; compact?: boolean }) {
  const { t } = useTranslation();
  const meta = STATUS_META[b.status] || STATUS_META.pending;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#04439e]/10"><UserRound className="h-5 w-5 text-[#04439e]" /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{b.customer_name || b.service_label || t('clinic.patientFallback')}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {b.scheduled_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {b.scheduled_time}</span>}
          {b.customer_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {b.customer_phone}</span>}
          {!compact && b.scheduled_date && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {new Date(b.scheduled_date + 'T00:00:00').toLocaleDateString('fr-FR')}</span>}
          {b.price > 0 && <span className="font-medium text-foreground"><Money amount={b.price} from="GNF" /></span>}
        </p>
      </div>
      <Badge className={meta.cls}>{t(meta.labelKey)}</Badge>
      <div className="flex gap-1.5">
        {b.status === 'pending' && (
          <>
            <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => onStatus(b.id, 'confirmed')}><CheckCircle2 className="h-3.5 w-3.5" /> {t('clinic.confirm')}</Button>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onStatus(b.id, 'cancelled')}><XCircle className="h-3.5 w-3.5" /></Button>
          </>
        )}
        {b.status === 'confirmed' && (
          <Button size="sm" className="h-8 gap-1 bg-violet-600 hover:bg-violet-700" onClick={() => onStatus(b.id, 'in_progress')}><PlayCircle className="h-3.5 w-3.5" /> {t('clinic.start')}</Button>
        )}
        {b.status === 'in_progress' && (
          <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onStatus(b.id, 'completed')}><CheckCircle2 className="h-3.5 w-3.5" /> {t('clinic.finish')}</Button>
        )}
      </div>
    </div>
  );
}

function AppointmentsAgenda({ bookings, loading, onStatus }: { bookings: ServiceBooking[]; loading: boolean; onStatus: (id: string, s: BookingStatus) => void }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const count = (s: 'all' | BookingStatus) => s === 'all' ? bookings.length : bookings.filter((b) => b.status === s).length;
  const filtered = useMemo(() => {
    const list = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
    return [...list].sort((a, b) => `${b.scheduled_date || ''}${b.scheduled_time || ''}`.localeCompare(`${a.scheduled_date || ''}${a.scheduled_time || ''}`));
  }, [bookings, filter]);

  const FILTERS: ('all' | BookingStatus)[] = ['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-[#04439e] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            {f === 'all' ? t('clinic.all') : t(STATUS_META[f].labelKey)} ({count(f)})
          </button>
        ))}
      </div>
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('clinic.loadingAppointments')}</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <CalendarDays className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('clinic.noAppointmentsPrefix')} {filter !== 'all' ? t(STATUS_META[filter].labelKey).toLowerCase() : ''}.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">{filtered.map((b) => <AppointmentRow key={b.id} b={b} onStatus={onStatus} />)}</div>
      )}
    </div>
  );
}

export default ClinicModule;

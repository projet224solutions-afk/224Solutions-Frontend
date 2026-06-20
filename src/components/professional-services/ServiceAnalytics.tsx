/**
 * ServiceAnalytics — Statistiques détaillées d'un service professionnel
 * Sources : service_bookings + service_reviews + wallet_transactions
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import {
  TrendingUp, TrendingDown, Calendar, Star, DollarSign,
  Users, Clock, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface ServiceAnalyticsProps {
  serviceId: string;
}

interface DayStats {
  day: string;
  label: string;
  bookings: number;
  revenue: number;
}

interface Stats {
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  avgRating: number;
  totalReviews: number;
  periodBookings: number;
  periodRevenue: number;
  prevPeriodBookings: number;
  prevPeriodRevenue: number;
}

const PERIODS = [
  { value: '7', labelKey: 'serviceAnalytics.period7' },
  { value: '30', labelKey: 'serviceAnalytics.period30' },
  { value: '90', labelKey: 'serviceAnalytics.period90' },
];

function formatAmount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M GNF`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K GNF`;
  return `${n} GNF`;
}

function formatDate(dateStr: string, period: number) {
  const d = new Date(dateStr);
  if (period <= 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  if (period <= 30) return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
}

function Trend({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0) return null;
  const pct = prev === 0 ? 100 : Math.round(((current - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium', up ? 'text-[#ff4000]' : 'text-destructive')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{pct}%
    </span>
  );
}

export function ServiceAnalytics({ serviceId }: ServiceAnalyticsProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { convert, userCurrency } = usePriceConverter();
  // Axe Y compact (revenus stockés en GNF → devise de l'utilisateur, taux BCRG)
  const compactAxis = (v: number) => {
    const c = convert(v, 'GNF').convertedAmount;
    if (Math.abs(c) >= 1_000_000) return `${(c / 1_000_000).toFixed(1)}M ${userCurrency}`;
    if (Math.abs(c) >= 1_000) return `${(c / 1_000).toFixed(0)}K ${userCurrency}`;
    return `${Math.round(c)} ${userCurrency}`;
  };
  const [period, setPeriod] = useState('30');
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const days = parseInt(period);
      const now = new Date();
      const start = new Date(now.getTime() - days * 86400_000);
      const prevStart = new Date(start.getTime() - days * 86400_000);

      // Toutes les réservations du service
      const { data: bookings } = await supabase
        .from('service_bookings')
        .select('id, status, total_amount, payment_status, scheduled_date, created_at')
        .eq('professional_service_id', serviceId)
        .order('created_at', { ascending: false });

      const all = bookings || [];
      const period_rows = all.filter(b => new Date(b.created_at) >= start);
      const prev_rows = all.filter(b => new Date(b.created_at) >= prevStart && new Date(b.created_at) < start);

      // Avis
      const { data: reviews } = await supabase
        .from('service_reviews')
        .select('rating')
        .eq('professional_service_id', serviceId);

      const revs = reviews || [];
      const avgRating = revs.length > 0
        ? revs.reduce((s, r) => s + (r.rating || 0), 0) / revs.length
        : 0;

      // Stats globales
      const totalRevenue = all
        .filter(b => b.payment_status === 'paid')
        .reduce((s, b) => s + Number(b.total_amount || 0), 0);

      const periodRevenue = period_rows
        .filter(b => b.payment_status === 'paid')
        .reduce((s, b) => s + Number(b.total_amount || 0), 0);

      const prevPeriodRevenue = prev_rows
        .filter(b => b.payment_status === 'paid')
        .reduce((s, b) => s + Number(b.total_amount || 0), 0);

      setStats({
        totalBookings: all.length,
        pendingBookings: all.filter(b => b.status === 'pending').length,
        confirmedBookings: all.filter(b => ['confirmed', 'completed'].includes(b.status)).length,
        cancelledBookings: all.filter(b => b.status === 'cancelled').length,
        totalRevenue,
        avgRating,
        totalReviews: revs.length,
        periodBookings: period_rows.length,
        periodRevenue,
        prevPeriodBookings: prev_rows.length,
        prevPeriodRevenue,
      });

      // Données graphique jour par jour
      const buckets: Record<string, { bookings: number; revenue: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400_000);
        const key = d.toISOString().split('T')[0];
        buckets[key] = { bookings: 0, revenue: 0 };
      }

      period_rows.forEach(b => {
        const key = new Date(b.created_at).toISOString().split('T')[0];
        if (buckets[key]) {
          buckets[key].bookings++;
          if (b.payment_status === 'paid') {
            buckets[key].revenue += Number(b.total_amount || 0);
          }
        }
      });

      setChartData(Object.entries(buckets).map(([day, v]) => ({
        day,
        label: formatDate(day, days),
        ...v,
      })));
    } catch (err) {
      console.error('[ServiceAnalytics]', err);
    } finally {
      setLoading(false);
    }
  }, [serviceId, period]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="space-y-6">
      {/* Sélecteur période */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('serviceAnalytics.title')}</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map(p => (
              <SelectItem key={p.value} value={p.value} className="text-xs">{t(p.labelKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{t('serviceAnalytics.bookings')}</span>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{s.periodBookings}</div>
            <Trend current={s.periodBookings} prev={s.prevPeriodBookings} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{t('serviceAnalytics.periodRevenue')}</span>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold">{fc(s.periodRevenue)}</div>
            <Trend current={s.periodRevenue} prev={s.prevPeriodRevenue} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{t('serviceAnalytics.avgRating')}</span>
              <Star className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              {s.avgRating > 0 ? s.avgRating.toFixed(1) : '—'}
            </div>
            <span className="text-xs text-muted-foreground">{s.totalReviews} {t('serviceAnalytics.reviewsWord')}</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{t('serviceAnalytics.totalRevenue')}</span>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold">{fc(s.totalRevenue)}</div>
            <span className="text-xs text-muted-foreground">{s.totalBookings} {t('serviceAnalytics.totalWord')}</span>
          </CardContent>
        </Card>
      </div>

      {/* Statuts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-orange-200 bg-orange-50 dark:bg-[#ff4000]/20">
          <CardContent className="p-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#ff4000]" />
            <div>
              <div className="text-lg font-bold text-[#ff4000]">{s.pendingBookings}</div>
              <div className="text-xs text-[#ff4000]">{t('serviceAnalytics.pending')}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50 dark:bg-[#ff4000]/20">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#ff4000]" />
            <div>
              <div className="text-lg font-bold text-[#ff4000]">{s.confirmedBookings}</div>
              <div className="text-xs text-[#ff4000]">{t('serviceAnalytics.confirmed')}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50 dark:bg-[#ff4000]/20">
          <CardContent className="p-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-[#ff4000]" />
            <div>
              <div className="text-lg font-bold text-[#ff4000]">{s.cancelledBookings}</div>
              <div className="text-xs text-[#ff4000]">{t('serviceAnalytics.cancelled')}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique réservations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {t('serviceAnalytics.bookingsPerDay')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.every(d => d.bookings === 0) ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Calendar className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">{t('serviceAnalytics.noBookingsPeriod')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [v, t('serviceAnalytics.bookings')]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Graphique revenus */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#ff4000]" />
            {t('serviceAnalytics.revenue')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.every(d => d.revenue === 0) ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <DollarSign className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">{t('serviceAnalytics.noRevenuePeriod')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={compactAxis} width={64} />
                <Tooltip
                  formatter={(v: number) => [fc(v), t('serviceAnalytics.revenueShort')]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#ff4000"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

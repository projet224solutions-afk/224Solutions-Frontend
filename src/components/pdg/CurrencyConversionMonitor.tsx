import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle2, ArrowRightLeft, TrendingUp, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ConversionLog {
  id: string;
  order_id: string | null;
  buyer_user_id: string | null;
  vendor_id: string | null;
  from_currency: string;
  to_currency: string;
  is_cross_currency: boolean;
  original_amount: number | null;
  converted_amount: number | null;
  commission_original: number | null;
  commission_converted: number | null;
  wallet_debit_amount: number | null;
  exchange_rate: number | null;
  exchange_rate_source: string | null;
  status: 'success' | 'error' | 'skipped';
  error_message: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface Stats {
  total: number;
  success: number;
  errors: number;
  skipped: number;
  crossCurrency: number;
  successRate: number;
  lastError: string | null;
  lastErrorAt: string | null;
}

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + ' ' + currency;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function CurrencyConversionMonitor() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<ConversionLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, success: 0, errors: 0, skipped: 0,
    crossCurrency: 0, successRate: 100,
    lastError: null, lastErrorAt: null,
  });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'error' | 'cross'>('all');
  const [realtimeActive, setRealtimeActive] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
       
      const db = supabase.from('currency_conversion_logs' as any);
      let query = db.select('*').order('created_at', { ascending: false }).limit(100);

      if (filter === 'error') query = (query as any).eq('status', 'error');
      else if (filter === 'cross') query = (query as any).eq('is_cross_currency', true);

      const { data, error } = await (query as any);
      if (error) {
        // Table absente → migration non appliquée
        if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.code === 'PGRST204' || error.code === '42P01') {
          toast.error('Migration manquante', {
            description: t('currencyConversionMonitor.laTableCurrencyConversionLogs'),
            duration: 10000,
          });
          setLoading(false);
          return;
        }
        throw error;
      }

      const rows = (data || []) as ConversionLog[];
      setLogs(rows);

      // Calcul stats sur les 100 derniers
      const all = rows;
      const errLogs = all.filter(l => l.status === 'error');
      const successLogs = all.filter(l => l.status === 'success');
      const skippedLogs = all.filter(l => l.status === 'skipped');
      const crossLogs = all.filter(l => l.is_cross_currency);
      const total = all.length;
      const successRate = total > 0
        ? Math.round(((successLogs.length + skippedLogs.length) / total) * 100)
        : 100;
      const lastErrLog = errLogs[0];

      setStats({
        total,
        success: successLogs.length,
        errors: errLogs.length,
        skipped: skippedLogs.length,
        crossCurrency: crossLogs.length,
        successRate,
        lastError: lastErrLog?.error_message ?? null,
        lastErrorAt: lastErrLog?.created_at ?? null,
      });
    } catch (err: any) {
      toast.error('Erreur chargement conversions', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Temps réel via Supabase realtime
  useEffect(() => {
    if (!realtimeActive) return;

    const channel = supabase
      .channel('currency_conversion_logs_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'currency_conversion_logs' },
        (payload) => {
          const newLog = payload.new as ConversionLog;
          setLogs(prev => [newLog, ...prev.slice(0, 99)]);

          if (newLog.status === 'error') {
            toast.error(t('currencyConversionMonitor.erreurDeConversionDeviseDetectee'), {
              description: `${newLog.from_currency} → ${newLog.to_currency} : ${newLog.error_message}`,
              duration: 8000,
            });
          }

          // Mettre à jour les stats en temps réel
          setStats(prev => {
            const newTotal = prev.total + 1;
            const newErrors = newLog.status === 'error' ? prev.errors + 1 : prev.errors;
            const newSuccess = newLog.status === 'success' ? prev.success + 1 : prev.success;
            const newSkipped = newLog.status === 'skipped' ? prev.skipped + 1 : prev.skipped;
            const newCross = newLog.is_cross_currency ? prev.crossCurrency + 1 : prev.crossCurrency;
            const newRate = newTotal > 0
              ? Math.round(((newSuccess + newSkipped) / newTotal) * 100)
              : 100;

            return {
              total: newTotal,
              success: newSuccess,
              errors: newErrors,
              skipped: newSkipped,
              crossCurrency: newCross,
              successRate: newRate,
              lastError: newLog.status === 'error' ? (newLog.error_message ?? prev.lastError) : prev.lastError,
              lastErrorAt: newLog.status === 'error' ? newLog.created_at : prev.lastErrorAt,
            };
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [realtimeActive]);

  const statusIcon = stats.errors === 0
    ? <CheckCircle2 className="h-5 w-5 text-[#ff4000]" />
    : stats.successRate < 80
      ? <XCircle className="h-5 w-5 text-[#ff4000] animate-pulse" />
      : <AlertTriangle className="h-5 w-5 text-[#ff4000]" />;

  const statusLabel = stats.errors === 0 ? 'Opérationnel' : stats.successRate < 80 ? 'Dégradé' : 'Avertissement';
  const statusVariant: 'default' | 'secondary' | 'destructive' =
    stats.errors === 0 ? 'default' : stats.successRate < 80 ? 'destructive' : 'secondary';

  return (
    <div className="space-y-4">
      {/* En-tête statut */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="font-semibold">{t('currencyConversionMonitor.systemeDeConversion')}</span>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          {realtimeActive && (
            <Badge variant="outline" className="text-xs text-[#ff4000] border-[#ff4000]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ff4000] mr-1 animate-pulse" />
              Temps réel
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={realtimeActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRealtimeActive(v => !v)}
            className="text-xs h-8"
          >
            {realtimeActive ? 'RT Actif' : 'RT Inactif'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alerte crash visible si erreurs récentes */}
      {stats.errors > 0 && stats.lastError && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-[#ff4000]/20">
          <CardContent className="p-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-[#ff4000] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#ff4000] dark:text-[#ff4000]">
                Dernière erreur de conversion
                {stats.lastErrorAt && (
                  <span className="font-normal ml-1 text-[#ff4000]">— {timeAgo(stats.lastErrorAt)}</span>
                )}
              </p>
              <p className="text-xs text-[#ff4000] dark:text-orange-300 mt-0.5 truncate">
                {stats.lastError}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métriques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total conversions</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t('currencyConversionMonitor.tauxDeSucces')}</p>
            <p className={`text-2xl font-bold ${stats.successRate >= 95 ? 'text-[#ff4000]' : stats.successRate >= 80 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
              {stats.successRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Erreurs</p>
            <p className={`text-2xl font-bold ${stats.errors === 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
              {stats.errors}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Cross-devise</p>
            <p className="text-2xl font-bold text-blue-600">{stats.crossCurrency}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(['all', 'error', 'cross'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs h-8"
          >
            {f === 'all' ? 'Tous' : f === 'error' ? `Erreurs (${stats.errors})` : `Cross-devise (${stats.crossCurrency})`}
          </Button>
        ))}
      </div>

      {/* Liste des logs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Mouvements de conversion — {logs.length} enregistrements
          </CardTitle>
          <CardDescription className="text-xs">{t('currencyConversionMonitor.chaqueAchatMarketplaceGenereUne')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">{t('currencyConversionMonitor.aucuneConversionEnregistree')}</p>
              <p className="text-xs mt-1">{t('currencyConversionMonitor.lesAchatsMarketplaceApparaitrontIci')}</p>
            </div>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  {/* Icône statut */}
                  <div className="mt-0.5 shrink-0">
                    {log.status === 'success' && <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />}
                    {log.status === 'error' && <XCircle className="h-4 w-4 text-[#ff4000]" />}
                    {log.status === 'skipped' && <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  {/* Détails */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold">
                        {log.from_currency} → {log.to_currency}
                      </span>
                      {log.is_cross_currency && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300">
                          cross-devise
                        </Badge>
                      )}
                      <Badge
                        variant={log.status === 'error' ? 'destructive' : log.status === 'success' ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {log.status}
                      </Badge>
                    </div>

                    {/* Montants */}
                    {log.status !== 'error' && (
                      <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                        {log.original_amount !== null && (
                          <span>Produits : {formatAmount(log.original_amount, log.from_currency)}</span>
                        )}
                        {log.is_cross_currency && log.converted_amount !== null && (
                          <span>→ {formatAmount(log.converted_amount, log.to_currency)}</span>
                        )}
                        {log.wallet_debit_amount !== null && (
                          <span className="font-medium text-foreground">
                            Débité : {formatAmount(log.wallet_debit_amount, log.to_currency)}
                          </span>
                        )}
                        {log.exchange_rate !== null && log.is_cross_currency && (
                          <span>Taux : {log.exchange_rate.toFixed(4)} ({log.exchange_rate_source})</span>
                        )}
                      </div>
                    )}

                    {/* Erreur */}
                    {log.status === 'error' && log.error_message && (
                      <p className="text-xs text-[#ff4000] mt-0.5 line-clamp-2">{log.error_message}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {timeAgo(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

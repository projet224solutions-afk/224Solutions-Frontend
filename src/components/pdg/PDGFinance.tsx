import { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, Wallet, Download, Clock, BarChart3, RefreshCw, User, Mail, Phone, CreditCard, Calendar, _Crown, Shield, Bike, Sparkles, Building2, ArrowUpDown, AlertTriangle, Globe2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  _ResponsiveContainer
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useFinanceData } from '@/hooks/useFinanceData';
import { backendFetch } from '@/services/backendApi';
import PlatformRevenueOverview from './PlatformRevenueOverview';
import CurrencyConversionMonitor from './CurrencyConversionMonitor';

const PDGRevenueAnalytics = lazy(() => import('./PDGRevenueAnalytics'));
const SubscriptionManagement = lazy(() => import('./SubscriptionManagement'));
const PDGEscrowManagement = lazy(() => import('./PDGEscrowManagement'));
const DriverSubscriptionManagement = lazy(() => import('./DriverSubscriptionManagement'));
const PDGServiceSubscriptions = lazy(() => import('./PDGServiceSubscriptions'));
const PDGTransferLimits = lazy(() => import('./PDGTransferLimits'));
const CountryPricingManagement = lazy(() => import('./CountryPricingManagement'));

export default function PDGFinance() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fc = useFormatCurrency();
  const { convert, userCurrency } = usePriceConverter();
  const compactAxis = (v) => {
    const c = convert(v, 'GNF').convertedAmount;
    if (Math.abs(c) >= 1_000_000) return `${(c / 1_000_000).toFixed(1)}M ${userCurrency}`;
    if (Math.abs(c) >= 1_000) return `${(c / 1_000).toFixed(0)}K ${userCurrency}`;
    return `${Math.round(c)} ${userCurrency}`;
  };
  const { stats, transactions, wallets, loading, refetch } = useFinanceData(true);
  const [activeFinanceTab, setActiveFinanceTab] = useState('overview');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [showWalletsDialog, setShowWalletsDialog] = useState(false);
  const [fxHealth, setFxHealth] = useState<any>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [showConversionStatsDialog, setShowConversionStatsDialog] = useState(false);
  const [conversionStats, setConversionStats] = useState<any>(null);
  const [conversionStatsLoading, setConversionStatsLoading] = useState(false);
  const [conversionTab, setConversionTab] = useState<'overview' | 'transactions' | 'rates'>('overview');
  const [alertCheckLoading, setAlertCheckLoading] = useState(false);
  const [marginUpdateLoading, setMarginUpdateLoading] = useState(false);
  const [showMarginDialog, setShowMarginDialog] = useState(false);
  const [marginPercentInput, setMarginPercentInput] = useState('3');
  const [clockMs, setClockMs] = useState(Date.now());
  const [fxFetchedAtMs, setFxFetchedAtMs] = useState<number | null>(null);

  const formatConakryTime = (iso: string | null | undefined): string => {
    if (!iso) return 'Heure N/A';
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Africa/Conakry',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(iso));
    } catch {
      return 'Heure N/A';
    }
  };

  const formatRateAgeCountdown = (ageSeconds: number | null | undefined): string => {
    if (typeof ageSeconds !== 'number' || ageSeconds < 0) return 'N/A';
    // Compte à rebours dans le cycle de rafraîchissement BCRG (1 min) : 59 → 00 puis redémarre.
    // Basé sur l'âge réel du taux : atteint 00 quand le taux a ~60 s (juste avant le prochain scrape).
    const remaining = 59 - (Math.floor(ageSeconds) % 60);
    return String(remaining).padStart(2, '0');
  };

  const visibleBankSources = (() => {
    if (Array.isArray(fxHealth?.bank_sources) && fxHealth.bank_sources.length > 0) {
      return fxHealth.bank_sources;
    }
    if (!Array.isArray(fxHealth?.today_history)) {
      return [];
    }

    const byUrl = new Map<string, { source: string | null; source_type: string | null; source_url: string | null; last_seen_at: string | null }>();
    for (const rate of fxHealth.today_history) {
      const url = rate?.source_url;
      if (!url) continue;
      if (!byUrl.has(url)) {
        byUrl.set(url, {
          source: null,
          source_type: rate?.source_type || null,
          source_url: url,
          last_seen_at: rate?.retrieved_at || null,
        });
      }
    }
    return Array.from(byUrl.values());
  })();

  // Auto-rafraîchir les données au montage du composant
  useEffect(() => {
    console.log('🔄 PDGFinance monté - rafraîchissement des données');
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log des stats pour debug
  useEffect(() => {
    if (!loading) {
      console.log('📊 Stats Finance PDG:', {
        total_revenue: stats.total_revenue,
        total_commission: stats.total_commission,
        pending_payments: stats.pending_payments,
        active_wallets: stats.active_wallets,
        transactions_count: transactions?.length || 0
      });
    }
  }, [loading, stats, transactions]);

  const [fxError, setFxError] = useState<string | null>(null);

  const loadFxHealth = async () => {
    try {
      setFxLoading(true);
      setFxError(null);
      const response = await backendFetch('/api/v2/wallet/admin/fx-health', { method: 'GET' });
      if (!response.success) {
        throw new Error(response.error || 'Impossible de récupérer les données FX');
      }
      setFxHealth(response.data || null);
      setFxFetchedAtMs(Date.now());
    } catch (error: any) {
      console.error('Erreur chargement FX health:', error);
      const msg = error?.message || 'Erreur inconnue';
      setFxError(msg);
      setFxHealth(null);
    } finally {
      setFxLoading(false);
    }
  };

  useEffect(() => {
    // Retry loadFxHealth after a delay if the first attempt fails (auth session may not be ready)
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    loadFxHealth().catch(() => {}).finally(() => {
      if (!cancelled) {
        retryTimer = setTimeout(() => loadFxHealth(), 3000);
      }
    });
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Surveillance des taux BCRG via polling Node.js — endpoint léger sans scraping
  // Connexion SSE — le backend pousse un événement à l'instant où un taux BCRG change.
  // Fallback polling toutes les 60s si la connexion SSE est indisponible.
  useEffect(() => {
    let active = true;
    let sseReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let lastKnownChangedAt: string | null = null;
    let sseConnected = false;

    // ── Connexion SSE via fetch (supporte les headers Authorization) ──
    const connectSSE = async () => {
      if (!active) return;
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { backendConfig } = await import('@/config/backend');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token || !active) return;

        const url = `${backendConfig.baseUrl}/api/v2/wallet/admin/fx-rates-stream`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
        });
        if (!response.ok || !response.body) throw new Error(`SSE HTTP ${response.status}`);

        sseReader = response.body.getReader();
        sseConnected = true;
        const decoder = new TextDecoder();
        let buffer = '';

        while (active) {
          const { done, value } = await sseReader.read();
          if (done || !active) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (!payload?.changedAt) continue;
              if (lastKnownChangedAt === null) {
                lastKnownChangedAt = payload.changedAt; // Premier événement : init sans rafraîchir
              } else if (payload.changedAt !== lastKnownChangedAt) {
                lastKnownChangedAt = payload.changedAt;
                loadFxHealth().catch(() => {});
                toast.info(t('pDGFinance.tauxBcrgMisAJour'));
              }
            } catch { /* JSON invalide */ }
          }
        }
      } catch { /* connexion interrompue */ }

      sseConnected = false;
      if (active) reconnectTimer = setTimeout(connectSSE, 5_000); // Reconnexion automatique
    };

    // ── Fallback polling 60s — uniquement si SSE non connecté ──
    fallbackInterval = setInterval(async () => {
      if (sseConnected) return; // SSE actif → pas besoin du polling
      try {
        const response = await backendFetch('/api/v2/wallet/admin/fx-rates-check', { method: 'GET' });
        if (!response.success || !response.data) return;
        const { changedAt } = response.data;
        if (!changedAt) return;
        if (lastKnownChangedAt === null) {
          lastKnownChangedAt = changedAt;
        } else if (changedAt !== lastKnownChangedAt) {
          lastKnownChangedAt = changedAt;
          loadFxHealth().catch(() => {});
          toast.info(t('pDGFinance.tauxBcrgMisAJour'));
        }
      } catch { /* silencieux */ }
    }, 60 * 1000);

    connectSSE();

    return () => {
      active = false;
      sseReader?.cancel().catch(() => {});
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  const loadConversionStats = async (hours = 168) => {
    try {
      setConversionStatsLoading(true);
      const response = await backendFetch(`/api/v2/wallet/admin/fx-conversion-stats?hours=${hours}`, { method: 'GET' });
      if (!response.success) {
        throw new Error(response.error || 'Impossible de charger les stats de conversion');
      }
      setConversionStats(response.data || null);
      setShowConversionStatsDialog(true);
    } catch (error: any) {
      toast.error(error?.message || 'Erreur stats de conversion');
    } finally {
      setConversionStatsLoading(false);
    }
  };

  const checkRateChangeAlert = async () => {
    try {
      setAlertCheckLoading(true);
      const response = await backendFetch('/api/v2/wallet/admin/fx-rate-alert-check', { method: 'POST' });
      if (!response.success) {
        throw new Error(response.error || 'Impossible de verifier les alertes FX');
      }

      if (response.data?.changed_under_one_hour) {
        toast.warning(`Changement de taux detecte en ${response.data?.minutes_between || 'N/A'} min.${response.data?.alert_created ? ' Alerte enregistree.' : ' Alerte deja active.'}`);
      } else {
        toast.success(t('pDGFinance.aucunChangementDeTauxEn'));
      }
      await loadFxHealth();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur verification alerte FX');
    } finally {
      setAlertCheckLoading(false);
    }
  };

  const displayedFxMargin = typeof fxHealth?.current_rate?.configured_margin === 'number'
    ? fxHealth.current_rate.configured_margin
    : typeof fxHealth?.current_rate?.margin === 'number'
      ? fxHealth.current_rate.margin
      : null;

  const openFxMarginDialog = () => {
    const currentMarginPercent = Number(((displayedFxMargin ?? 0.03) * 100).toFixed(2));
    setMarginPercentInput(Number.isFinite(currentMarginPercent) ? String(currentMarginPercent) : '3');
    setShowMarginDialog(true);
  };

  const updateFxMargin = async () => {
    const marginPercent = Number(String(marginPercentInput).replace(',', '.'));
    if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 30) {
      toast.error(t('pDGFinance.commissionInvalideEntrezUnPourcentage'));
      return;
    }

    try {
      setMarginUpdateLoading(true);
      const response = await backendFetch('/api/v2/wallet/admin/fx-margin', {
        method: 'POST',
        body: { margin_percent: marginPercent },
      });

      if (!response.success) {
        throw new Error(response.error || 'Mise a jour de la commission FX impossible');
      }

      const nextMarginValue = marginPercent / 100;
      setFxHealth((current: any) => current ? ({
        ...current,
        configured_margin: nextMarginValue,
        current_rate: current.current_rate
          ? { ...current.current_rate, configured_margin: nextMarginValue }
          : current.current_rate,
      }) : current);

      toast.success(`Commission FX mise a jour: ${marginPercent}%`);
      setShowMarginDialog(false);
      void loadFxHealth();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur mise a jour commission FX');
    } finally {
      setMarginUpdateLoading(false);
    }
  };

  const chartConfig = {
    amount: { label: "Montant", color: "hsl(var(--primary))" },
    commission: { label: "Commission", color: "hsl(var(--chart-2))" }
  };

  const exportData = async () => {
    try {
      const csvData = (transactions || []).map(t => {
        return {
          'ID Transaction': t.id,
          'Type': t.transaction_type || 'N/A',
          'Montant': t.amount,
          'Statut': t.status,
          'Date': new Date(t.created_at).toLocaleDateString('fr-FR'),
          'Description': t.description || 'N/A',
          'Devise': t.currency || 'GNF'
        };
      });

      const csvContent = [
        Object.keys(csvData[0] || {}).join(','),
        ...csvData.map(row => Object.values(row).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(t('pDGFinance.exportReussi'));
    } catch (error) {
      console.error('Erreur export:', error);
      toast.error(t('pDGFinance.erreurLorsDeLExport'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const chartData = (transactions || []).slice(0, 10).reverse().map(t => ({
    date: new Date(t.created_at).toLocaleDateString(),
    amount: Number(t.amount),
    commission: Number(t.fee)
  }));

  const liveRateAgeSeconds = (() => {
    const retrievedAt = fxHealth?.current_rate?.retrieved_at;
    if (!retrievedAt) {
      if (typeof fxHealth?.age_minutes !== 'number') return null;
      const baseAgeSeconds = Math.max(0, fxHealth.age_minutes * 60);
      if (!fxFetchedAtMs) return baseAgeSeconds;
      const elapsedSinceFetchSeconds = Math.max(0, Math.floor((clockMs - fxFetchedAtMs) / 1000));
      return baseAgeSeconds + elapsedSinceFetchSeconds;
    }

    const parsed = new Date(retrievedAt).getTime();
    if (!Number.isFinite(parsed)) {
      return typeof fxHealth?.age_minutes === 'number' ? Math.max(0, fxHealth.age_minutes * 60) : null;
    }

    return Math.max(0, Math.floor((clockMs - parsed) / 1000));
  })();

  return (
    <>
    <Tabs value={activeFinanceTab} onValueChange={setActiveFinanceTab} className="space-y-4 sm:space-y-6">
      {/* Mobile: Horizontal scrollable tabs */}
      <div className="overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
        <TabsList className="inline-flex w-max sm:w-full sm:grid sm:grid-cols-10 gap-1 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Revenus</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Transactions</span>
          </TabsTrigger>
          <TabsTrigger value="transfer-limits" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Limites</span>
          </TabsTrigger>
          <TabsTrigger value="pdg-revenue" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>PDG</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Abonnements</span>
          </TabsTrigger>
          <TabsTrigger value="service-subscriptions" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{t('pDGFinance.services')}</span>
          </TabsTrigger>
          <TabsTrigger value="escrow" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Escrow</span>
          </TabsTrigger>
          <TabsTrigger value="driver-subscriptions" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <Bike className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Drivers</span>
          </TabsTrigger>
          <TabsTrigger value="devises" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <Globe2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Devises</span>
          </TabsTrigger>
          <TabsTrigger value="country-pricing" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <Globe2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Prix par pays</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-6">
        <PlatformRevenueOverview />

        {/* FX Commission Management Card */}
        <Card className="border-border/40 bg-blue-500/5/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="w-5 h-5 text-blue-500" />
              Gestion Commission FX
            </CardTitle>
            <CardDescription>{t('pDGFinance.gerezLeTauxDeCommission')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fxLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Chargement données FX...
              </div>
            ) : !fxHealth ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('pDGFinance.donneesFxIndisponiblesPourLe')}</p>
                {fxError && (
                  <p className="text-xs text-[#ff4000]">Erreur: {fxError}</p>
                )}
                <Button type="button" variant="outline" size="sm" onClick={loadFxHealth} className="gap-2">
                  <RefreshCw className="w-3 h-3" />
                  Réessayer
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-blue-200/50 bg-blue-50/30 p-3">
                  <p className="text-xs text-muted-foreground font-medium">Commission Actuelle</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {typeof fxHealth.current_rate?.margin === 'number'
                      ? `${(fxHealth.current_rate.margin * 100).toFixed(2)}%`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Appliquée sur tous les taux de change
                  </p>
                </div>

                <div className="rounded-lg border border-blue-200/50 bg-blue-50/30 p-3">
                  <p className="text-xs text-muted-foreground font-medium">Taux Actuel</p>
                  <p className="text-lg font-semibold mt-1">
                    {fxHealth.current_rate
                      ? `${fxHealth.current_rate.from_currency}/${fxHealth.current_rate.to_currency}`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {typeof fxHealth.current_rate?.rate === 'number'
                      ? fxHealth.current_rate.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })
                      : 'N/A'}
                  </p>
                </div>

                <div className="rounded-lg border border-orange-200/50 bg-orange-50/30 p-3">
                  <p className="text-xs text-muted-foreground font-medium">{t('pDGFinance.tauxFinalAvecCommission')}</p>
                  <p className="text-lg font-semibold mt-1 text-[#ff4000]">
                    {typeof fxHealth.current_rate?.final_rate_usd === 'number'
                      ? fxHealth.current_rate.final_rate_usd.toLocaleString(undefined, { maximumFractionDigits: 6 })
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatRateAgeCountdown(liveRateAgeSeconds)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="default"
                className="gap-2 flex-1"
                onClick={openFxMarginDialog}
                disabled={marginUpdateLoading || !fxHealth}
              >
                <DollarSign className="w-4 h-4" />
                {marginUpdateLoading ? 'Mise à jour...' : 'Modifier Commission'}
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={loadConversionStats} disabled={conversionStatsLoading}>
                <Globe2 className="w-4 h-4" />
                {conversionStatsLoading ? 'Chargement...' : 'Conversions par pays'}
              </Button>
              <Button type="button" variant="secondary" className="gap-2" onClick={checkRateChangeAlert} disabled={alertCheckLoading}>
                <AlertTriangle className="w-4 h-4" />
                {alertCheckLoading ? 'Vérification...' : 'Alerte changement < 1 min'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={loadFxHealth}
                disabled={fxLoading}
              >
                <RefreshCw className={`w-4 h-4 ${fxLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="transfer-limits" className="space-y-6">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <PDGTransferLimits />
        </Suspense>
      </TabsContent>

      <TabsContent value="pdg-revenue" className="space-y-6">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <PDGRevenueAnalytics />
        </Suspense>
      </TabsContent>

      <TabsContent value="subscriptions" className="space-y-6">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <SubscriptionManagement />
        </Suspense>
      </TabsContent>

      <TabsContent value="service-subscriptions" className="space-y-6">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <PDGServiceSubscriptions />
        </Suspense>
      </TabsContent>

      <TabsContent value="escrow" className="space-y-6">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <PDGEscrowManagement />
        </Suspense>
      </TabsContent>

      <TabsContent value="driver-subscriptions" className="space-y-6">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <DriverSubscriptionManagement />
        </Suspense>
      </TabsContent>

      <TabsContent value="country-pricing" className="space-y-6">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <CountryPricingManagement />
        </Suspense>
      </TabsContent>

      <TabsContent value="devises" className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>{t('pDGFinance.conversionsDeDevises')}</CardTitle>
                <CardDescription>
                  Monitoring en temps réel de chaque conversion lors des achats marketplace.
                  Toute erreur apparaît ici immédiatement.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CurrencyConversionMonitor />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="transactions" className="space-y-8">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <CardTitle className="text-xl">{t('pDGFinance.santeFxDevises')}</CardTitle>
              {typeof displayedFxMargin === 'number' && (
                <Badge variant="secondary" className="ml-2">
                  Commission: {(displayedFxMargin * 100).toFixed(2)}%
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="default"
              className="gap-2"
              onClick={openFxMarginDialog}
              disabled={marginUpdateLoading || !fxHealth}
              size="sm"
            >
              <DollarSign className="w-4 h-4" />
              {marginUpdateLoading ? 'Mise à jour...' : 'Modifier Commission'}
            </Button>
          </div>
          <CardDescription>{t('pDGFinance.tauxActuelHistoriqueDuJour')}</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" className="gap-2" onClick={loadConversionStats} disabled={conversionStatsLoading}>
              <Globe2 className="w-4 h-4" />
              {conversionStatsLoading ? 'Chargement...' : 'Voir conversions par pays'}
            </Button>
            <Button type="button" variant="secondary" className="gap-2" onClick={checkRateChangeAlert} disabled={alertCheckLoading}>
              <AlertTriangle className="w-4 h-4" />
              {alertCheckLoading ? 'Verification...' : 'Alerte changement < 1 min'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fxLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Chargement des données FX...
            </div>
          ) : !fxHealth ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('pDGFinance.donneesFxIndisponiblesPourLe')}</p>
              {fxError && (
                <p className="text-xs text-[#ff4000]">Erreur: {fxError}</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={loadFxHealth} className="gap-2">
                <RefreshCw className="w-3 h-3" />
                Réessayer
              </Button>
            </div>
          ) : (
            <>
              {/* Grille des taux du jour — toutes devises visibles simultanément */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {/* USD/GNF — taux BCRG temps réel */}
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">USD → GNF</p>
                  <p className="text-sm font-bold mt-0.5">
                    {typeof fxHealth.current_rate?.rate === 'number'
                      ? fxHealth.current_rate.rate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Final: {typeof fxHealth.current_rate?.final_rate_usd === 'number'
                      ? fxHealth.current_rate.final_rate_usd.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
                      : 'N/A'}
                  </p>
                  <Badge variant={fxHealth.is_stale ? 'destructive' : 'secondary'} className="mt-1 text-xs px-1">
                    {fxHealth.is_stale ? 'Stale' : 'Fresh'}
                  </Badge>
                </div>

                {/* EUR/GBP/XOF/XAF/CAD → GNF */}
                {[
                  { key: 'EUR_GNF', label: 'EUR → GNF', name: 'Euro' },
                  { key: 'GBP_GNF', label: 'GBP → GNF', name: 'Livre sterling' },
                  { key: 'XOF_GNF', label: 'XOF → GNF', name: 'CFA UEMOA' },
                  { key: 'CAD_GNF', label: 'CAD → GNF', name: 'Dollar canadien' },
                ].map(({ key, label }) => {
                  const kr = fxHealth.key_rates?.[key];
                  const rateAgeMin = kr?.retrieved_at
                    ? Math.floor((Date.now() - new Date(kr.retrieved_at).getTime()) / 60000)
                    : null;
                  const isStaleKr = rateAgeMin === null || rateAgeMin > 90;
                  return (
                    <div key={key} className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      <p className="text-sm font-bold mt-0.5">
                        {typeof kr?.rate === 'number'
                          ? kr.rate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })
                          : 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Final: {typeof kr?.final_rate === 'number'
                          ? kr.final_rate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })
                          : 'N/A'}
                      </p>
                      <Badge
                        variant={!kr ? 'outline' : isStaleKr ? 'destructive' : 'secondary'}
                        className="mt-1 text-xs px-1"
                      >
                        {!kr ? 'N/A' : isStaleKr ? 'Stale' : 'Fresh'}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {/* Ligne d'infos : Commission, Âge USD/GNF, Sources */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('pDGFinance.commissionAppliquee')}</p>
                  <p className="text-lg font-semibold">
                    {typeof fxHealth.current_rate?.margin === 'number'
                      ? `${(fxHealth.current_rate.margin * 100).toFixed(2)}%`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {typeof fxHealth.current_rate?.final_rate_usd === 'number' && typeof fxHealth.current_rate?.rate === 'number'
                      ? `Taux USD final: ${fxHealth.current_rate.final_rate_usd.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`
                      : 'N/A'}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Âge du taux USD/GNF</p>
                  <p className="text-lg font-semibold">
                    {formatRateAgeCountdown(liveRateAgeSeconds)}
                  </p>
                  <Badge variant={fxHealth.is_stale ? 'destructive' : 'secondary'} className="mt-1">
                    {fxHealth.is_stale ? 'Stale' : 'Fresh'}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('pDGFinance.sourcesBancairesVisitees')}</p>
                  <p className="text-lg font-semibold">{visibleBankSources.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('pDGFinance.collecteDuBackend')}</p>
                </div>
              </div>

              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                Fuseau horaire système: <span className="font-medium text-foreground">{fxHealth.timezone || 'Africa/Conakry'}</span>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2">{t('pDGFinance.sourcesBancairesVisiteesUrls')}</p>
                {visibleBankSources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('pDGFinance.aucuneSourceBancaireTrouvee')}</p>
                ) : (
                  <div className="max-h-44 overflow-auto space-y-1">
                    {visibleBankSources.slice(0, 12).map((source, idx) => (
                      <div key={`${source.source_url || 'na'}-${idx}`} className="text-xs rounded border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{source.source || source.source_type || 'Source bancaire'}</span>
                          <span className="text-muted-foreground">
                            {formatConakryTime(source.last_seen_at)}
                          </span>
                        </div>
                        <div className="mt-1 text-muted-foreground break-all">
                          {source.source_url || source.source || source.source_type || 'Source indisponible'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2">{t('pDGFinance.historiqueDeviseGuineeGnf')}</p>
                {!Array.isArray(fxHealth.gnf_today_history) || fxHealth.gnf_today_history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('pDGFinance.aucunTauxGnfCollecteAujourd')}</p>
                ) : (
                  <div className="max-h-40 overflow-auto space-y-1">
                    {fxHealth.gnf_today_history.slice(0, 20).map((rate: any, idx: number) => (
                      <div key={`gnf-${rate.retrieved_at || 'na'}-${idx}`} className="text-xs rounded border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{rate.from_currency}/{rate.to_currency}</span>
                          <span>{typeof rate.rate === 'number' ? rate.rate.toLocaleString(undefined, { maximumFractionDigits: 6 }) : 'N/A'}</span>
                        </div>
                        <div className="mt-1 text-muted-foreground flex items-center justify-between gap-2">
                          <span>
                            {formatConakryTime(rate.retrieved_at)} {' • '} {rate.source_url || rate.source_type || 'Source N/A'}
                          </span>
                          {typeof rate.margin === 'number' && (
                            <span className="font-medium text-blue-500">Marge: {(rate.margin * 100).toFixed(2)}%</span>
                          )}
                        </div>
                        {typeof rate.final_rate_usd === 'number' && (
                          <div className="mt-1 text-blue-500 text-xs">
                            Taux final: {rate.final_rate_usd.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2">{t('pDGFinance.historiqueDuTauxAujourdHui')}</p>
                {!fxHealth.today_history || fxHealth.today_history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('pDGFinance.aucunTauxCollecteAujourdHui')}</p>
                ) : (
                  <div className="max-h-64 overflow-auto space-y-1">
                    {fxHealth.today_history.slice(0, 20).map((rate, idx) => (
                      <div key={`${rate.retrieved_at || 'na'}-${idx}`} className="text-xs rounded border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{rate.from_currency}/{rate.to_currency}</span>
                          <span>
                            {typeof rate.rate === 'number'
                              ? rate.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="mt-1 text-muted-foreground flex items-center justify-between gap-2">
                          <span>
                            {formatConakryTime(rate.retrieved_at)}
                            {' • '}
                            {rate.source_url || rate.source_type || 'Source N/A'}
                          </span>
                          {typeof rate.margin === 'number' && (
                            <span className="font-medium text-blue-500">Marge: {(rate.margin * 100).toFixed(2)}%</span>
                          )}
                        </div>
                        {typeof rate.final_rate_usd === 'number' && (
                          <div className="mt-1 text-blue-500 text-xs">
                            Taux final: {rate.final_rate_usd.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden border-border bg-card hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-[#ff4000]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#ff4000]/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-[#ff4000]" />
              </div>
              Revenus Totaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold bg-foreground bg-clip-text text-transparent">
                {fc(stats.total_revenue || 0)}
              </p>
              <p className="text-xs text-[#ff4000] flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +12.5% ce mois
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border bg-card hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold bg-foreground bg-clip-text text-transparent">
                {fc(stats.total_commission || 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                  Sur {transactions?.length || 0} transactions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border bg-card hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              Paiements en Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold bg-foreground bg-clip-text text-transparent">
                {fc(stats.pending_payments || 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {transactions?.filter(t => t.status === 'pending').length || 0} transactions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden border-border bg-card hover:shadow-xl transition-all duration-300 group cursor-pointer"
          onClick={() => setShowWalletsDialog(true)}
        >
          <div className="absolute inset-0 bg-[#04439e]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#04439e]/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-[#04439e]" />
              </div>
              Wallets Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold bg-foreground bg-clip-text text-transparent">
                {stats.active_wallets || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Cliquez pour voir les détails
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 gap-2"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate('/wallet');
                }}
              >
                <ArrowUpDown className="w-4 h-4" />
                Transférer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Évolution des Transactions
            </CardTitle>
            <CardDescription>{t('pDGFinance.volumeDes10DernieresTransactions')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={compactAxis} width={72} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Répartition des Commissions
            </CardTitle>
            <CardDescription>Par transaction</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={compactAxis} width={72} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="commission" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Export Section */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>{t('pDGFinance.exportDesDonnees')}</CardTitle>
          <CardDescription>{t('pDGFinance.telechargerLesRapportsFinanciers')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="bg-background"
            />
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="bg-background"
            />
            <Button onClick={exportData} className="gap-2 shadow-lg">
              <Download className="w-4 h-4" />
              Exporter CSV
            </Button>
            <Button onClick={refetch} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-xl">{t('pDGFinance.transactionsRecentes')}</CardTitle>
          <CardDescription>{t('pDGFinance.les10DernieresOperationsFinancieres')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(transactions || []).slice(0, 10).map((trans, index) => (
              <div
                key={trans.id}
                className="group p-4 rounded-xl border border-border/40 bg-muted/30 hover:bg-muted/50 hover:border-border/60 transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                      trans.status === 'completed' ? 'bg-[#ff4000]/10' :
                      trans.status === 'pending' ? 'bg-orange-500/10' :
                      'bg-[#ff4000]/10'
                    }`}>
                      <DollarSign className={`w-6 h-6 ${
                        trans.status === 'completed' ? 'text-[#ff4000]' :
                        trans.status === 'pending' ? 'text-orange-500' :
                        'text-[#ff4000]'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {trans.transaction_type?.toUpperCase() || 'TRANSACTION'} #{String(trans.id).slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(trans.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {trans.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {trans.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <p className="text-xl font-bold">
                      {fc(Number(trans.amount))}
                    </p>
                    <Badge variant="outline" className={
                      trans.status === 'completed' ? 'border-[#ff4000]/50 bg-[#ff4000]/10 text-[#ff4000]' :
                      trans.status === 'pending' ? 'border-orange-500/50 bg-orange-500/10 text-orange-500' :
                      'border-[#ff4000]/50 bg-[#ff4000]/10 text-[#ff4000]'
                    }>
                      {trans.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      </TabsContent>
    </Tabs>

      <Dialog open={showMarginDialog} onOpenChange={setShowMarginDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pDGFinance.modifierCommissionFx')}</DialogTitle>
            <DialogDescription>
              Définir la commission (%) appliquée sur le taux de change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Commission en pourcentage</p>
              <Input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={marginPercentInput}
                onChange={(e) => setMarginPercentInput(e.target.value)}
                placeholder="Ex: 3,7"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowMarginDialog(false)} disabled={marginUpdateLoading}>
                Annuler
              </Button>
              <Button type="button" onClick={updateFxMargin} disabled={marginUpdateLoading}>
                {marginUpdateLoading ? 'Mise a jour...' : 'Appliquer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Conversions */}
      <Dialog open={showConversionStatsDialog} onOpenChange={(v) => { setShowConversionStatsDialog(v); if (!v) setConversionTab('overview'); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Globe2 className="w-6 h-6 text-primary" />
              Conversions utilisateurs par pays
            </DialogTitle>
            <DialogDescription>
              Fenêtre {conversionStats?.window_hours || 168}h — {conversionStats?.total_conversions || 0} transfert(s) détecté(s)
            </DialogDescription>
          </DialogHeader>

          {!conversionStats ? (
            <p className="text-sm text-muted-foreground">{t('pDGFinance.aucuneStatistiqueDisponible')}</p>
          ) : (
            <div className="space-y-4 mt-2">
              {/* Sélecteur fenêtre */}
              <div className="flex gap-2 flex-wrap">
                {[24, 72, 168, 720].map((h) => (
                  <button key={h} onClick={() => loadConversionStats(h)}
                    className={`px-3 py-1 rounded text-xs border transition-colors ${(conversionStats?.window_hours || 168) === h ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-border'}`}>
                    {h === 24 ? '24h' : h === 72 ? '3 jours' : h === 168 ? '7 jours' : '30 jours'}
                  </button>
                ))}
              </div>

              {/* Onglets */}
              <div className="flex gap-1 border-b">
                {(['overview', 'transactions', 'rates'] as const).map((tab) => (
                  <button key={tab} onClick={() => setConversionTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${conversionTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    {tab === 'overview' ? 'Vue d\'ensemble' : tab === 'transactions' ? `Transactions (${(conversionStats.transactions || []).length})` : `Taux (${(conversionStats.rate_history || []).length})`}
                  </button>
                ))}
              </div>

              {/* ---- ONG VUE D'ENSEMBLE ---- */}
              {conversionTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card><CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Conversions totales</p>
                      <p className="text-2xl font-bold">{conversionStats.total_conversions || 0}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Internationales</p>
                      <p className="text-2xl font-bold text-blue-600">{conversionStats.international_conversions || 0}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Pays actifs</p>
                      <p className="text-2xl font-bold">{Array.isArray(conversionStats.by_country) ? conversionStats.by_country.length : 0}</p>
                    </CardContent></Card>
                  </div>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Corridors pays vers pays</CardTitle></CardHeader>
                    <CardContent>
                      {!Array.isArray(conversionStats.country_corridors) || conversionStats.country_corridors.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('pDGFinance.aucunCorridorDetecte')}</p>
                      ) : (
                        <div className="max-h-48 overflow-auto space-y-1">
                          {conversionStats.country_corridors.slice(0, 30).map((row: any, idx: number) => (
                            <div key={idx} className="text-xs rounded border p-2 flex justify-between gap-2">
                              <span className="font-medium">{row.from_country} → {row.to_country}</span>
                              <span><span className="font-semibold">{row.conversions_count}</span> conv. {row.total_amount > 0 && <span className="text-muted-foreground ml-1">{Math.round(row.total_amount).toLocaleString('fr-FR')}</span>}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Top utilisateurs</CardTitle></CardHeader>
                    <CardContent>
                      {!Array.isArray(conversionStats.by_user) || conversionStats.by_user.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('pDGFinance.aucunUtilisateur')}</p>
                      ) : (
                        <div className="max-h-48 overflow-auto space-y-1">
                          {conversionStats.by_user.slice(0, 30).map((row: any, idx: number) => (
                            <div key={idx} className="text-xs rounded border p-2 flex justify-between gap-2">
                              <span className="truncate font-medium">{row.user_label} <span className="text-muted-foreground">({row.country || 'Inconnu'})</span></span>
                              <span className="shrink-0 font-semibold">{row.conversions_count} <span className="text-muted-foreground font-normal">{row.total_amount > 0 ? Math.round(row.total_amount).toLocaleString('fr-FR') : ''}</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ---- ONGLET TRANSACTIONS DÉTAILLÉES ---- */}
              {conversionTab === 'transactions' && (
                <div className="space-y-2">
                  {!Array.isArray(conversionStats.transactions) || conversionStats.transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">{t('pDGFinance.aucuneTransactionDansCetteFenetre')}</p>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-auto">
                      {conversionStats.transactions.map((tx: any, idx: number) => {
                        const dateStr = new Date(tx.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
                        const timeStr = new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const isIntl = tx.is_international;
                        const sameAmount = Math.abs(tx.amount_sent - tx.amount_received) < 0.01 && tx.sender_currency === tx.receiver_currency;
                        return (
                          <div key={idx} className={`rounded-lg border p-3 text-xs space-y-2 ${isIntl ? 'border-blue-200 bg-blue-50/40' : 'bg-muted/30'}`}>
                            {/* Ligne 1 : date + ID + badge */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-muted-foreground">{dateStr} {timeStr}</span>
                                {tx.id && <span className="font-mono text-[10px] text-muted-foreground/70 hidden sm:inline">{String(tx.id).slice(0, 16)}</span>}
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${isIntl ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-[#ff4000]'}`}>
                                {isIntl ? 'International' : 'Domestique'}
                              </span>
                            </div>
                            {/* Ligne 2 : expéditeur → destinataire + pays */}
                            <div className="flex items-center gap-1 font-medium">
                              <span className="text-[#ff4000]">{tx.sender_name}</span>
                              <span className="text-muted-foreground">({tx.sender_country})</span>
                              <span className="text-muted-foreground mx-1">→</span>
                              <span className="text-[#ff4000]">{tx.receiver_name}</span>
                              <span className="text-muted-foreground">({tx.receiver_country})</span>
                            </div>
                            {/* Ligne 3 : montants */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="rounded bg-orange-50 border border-orange-100 p-2">
                                <p className="text-[10px] text-muted-foreground">{t('pDGFinance.montantEnvoye')}</p>
                                <p className="font-bold text-[#ff4000]">{Math.round(tx.amount_sent).toLocaleString('fr-FR')} <span className="font-normal">{tx.sender_currency}</span></p>
                              </div>
                              <div className="rounded bg-orange-50 border border-orange-100 p-2">
                                <p className="text-[10px] text-muted-foreground">{t('pDGFinance.montantRecu')}</p>
                                <p className="font-bold text-[#ff4000]">{Math.round(tx.amount_received).toLocaleString('fr-FR')} <span className="font-normal">{tx.receiver_currency}</span></p>
                              </div>
                              {tx.fee_amount > 0 && (
                                <div className="rounded bg-orange-50 border border-orange-100 p-2">
                                  <p className="text-[10px] text-muted-foreground">Frais</p>
                                  <p className="font-semibold text-orange-700">{Math.round(tx.fee_amount).toLocaleString('fr-FR')} <span className="font-normal">{tx.sender_currency}</span></p>
                                </div>
                              )}
                              {isIntl && !sameAmount && (
                                <div className="rounded bg-blue-50 border border-blue-100 p-2">
                                  <p className="text-[10px] text-muted-foreground">{t('pDGFinance.tauxApplique')}</p>
                                  <p className="font-semibold text-blue-700">
                                    {/* rate_used = unités de receiver pour 1 sender. Si < 1, on inverse
                                        le NOMBRE *et* les devises pour rester cohérent (ex. 1 XOF = 15,49 GNF). */}
                                    {tx.rate_used >= 1
                                      ? `1 ${tx.sender_currency} = ${tx.rate_used.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ${tx.receiver_currency}`
                                      : `1 ${tx.receiver_currency} = ${(1 / tx.rate_used).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ${tx.sender_currency}`}
                                  </p>
                                  {tx.rate_source && <p className="text-[10px] text-muted-foreground truncate">{tx.rate_source}</p>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ---- ONGLET HISTORIQUE DES TAUX ---- */}
              {conversionTab === 'rates' && (
                <div className="space-y-2">
                  {!Array.isArray(conversionStats.rate_history) || conversionStats.rate_history.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">{t('pDGFinance.aucunHistoriqueDeTauxDisponible')}<br/><span className="text-xs">{t('pDGFinance.lesTauxSontEnregistresUniquement')}</span></p>
                  ) : (
                    <div className="max-h-[60vh] overflow-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr>
                            <th className="text-left p-2 font-medium">Date</th>
                            <th className="text-left p-2 font-medium">Paire</th>
                            <th className="text-right p-2 font-medium">Taux</th>
                            <th className="text-right p-2 font-medium hidden sm:table-cell">Marge</th>
                            <th className="text-left p-2 font-medium hidden sm:table-cell">Source</th>
                            <th className="text-center p-2 font-medium">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {conversionStats.rate_history.map((r: any, idx: number) => {
                            const dateR = r.retrieved_at || r.effective_date;
                            const dateStr = dateR ? new Date(dateR).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : r.effective_date || '—';
                            const timeStr = r.retrieved_at ? new Date(r.retrieved_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
                            return (
                              <tr key={idx} className={`border-b hover:bg-muted/30 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                <td className="p-2 font-mono">{dateStr} {timeStr}</td>
                                <td className="p-2 font-semibold">{r.from_currency} → {r.to_currency}</td>
                                <td className="p-2 text-right font-mono">{Number(r.rate).toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 8 })}</td>
                                <td className="p-2 text-right hidden sm:table-cell text-muted-foreground">{r.margin != null ? `${(Number(r.margin) * 100).toFixed(1)}%` : '—'}</td>
                                <td className="p-2 text-muted-foreground truncate max-w-[120px] hidden sm:table-cell">{r.source || '—'}</td>
                                <td className="p-2 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.status === 'OK' ? 'bg-orange-100 text-[#ff4000]' : 'bg-orange-100 text-[#ff4000]'}`}>{r.status || '—'}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal des Wallets */}
      <Dialog open={showWalletsDialog} onOpenChange={setShowWalletsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Wallet className="w-6 h-6 text-primary" />
              Détails des Wallets ({wallets?.length || 0})
            </DialogTitle>
            <DialogDescription>
              Liste complète de tous les wallets avec leurs informations détaillées
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {!wallets || wallets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun wallet trouvé
              </div>
            ) : (
              wallets.map((wallet) => (
                <Card key={wallet.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Informations utilisateur */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">
                              {`${wallet.profiles?.first_name || ''} ${wallet.profiles?.last_name || ''}`.trim() ||
                               'Utilisateur'}
                            </h3>
                            <Badge variant="outline" className="mt-1">
                              {wallet.profiles?.role || 'N/A'}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {wallet.profiles?.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Email:</span>
                              <span className="font-medium">{wallet.profiles.email}</span>
                            </div>
                          )}

                          {wallet.profiles?.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">{t('pDGFinance.telephone')}</span>
                              <span className="font-medium">{wallet.profiles.phone}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-sm">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Code ID:</span>
                            <span className="font-mono text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-bold">
                              {wallet.custom_id || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Informations wallet */}
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-[#ff4000]/10 to-transparent border border-[#ff4000]/20">
                          <p className="text-sm text-muted-foreground mb-1">{t('pDGFinance.solde')}</p>
                          <p className="text-3xl font-bold text-[#ff4000]">
                            {Number(wallet.balance).toLocaleString()} {wallet.currency}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Statut:</span>
                            <Badge
                              variant={wallet.wallet_status === 'active' ? 'default' : 'secondary'}
                              className={wallet.wallet_status === 'active' ? 'bg-[#ff4000]' : ''}
                            >
                              {wallet.wallet_status}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{t('pDGFinance.creeLe')}</span>
                            <span className="font-medium">
                              {new Date(wallet.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{t('pDGFinance.misAJour')}</span>
                            <span className="font-medium">
                              {new Date(wallet.updated_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * 🔐 PANNEAU ADMINISTRATION WALLET - PDG
 * Vue complète sur tous les wallets et contrôle admin
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PublicIdBadge } from '@/components/PublicIdBadge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import {
  Wallet,
  Lock,
  Unlock,
  Search,
  AlertTriangle,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Shield,
  RefreshCw
} from 'lucide-react';

interface WalletAdminData {
  id: string;
  public_id: string | null;
  user_id: string;
  balance: number;
  currency: string;
  wallet_status: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  total_received: number;
  total_sent: number;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface AdminStats {
  total_wallets: number;
  total_balance: number;
  transactions_24h: number;
  agent_wallets: number;
  bureau_wallets: number;
}

interface FxHealthData {
  timezone?: string;
  start_of_day_iso?: string;
  stale_threshold_minutes: number;
  is_stale: boolean;
  age_minutes: number | null;
  two_consecutive_failures: boolean;
  configured_margin?: number | null;
  current_rate: {
    from_currency: string;
    to_currency: string;
    rate: number;
    margin: number | null;
    configured_margin?: number | null;
    final_rate_usd?: number | null;
    final_rate_eur?: number | null;
    source?: string | null;
    source_type: string | null;
    source_url: string | null;
    retrieved_at: string | null;
  } | null;
  last_rate: {
    from_currency: string;
    to_currency: string;
    rate: number;
    margin: number | null;
    source_type: string | null;
    source_url: string | null;
    retrieved_at: string | null;
  } | null;
  bank_sources: Array<{
    source: string | null;
    source_type: string | null;
    source_url: string | null;
    last_seen_at: string | null;
  }>;
  today_history: Array<{
    from_currency: string;
    to_currency: string;
    rate: number;
    margin: number | null;
    final_rate_usd?: number | null;
    final_rate_eur?: number | null;
    source_type: string | null;
    source_url: string | null;
    retrieved_at: string | null;
  }>;
  gnf_today_history?: Array<{
    from_currency: string;
    to_currency: string;
    rate: number;
    margin: number | null;
    final_rate_usd?: number | null;
    final_rate_eur?: number | null;
    source_type: string | null;
    source_url: string | null;
    retrieved_at: string | null;
  }>;
  active_alerts: Array<{
    id: string;
    alert_type: string;
    severity: string;
    title: string;
    description: string;
    created_at: string;
  }>;
}

export function WalletAdminPanel() {
  const { t } = useTranslation();
  const [wallets, setWallets] = useState<WalletAdminData[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<WalletAdminData | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [fxHealth, setFxHealth] = useState<FxHealthData | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxRefreshing, setFxRefreshing] = useState(false);
  const [fxMarginUpdating, setFxMarginUpdating] = useState(false);
  const [showFxMarginDialog, setShowFxMarginDialog] = useState(false);
  const [fxMarginPercentInput, setFxMarginPercentInput] = useState('3');
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
    // Affiche l'âge du taux écoulé (MM:SS format)
    const minutes = Math.floor(ageSeconds / 60);
    const seconds = ageSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const displayedFxMargin = typeof fxHealth?.current_rate?.configured_margin === 'number'
    ? fxHealth.current_rate.configured_margin
    : typeof fxHealth?.current_rate?.margin === 'number'
      ? fxHealth.current_rate.margin
      : null;

  useEffect(() => {
    loadWallets();
    loadStats();
    loadFxHealth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadFxHealth = async () => {
    try {
      setFxLoading(true);
      const response = await backendFetch<FxHealthData>('/api/v2/wallet/admin/fx-health', { method: 'GET' });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Impossible de charger le monitoring FX');
      }
      setFxHealth(response.data);
      setFxFetchedAtMs(Date.now());
    } catch (error: any) {
      toast.error(error?.message || 'Erreur chargement monitoring FX');
    } finally {
      setFxLoading(false);
    }
  };

  const handleFxRefresh = async () => {
    try {
      setFxRefreshing(true);
      const response = await backendFetch('/api/v2/wallet/admin/fx-refresh', { method: 'POST' });
      if (!response.success) {
        throw new Error(response.error || 'Refresh FX échoué');
      }
      toast.success(t('walletAdminPanel.collecteDesTauxLanceeAvec'));
      await loadFxHealth();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur refresh FX');
    } finally {
      setFxRefreshing(false);
    }
  };

  const openFxMarginDialog = () => {
    const currentMarginPercent = Number(((displayedFxMargin ?? 0.03) * 100).toFixed(2));
    setFxMarginPercentInput(Number.isFinite(currentMarginPercent) ? String(currentMarginPercent) : '3');
    setShowFxMarginDialog(true);
  };

  const handleFxMarginUpdate = async () => {
    const marginPercent = Number(String(fxMarginPercentInput).replace(',', '.'));
    if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 30) {
      toast.error(t('walletAdminPanel.commissionInvalideEntrezUnPourcentage'));
      return;
    }

    try {
      setFxMarginUpdating(true);
      const response = await backendFetch('/api/v2/wallet/admin/fx-margin', {
        method: 'POST',
        body: { margin_percent: marginPercent },
      });
      if (!response.success) {
        throw new Error(response.error || 'Mise a jour commission FX echouee');
      }

      const nextMarginValue = marginPercent / 100;
      setFxHealth((current) => current ? ({
        ...current,
        configured_margin: nextMarginValue,
        current_rate: current.current_rate
          ? { ...current.current_rate, configured_margin: nextMarginValue }
          : current.current_rate,
      }) : current);

      toast.success(`Commission FX mise a jour: ${marginPercent}%`);
      setShowFxMarginDialog(false);
      void loadFxHealth();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur mise a jour commission FX');
    } finally {
      setFxMarginUpdating(false);
    }
  };

  const loadWallets = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Enrichir avec données profiles
      const enriched = await Promise.all(
        (data || []).map(async (wallet) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', wallet.user_id)
            .single();

          return { ...wallet, profiles: profile };
        })
      );

      setWallets(enriched as any);

    } catch (error: any) {
      console.error('❌ Erreur loadWallets:', error);
      toast.error('Erreur chargement wallets');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Calculer les stats directement depuis la table wallets
      const { data: walletsData, error } = await supabase
        .from('wallets')
        .select('balance, wallet_status');

      if (error) throw error;

      const totalWallets = walletsData?.length || 0;
      const totalBalance = walletsData?.reduce((sum, w) => sum + (w.balance || 0), 0) || 0;

      setStats({
        total_wallets: totalWallets,
        total_balance: totalBalance,
        transactions_24h: 0,
        agent_wallets: 0,
        bureau_wallets: 0
      });

    } catch (error) {
      console.error('❌ Erreur loadStats:', error);
      // Set default stats on error
      setStats({
        total_wallets: wallets.length,
        total_balance: wallets.reduce((sum, w) => sum + (w.balance || 0), 0),
        transactions_24h: 0,
        agent_wallets: 0,
        bureau_wallets: 0
      });
    }
  };

  const handleBlockWallet = async () => {
    if (!selectedWallet || !blockReason) {
      toast.error(t('walletAdminPanel.raisonDeBlocageRequise'));
      return;
    }

    try {
      const { error } = await supabase
        .from('wallets')
        .update({
          is_blocked: true,
          blocked_reason: blockReason,
          blocked_at: new Date().toISOString(),
          wallet_status: 'blocked'
        })
        .eq('id', selectedWallet.id as any);

      if (error) throw error;

      toast.success(t('walletAdminPanel.walletBloqueAvecSucces'));
      setBlockDialogOpen(false);
      setBlockReason('');
      setSelectedWallet(null);
      await loadWallets();

    } catch (_error: any) {
      toast.error('Erreur blocage wallet');
    }
  };

  const handleUnblockWallet = async (walletId: string) => {
    try {
      const { error } = await supabase
        .from('wallets')
        .update({
          is_blocked: false,
          blocked_reason: null,
          blocked_at: null,
          wallet_status: 'active'
        })
        .eq('id', walletId as any);

      if (error) throw error;

      toast.success(t('walletAdminPanel.walletDebloqueAvecSucces'));
      await loadWallets();

    } catch (_error: any) {
      toast.error(t('walletAdminPanel.erreurDeblocageWallet'));
    }
  };

  const filteredWallets = wallets.filter(w => {
    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase();
    return (
      w.public_id?.toLowerCase().includes(term) ||
      w.profiles?.email?.toLowerCase().includes(term) ||
      w.profiles?.first_name?.toLowerCase().includes(term) ||
      w.profiles?.last_name?.toLowerCase().includes(term)
    );
  });

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
    if (!Number.isFinite(parsed)) return typeof fxHealth?.age_minutes === 'number' ? Math.max(0, fxHealth.age_minutes * 60) : null;

    return Math.max(0, Math.floor((clockMs - parsed) / 1000));
  })();

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total_wallets}</p>
                  <p className="text-sm text-muted-foreground">Total Wallets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-[#ff4000]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.agent_wallets}</p>
                  <p className="text-sm text-muted-foreground">Agents</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.bureau_wallets}</p>
                  <p className="text-sm text-muted-foreground">Bureaux</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-[#04439e]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Math.round(stats.total_balance).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('walletAdminPanel.soldeTotalGnf')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liste des wallets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <CardTitle>{t('walletAdminPanel.monitoringTauxDeChange')}</CardTitle>
                {typeof displayedFxMargin === 'number' && (
                  <Badge variant="secondary">
                    Commission: {(displayedFxMargin * 100).toFixed(2)}%
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1">
                Surveillance horaire des taux bancaires africains pour la conversion wallet et marketplace
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={openFxMarginDialog}
                disabled={fxMarginUpdating}
                className="gap-2"
              >
                <DollarSign className="w-4 h-4" />
                {fxMarginUpdating ? 'Mise a jour...' : 'Modifier commission'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFxRefresh}
                disabled={fxRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${fxRefreshing ? 'animate-spin' : ''}`} />
                Rafraîchir les taux
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {fxLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-7 h-7 animate-spin text-muted-foreground" />
            </div>
          ) : !fxHealth ? (
            <div className="text-sm text-muted-foreground">Monitoring FX indisponible.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('walletAdminPanel.fraicheurDesTaux')}</p>
                  <p className="text-lg font-semibold">
                    {formatRateAgeCountdown(liveRateAgeSeconds)}
                  </p>
                  <Badge variant={fxHealth.is_stale ? 'destructive' : 'default'} className="mt-1">
                    {fxHealth.is_stale ? 'Taux obsolètes' : 'Taux à jour'}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('walletAdminPanel.collecteConsecutive')}</p>
                  <p className="text-lg font-semibold">
                    {fxHealth.two_consecutive_failures ? '2 échecs détectés' : 'Stable'}
                  </p>
                  <Badge variant={fxHealth.two_consecutive_failures ? 'destructive' : 'secondary'} className="mt-1">
                    {fxHealth.two_consecutive_failures ? 'Alerte critique' : 'Normal'}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Taux officiel BCRG</p>
                  <p className="text-lg font-semibold">
                    {typeof fxHealth.current_rate?.rate === 'number'
                      ? fxHealth.current_rate.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fxHealth.current_rate
                      ? `${fxHealth.current_rate.from_currency}/${fxHealth.current_rate.to_currency}`
                      : 'Paire indisponible'}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Marge active</p>
                  <p className="text-lg font-semibold">
                    {typeof displayedFxMargin === 'number'
                      ? `${(displayedFxMargin * 100).toFixed(2)}%`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Source: {fxHealth.current_rate?.source_type || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2">{t('walletAdminPanel.sourcesBancairesVisitees')}</p>
                {fxHealth.bank_sources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('walletAdminPanel.aucuneSourceBancaireTrouvee')}</p>
                ) : (
                  <div className="space-y-1">
                    {fxHealth.bank_sources.slice(0, 6).map((source, idx) => (
                      <div key={`${source.source_url}-${idx}`} className="text-xs flex items-center justify-between gap-3">
                        <span className="truncate">{source.source || source.source_type || 'source'}</span>
                        <span className="text-muted-foreground truncate">{source.source_url || source.source || source.source_type || 'Source N/A'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2">Fuseau horaire</p>
                <p className="text-xs text-muted-foreground">
                  {fxHealth.timezone || 'Africa/Conakry'} (normalisé backend)
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2">{t('walletAdminPanel.historiqueDeviseGuineeGnf')}</p>
                {!fxHealth.gnf_today_history || fxHealth.gnf_today_history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('walletAdminPanel.aucunTauxGnfCollecteAujourd')}</p>
                ) : (
                  <div className="max-h-48 overflow-auto space-y-1">
                    {fxHealth.gnf_today_history.slice(0, 20).map((rate, idx) => (
                      <div key={`${rate.retrieved_at || 'na'}-${idx}`} className="text-xs rounded border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{rate.from_currency}/{rate.to_currency}</span>
                          <span>
                            {typeof rate.rate === 'number'
                              ? rate.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {formatConakryTime(rate.retrieved_at)} {' • '} {rate.source_url || rate.source_type || 'Source N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2">{t('walletAdminPanel.historiqueDuTauxAujourdHui')}</p>
                {fxHealth.today_history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('walletAdminPanel.aucunTauxCollecteAujourdHui')}</p>
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

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2">Alertes FX actives</p>
                {fxHealth.active_alerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('walletAdminPanel.aucuneAlerteActive')}</p>
                ) : (
                  <div className="space-y-2">
                    {fxHealth.active_alerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-start gap-2 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-[#ff4000]" />
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-muted-foreground">{alert.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Gestion des Wallets
              </CardTitle>
              <CardDescription>
                Vue complète et contrôle de tous les wallets du système
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadWallets();
                loadStats();
                loadFxHealth();
              }}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Recherche */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('walletAdminPanel.rechercherParIdNomEmail')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tableau wallets */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWallets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p>{t('walletAdminPanel.aucunWalletTrouve')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredWallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  {/* ID et utilisateur */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {wallet.public_id && (
                        <PublicIdBadge
                          publicId={wallet.public_id}
                          variant="secondary"
                          size="sm"
                        />
                      )}
                      <p className="font-medium truncate">
                        {wallet.profiles?.first_name} {wallet.profiles?.last_name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {wallet.profiles?.email}
                    </p>
                  </div>

                  {/* Solde */}
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {wallet.balance.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {wallet.currency}
                    </p>
                  </div>

                  {/* Statut */}
                  <div className="w-24">
                    {wallet.is_blocked ? (
                      <Badge variant="destructive" className="gap-1 w-full justify-center">
                        <Lock className="w-3 h-3" />
                        Bloqué
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1 w-full justify-center bg-[#ff4000]">
                        Actif
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {wallet.is_blocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnblockWallet(wallet.id)}
                        className="gap-2"
                      >
                        <Unlock className="w-4 h-4" />
                        Débloquer
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedWallet(wallet);
                          setBlockDialogOpen(true);
                        }}
                        className="gap-2"
                      >
                        <Lock className="w-4 h-4" />
                        Bloquer
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showFxMarginDialog} onOpenChange={setShowFxMarginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('walletAdminPanel.modifierCommissionFx')}</DialogTitle>
            <DialogDescription>
              Saisissez le pourcentage de commission à appliquer au taux.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Commission (%)</label>
              <Input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={fxMarginPercentInput}
                onChange={(e) => setFxMarginPercentInput(e.target.value)}
                className="mt-2"
                placeholder="Ex: 3,7"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowFxMarginDialog(false)}
                disabled={fxMarginUpdating}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleFxMarginUpdate}
                disabled={fxMarginUpdating}
              >
                {fxMarginUpdating ? 'Mise a jour...' : 'Appliquer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog blocage */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('walletAdminPanel.bloquerLeWallet')}</DialogTitle>
            <DialogDescription>
              Cette action bloquera toutes les opérations sur ce wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedWallet && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  {selectedWallet.public_id && (
                    <PublicIdBadge publicId={selectedWallet.public_id} size="sm" />
                  )}
                  <p className="font-medium">
                    {selectedWallet.profiles?.first_name} {selectedWallet.profiles?.last_name}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Solde: {selectedWallet.balance.toLocaleString()} {selectedWallet.currency}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">{t('walletAdminPanel.raisonDuBlocage')}</label>
              <Input
                placeholder={t('walletAdminPanel.exActiviteSuspecteFraudeDetectee')}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setBlockDialogOpen(false);
                  setBlockReason('');
                  setSelectedWallet(null);
                }}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={handleBlockWallet}
                disabled={!blockReason}
              >
                <Lock className="w-4 h-4" />
                Confirmer le blocage
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WalletAdminPanel;

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  Shield,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  AlertOctagon,
  RefreshCw,
  Lock,
  Unlock,
  Eye,
  Activity,
  DollarSign,
  Users,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface DashboardData {
  panic_mode_active: boolean;
  total_balance: {
    wallets: number;
    agent_wallets: number;
    bureau_wallets: number;
    total: number;
  };
  pending_quarantine: number;
  unread_alerts: number;
  today_stats: {
    transactions: number;
    volume: number;
    successful: number;
    failed: number;
    quarantined: number;
  };
  generated_at: string;
}

interface FinancialAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  related_transaction_id: string | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

interface QuarantinedTransaction {
  id: string;
  original_transaction_id: string;
  actor_id: string;
  actor_type: string;
  amount: number;
  quarantine_reason: string;
  risk_score: number;
  status: string;
  created_at: string;
}

interface LedgerEntry {
  id: string;
  transaction_id: string;
  actor_type: string;
  amount: number;
  transaction_type: string;
  balance_before_debit: number | null;
  balance_after_debit: number | null;
  balance_before_credit: number | null;
  balance_after_credit: number | null;
  validation_status: string;
  created_at: string;
  ledger_hash: string;
}

const BankingDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);
  const [quarantine, setQuarantine] = useState<QuarantinedTransaction[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [panicReason, setPanicReason] = useState('');
  const [showPanicDialog, setShowPanicDialog] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // Load dashboard stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_pdg_financial_dashboard');

      if (statsError) throw statsError;
      setDashboardData(statsData as unknown as DashboardData);

      // Load alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('pdg_financial_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!alertsError && alertsData) {
        setAlerts(alertsData as FinancialAlert[]);
      }

      // Load quarantine
      const { data: quarantineData, error: quarantineError } = await supabase
        .from('financial_quarantine')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!quarantineError && quarantineData) {
        setQuarantine(quarantineData as QuarantinedTransaction[]);
      }

      // Load recent ledger entries
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('financial_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!ledgerError && ledgerData) {
        setLedger(ledgerData as LedgerEntry[]);
      }

    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      toast.error(t('bankingDashboard.erreurDeChargementDuTableau'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    // Refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const activatePanicMode = async () => {
    if (!user?.id || !panicReason.trim()) {
      toast.error(t('bankingDashboard.veuillezFournirUneRaison'));
      return;
    }

    try {
      const { data, error } = await supabase.rpc('activate_panic_mode', {
        p_pdg_id: user.id,
        p_reason: panicReason
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string };
      if (result.success) {
        toast.success(t('bankingDashboard.modePanicActiveToutesLes'));
        setShowPanicDialog(false);
        setPanicReason('');
        loadDashboard();
      } else {
        toast.error(result.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deactivatePanicMode = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc('deactivate_panic_mode', {
        p_pdg_id: user.id
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string };
      if (result.success) {
        toast.success(t('bankingDashboard.modePanicDesactiveTransactionsAutorisees'));
        loadDashboard();
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const markAlertRead = async (alertId: string) => {
    try {
      await supabase
        .from('pdg_financial_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    } catch (error) {
      console.error('Error marking alert read:', error);
    }
  };

  const handleQuarantineAction = async (id: string, action: 'approved' | 'rejected') => {
    try {
      await supabase
        .from('financial_quarantine')
        .update({
          status: action,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      toast.success(action === 'approved' ? 'Transaction approuvée' : 'Transaction rejetée');
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const formatAmount = useFormatCurrency();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'emergency': return 'bg-[#ff4000]';
      case 'critical': return 'bg-orange-500';
      case 'warning': return 'bg-[#ff4000]';
      default: return 'bg-blue-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <Badge className="bg-[#ff4000]">{t('bankingDashboard.confirme')}</Badge>;
      case 'pending': return <Badge className="bg-[#ff4000]">En attente</Badge>;
      case 'quarantined': return <Badge className="bg-orange-500">Quarantaine</Badge>;
      case 'rejected': return <Badge variant="destructive">{t('bankingDashboard.rejete')}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec Mode Panic */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Système Bancaire Intelligent
          </h1>
          <p className="text-muted-foreground">{t('bankingDashboard.supervisionFinanciereEnTempsReel')}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>

          {dashboardData?.panic_mode_active ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="animate-pulse">
                  <Lock className="h-4 w-4 mr-2" />
                  MODE PANIC ACTIF
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('bankingDashboard.desactiverLeModePanic')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Les transactions financières seront à nouveau autorisées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('bankingDashboard.annuler')}</AlertDialogCancel>
                  <AlertDialogAction onClick={deactivatePanicMode}>
                    <Unlock className="h-4 w-4 mr-2" />
                    Désactiver
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog open={showPanicDialog} onOpenChange={setShowPanicDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-[#ff4000] text-[#ff4000] hover:bg-[#ff4000] hover:text-white">
                  <AlertOctagon className="h-4 w-4 mr-2" />
                  Mode Panic
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-[#ff4000]">{t('bankingDashboard.activerLeModePanic')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    ATTENTION: Toutes les transactions financières seront immédiatement gelées.
                    Cette action est réservée aux situations d'urgence uniquement.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder={t('bankingDashboard.raisonDeLActivationDu')}
                  value={panicReason}
                  onChange={(e) => setPanicReason(e.target.value)}
                  className="my-4"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('bankingDashboard.annuler')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={activatePanicMode}
                    className="bg-[#ff4000] hover:bg-[#ff4000]"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Activer Mode Panic
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Alertes critiques */}
      {dashboardData?.panic_mode_active && (
        <Card className="border-[#ff4000] bg-orange-50 dark:bg-[#ff4000]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertOctagon className="h-8 w-8 text-[#ff4000]" />
              <div>
                <p className="font-bold text-[#ff4000]">{t('bankingDashboard.systemeEnModePanic')}</p>
                <p className="text-sm text-[#ff4000]">{t('bankingDashboard.toutesLesTransactionsFinancieresSont')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Solde Total Plateforme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(dashboardData?.total_balance?.total || 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <div>Wallets: {formatAmount(dashboardData?.total_balance?.wallets || 0)}</div>
              <div>Agents: {formatAmount(dashboardData?.total_balance?.agent_wallets || 0)}</div>
              <div>Bureaux: {formatAmount(dashboardData?.total_balance?.bureau_wallets || 0)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#ff4000]" />
              Transactions Aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.today_stats?.transactions || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-[#ff4000]" />
                {dashboardData?.today_stats?.successful || 0} réussies
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-[#ff4000]" />
                {dashboardData?.today_stats?.failed || 0} échouées
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              Volume Aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(dashboardData?.today_stats?.volume || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className={dashboardData?.pending_quarantine ? 'border-orange-500' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              En Quarantaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.pending_quarantine || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {dashboardData?.unread_alerts || 0} alertes non lues
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertes
            {(dashboardData?.unread_alerts || 0) > 0 && (
              <Badge variant="destructive" className="ml-1">{dashboardData?.unread_alerts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="quarantine" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Quarantaine
            {(dashboardData?.pending_quarantine || 0) > 0 && (
              <Badge className="bg-orange-500 ml-1">{dashboardData?.pending_quarantine}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('bankingDashboard.alertesFinancieres')}</CardTitle>
              <CardDescription>{t('bankingDashboard.notificationsDeSecuriteEtAnomalies')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {alerts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t('bankingDashboard.aucuneAlerte')}</p>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-lg border ${!alert.is_read ? 'bg-muted/50' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(alert.severity)}`} />
                            <div>
                              <p className="font-medium">{alert.title}</p>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(alert.created_at).toLocaleString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          {!alert.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAlertRead(alert.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarantine" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Transactions en Quarantaine</CardTitle>
              <CardDescription>{t('bankingDashboard.transactionsSuspectesEnAttenteDe')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {quarantine.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t('bankingDashboard.aucuneTransactionEnQuarantaine')}</p>
                ) : (
                  <div className="space-y-4">
                    {quarantine.map((tx) => (
                      <div key={tx.id} className="p-4 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{tx.original_transaction_id}</p>
                              <Badge className="bg-orange-500">Score: {tx.risk_score}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{tx.quarantine_reason}</p>
                            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">{t('bankingDashboard.montant')}</span>
                                <span className="ml-2 font-medium">{formatAmount(tx.amount)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Type:</span>
                                <span className="ml-2">{tx.actor_type}</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(tx.created_at).toLocaleString('fr-FR')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[#ff4000] border-[#ff4000]"
                              onClick={() => handleQuarantineAction(tx.id, 'approved')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approuver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[#ff4000] border-[#ff4000]"
                              onClick={() => handleQuarantineAction(tx.id, 'rejected')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Rejeter
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ledger Financier Immuable</CardTitle>
              <CardDescription>{t('bankingDashboard.historiqueCompletDesTransactionsSource')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {ledger.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t('bankingDashboard.aucuneEntreeDansLeLedger')}</p>
                ) : (
                  <div className="space-y-2">
                    {ledger.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-sm">{entry.transaction_id}</p>
                                {getStatusBadge(entry.validation_status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {entry.transaction_type} • {entry.actor_type}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatAmount(entry.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        {(entry.balance_before_debit !== null || entry.balance_before_credit !== null) && (
                          <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-4 text-xs">
                            {entry.balance_before_debit !== null && (
                              <div>
                                <span className="text-muted-foreground">{t('bankingDashboard.debit')}</span>
                                <span className="ml-1">{formatAmount(entry.balance_before_debit)} → {formatAmount(entry.balance_after_debit || 0)}</span>
                              </div>
                            )}
                            {entry.balance_before_credit !== null && (
                              <div>
                                <span className="text-muted-foreground">{t('bankingDashboard.credit')}</span>
                                <span className="ml-1">{formatAmount(entry.balance_before_credit)} → {formatAmount(entry.balance_after_credit || 0)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
                          Hash: {entry.ledger_hash.substring(0, 32)}...
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BankingDashboard;

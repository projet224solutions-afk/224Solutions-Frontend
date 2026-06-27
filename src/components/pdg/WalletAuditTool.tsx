/**
 * 🔐 OUTIL D'AUDIT WALLET COMPLET
 * Permet au PDG de diagnostiquer, vérifier et corriger les wallets
 */

import { useState, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Search,
  Wallet,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wrench,
  Activity,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  Plus,
  FileText,
  Eye,
  Clock,
  AlertCircle,
  CreditCard,
  Key,
  Zap,
  BarChart3,
  Users,
  ListChecks,
  Ban,
  ShieldX,
  XOctagon,
  CalendarX
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WalletIssue {
  type: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  details?: any;
  canAutoFix: boolean;
}

interface ApiSignatureCheck {
  api: string;
  status: 'valid' | 'invalid' | 'unknown' | 'expired';
  lastChecked: string;
  details?: string;
}

interface AuditResult {
  success: boolean;
  walletFound: boolean;
  wallet: any;
  transactions: any[];
  issues: WalletIssue[];
  calculatedBalance: number;
  storedBalance: number;
  balanceDifference: number;
  isBalanceCorrect: boolean;
  apiSignatures: ApiSignatureCheck[];
  recommendations: string[];
  logs: any[];
  suspiciousActivities: any[];
  reconciliationHistory: any[];
  paymentMethods: any[];
  summary: {
    totalIncoming: number;
    totalOutgoing: number;
    expectedBalance: number;
    actualBalance: number;
    transactionCount: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingTransactions: number;
    lastActivity: string | null;
    walletAge: number;
    healthScore: number;
  };
}

interface GlobalStats {
  totalUsers: number;
  totalWallets: number;
  usersWithoutWalletCount: number;
  problematicWalletsCount: number;
  unresolvedSuspiciousCount: number;
}

interface BatchActionResult {
  success: boolean;
  message: string;
  stats: {
    total?: number;
    reconciled?: number;
    created?: number;
    skipped?: number;
    errors?: number;
    totalMissing?: number;
  };
  results: any[];
}

export function WalletAuditTool() {
  const { t } = useTranslation();
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [usersWithoutWallet, setUsersWithoutWallet] = useState<any[]>([]);
  const [problematicWallets, setProblematicWallets] = useState<any[]>([]);
  const [apiSignatures, setApiSignatures] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('search');
  const [batchResult, setBatchResult] = useState<BatchActionResult | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [userSubscriptions, setUserSubscriptions] = useState<any>(null);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showSubscriptionsDialog, setShowSubscriptionsDialog] = useState(false);

  const fc = useFormatCurrency();
  const formatAmount = (amount: number, currency = 'GNF') => fc(amount, currency);

  // Audit d'un wallet spécifique
  const auditWallet = useCallback(async (customId?: string) => {
    const idToUse = customId || searchId.trim().toUpperCase();
    if (!idToUse) {
      toast.error(t('walletAuditTool.veuillezEntrerUnIdUtilisateur'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: { action: 'audit', customId: idToUse }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAuditResult(data);
      toast.success(`Audit terminé pour ${idToUse}`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'audit');
      console.error('Audit error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchId]);

  // Charger les stats globales
  const loadGlobalStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: { action: 'get-all-wallets' }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGlobalStats(data.stats);
      setUsersWithoutWallet(data.usersWithoutWallet || []);
      setProblematicWallets(data.problematicWallets || []);
      toast.success(t('walletAuditTool.statistiquesChargees'));
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  // Vérifier les signatures API
  const verifySignatures = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: { action: 'verify-signatures' }
      });

      if (error) throw error;
      setApiSignatures(data);
      toast.success(t('walletAuditTool.signaturesVerifiees'));
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  }, []);

  // Réconcilier le solde
  const reconcileBalance = useCallback(async () => {
    if (!auditResult?.wallet) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: { action: 'reconcile', userId: auditResult.wallet.user_id }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data.error);

      toast.success(`Solde réconcilié: ${formatAmount(data.oldBalance)} → ${formatAmount(data.newBalance)}`);
      // Recharger l'audit
      await auditWallet();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la réconciliation');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditResult, auditWallet]);

  // Débloquer un wallet
  const unblockWallet = useCallback(async () => {
    if (!auditResult?.wallet) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: { action: 'fix', userId: auditResult.wallet.user_id, fixAction: 'unblock' }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data.error);

      toast.success(t('walletAuditTool.walletDebloque'));
      await auditWallet();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du déblocage');
    } finally {
      setLoading(false);
    }
  }, [auditResult, auditWallet]);

  // Activer un wallet
  const activateWallet = useCallback(async () => {
    if (!auditResult?.wallet) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: { action: 'fix', userId: auditResult.wallet.user_id, fixAction: 'activate' }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data.error);

      toast.success(t('walletAuditTool.walletActive'));
      await auditWallet();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'activation');
    } finally {
      setLoading(false);
    }
  }, [auditResult, auditWallet]);

  // Créer un wallet manquant
  const createWallet = useCallback(async (customId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: { action: 'create-wallet', customId }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data.error);

      toast.success(`Wallet créé pour ${customId}`);
      await loadGlobalStats();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }, [loadGlobalStats]);

  // Réconcilier tous les wallets
  const reconcileAllWallets = useCallback(async () => {
    setActionLoading('reconcile-all');
    setBatchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: { action: 'reconcile-all' }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data.error);

      setBatchResult(data);
      toast.success(`Réconciliation terminée: ${data.stats.reconciled} wallets corrigés`);
      await loadGlobalStats();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la réconciliation');
    } finally {
      setActionLoading(null);
    }
  }, [loadGlobalStats]);

  // Créer tous les wallets manquants
  const createAllMissingWallets = useCallback(async () => {
    setActionLoading('create-all');
    setBatchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: { action: 'create-all-missing-wallets' }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data.error);

      setBatchResult(data);
      toast.success(`${data.stats.created} wallets créés`);
      await loadGlobalStats();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setActionLoading(null);
    }
  }, [loadGlobalStats]);

  // Bloquer un wallet
  const blockWallet = useCallback(async (reason?: string) => {
    if (!auditResult?.wallet) return;

    setActionLoading('block');
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: {
          action: 'block-wallet',
          userId: auditResult.wallet.user_id,
          reason: reason || blockReason || 'Blocage de sécurité'
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data.error);

      toast.success(t('walletAuditTool.walletBloqueAvecSucces'));
      setShowBlockDialog(false);
      setBlockReason('');
      await auditWallet();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du blocage');
    } finally {
      setActionLoading(null);
    }
  }, [auditResult, auditWallet, blockReason]);

  // Débloquer un wallet (déjà existant dans unblockWallet)

  // Charger les abonnements d'un utilisateur
  const loadUserSubscriptions = useCallback(async () => {
    if (!auditResult?.wallet) return;

    setActionLoading('subscriptions');
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: {
          action: 'get-user-subscriptions',
          userId: auditResult.wallet.user_id
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data.error);

      setUserSubscriptions(data);
      setShowSubscriptionsDialog(true);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des abonnements');
    } finally {
      setActionLoading(null);
    }
  }, [auditResult]);

  // Annuler un abonnement
  const cancelSubscription = useCallback(async (subscriptionId: string) => {
    if (!auditResult?.wallet) return;

    setActionLoading(`cancel-${subscriptionId}`);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-audit', {
        body: {
          action: 'cancel-subscription',
          userId: auditResult.wallet.user_id,
          subscriptionId,
          reason: cancelReason || 'Annulation par administrateur'
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data.error);

      toast.success(t('walletAuditTool.abonnementAnnuleAvecSucces'));
      setCancelReason('');
      // Recharger les abonnements
      await loadUserSubscriptions();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'annulation');
    } finally {
      setActionLoading(null);
    }
  }, [auditResult, cancelReason, loadUserSubscriptions]);

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'critical': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-[#ff4000]" />;
      default: return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSignatureStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-orange-100 text-[#ff4000]';
      case 'invalid': return 'bg-orange-100 text-[#ff4000]';
      case 'expired': return 'bg-orange-100 text-[#ff4000]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête et onglets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Audit & Diagnostic Wallet Complet
          </CardTitle>
          <CardDescription>
            Vérifiez, diagnostiquez et corrigez les problèmes de wallet des utilisateurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="search" className="gap-1">
                <Search className="h-4 w-4" />
                Recherche
              </TabsTrigger>
              <TabsTrigger value="global" className="gap-1">
                <BarChart3 className="h-4 w-4" />
                Vue Globale
              </TabsTrigger>
              <TabsTrigger value="signatures" className="gap-1">
                <Key className="h-4 w-4" />
                API Signatures
              </TabsTrigger>
              <TabsTrigger value="issues" className="gap-1">
                <AlertTriangle className="h-4 w-4" />
                Problèmes
              </TabsTrigger>
            </TabsList>

            {/* Onglet Recherche */}
            <TabsContent value="search" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Entrez l'ID (ex: VND0001, CLT0002)..."
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && auditWallet()}
                  className="font-mono"
                />
                <Button onClick={() => auditWallet()} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Auditer
                </Button>
              </div>

              {/* Résultats de l'audit */}
              {auditResult && (
                <div className="space-y-4">
                  {/* Score de santé */}
                  <Card className={`border-2 ${
                    auditResult.summary.healthScore >= 80 ? 'border-[#ff4000]' :
                    auditResult.summary.healthScore >= 50 ? 'border-[#ff4000]' : 'border-[#ff4000]'
                  }`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-full ${
                            auditResult.summary.healthScore >= 80 ? 'bg-orange-100' :
                            auditResult.summary.healthScore >= 50 ? 'bg-orange-100' : 'bg-orange-100'
                          }`}>
                            <Wallet className={`h-6 w-6 ${
                              auditResult.summary.healthScore >= 80 ? 'text-[#ff4000]' :
                              auditResult.summary.healthScore >= 50 ? 'text-[#ff4000]' : 'text-[#ff4000]'
                            }`} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold">Score de Santé: {auditResult.summary.healthScore}%</h3>
                            <p className="text-sm text-muted-foreground">
                              {auditResult.walletFound ? 'Wallet trouvé' : 'Aucun wallet'}
                            </p>
                          </div>
                        </div>
                        <Progress value={auditResult.summary.healthScore} className="w-32" />
                      </div>

                      {/* Stats rapides */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold text-[#ff4000]">
                            {formatAmount(auditResult.storedBalance)}
                          </p>
                          <p className="text-xs text-muted-foreground">{t('walletAuditTool.soldeActuel')}</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold">
                            {formatAmount(auditResult.calculatedBalance)}
                          </p>
                          <p className="text-xs text-muted-foreground">{t('walletAuditTool.soldeCalcule')}</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className={`text-2xl font-bold ${
                            auditResult.isBalanceCorrect ? 'text-[#ff4000]' : 'text-[#ff4000]'
                          }`}>
                            {auditResult.isBalanceCorrect ? '✓' : formatAmount(auditResult.balanceDifference)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {auditResult.isBalanceCorrect ? 'Solde correct' : 'Divergence'}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold">{auditResult.summary.transactionCount}</p>
                          <p className="text-xs text-muted-foreground">Transactions</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Problèmes détectés */}
                  {auditResult.issues.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-[#ff4000]" />
                          Problèmes Détectés ({auditResult.issues.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {auditResult.issues.map((issue, idx) => (
                            <Alert key={idx} variant={issue.type === 'critical' ? 'destructive' : 'default'}>
                              <div className="flex items-start gap-2">
                                {getIssueIcon(issue.type)}
                                <div className="flex-1">
                                  <AlertTitle className="flex items-center gap-2">
                                    {issue.code}
                                    <Badge variant="outline" className="text-xs">
                                      {issue.type}
                                    </Badge>
                                  </AlertTitle>
                                  <AlertDescription>{issue.message}</AlertDescription>
                                  {issue.details && (
                                    <details className="mt-2">
                                      <summary className="text-xs cursor-pointer text-primary">{t('walletAuditTool.details')}</summary>
                                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                        {JSON.stringify(issue.details, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                                {issue.canAutoFix && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (issue.code === 'BALANCE_MISMATCH') reconcileBalance();
                                      else if (issue.code === 'WALLET_BLOCKED') unblockWallet();
                                      else if (issue.code === 'WALLET_INACTIVE') activateWallet();
                                      else if (issue.code === 'WALLET_MISSING') createWallet(searchId);
                                    }}
                                    disabled={loading}
                                  >
                                    <Wrench className="h-3 w-3 mr-1" />
                                    Corriger
                                  </Button>
                                )}
                              </div>
                            </Alert>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Actions de correction */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('walletAuditTool.actionsDeCorrection')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {!auditResult.isBalanceCorrect && auditResult.walletFound && (
                          <Button onClick={reconcileBalance} disabled={loading} variant="outline">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Réconcilier le solde
                          </Button>
                        )}
                        {auditResult.wallet?.is_blocked && (
                          <Button onClick={unblockWallet} disabled={loading} variant="outline">
                            <Unlock className="h-4 w-4 mr-2" />
                            Débloquer le wallet
                          </Button>
                        )}
                        {auditResult.wallet?.wallet_status !== 'active' && auditResult.walletFound && (
                          <Button onClick={activateWallet} disabled={loading} variant="outline">
                            <Zap className="h-4 w-4 mr-2" />
                            Activer le wallet
                          </Button>
                        )}
                        {!auditResult.walletFound && (
                          <Button onClick={() => createWallet(searchId)} disabled={loading}>
                            <Plus className="h-4 w-4 mr-2" />
                            Créer le wallet
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions de sécurité */}
                  {auditResult.walletFound && (
                    <Card className="border-destructive/30">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ShieldX className="h-5 w-5 text-destructive" />
                          Mesures de Sécurité
                        </CardTitle>
                        <CardDescription>
                          Actions restrictives pour protéger l'utilisateur ou la plateforme
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Blocage/Déblocage Wallet */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                auditResult.wallet?.wallet_status === 'blocked'
                                  ? 'bg-orange-100'
                                  : 'bg-orange-100'
                              }`}>
                                {auditResult.wallet?.wallet_status === 'blocked' ? (
                                  <Lock className="h-5 w-5 text-[#ff4000]" />
                                ) : (
                                  <Unlock className="h-5 w-5 text-[#ff4000]" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">
                                  Statut: {auditResult.wallet?.wallet_status === 'blocked' ? 'Bloqué' : 'Actif'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {auditResult.wallet?.wallet_status === 'blocked'
                                    ? 'L\'utilisateur ne peut pas effectuer de transactions'
                                    : 'Le wallet fonctionne normalement'
                                  }
                                </p>
                              </div>
                            </div>
                            {auditResult.wallet?.wallet_status === 'blocked' ? (
                              <Button
                                onClick={unblockWallet}
                                disabled={actionLoading === 'unblock'}
                                variant="outline"
                                className="border-[#ff4000] text-[#ff4000] hover:bg-orange-50"
                              >
                                {actionLoading === 'unblock' ? (
                                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Unlock className="h-4 w-4 mr-2" />
                                )}
                                Débloquer
                              </Button>
                            ) : (
                              <Button
                                onClick={() => setShowBlockDialog(true)}
                                disabled={actionLoading === 'block'}
                                variant="destructive"
                              >
                                {actionLoading === 'block' ? (
                                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Ban className="h-4 w-4 mr-2" />
                                )}
                                Bloquer
                              </Button>
                            )}
                          </div>

                          {/* Dialog de blocage */}
                          {showBlockDialog && (
                            <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5 space-y-3">
                              <div className="flex items-center gap-2 text-destructive">
                                <XOctagon className="h-5 w-5" />
                                <span className="font-medium">Bloquer ce wallet</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Cette action empêchera l'utilisateur d'effectuer des transactions.
                                Une notification sera envoyée.
                              </p>
                              <Input
                                placeholder={t('walletAuditTool.raisonDuBlocageObligatoire')}
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                className="border-destructive/50"
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setShowBlockDialog(false);
                                    setBlockReason('');
                                  }}
                                >
                                  Annuler
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => blockWallet()}
                                  disabled={!blockReason.trim() || actionLoading === 'block'}
                                >
                                  {actionLoading === 'block' ? (
                                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Ban className="h-4 w-4 mr-2" />
                                  )}
                                  Confirmer le blocage
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        <Separator />

                        {/* Gestion des abonnements */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-blue-100">
                              <CreditCard className="h-5 w-5 text-[#04439e]" />
                            </div>
                            <div>
                              <p className="font-medium">Abonnements</p>
                              <p className="text-sm text-muted-foreground">
                                Gérer ou annuler les abonnements de l'utilisateur
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={loadUserSubscriptions}
                            disabled={actionLoading === 'subscriptions'}
                          >
                            {actionLoading === 'subscriptions' ? (
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Eye className="h-4 w-4 mr-2" />
                            )}
                            Voir les abonnements
                          </Button>
                        </div>

                        {/* Dialog des abonnements */}
                        {showSubscriptionsDialog && userSubscriptions && (
                          <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CalendarX className="h-5 w-5 text-primary" />
                                <span className="font-medium">
                                  Abonnements ({userSubscriptions.stats?.total || 0})
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSubscriptionsDialog(false)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div className="text-center p-2 bg-background rounded">
                                <p className="text-xl font-bold text-[#ff4000]">
                                  {userSubscriptions.stats?.active || 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Actifs</p>
                              </div>
                              <div className="text-center p-2 bg-background rounded">
                                <p className="text-xl font-bold text-destructive">
                                  {userSubscriptions.stats?.expired || 0}
                                </p>
                                <p className="text-xs text-muted-foreground">{t('walletAuditTool.expires')}</p>
                              </div>
                              <div className="text-center p-2 bg-background rounded">
                                <p className="text-xl font-bold text-blue-600">
                                  {userSubscriptions.stats?.paymentsCount || userSubscriptions.payments?.length || 0}
                                </p>
                                <p className="text-xs text-muted-foreground">{t('walletAuditTool.paiements')}</p>
                              </div>
                            </div>

                            {userSubscriptions.subscriptions?.all?.length > 0 ? (
                              <ScrollArea className="h-[280px]">
                                <div className="space-y-3">
                                  {userSubscriptions.subscriptions.all.map((sub: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="p-3 bg-background rounded-lg border"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <Badge variant={sub._status === 'active' ? 'default' : 'secondary'}>
                                            {sub._type}
                                          </Badge>
                                          <Badge variant={sub._status === 'active' ? 'outline' : 'destructive'}>
                                            {sub._status || sub.status}
                                          </Badge>
                                        </div>
                                        {(sub._status === 'active' || sub.status === 'active') && (
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => cancelSubscription(sub.id)}
                                            disabled={actionLoading === `cancel-${sub.id}`}
                                          >
                                            {actionLoading === `cancel-${sub.id}` ? (
                                              <RefreshCw className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <XCircle className="h-3 w-3 mr-1" />
                                            )}
                                            Annuler
                                          </Button>
                                        )}
                                      </div>

                                      <p className="text-sm font-medium">
                                        {sub._plan_name || sub.plans?.display_name || sub.plans?.name || sub.service_plans?.name || 'Abonnement'}
                                      </p>

                                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          <span>Expire:</span>
                                          <span className={sub._is_expired ? 'text-destructive font-medium' : (sub._is_unlimited ? 'text-[#ff4000] font-medium' : 'font-medium')}>
                                            {sub._is_unlimited
                                              ? '∞ Illimité'
                                              : (sub._end_date
                                                  ? format(new Date(sub._end_date), 'dd/MM/yyyy HH:mm')
                                                  : 'Non définie'
                                                )
                                            }
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                          <CreditCard className="h-3 w-3" />
                                          <span>{t('walletAuditTool.paiement')}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {sub._payment_method || sub.payment_method || 'Non défini'}
                                          </Badge>
                                        </div>
                                      </div>

                                      {sub.price_paid && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                          Montant payé: <span className="font-medium">{formatAmount(sub.price_paid)}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground">
                                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>{t('walletAuditTool.aucunAbonnementTrouve')}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Transactions récentes */}
                  {auditResult.transactions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Transactions Récentes ({auditResult.transactions.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {auditResult.transactions.slice(0, 50).map((tx, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                <div className={`p-2 rounded-full ${
                                  tx._direction === 'received' ? 'bg-orange-100' : 'bg-orange-100'
                                }`}>
                                  {tx._direction === 'received' ? (
                                    <TrendingUp className="h-4 w-4 text-[#ff4000]" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 text-[#ff4000]" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {tx._source}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {tx.transaction_type || tx.type || 'transfer'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {tx.description || tx.id}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-bold ${
                                    tx._direction === 'received' ? 'text-[#ff4000]' : 'text-[#ff4000]'
                                  }`}>
                                    {tx._direction === 'received' ? '+' : '-'}
                                    {formatAmount(Number(tx.amount) || 0)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm')}
                                  </p>
                                </div>
                                <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                                  {tx.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Historique de réconciliation */}
                  {auditResult.reconciliationHistory.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('walletAuditTool.historiqueDeReconciliation')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-2">
                            {auditResult.reconciliationHistory.map((rec: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="text-sm">
                                    {formatAmount(rec.stored_balance)} → {formatAmount(rec.calculated_balance)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Différence: {formatAmount(rec.difference)}
                                  </p>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                  {format(new Date(rec.created_at), 'dd/MM/yyyy HH:mm')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Activités suspectes */}
                  {auditResult.suspiciousActivities.length > 0 && (
                    <Card className="border-orange-200">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2 text-[#ff4000]">
                          <AlertTriangle className="h-5 w-5" />
                          Activités Suspectes ({auditResult.suspiciousActivities.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-2">
                            {auditResult.suspiciousActivities.map((activity: any, idx: number) => (
                              <Alert key={idx} variant="destructive">
                                <AlertTitle>{activity.activity_type}</AlertTitle>
                                <AlertDescription>
                                  Niveau de risque: {activity.risk_level} •
                                  {activity.is_resolved ? ' Résolu' : ' Non résolu'}
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Onglet Vue Globale */}
            <TabsContent value="global" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={loadGlobalStats} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Charger les statistiques
                </Button>
              </div>

              {globalStats && (
                <>
                  {/* Stats globales */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <Users className="h-8 w-8 mx-auto text-primary mb-2" />
                        <p className="text-2xl font-bold">{globalStats.totalUsers}</p>
                        <p className="text-xs text-muted-foreground">Utilisateurs totaux</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <Wallet className="h-8 w-8 mx-auto text-[#ff4000] mb-2" />
                        <p className="text-2xl font-bold">{globalStats.totalWallets}</p>
                        <p className="text-xs text-muted-foreground">{t('walletAuditTool.walletsCrees')}</p>
                      </CardContent>
                    </Card>
                    <Card className={globalStats.usersWithoutWalletCount > 0 ? 'border-[#ff4000]' : ''}>
                      <CardContent className="pt-6 text-center">
                        <AlertTriangle className="h-8 w-8 mx-auto text-[#ff4000] mb-2" />
                        <p className="text-2xl font-bold">{globalStats.usersWithoutWalletCount}</p>
                        <p className="text-xs text-muted-foreground">{t('walletAuditTool.sansWallet')}</p>
                      </CardContent>
                    </Card>
                    <Card className={globalStats.problematicWalletsCount > 0 ? 'border-[#ff4000]' : ''}>
                      <CardContent className="pt-6 text-center">
                        <XCircle className="h-8 w-8 mx-auto text-[#ff4000] mb-2" />
                        <p className="text-2xl font-bold">{globalStats.problematicWalletsCount}</p>
                        <p className="text-xs text-muted-foreground">{t('walletAuditTool.walletsProblematiques')}</p>
                      </CardContent>
                    </Card>
                    <Card className={globalStats.unresolvedSuspiciousCount > 0 ? 'border-[#ff4000]' : ''}>
                      <CardContent className="pt-6 text-center">
                        <Shield className="h-8 w-8 mx-auto text-[#ff4000] mb-2" />
                        <p className="text-2xl font-bold">{globalStats.unresolvedSuspiciousCount}</p>
                        <p className="text-xs text-muted-foreground">{t('walletAuditTool.activitesSuspectes')}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Utilisateurs sans wallet */}
                  {usersWithoutWallet.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('walletAuditTool.utilisateursSansWallet')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[250px]">
                          <div className="space-y-2">
                            {usersWithoutWallet.map((user, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono">
                                    {user.custom_id}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {user.user_id}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => createWallet(user.custom_id)}
                                  disabled={loading}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Créer
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Wallets problématiques */}
                  {problematicWallets.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('walletAuditTool.walletsProblematiques2')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[250px]">
                          <div className="space-y-2">
                            {problematicWallets.map((wallet, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-[#ff4000]/30 rounded-lg">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {wallet.is_blocked && <Lock className="h-4 w-4 text-[#ff4000]" />}
                                    <Badge variant={wallet.wallet_status === 'active' ? 'default' : 'destructive'}>
                                      {wallet.wallet_status}
                                    </Badge>
                                    <span className="font-mono text-xs">{wallet.id}</span>
                                  </div>
                                  <p className="text-sm">
                                    Solde: {formatAmount(Number(wallet.balance) || 0, wallet.currency)}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSearchId('');
                                    auditWallet();
                                  }}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Auditer
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* Onglet Signatures API */}
            <TabsContent value="signatures" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={verifySignatures} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                  Vérifier les signatures
                </Button>
              </div>

              {apiSignatures && (
                <>
                  {/* Stats signatures */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <p className="text-2xl font-bold">{apiSignatures.stats.total}</p>
                        <p className="text-xs text-muted-foreground">Total APIs</p>
                      </CardContent>
                    </Card>
                    <Card className="border-[#ff4000]">
                      <CardContent className="pt-6 text-center">
                        <CheckCircle className="h-6 w-6 mx-auto text-[#ff4000] mb-1" />
                        <p className="text-2xl font-bold text-[#ff4000]">{apiSignatures.stats.valid}</p>
                        <p className="text-xs text-muted-foreground">Valides</p>
                      </CardContent>
                    </Card>
                    <Card className={apiSignatures.stats.invalid > 0 ? 'border-[#ff4000]' : ''}>
                      <CardContent className="pt-6 text-center">
                        <XCircle className="h-6 w-6 mx-auto text-[#ff4000] mb-1" />
                        <p className="text-2xl font-bold text-[#ff4000]">{apiSignatures.stats.invalid}</p>
                        <p className="text-xs text-muted-foreground">Invalides</p>
                      </CardContent>
                    </Card>
                    <Card className={apiSignatures.stats.expired > 0 ? 'border-[#ff4000]' : ''}>
                      <CardContent className="pt-6 text-center">
                        <Clock className="h-6 w-6 mx-auto text-[#ff4000] mb-1" />
                        <p className="text-2xl font-bold text-[#ff4000]">{apiSignatures.stats.expired}</p>
                        <p className="text-xs text-muted-foreground">{t('walletAuditTool.expirees')}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Liste des signatures */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('walletAuditTool.etatDesApiDePaiement')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {apiSignatures.signatures.map((sig: ApiSignatureCheck, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-3">
                              <CreditCard className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{sig.api}</p>
                                {sig.details && (
                                  <p className="text-xs text-muted-foreground">{sig.details}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getSignatureStatusColor(sig.status)}>
                                {sig.status === 'valid' && <CheckCircle className="h-3 w-3 mr-1" />}
                                {sig.status === 'invalid' && <XCircle className="h-3 w-3 mr-1" />}
                                {sig.status === 'expired' && <Clock className="h-3 w-3 mr-1" />}
                                {sig.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {sig.lastChecked && format(new Date(sig.lastChecked), 'dd/MM HH:mm')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Webhooks récents */}
                  {apiSignatures.recentWebhooks && apiSignatures.recentWebhooks.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('walletAuditTool.webhooksRecents')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-2">
                            {apiSignatures.recentWebhooks.map((wh: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                                <Badge variant={wh.status_code < 400 ? 'default' : 'destructive'}>
                                  {wh.status_code}
                                </Badge>
                                <span className="text-sm truncate flex-1">{wh.endpoint}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(wh.created_at), 'dd/MM HH:mm')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* Onglet Problèmes */}
            <TabsContent value="issues" className="space-y-4">
              <Alert>
                <ListChecks className="h-4 w-4" />
                <AlertTitle>{t('walletAuditTool.checklistDeVerification')}</AlertTitle>
                <AlertDescription>
                  Utilisez cette section pour vérifier l'état global des wallets et identifier les problèmes à résoudre.
                </AlertDescription>
              </Alert>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-500" />
                      Vérifications Automatiques
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={loadGlobalStats}
                        disabled={loading || actionLoading !== null}
                      >
                        {loading ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Users className="h-4 w-4 mr-2" />
                        )}
                        Scanner tous les wallets
                      </Button>
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={verifySignatures}
                        disabled={loading || actionLoading !== null}
                      >
                        {loading ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="h-4 w-4 mr-2" />
                        )}
                        Vérifier les clés API
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-[#ff4000]" />
                      Actions Rapides
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={reconcileAllWallets}
                        disabled={loading || actionLoading !== null}
                      >
                        {actionLoading === 'reconcile-all' ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Réconcilier tous les soldes
                      </Button>
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={createAllMissingWallets}
                        disabled={loading || actionLoading !== null}
                      >
                        {actionLoading === 'create-all' ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Créer wallets manquants
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Statistiques du scan */}
              {globalStats && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Résultats du Scan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-xl font-bold">{globalStats.totalUsers}</p>
                        <p className="text-xs text-muted-foreground">Utilisateurs</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-xl font-bold text-[#ff4000]">{globalStats.totalWallets}</p>
                        <p className="text-xs text-muted-foreground">{t('walletAuditTool.walletsCrees')}</p>
                      </div>
                      <div className="text-center p-3 bg-orange-100 dark:bg-[#ff4000]/30 rounded-lg">
                        <p className="text-xl font-bold text-[#ff4000]">{globalStats.usersWithoutWalletCount}</p>
                        <p className="text-xs text-muted-foreground">{t('walletAuditTool.sansWallet')}</p>
                      </div>
                      <div className="text-center p-3 bg-orange-100 dark:bg-[#ff4000]/30 rounded-lg">
                        <p className="text-xl font-bold text-[#ff4000]">{globalStats.problematicWalletsCount}</p>
                        <p className="text-xs text-muted-foreground">{t('walletAuditTool.problematiques')}</p>
                      </div>
                      <div className="text-center p-3 bg-orange-100 dark:bg-[#ff4000]/30 rounded-lg">
                        <p className="text-xl font-bold text-[#ff4000]">{globalStats.unresolvedSuspiciousCount}</p>
                        <p className="text-xs text-muted-foreground">Suspects</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Résultats des actions batch */}
              {batchResult && (
                <Card className="border-[#ff4000]">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-[#ff4000]" />
                      Résultat de l'Action
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert className="mb-4">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>{batchResult.message}</AlertTitle>
                      <AlertDescription>
                        <div className="flex flex-wrap gap-4 mt-2">
                          {batchResult.stats.total !== undefined && (
                            <span>Total: <strong>{batchResult.stats.total}</strong></span>
                          )}
                          {batchResult.stats.totalMissing !== undefined && (
                            <span>Manquants: <strong>{batchResult.stats.totalMissing}</strong></span>
                          )}
                          {batchResult.stats.reconciled !== undefined && (
                            <span className="text-[#ff4000]">{t('walletAuditTool.reconcilies')} <strong>{batchResult.stats.reconciled}</strong></span>
                          )}
                          {batchResult.stats.created !== undefined && (
                            <span className="text-[#ff4000]">{t('walletAuditTool.crees')} <strong>{batchResult.stats.created}</strong></span>
                          )}
                          {batchResult.stats.skipped !== undefined && (
                            <span className="text-muted-foreground">{t('walletAuditTool.ignores')} <strong>{batchResult.stats.skipped}</strong></span>
                          )}
                          {batchResult.stats.errors !== undefined && batchResult.stats.errors > 0 && (
                            <span className="text-[#ff4000]">Erreurs: <strong>{batchResult.stats.errors}</strong></span>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>

                    {batchResult.results.length > 0 && (
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {batchResult.results.map((result, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                              <div className="flex items-center gap-2">
                                {result.status === 'reconciled' || result.status === 'created' ? (
                                  <CheckCircle className="h-4 w-4 text-[#ff4000]" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-[#ff4000]" />
                                )}
                                <Badge variant="outline" className="font-mono text-xs">
                                  {result.customId || result.userId?.slice(0, 8)}
                                </Badge>
                              </div>
                              {result.oldBalance !== undefined && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">
                                    {formatAmount(result.oldBalance)}
                                  </span>
                                  <span>→</span>
                                  <span className="text-[#ff4000] font-medium">
                                    {formatAmount(result.newBalance)}
                                  </span>
                                  {result.difference !== 0 && (
                                    <Badge variant={result.difference > 0 ? 'destructive' : 'default'} className="text-xs">
                                      {result.difference > 0 ? '+' : ''}{formatAmount(result.difference)}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              {result.walletId && (
                                <Badge variant="outline" className="text-xs text-[#ff4000]">
                                  Wallet créé
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* API Signatures Status */}
              {apiSignatures && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      État des API de Paiement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="text-center p-2 bg-muted rounded-lg">
                        <p className="text-lg font-bold">{apiSignatures.stats.total}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center p-2 bg-orange-100 dark:bg-[#ff4000]/30 rounded-lg">
                        <p className="text-lg font-bold text-[#ff4000]">{apiSignatures.stats.valid}</p>
                        <p className="text-xs text-muted-foreground">Valides</p>
                      </div>
                      <div className="text-center p-2 bg-orange-100 dark:bg-[#ff4000]/30 rounded-lg">
                        <p className="text-lg font-bold text-[#ff4000]">{apiSignatures.stats.invalid}</p>
                        <p className="text-xs text-muted-foreground">Invalides</p>
                      </div>
                      <div className="text-center p-2 bg-orange-100 dark:bg-[#ff4000]/30 rounded-lg">
                        <p className="text-lg font-bold text-[#ff4000]">{apiSignatures.stats.expired}</p>
                        <p className="text-xs text-muted-foreground">{t('walletAuditTool.expirees')}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {apiSignatures.signatures.map((sig: ApiSignatureCheck, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{sig.api}</span>
                          </div>
                          <Badge className={getSignatureStatusColor(sig.status)}>
                            {sig.status === 'valid' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {sig.status === 'invalid' && <XCircle className="h-3 w-3 mr-1" />}
                            {sig.status === 'expired' && <Clock className="h-3 w-3 mr-1" />}
                            {sig.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

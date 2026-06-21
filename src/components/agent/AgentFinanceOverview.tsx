import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DollarSign, TrendingUp, Wallet,
  ArrowUpRight, ArrowDownLeft, RefreshCw, Calendar,
  PiggyBank, CreditCard, BarChart3, Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AgentFinanceOverviewProps {
  agentId: string;
}

interface FinancialStats {
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  walletBalance: number;
  walletCurrency: string;
  totalTransactions: number;
  transactionsThisMonth: number;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  created_at: string;
}

export function AgentFinanceOverview({ agentId }: AgentFinanceOverviewProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<FinancialStats>({
    totalCommissions: 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    walletBalance: 0,
    walletCurrency: 'GNF',
    totalTransactions: 0,
    transactionsThisMonth: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadFinancialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const loadFinancialData = async () => {
    try {
      setLoading(true);

      // Source unique: agent_commissions_log
      const { data: commissionsData, error: commError } = await supabase
        .from('agent_commissions_log')
        .select('id, amount, source_type, related_user_id, transaction_id, description, created_at, status, commission_rate, transaction_amount, currency')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (commError) console.error('Erreur commissions:', commError);

      // Résoudre user_id de l'agent puis charger le solde depuis wallets (source de vérité)
      const { data: agentData } = await supabase
        .from('agents_management')
        .select('user_id')
        .eq('id', agentId)
        .single();

      const { data: walletData, error: walletError } = agentData?.user_id
        ? await supabase
            .from('wallets')
            .select('balance, currency')
            .eq('user_id', agentData.user_id)
            .single()
        : { data: null, error: null };

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Erreur wallet:', walletError);
      }

      // Mapper vers format unifié
      const commissionsList = (commissionsData || []).map((c: any) => ({
        ...c,
        commission_amount: c.amount,
        transaction_type: c.source_type,
        commission_rate: c.commission_rate || 0,
        transaction_amount: c.transaction_amount || 0,
      }));
      const totalCommissions = commissionsList.reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);
      const pendingCommissions = commissionsList
        .filter((c: any) => c.status === 'pending')
        .reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);
      const paidCommissions = commissionsList
        .filter((c: any) => c.status === 'validated' || c.status === 'paid')
        .reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);

      const startOfCurrentMonth = startOfMonth(new Date());
      const commissionsThisMonth = commissionsList.filter(
        (c: any) => new Date(c.created_at) >= startOfCurrentMonth
      ).length;

      setStats({
        totalCommissions,
        pendingCommissions,
        paidCommissions,
        walletBalance: walletData?.balance || 0,
        walletCurrency: walletData?.currency || 'GNF',
        totalTransactions: commissionsList.length,
        transactionsThisMonth: commissionsThisMonth
      });

      setCommissions(commissionsList);

      // Utiliser les mêmes données comme transactions
      const transactions = commissionsList.map((c: any) => ({
        id: c.id,
        amount: c.amount,
        type: c.source_type,
        status: c.status || 'validated',
        description: c.description || 'Commission',
        created_at: c.created_at
      }));

      setRecentTransactions(transactions);

    } catch (error: any) {
      console.error('Erreur chargement données financières:', error);
      toast.error(t('agentFinanceOverview.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = useFormatCurrency();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-orange-100 text-[#ff4000]">{t('agentFinanceOverview.paye')}</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-[#ff4000]">En attente</Badge>;
      case 'cancelled':
        return <Badge className="bg-orange-100 text-[#ff4000]">{t('agentFinanceOverview.annule')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-[#ff4000]/5 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <DollarSign className="w-6 h-6 text-[#ff4000]" />
              Finance & Revenus
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadFinancialData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#ff4000] rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5" />
                <span className="text-sm opacity-90">{t('agentFinanceOverview.soldeWallet')}</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold break-words">{formatAmount(stats.walletBalance)}</p>
              <p className="text-xs opacity-75">{stats.walletCurrency}</p>
            </div>

            <div className="bg-[#04439e] rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm opacity-90">Total Commissions</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold break-words">{formatAmount(stats.totalCommissions)}</p>
              <p className="text-xs opacity-75">{stats.walletCurrency}</p>
            </div>

            <div className="bg-[#ff4000] rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="w-5 h-5" />
                <span className="text-sm opacity-90">En Attente</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold break-words">{formatAmount(stats.pendingCommissions)}</p>
              <p className="text-xs opacity-75">{stats.walletCurrency}</p>
            </div>

            <div className="bg-[#ff4000] rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5" />
                <span className="text-sm opacity-90">{t('agentFinanceOverview.payees')}</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold break-words">{formatAmount(stats.paidCommissions)}</p>
              <p className="text-xs opacity-75">{stats.walletCurrency}</p>
            </div>
          </div>

          {/* Activity Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-muted/30 rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalTransactions}</p>
                <p className="text-sm text-muted-foreground">Transactions totales</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.transactionsThisMonth}</p>
                <p className="text-sm text-muted-foreground">Ce mois-ci</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for details */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full rounded-none border-b bg-muted/30">
              <TabsTrigger value="overview" className="flex-1">Historique</TabsTrigger>
              <TabsTrigger value="commissions" className="flex-1">Commissions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Dernières Transactions
              </h3>

              {recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('agentFinanceOverview.aucuneTransactionRecente')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            tx.amount >= 0 ? 'bg-orange-100' : 'bg-orange-100'
                          }`}>
                            {tx.amount >= 0 ? (
                              <ArrowDownLeft className="w-5 h-5 text-[#ff4000]" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 text-[#ff4000]" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{tx.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${tx.amount >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                            {tx.amount >= 0 ? '+' : ''}{formatAmount(tx.amount)} {stats.walletCurrency}
                          </p>
                          <Badge variant="secondary" className="text-xs">{tx.type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="commissions" className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Détail des Commissions
              </h3>

              {commissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('agentFinanceOverview.aucuneCommissionEnregistree')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {commissions.map((comm) => (
                      <div
                        key={comm.id}
                        className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            Commission {comm.transaction_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Taux: {comm.commission_rate}% sur {formatAmount(comm.transaction_amount)} {stats.walletCurrency}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(comm.created_at), 'dd MMM yyyy', { locale: fr })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#ff4000]">
                            +{formatAmount(comm.commission_amount)} {stats.walletCurrency}
                          </p>
                          {getStatusBadge(comm.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * AGENT FULL FINANCE MODULE
 * Module Finance dédié à l'agent — affiche UNIQUEMENT les données propres à l'agent
 * Source de vérité: agent_commissions_log + agent_wallets
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DollarSign, TrendingUp, Wallet, Download,
  BarChart3, RefreshCw, Activity, PiggyBank,
  CreditCard, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface AgentFullFinanceModuleProps {
  agentId: string;
  canManage?: boolean;
}

interface AgentFinancialStats {
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  walletBalance: number;
  totalTransactions: number;
  transactionsThisMonth: number;
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

export function AgentFullFinanceModule({ agentId, canManage = false }: AgentFullFinanceModuleProps) {
  const { t } = useTranslation();
  const [agentStats, setAgentStats] = useState<AgentFinancialStats>({
    totalCommissions: 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    walletBalance: 0,
    totalTransactions: 0,
    transactionsThisMonth: 0
  });
  const [commissions, setCommissions] = useState<any[]>([]);
  const [agentTransactions, setAgentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [_dateRange, _setDateRange] = useState({ from: '', to: '' });
  const [activeTab, setActiveTab] = useState('overview');

  const chartConfig = {
    amount: { label: t('agentFullFinanceModule.montant'), color: "hsl(var(--primary))" },
    commission: { label: "Commission", color: "hsl(var(--chart-2))" }
  };

  useEffect(() => {
    loadAgentFinancialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const loadAgentFinancialData = async () => {
    try {
      setLoading(true);

      // Source unique: agent_commissions_log
      const { data: commissionsData } = await supabase
        .from('agent_commissions_log')
        .select('id, amount, source_type, related_user_id, transaction_id, description, created_at, status, commission_rate, transaction_amount, currency')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Résoudre user_id puis charger le solde depuis wallets (source de vérité)
      const { data: agentUserData } = await supabase
        .from('agents_management')
        .select('user_id')
        .eq('id', agentId)
        .single();

      const { data: walletData } = agentUserData?.user_id
        ? await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', agentUserData.user_id)
            .single()
        : { data: null };

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
      const transactionsThisMonth = commissionsList.filter(
        c => new Date(c.created_at) >= startOfCurrentMonth
      ).length;

      setAgentStats({
        totalCommissions,
        pendingCommissions,
        paidCommissions,
        walletBalance: walletData?.balance || 0,
        totalTransactions: commissionsList.length,
        transactionsThisMonth
      });

      setCommissions(commissionsList);
      setAgentTransactions(commissionsList.map((c: any) => ({
        id: c.id,
        amount: c.amount,
        type: c.source_type,
        status: c.status || 'validated',
        description: c.description || 'Commission',
        created_at: c.created_at
      })));

    } catch (error) {
      console.error('Erreur chargement finances agent:', error);
      toast.error(t('agentFullFinanceModule.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = useFormatCurrency();
  const { convert, userCurrency } = usePriceConverter();
  const compactAxis = (v: number) => {
    const c = convert(v, 'GNF').convertedAmount;
    if (Math.abs(c) >= 1_000_000) return `${(c / 1_000_000).toFixed(1)}M ${userCurrency}`;
    if (Math.abs(c) >= 1_000) return `${(c / 1_000).toFixed(0)}K ${userCurrency}`;
    return `${Math.round(c)} ${userCurrency}`;
  };

  const exportData = async () => {
    try {
      const csvData = commissions.map(c => ({
        'ID': c.id,
        'Type': c.transaction_type || 'N/A',
        'Montant Transaction': c.transaction_amount,
        'Commission': c.commission_amount,
        'Taux': `${c.commission_rate}%`,
        'Statut': c.status,
        'Date': new Date(c.created_at).toLocaleDateString('fr-FR'),
      }));

      const csvContent = [
        Object.keys(csvData[0] || {}).join(','),
        ...csvData.map(row => Object.values(row).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commissions_agent_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(t('agentFullFinanceModule.exportReussi'));
    } catch (_error) {
      toast.error(t('agentFullFinanceModule.erreurLorsDeLExport'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-orange-100 text-[#ff4000]">{t('agentFullFinanceModule.paye')}</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-[#ff4000]">En attente</Badge>;
      case 'cancelled':
        return <Badge className="bg-orange-100 text-[#ff4000]">{t('agentFullFinanceModule.annule')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const chartData = commissions.slice(0, 10).reverse().map(c => ({
    date: new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    amount: Number(c.transaction_amount),
    commission: Number(c.commission_amount)
  }));

  return (
    <div className="space-y-6">
      {/* Header avec stats agent */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-[#ff4000]/10 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#ff4000] shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Mes Finances</CardTitle>
                <CardDescription>Commissions & transactions personnelles</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadAgentFinancialData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Stats Cards Agent */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#ff4000] rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5" />
                <span className="text-sm opacity-90">{t('agentFullFinanceModule.monSolde')}</span>
              </div>
              <p className="text-2xl font-bold">{formatAmount(agentStats.walletBalance)}</p>
              <p className="text-xs opacity-75">GNF</p>
            </div>
            <div className="bg-[#04439e] rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm opacity-90">Total Commissions</span>
              </div>
              <p className="text-2xl font-bold">{formatAmount(agentStats.totalCommissions)}</p>
              <p className="text-xs opacity-75">GNF</p>
            </div>
            <div className="bg-[#ff4000] rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="w-5 h-5" />
                <span className="text-sm opacity-90">En Attente</span>
              </div>
              <p className="text-2xl font-bold">{formatAmount(agentStats.pendingCommissions)}</p>
              <p className="text-xs opacity-75">GNF</p>
            </div>
            <div className="bg-[#ff4000] rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5" />
                <span className="text-sm opacity-90">{t('agentFullFinanceModule.payees')}</span>
              </div>
              <p className="text-2xl font-bold">{formatAmount(agentStats.paidCommissions)}</p>
              <p className="text-xs opacity-75">GNF</p>
            </div>
          </div>

          {/* Activity quick stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{agentStats.totalTransactions}</p>
                <p className="text-sm text-muted-foreground">Transactions totales</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{agentStats.transactionsThisMonth}</p>
                <p className="text-sm text-muted-foreground">Ce mois-ci</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs agent uniquement */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{t('agentFullFinanceModule.apercu')}</span>
          </TabsTrigger>
          <TabsTrigger value="my-commissions" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Commissions</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Historique</span>
          </TabsTrigger>
        </TabsList>

        {/* Aperçu graphique */}
        <TabsContent value="overview" className="space-y-6">
          {chartData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Évolution des Commissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={compactAxis} width={72} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="commission"
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
                    Volume des Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={compactAxis} width={72} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-border/40">
              <CardContent className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('agentFullFinanceModule.aucuneDonneeGraphiqueDisponible')}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Mes Commissions */}
        <TabsContent value="my-commissions" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Mes Commissions
                </CardTitle>
                <Button variant="outline" size="sm" onClick={exportData}>
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {commissions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('agentFullFinanceModule.aucuneCommissionEnregistree')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {commissions.map((comm) => (
                      <div
                        key={comm.id}
                        className="flex items-center justify-between p-4 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            Commission {comm.transaction_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Taux: {comm.commission_rate}% sur {formatAmount(comm.transaction_amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(comm.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#ff4000]">
                            +{formatAmount(comm.commission_amount)}
                          </p>
                          {getStatusBadge(comm.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historique transactions agent */}
        <TabsContent value="transactions" className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>{t('agentFullFinanceModule.historiqueDesTransactions')}</CardTitle>
              <CardDescription>{t('agentFullFinanceModule.toutesMesOperationsFinancieres')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {agentTransactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>{t('agentFullFinanceModule.aucuneTransaction')}</p>
                    </div>
                  ) : (
                    agentTransactions.map((trans) => (
                      <div
                        key={trans.id}
                        className="group p-4 rounded-xl border border-border/40 bg-muted/30 hover:bg-muted/50 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <DollarSign className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {trans.type?.toUpperCase() || 'COMMISSION'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(trans.created_at).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-foreground">{formatAmount(trans.amount || 0)}</p>
                            <Badge variant={trans.status === 'validated' || trans.status === 'paid' ? 'default' : 'secondary'}>
                              {trans.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AgentFullFinanceModule;

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Shield, Wallet, RefreshCw, Activity,
  DollarSign, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AgentBankingModuleProps {
  agentId: string;
  canManage?: boolean;
}

interface WalletTx {
  id: number;
  transaction_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  currency: string;
  transaction_type: string;
  status: string;
  description: string;
  created_at: string;
}

export function AgentBankingModule({ agentId, canManage = false }: AgentBankingModuleProps) {
  const { t } = useTranslation();
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState('GNF');
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const formatAmount = useFormatCurrency();

  const stats = {
    totalIn: transactions.filter(t => ['deposit', 'receive', 'credit'].includes(t.transaction_type) && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0),
    totalOut: transactions.filter(t => ['withdrawal', 'transfer', 'payment', 'debit'].includes(t.transaction_type) && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0),
    pending: transactions.filter(t => t.status === 'pending').length,
    completed: transactions.filter(t => t.status === 'completed').length,
  };

  useEffect(() => {
    loadData();
  }, [agentId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Résoudre user_id de l'agent
      const { data: agentData, error: agentErr } = await supabase
        .from('agents_management')
        .select('user_id')
        .eq('id', agentId)
        .single();

      if (agentErr || !agentData?.user_id) {
        setLoading(false);
        return;
      }

      // Wallet de l'agent
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, balance, currency')
        .eq('user_id', agentData.user_id)
        .single();

      if (wallet) {
        setWalletBalance(wallet.balance || 0);
        setWalletCurrency(wallet.currency || 'GNF');

        // Transactions du wallet
        const { data: txData } = await supabase
          .from('wallet_transactions')
          .select('id, transaction_id, amount, fee, net_amount, currency, transaction_type, status, description, created_at')
          .eq('wallet_id', wallet.id)
          .order('created_at', { ascending: false })
          .limit(100);

        setTransactions((txData || []) as WalletTx[]);
      }

      // Nombre d'utilisateurs créés par cet agent
      const { count } = await supabase
        .from('agent_created_users')
        .select('user_id', { count: 'exact', head: true })
        .eq('agent_id', agentId);

      setUsersCount(count || 0);
    } catch (err) {
      console.error('Erreur chargement banking:', err);
      toast.error(t('agentBankingModule.erreurDeChargement'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-orange-100 text-[#ff4000] flex items-center gap-1"><CheckCircle className="w-3 h-3" />{t('agentBankingModule.complete')}</Badge>;
      case 'pending': return <Badge className="bg-orange-100 text-[#ff4000] flex items-center gap-1"><Clock className="w-3 h-3" />En attente</Badge>;
      case 'failed': return <Badge className="bg-orange-100 text-[#ff4000] flex items-center gap-1"><XCircle className="w-3 h-3" />{t('agentBankingModule.echoue')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTxIcon = (type: string) => {
    if (['deposit', 'receive', 'credit'].includes(type))
      return <ArrowDownLeft className="w-4 h-4 text-[#ff4000]" />;
    return <ArrowUpRight className="w-4 h-4 text-[#ff4000]" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Système Bancaire
          </h1>
          <p className="text-muted-foreground">{t('agentBankingModule.supervisionFinanciereDeVotreActivite')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Solde Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(walletBalance, walletCurrency)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-[#ff4000]" />
              Total Entrant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">{formatAmount(stats.totalIn, walletCurrency)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-[#ff4000]" />
              Total Sortant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">{formatAmount(stats.totalOut, walletCurrency)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersCount}</div>
            <div className="text-xs text-muted-foreground">{stats.pending} transactions en attente</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Transactions ({transactions.length})
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('agentBankingModule.historiqueDesTransactions')}</CardTitle>
              <CardDescription>{t('agentBankingModule.toutesLesTransactionsDeVotre')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t('agentBankingModule.aucuneTransaction')}</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {getTxIcon(tx.transaction_type)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{tx.description || tx.transaction_type}</p>
                              <p className="text-xs text-muted-foreground">
                                {tx.transaction_id && `#${tx.transaction_id.slice(0, 8)}`} ·{' '}
                                {format(new Date(tx.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(tx.status)}
                            <span className={`font-bold text-sm ${['deposit', 'receive', 'credit'].includes(tx.transaction_type) ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                              {['deposit', 'receive', 'credit'].includes(tx.transaction_type) ? '+' : '-'}
                              {formatAmount(tx.amount || 0, tx.currency || walletCurrency)}
                            </span>
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

        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('agentBankingModule.resumeFinancier')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">{t('agentBankingModule.soldeActuel')}</span>
                  <span className="font-bold">{formatAmount(walletBalance, walletCurrency)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Total entrant</span>
                  <span className="font-bold text-[#ff4000]">{formatAmount(stats.totalIn, walletCurrency)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Total sortant</span>
                  <span className="font-bold text-[#ff4000]">{formatAmount(stats.totalOut, walletCurrency)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Transactions totales</span>
                  <span className="font-bold">{transactions.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('agentBankingModule.statutDesTransactions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#ff4000]" />Complétées
                  </span>
                  <span className="font-bold text-[#ff4000]">{stats.completed}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#ff4000]" />En attente
                  </span>
                  <span className="font-bold text-[#ff4000]">{stats.pending}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />Utilisateurs gérés
                  </span>
                  <span className="font-bold">{usersCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

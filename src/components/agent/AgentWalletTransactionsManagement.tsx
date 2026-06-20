import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Send, RefreshCw,
  Search, Filter, Clock, CheckCircle, XCircle, AlertTriangle,
  CreditCard, Building2, User
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AgentWalletTransactionsManagementProps {
  agentId: string;
}

interface WalletTransaction {
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
  sender_user_id: string;
  receiver_user_id: string;
}

export function AgentWalletTransactionsManagement({ agentId }: AgentWalletTransactionsManagementProps) {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState('GNF');
  const [_walletId, setWalletId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    recipientId: '',
    amount: '',
    description: ''
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadWalletData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const loadWalletData = async () => {
    try {
      setLoading(true);

      // Résoudre user_id depuis agents_management
      const { data: agentData, error: agentError } = await supabase
        .from('agents_management')
        .select('user_id')
        .eq('id', agentId)
        .single();

      if (agentError || !agentData?.user_id) {
        console.error('Erreur agent:', agentError);
        setLoading(false);
        return;
      }

      // Charger le wallet depuis wallets (source de vérité)
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance, currency')
        .eq('user_id', agentData.user_id)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Erreur wallet:', walletError);
      }

      if (wallet) {
        setWalletBalance(wallet.balance || 0);
        if (wallet.currency) setWalletCurrency(wallet.currency);
        setWalletId(String(wallet.id));
      }

      // Charger UNIQUEMENT les transactions liées au wallet (wallets.id = sender/receiver)
      if (wallet?.id) {
        const { data: txData, error: txError } = await supabase
          .from('wallet_transactions')
          .select('id, transaction_id, amount, fee, net_amount, currency, transaction_type, status, description, created_at, sender_wallet_id, receiver_wallet_id')
          .or(`sender_wallet_id.eq.${wallet.id},receiver_wallet_id.eq.${wallet.id}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (txError) {
          console.error('Erreur transactions:', txError);
        }

        setTransactions((txData || []).map(tx => ({
          ...tx,
          sender_user_id: tx.sender_wallet_id || '',
          receiver_user_id: tx.receiver_wallet_id || '',
        })) as any);
      } else {
        setTransactions([]);
      }

    } catch (error: any) {
      console.error('Erreur chargement wallet:', error);
      toast.error(t('agentWalletTransactionsManagement.erreurLorsDuChargement'));
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferData.recipientId || !transferData.amount) {
      toast.error(t('agentWalletTransactionsManagement.veuillezRemplirTousLesChamps'));
      return;
    }

    const amount = parseFloat(transferData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('agentWalletTransactionsManagement.montantInvalide'));
      return;
    }

    if (amount > walletBalance) {
      toast.error(t('agentWalletTransactionsManagement.soldeInsuffisant'));
      return;
    }

    try {
      setProcessing(true);

      // Appel à une fonction RPC pour le transfert sécurisé
      const { data, error } = await supabase.rpc('agent_wallet_transfer' as any, {
        p_agent_id: agentId,
        p_recipient_id: transferData.recipientId,
        p_amount: amount,
        p_description: transferData.description || 'Transfert agent'
      });

      if (error) throw error;

      toast.success(t('agentWalletTransactionsManagement.transfertEffectueAvecSucces'));
      setIsTransferDialogOpen(false);
      setTransferData({ recipientId: '', amount: '', description: '' });
      loadWalletData();

    } catch (error: any) {
      console.error('Erreur transfert:', error);
      toast.error(error.message || 'Erreur lors du transfert');
    } finally {
      setProcessing(false);
    }
  };

  const formatAmount = useFormatCurrency();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-orange-100 text-[#ff4000]"><CheckCircle className="w-3 h-3 mr-1" />{t('agentWalletTransactionsManagement.complete')}</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-[#ff4000]"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case 'failed':
        return <Badge className="bg-orange-100 text-[#ff4000]"><XCircle className="w-3 h-3 mr-1" />{t('agentWalletTransactionsManagement.echoue')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'credit':
        return <ArrowDownLeft className="w-5 h-5 text-[#ff4000]" />;
      case 'withdrawal':
      case 'debit':
      case 'transfer':
        return <ArrowUpRight className="w-5 h-5 text-[#ff4000]" />;
      default:
        return <CreditCard className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || tx.transaction_type === filterType;
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const transactionTypes = [...new Set(transactions.map(t => t.transaction_type).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec solde */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#ff4000] to-[#ff4000] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm mb-1">{t('agentWalletTransactionsManagement.soldeDisponible')}</p>
              <p className="text-3xl font-bold text-white">{formatCurrency(walletBalance, walletCurrency)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadWalletData}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
              <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <Send className="w-4 h-4 mr-2" />
                    Transférer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-primary" />
                      Nouveau Transfert
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>{t('agentWalletTransactionsManagement.idDuDestinataire')}</Label>
                      <Input
                        placeholder={t('agentWalletTransactionsManagement.entrezLIdPublicDu')}
                        value={transferData.recipientId}
                        onChange={(e) => setTransferData({...transferData, recipientId: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>{t('agentWalletTransactionsManagement.montantGnf')}</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={transferData.amount}
                        onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Solde disponible: {formatCurrency(walletBalance, walletCurrency)}
                      </p>
                    </div>
                    <div>
                      <Label>Description (optionnel)</Label>
                      <Input
                        placeholder={t('agentWalletTransactionsManagement.motifDuTransfert')}
                        value={transferData.description}
                        onChange={(e) => setTransferData({...transferData, description: e.target.value})}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleTransfer} disabled={processing}>
                      {processing ? 'Envoi...' : 'Confirmer le transfert'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </Card>

      {/* Liste des transactions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Historique des Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* Filtres */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={t('agentWalletTransactionsManagement.rechercher')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agentWalletTransactionsManagement.tousLesTypes')}</SelectItem>
                {transactionTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agentWalletTransactionsManagement.tousLesStatuts')}</SelectItem>
                <SelectItem value="completed">{t('agentWalletTransactionsManagement.complete')}</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="failed">{t('agentWalletTransactionsManagement.echoue')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Liste */}
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('agentWalletTransactionsManagement.aucuneTransactionTrouvee')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.transaction_type === 'deposit' || tx.transaction_type === 'credit'
                          ? 'bg-orange-100' : 'bg-orange-100'
                      }`}>
                        {getTypeIcon(tx.transaction_type)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {tx.description || tx.transaction_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID: {tx.transaction_id?.slice(0, 12)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        tx.transaction_type === 'deposit' || tx.transaction_type === 'credit'
                          ? 'text-[#ff4000]' : 'text-[#ff4000]'
                      }`}>
                        {tx.transaction_type === 'deposit' || tx.transaction_type === 'credit' ? '+' : '-'}
                        {formatCurrency(tx.amount, tx.currency || walletCurrency)}
                      </p>
                      {tx.fee > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Frais: {formatCurrency(tx.fee, tx.currency || walletCurrency)}
                        </p>
                      )}
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

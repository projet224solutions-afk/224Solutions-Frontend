import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  DollarSign,
  User,
  Clock,
  CreditCard,
  Smartphone
} from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DetailedTransaction {
  id: number;
  transaction_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  currency: string;
  transaction_type: string;
  status: string;
  description: string | null;
  created_at: string;
  metadata: any;
  payment_method?: string;
  sender_wallet_id: number | null;
  receiver_wallet_id: number | null;
  sender_info?: {
    user_id: string;
    name: string;
    email: string;
  } | null;
  receiver_info?: {
    user_id: string;
    name: string;
    email: string;
  } | null;
}

export default function DetailedTransactionsList() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<DetailedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDetailedTransactions = async () => {
    try {
      setLoading(true);
      console.log('🔄 [DetailedTransactions] Chargement des transactions détaillées...');

      // Récupérer toutes les transactions
      const { data: transactionsData, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      console.log('📦 [DetailedTransactions] Transactions brutes:', transactionsData);

      // Récupérer les wallet IDs uniques
      const walletIds = new Set<number>();
      transactionsData?.forEach((t: any) => {
        if (t.sender_wallet_id) walletIds.add(t.sender_wallet_id);
        if (t.receiver_wallet_id) walletIds.add(t.receiver_wallet_id);
      });

      // Récupérer les wallets avec leurs user_ids
      const { data: walletsData, error: walletsError } = await supabase
        .from('wallets')
        .select('id, user_id')
        .in('id', Array.from(walletIds));

      if (walletsError) {
        console.error('⚠️ Erreur chargement wallets:', walletsError);
      }

      console.log('💼 [DetailedTransactions] Wallets:', walletsData);

      // Créer une map des wallets
      const walletsMap = new Map(walletsData?.map(w => [w.id, w.user_id]) || []);

      // Récupérer les user IDs uniques
      const userIds = new Set<string>();
      walletsData?.forEach((w: any) => {
        if (w.user_id) userIds.add(w.user_id);
      });

      // Récupérer les informations des utilisateurs
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', Array.from(userIds));

      if (usersError) {
        console.error('⚠️ Erreur chargement utilisateurs:', usersError);
      }

      console.log('👥 [DetailedTransactions] Utilisateurs:', usersData);

      // Mapper les données
      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);

      const enrichedTransactions: DetailedTransaction[] = (transactionsData || []).map((t: any) => {
        const senderUserId = t.sender_wallet_id ? walletsMap.get(t.sender_wallet_id) : null;
        const receiverUserId = t.receiver_wallet_id ? walletsMap.get(t.receiver_wallet_id) : null;

        const senderUser = senderUserId ? usersMap.get(senderUserId) : null;
        const receiverUser = receiverUserId ? usersMap.get(receiverUserId) : null;

        return {
          ...t,
          sender_info: senderUserId ? {
            user_id: senderUserId,
            name: senderUser
              ? `${senderUser.first_name || ''} ${senderUser.last_name || ''}`.trim() || 'Utilisateur inconnu'
              : 'Utilisateur inconnu',
            email: senderUser?.email || 'N/A'
          } : null,
          receiver_info: receiverUserId ? {
            user_id: receiverUserId,
            name: receiverUser
              ? `${receiverUser.first_name || ''} ${receiverUser.last_name || ''}`.trim() || 'Utilisateur inconnu'
              : 'Utilisateur inconnu',
            email: receiverUser?.email || 'N/A'
          } : null
        };
      });

      console.log('✅ [DetailedTransactions] Transactions enrichies:', enrichedTransactions);
      setTransactions(enrichedTransactions);
    } catch (error: any) {
      console.error('❌ [DetailedTransactions] Erreur:', error);
      toast.error(t('detailedTransactionsList.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDetailedTransactions();
    setRefreshing(false);
    toast.success(t('detailedTransactionsList.transactionsActualisees'));
  };

  useEffect(() => {
    fetchDetailedTransactions();

    // Temps réel
    console.log('📡 [DetailedTransactions] Abonnement temps réel activé');
    const channel = supabase
      .channel('detailed-transactions-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
        },
        (payload) => {
          console.log('💰 [DetailedTransactions] Transaction détectée:', payload);
          setTimeout(() => fetchDetailedTransactions(), 1000);
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 [DetailedTransactions] Déconnexion temps réel');
      channel.unsubscribe();
    };
  }, []);

  const getTransactionTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'deposit': 'Dépôt',
      'withdraw': 'Retrait',
      'transfer': 'Transfert',
      'credit': 'Crédit',
      'marketplace': 'E-Commerce',
      'taxi': 'Taxi-Moto',
      'delivery': 'Livraison',
      'subscription': 'Abonnement'
    };
    return labels[type] || type;
  };

  const getPaymentMethodLabel = (metadata: any) => {
    if (!metadata) return null;
    const method = metadata.payment_method || metadata.withdraw_method;
    if (method === 'orange_money') return 'Orange Money';
    if (method === 'bank_card') return 'Carte Bancaire';
    return method;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.abs(amount)) + ' GNF';
  };

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      t.transaction_id.toLowerCase().includes(search) ||
      t.transaction_type.toLowerCase().includes(search) ||
      t.sender_info?.name.toLowerCase().includes(search) ||
      t.sender_info?.email.toLowerCase().includes(search) ||
      t.receiver_info?.name.toLowerCase().includes(search) ||
      t.receiver_info?.email.toLowerCase().includes(search) ||
      t.description?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Transactions Détaillées de la Plateforme
              </CardTitle>
              <CardDescription>
                Toutes les transactions avec détails complets et revenus de la plateforme
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('detailedTransactionsList.rechercherParIdTypeUtilisateur')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-[#ff4000]/10 to-transparent border border-[#ff4000]/20">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                Total Transactions
              </div>
              <div className="text-2xl font-bold">{filteredTransactions.length}</div>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                Revenus Totaux
              </div>
              <div className="text-2xl font-bold">
                {formatAmount(filteredTransactions.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0))}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-[#04439e]/10 to-transparent border border-[#04439e]/20">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                Frais de Plateforme
              </div>
              <div className="text-2xl font-bold">
                {formatAmount(filteredTransactions.reduce((sum, t) => sum + t.fee, 0))}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune transaction trouvée
            </div>
          ) : (
            filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="p-5 rounded-xl bg-background border border-border/40 hover:border-primary/30 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Partie gauche - Infos principales */}
                  <div className="flex-1 space-y-3">
                    {/* Type et ID */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        transaction.amount > 0
                          ? 'bg-[#ff4000]/10'
                          : 'bg-[#ff4000]/10'
                      }`}>
                        {transaction.amount > 0 ? (
                          <ArrowDownLeft className="w-5 h-5 text-[#ff4000]" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-[#ff4000]" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-lg">
                          {getTransactionTypeLabel(transaction.transaction_type)}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          ID: {transaction.transaction_id}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/20">
                        {transaction.status}
                      </Badge>
                    </div>

                    {/* Utilisateurs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {transaction.sender_info && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                          <User className="w-4 h-4 text-orange-500 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground">{t('detailedTransactionsList.expediteur')}</div>
                            <div className="font-medium truncate">{transaction.sender_info.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{transaction.sender_info.email}</div>
                          </div>
                        </div>
                      )}
                      {transaction.receiver_info && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-[#ff4000]/5 border border-[#ff4000]/10">
                          <User className="w-4 h-4 text-[#ff4000] mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground">Destinataire</div>
                            <div className="font-medium truncate">{transaction.receiver_info.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{transaction.receiver_info.email}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Infos supplémentaires */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(transaction.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                      </div>
                      {getPaymentMethodLabel(transaction.metadata) && (
                        <div className="flex items-center gap-1">
                          {getPaymentMethodLabel(transaction.metadata) === 'Orange Money' ? (
                            <Smartphone className="w-3 h-3" />
                          ) : (
                            <CreditCard className="w-3 h-3" />
                          )}
                          {getPaymentMethodLabel(transaction.metadata)}
                        </div>
                      )}
                    </div>

                    {transaction.description && (
                      <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                        {transaction.description}
                      </div>
                    )}
                  </div>

                  {/* Partie droite - Montants */}
                  <div className="text-right space-y-2 min-w-[140px]">
                    <div>
                      <div className="text-sm text-muted-foreground">{t('detailedTransactionsList.montant')}</div>
                      <div className={`text-2xl font-bold ${
                        transaction.amount > 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'
                      }`}>
                        {transaction.amount > 0 ? '+' : ''}{formatAmount(transaction.amount)}
                      </div>
                    </div>
                    {transaction.fee > 0 && (
                      <div className="pt-2 border-t border-border/40">
                        <div className="text-xs text-muted-foreground">Frais Plateforme</div>
                        <div className="text-lg font-bold text-blue-500">
                          +{formatAmount(transaction.fee)}
                        </div>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border/40">
                      <div className="text-xs text-muted-foreground">{t('detailedTransactionsList.montantNet')}</div>
                      <div className="text-sm font-semibold">
                        {formatAmount(transaction.net_amount)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

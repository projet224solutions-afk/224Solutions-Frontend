import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  XCircle,
  RefreshCw,
  History
} from 'lucide-react';

interface Transaction {
  id: string | number;
  amount: number;
  sender_id: string;
  receiver_id: string;
  sender_custom_id?: string;
  receiver_custom_id?: string;
  sender_name?: string;
  receiver_name?: string;
  method: string;
  created_at: string;
  status: string;
  metadata?: any;
}

interface WalletTransactionHistoryProps {
  className?: string;
  limit?: number;
}

export const WalletTransactionHistory = ({
  className = '',
  limit = 50
}: WalletTransactionHistoryProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletCurrency, setWalletCurrency] = useState<string>('GNF');
  const [showAll, setShowAll] = useState(false);
  const INITIAL_DISPLAY_COUNT = 3;

  const loadTransactions = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance, currency')
        .eq('user_id', user.id)
        .single();

      if (walletError) {
        console.error('Erreur récupération wallet:', walletError);
        setError('Impossible de charger votre portefeuille');
        return;
      }

      setWalletCurrency(walletData?.currency || 'GNF');

      const [{ data: enhancedData, error: enhancedError }, { data: walletTransactionsData, error: walletTransactionsError }] = await Promise.all([
        (supabase
          .from('enhanced_transactions' as any)
          .select('id, amount, sender_id, receiver_id, method, created_at, status, metadata')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(limit) as any),
        supabase
          .from('wallet_transactions')
          .select('id, sender_wallet_id, receiver_wallet_id, amount, transaction_type, created_at, status, description, metadata')
          .or(`sender_wallet_id.eq.${walletData.id},receiver_wallet_id.eq.${walletData.id}`)
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      if (enhancedError) {
        console.error('Erreur récupération enhanced_transactions:', enhancedError);
      }
      if (walletTransactionsError) {
        console.error('Erreur récupération wallet_transactions:', walletTransactionsError);
      }

      const walletTxRows = (walletTransactionsData || []) as Array<{
        id: string;
        sender_wallet_id: string;
        receiver_wallet_id: string;
        amount: number;
        transaction_type: string;
        created_at: string;
        status: string;
        description?: string | null;
        metadata?: any;
      }>;

      const otherWalletIds = Array.from(new Set(
        walletTxRows
          .flatMap((tx) => [tx.sender_wallet_id, tx.receiver_wallet_id])
          .filter((walletId) => walletId && walletId !== walletData.id)
      ));

      let walletIdToUserId = new Map<string, string>();
      if (otherWalletIds.length > 0) {
        const { data: otherWalletRows } = await supabase
          .from('wallets')
          .select('id, user_id')
          .in('id', otherWalletIds);

        walletIdToUserId = new Map((otherWalletRows || []).map((row: any) => [row.id, row.user_id]));
      }

      const uniqueUserIds = new Set<string>();
      ((enhancedData || []) as Array<{ sender_id?: string; receiver_id?: string }>).forEach((tx) => {
        if (tx.sender_id) uniqueUserIds.add(tx.sender_id);
        if (tx.receiver_id) uniqueUserIds.add(tx.receiver_id);
      });
      Array.from(walletIdToUserId.values()).forEach((userId) => uniqueUserIds.add(userId));
      uniqueUserIds.add(user.id);

      let profilesMap: Record<string, { public_id?: string; full_name?: string; first_name?: string; last_name?: string; email?: string }> = {};
      if (uniqueUserIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, public_id, full_name, first_name, last_name, email')
          .in('id', Array.from(uniqueUserIds));

        if (profilesData) {
          profilesMap = Object.fromEntries(profilesData.map((profile: any) => [profile.id, profile]));
        }
      }

      const getUserDisplay = (userId: string | null | undefined) => {
        if (!userId) {
          return { customId: 'SYS', name: 'Système' };
        }

        const profile = profilesMap[userId];
        const name = profile?.full_name
          || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
          || profile?.email
          || 'Utilisateur';

        return {
          customId: profile?.public_id || userId.slice(0, 8),
          name,
        };
      };

      const mergedTransactions = new Map<string, Transaction>();

      for (const tx of (enhancedData || []) as any[]) {
        const metadata = tx.metadata || {};
        const sender = getUserDisplay(tx.sender_id);
        const receiver = getUserDisplay(tx.receiver_id);
        const dedupeKey = metadata?.idempotency_key || `enhanced:${tx.id}`;

        mergedTransactions.set(dedupeKey, {
          id: tx.id,
          amount: Number(tx.amount || 0),
          sender_id: tx.sender_id,
          receiver_id: tx.receiver_id,
          method: tx.method || 'transaction',
          created_at: tx.created_at,
          status: tx.status || 'completed',
          metadata,
          sender_custom_id: sender.customId,
          receiver_custom_id: receiver.customId,
          sender_name: sender.name,
          receiver_name: receiver.name,
        });
      }

      for (const tx of walletTxRows) {
        const metadata = tx.metadata || {};
        const dedupeKey = metadata?.idempotency_key || `wallet:${tx.id}`;

        if (mergedTransactions.has(dedupeKey)) {
          continue;
        }

        const isOutgoing = tx.sender_wallet_id === walletData.id;
        const otherWalletId = isOutgoing ? tx.receiver_wallet_id : tx.sender_wallet_id;
        const otherUserId = walletIdToUserId.get(otherWalletId) || null;
        const counterparty = getUserDisplay(otherUserId);

        mergedTransactions.set(dedupeKey, {
          id: tx.id,
          amount: Number(tx.amount || 0),
          sender_id: isOutgoing ? user.id : (otherUserId || 'system'),
          receiver_id: isOutgoing ? (otherUserId || 'system') : user.id,
          method: tx.transaction_type || 'transaction',
          created_at: tx.created_at,
          status: tx.status || 'completed',
          metadata: {
            ...metadata,
            description: tx.description || metadata?.description,
          },
          sender_custom_id: isOutgoing ? 'Vous' : counterparty.customId,
          receiver_custom_id: isOutgoing ? counterparty.customId : 'Vous',
          sender_name: isOutgoing ? 'Vous' : counterparty.name,
          receiver_name: isOutgoing ? counterparty.name : 'Vous',
        });
      }

      const merged = Array.from(mergedTransactions.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);

      setTransactions(merged);

      if (merged.length === 0 && enhancedError && walletTransactionsError) {
        setError(`Impossible de charger l'historique: ${enhancedError.message}`);
      }
    } catch (error: any) {
      console.error('Erreur chargement transactions:', error);
      setError(error?.message || 'Une erreur inattendue s\'est produite');
    } finally {
      setLoading(false);
    }
  }, [limit, user]);

  useEffect(() => {
    if (user) {
      void loadTransactions();
    }
  }, [user, loadTransactions]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleWalletUpdate = () => {
      void loadTransactions();
    };

    window.addEventListener('wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
  }, [user, loadTransactions]);

  const getTransactionIcon = (transaction: Transaction, status: string) => {
    if (status === 'pending') return <Clock className="w-4 h-4 text-orange-500" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-[#ff4000]" />;

    // Déterminer si c'est un crédit ou débit basé sur sender_id
    const isCredit = transaction.receiver_id === user?.id;
    if (isCredit) return <ArrowUp className="w-4 h-4 text-[#ff4000]" />;
    return <ArrowDown className="w-4 h-4 text-[#ff4000]" />;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'bg-orange-100 text-[#ff4000]',
      pending: 'bg-orange-100 text-orange-700',
      failed: 'bg-orange-100 text-[#ff4000]'
    };

    const labels = {
      completed: 'Terminé',
      pending: 'En cours',
      failed: 'Échoué'
    };

    return (
      <Badge className={variants[status as keyof typeof variants] || variants.pending}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatAmount = (amount: number, transaction: Transaction) => {
    const isCredit = transaction.receiver_id === user?.id;
    const sign = isCredit ? '+' : '-';
    return `${sign}${Math.abs(amount).toLocaleString()} ${walletCurrency}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedTransactions = showAll
    ? transactions
    : transactions.slice(0, INITIAL_DISPLAY_COUNT);

  return (
    <Card className={`${className} border-2 border-orange-100 bg-gradient-to-br from-orange-50 to-orange-50`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#ff4000]" />
            Historique des transactions
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={loadTransactions}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-[#ff4000] mx-auto mb-3" />
            <p className="text-[#ff4000] font-semibold mb-2">{t('walletTransactionHistory.erreurDeChargement')}</p>
            <p className="text-sm text-gray-600 mb-4">
              {error}
            </p>
            <Button
              onClick={loadTransactions}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Réessayer
            </Button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <ArrowUpDown className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">{t('walletTransactionHistory.aucuneTransaction')}</p>
            <p className="text-sm text-gray-500">
              Vos transactions apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-orange-200 hover:bg-white/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getTransactionIcon(transaction, transaction.status)}
                  <div>
                    <p className="font-medium text-gray-800">
                      {transaction.receiver_id === user?.id ? 'Reçu de' : 'Envoyé à'}{' '}
                      <span className="text-foreground">
                        {transaction.receiver_id === user?.id
                          ? (transaction.sender_name || 'Utilisateur')
                          : (transaction.receiver_name || 'Utilisateur')}
                      </span>
                      {' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        ({transaction.receiver_id === user?.id
                          ? transaction.sender_custom_id
                          : transaction.receiver_custom_id})
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {transaction.method} • {formatDate(transaction.created_at)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`font-bold ${
                    transaction.receiver_id === user?.id
                      ? 'text-[#ff4000]'
                      : 'text-[#ff4000]'
                  }`}>
                    {formatAmount(transaction.amount, transaction)}
                  </p>
                  {getStatusBadge(transaction.status)}
                </div>
              </div>
            ))}

            {transactions.length > INITIAL_DISPLAY_COUNT && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Voir moins' : `Voir tout (${transactions.length} transactions)`}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletTransactionHistory;

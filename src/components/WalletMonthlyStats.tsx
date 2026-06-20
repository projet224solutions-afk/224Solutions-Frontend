import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { TrendingUp, TrendingDown, Activity, Calendar } from 'lucide-react';

interface MonthlyStats {
  totalReceived: number;
  totalSent: number;
  transactionCount: number;
  netChange: number;
}

export default function WalletMonthlyStats() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<MonthlyStats>({
    totalReceived: 0,
    totalSent: 0,
    transactionCount: 0,
    netChange: 0
  });
  const [walletCurrency, setWalletCurrency] = useState<string>('GNF');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadMonthlyStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadMonthlyStats = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Wallet de l'utilisateur (id + devise) — MÊME source que le solde et l'historique
      const { data: wallet, error: walletErr } = await supabase
        .from('wallets')
        .select('id, currency')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletErr) throw walletErr;
      if (!wallet?.id) {
        setStats({ totalReceived: 0, totalSent: 0, transactionCount: 0, netChange: 0 });
        return;
      }
      setWalletCurrency(wallet.currency || 'GNF');

      // Premier et dernier jour du mois actuel
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Grand livre du wallet (wallet_transactions) : MÊME table que les transactions
      // récentes affichées → le bilan se réconcilie avec ce que l'utilisateur voit.
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('amount, sender_wallet_id, receiver_wallet_id, status, created_at')
        .or(`sender_wallet_id.eq.${wallet.id},receiver_wallet_id.eq.${wallet.id}`)
        .eq('status', 'completed')
        .gte('created_at', firstDay.toISOString())
        .lte('created_at', lastDay.toISOString());

      if (error) throw error;

      let totalReceived = 0;
      let totalSent = 0;
      const txArray = (transactions || []) as Array<{ receiver_wallet_id: string; sender_wallet_id: string; amount: number }>;
      const transactionCount = txArray.length;

      txArray.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.receiver_wallet_id === wallet.id) {
          totalReceived += amt;
        } else if (tx.sender_wallet_id === wallet.id) {
          totalSent += amt;
        }
      });

      const netChange = totalReceived - totalSent;

      setStats({
        totalReceived,
        totalSent,
        transactionCount,
        netChange
      });
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = useFormatCurrency();

  const getMonthName = () => {
    return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Statistiques du mois
        </CardTitle>
        <CardDescription>
          {getMonthName()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Revenus */}
          <div className="bg-orange-50 dark:bg-[#ff4000] rounded-lg p-4 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-[#ff4000]" />
              <span className="text-sm font-medium text-[#ff4000] dark:text-[#ff4000]">{t('walletMonthlyStats.recu')}</span>
            </div>
            <p className="text-2xl font-bold text-[#ff4000]">
              {formatCurrency(stats.totalReceived, walletCurrency)}
            </p>
          </div>

          {/* Dépenses */}
          <div className="bg-orange-50 dark:bg-[#ff4000] rounded-lg p-4 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-[#ff4000]" />
              <span className="text-sm font-medium text-[#ff4000] dark:text-[#ff4000]">{t('walletMonthlyStats.envoye')}</span>
            </div>
            <p className="text-2xl font-bold text-[#ff4000]">
              {formatCurrency(stats.totalSent, walletCurrency)}
            </p>
          </div>

          {/* Transactions */}
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Transactions</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {stats.transactionCount}
            </p>
          </div>
        </div>

        {/* Bilan du mois */}
        <div className={`mt-4 rounded-lg p-4 border ${
          stats.netChange >= 0
            ? 'bg-orange-50 dark:bg-[#ff4000] border-orange-200'
            : 'bg-orange-50 dark:bg-[#ff4000] border-orange-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('walletMonthlyStats.bilanDuMois')}</span>
            <div className="flex items-center gap-2">
              {stats.netChange >= 0 ? (
                <TrendingUp className="h-5 w-5 text-[#ff4000]" />
              ) : (
                <TrendingDown className="h-5 w-5 text-[#ff4000]" />
              )}
              <span className={`text-xl font-bold ${
                stats.netChange >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'
              }`}>
                {stats.netChange >= 0 ? '+' : ''}{formatCurrency(stats.netChange, walletCurrency)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

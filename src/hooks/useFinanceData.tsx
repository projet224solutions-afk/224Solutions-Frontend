import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WalletDetail {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  wallet_status: string;
  created_at: string;
  updated_at: string;
  custom_id?: string;
  profiles?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    status: string;
  };
}

export interface Transaction {
  id: string;
  sender_id: string | null;
  receiver_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  transaction_type?: string | null;
  fee?: number;
  description?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: any;
  custom_id?: string;
  public_id?: string;
}

export interface FinanceStats {
  total_revenue: number;
  total_commission: number;
  pending_payments: number;
  active_wallets: number;
}

export function useFinanceData(enabled: boolean = true) {
  const [stats, setStats] = useState<FinanceStats>({
    total_revenue: 0,
    total_commission: 0,
    pending_payments: 0,
    active_wallets: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<WalletDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchInProgressRef = useRef(false);

  const fetchData = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    try {
      setLoading(true);

      // 🚀 PARALLEL fetch: transactions + wallets + profiles + user_ids in 2 batches
      const [transResult, walletsResult] = await Promise.all([
        supabase
          .from('wallet_transactions')
          .select('id, sender_wallet_id, receiver_wallet_id, amount, currency, status, transaction_type, fee, description, created_at, updated_at, metadata')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('wallets')
          .select('id, user_id, balance, currency, wallet_status, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (transResult.error) {
        console.error('❌ Erreur récupération transactions:', transResult.error);
        throw transResult.error;
      }

      const mappedTransactions = (transResult.data || []).map((t: any) => ({
        id: t.id,
        sender_id: t.sender_wallet_id,
        receiver_id: t.receiver_wallet_id,
        amount: Number(t.amount),
        currency: t.currency || 'GNF',
        status: t.status,
        method: t.transaction_type,
        transaction_type: t.transaction_type,
        fee: Number(t.fee || 0),
        description: t.description,
        created_at: t.created_at,
        updated_at: t.updated_at || t.created_at,
        metadata: t.metadata,
        custom_id: t.id,
        public_id: t.id
      }));

      // 🚀 FIX: Batch-load profiles + user_ids instead of N+1 queries
      let enrichedWallets: any[] = [];
      if (walletsResult.data && walletsResult.data.length > 0) {
        const userIds = walletsResult.data.map(w => w.user_id);

        // Two parallel batch queries instead of N individual queries
        const [profilesResult, userIdsResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone, role, status')
            .in('id', userIds),
          supabase
            .from('user_ids')
            .select('user_id, custom_id')
            .in('user_id', userIds),
        ]);

        const profilesMap = new Map(
          (profilesResult.data || []).map(p => [p.id, p])
        );
        const userIdsMap = new Map(
          (userIdsResult.data || []).map(u => [u.user_id, u.custom_id])
        );

        enrichedWallets = walletsResult.data.map(wallet => ({
          ...wallet,
          profiles: profilesMap.get(wallet.user_id) || null,
          custom_id: userIdsMap.get(wallet.user_id) || null,
        }));
      }

      if (walletsResult.error) {
        console.error('Erreur lors de la récupération des wallets:', walletsResult.error);
        throw walletsResult.error;
      }

      setTransactions(mappedTransactions);
      setWallets(enrichedWallets);

      // Calculate stats from already-loaded data (no extra queries)
      const totalRevenue = mappedTransactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalCommission = mappedTransactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + Number(t.fee || 0), 0);

      const pendingPayments = mappedTransactions
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const activeWallets = enrichedWallets
        .filter((w: any) => w.wallet_status === 'active')
        .length;

      setStats({
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        pending_payments: pendingPayments,
        active_wallets: activeWallets,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des données financières:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchData();

    // 🚀 FIX: Debounce realtime updates instead of refetching on every change
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchData(), 2000);
    };

    const walletsChannel = supabase
      .channel('wallets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, debouncedFetch)
      .subscribe();

    const transactionsChannel = supabase
      .channel('wallet-transactions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions' }, debouncedFetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      walletsChannel.unsubscribe();
      transactionsChannel.unsubscribe();
    };
  }, [enabled, fetchData]);

  return {
    stats,
    transactions,
    wallets,
    loading,
    refetch: fetchData,
  };
}

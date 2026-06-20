/**
 * 💳 HOOK: GESTION WALLET COMPLÈTE
 * Hook principal pour toutes les opérations wallet
 *
 * ⚡ Phase 6: Migré depuis Edge Functions (wallet-operations) vers le backend Node.js
 * Utilise backendFetch → /api/v2/wallet/* au lieu de supabase.functions.invoke('wallet-operations')
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  depositToWallet,
  withdrawFromWallet,
  transferToWallet,
  getWalletBalance,
  initializeWallet,
  getWalletTransactions,
  getWalletPinStatus,
} from '@/services/walletBackendService';

export interface WalletData {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  currency_locked?: boolean;
  currency_lock_reason?: string | null;
  wallet_status: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  pin_enabled?: boolean;
  pin_failed_attempts?: number;
  pin_locked_until?: string | null;
  pin_updated_at?: string | null;
  daily_limit: number;
  monthly_limit: number;
  created_at: string;
}

export interface TransactionData {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  created_at: string;
  metadata: any;
}

export interface WalletStats {
  balance: number;
  total_received: number;
  total_sent: number;
  transactions_count: number;
  last_transaction: string | null;
}

export const useWallet = () => {
  const { user } = useAuth();
  // ID unique par instance pour éviter les conflits de canaux Supabase entre composants
  const instanceId = useRef(Math.random().toString(36).slice(2)).current;
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Charger le wallet
  const loadWallet = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let balanceResponse = await getWalletBalance();
      if (!balanceResponse.success || !balanceResponse.data) {
        const initResponse = await initializeWallet();
        if (!initResponse.success) {
          setWallet(null);
          return;
        }
        balanceResponse = await getWalletBalance();
      }

      const walletData = balanceResponse.data;
      if (walletData) {
        const pinStatusResponse = await getWalletPinStatus();
        const pinStatus = pinStatusResponse.success ? pinStatusResponse.data : undefined;

        const normalizedWallet: WalletData = {
          id: String(walletData.id),
          user_id: user.id,
          balance: Number(walletData.balance || 0),
          currency: walletData.currency || 'GNF',
          currency_locked: Boolean(walletData.currency_locked ?? true),
          currency_lock_reason: (walletData as any).currency_lock_reason ?? null,
          wallet_status: walletData.wallet_status || 'active',
          is_blocked: Boolean(walletData.is_blocked),
          blocked_reason: null,
          pin_enabled: pinStatus?.pin_enabled,
          pin_failed_attempts: pinStatus?.pin_failed_attempts,
          pin_locked_until: pinStatus?.pin_locked_until,
          pin_updated_at: pinStatus?.pin_updated_at,
          daily_limit: Number(walletData.daily_limit || 0),
          monthly_limit: Number(walletData.monthly_limit || 0),
          created_at: walletData.created_at || new Date().toISOString(),
        };

        setWallet(normalizedWallet);

        const txResponse = await getWalletTransactions({ limit: 100, offset: 0 });
        const txData = txResponse.success ? (txResponse.data || []) : [];

        const totalReceived = txData
          .filter((t) => ['deposit', 'mobile_money_in', 'admin_credit', 'escrow_release'].includes(t.transaction_type))
          .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
        const totalSent = txData
          .filter((t) => ['withdrawal', 'mobile_money_out', 'transfer'].includes(t.transaction_type))
          .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

        setStats({
          balance: normalizedWallet.balance,
          total_received: totalReceived,
          total_sent: totalSent,
          transactions_count: txData.length,
          last_transaction: txData[0]?.created_at || null,
        });
      } else {
        setWallet(null);
      }

    } catch (error: any) {
      console.error('❌ Erreur loadWallet:', error);
      toast.error('Erreur chargement wallet');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Charger les transactions
  const loadTransactions = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await getWalletTransactions({ limit: 50, offset: 0 });
      if (!response.success) throw new Error(response.error || 'Erreur chargement transactions');

      const mapped: TransactionData[] = (response.data || []).map((tx: any) => ({
        id: String(tx.id),
        sender_id: String(tx.sender_wallet_id || ''),
        receiver_id: String(tx.receiver_wallet_id || ''),
        amount: Number(tx.amount || 0),
        currency: tx.currency || 'GNF',
        method: tx.transaction_type || 'wallet',
        status: tx.status || 'completed',
        created_at: tx.created_at,
        metadata: tx.metadata || {},
      }));

      setTransactions(mapped);

    } catch (error) {
      console.error('❌ Erreur loadTransactions:', error);
    }
  }, [user?.id]);

  // Dépôt — via backend Node.js /api/v2/wallet/deposit
  const deposit = async (amount: number, _method: string = 'card', metadata: any = {}) => {
    if (!wallet) {
      toast.error('Wallet non disponible');
      return false;
    }

    setProcessing(true);

    try {
      const result = await depositToWallet(
        amount,
        metadata.description || 'Dépôt sur wallet',
        metadata.reference
      );

      if (!result.success) {
        toast.error(result.error || 'Erreur lors du dépôt');
        return false;
      }

      toast.success(`Dépôt de ${amount.toLocaleString()} ${wallet?.currency || 'GNF'} réussi !`);
      await loadWallet();
      await loadTransactions();

      window.dispatchEvent(new Event('wallet-updated'));
      return true;

    } catch (error: any) {
      console.error('❌ Erreur deposit:', error);
      toast.error(error.message || 'Erreur lors du dépôt');
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Retrait — via backend Node.js /api/v2/wallet/withdraw
  const withdraw = async (amount: number, _method: string = 'card', metadata: any = {}) => {
    if (!wallet) {
      toast.error('Wallet non disponible');
      return false;
    }

    if (amount > wallet.balance) {
      toast.error('Solde insuffisant');
      return false;
    }

    setProcessing(true);

    try {
      const result = await withdrawFromWallet(
        amount,
        metadata.description || 'Retrait de wallet',
        metadata.pin
      );

      if (!result.success) {
        toast.error(result.error || 'Erreur lors du retrait');
        return false;
      }

      toast.success(`Retrait de ${amount.toLocaleString()} ${wallet?.currency || 'GNF'} réussi !`);
      await loadWallet();
      await loadTransactions();

      window.dispatchEvent(new Event('wallet-updated'));
      return true;

    } catch (error: any) {
      console.error('❌ Erreur withdraw:', error);
      toast.error(error.message || 'Erreur lors du retrait');
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Transfert P2P — via backend Node.js /api/v2/wallet/transfer
  const transfer = async (
    recipientId: string,
    amount: number,
    description: string = '',
    metadata: any = {}
  ) => {
    if (!wallet) {
      toast.error('Wallet non disponible');
      return false;
    }

    if (amount > wallet.balance) {
      toast.error('Solde insuffisant');
      return false;
    }

    if (recipientId === user?.id) {
      toast.error('Vous ne pouvez pas transférer à vous-même');
      return false;
    }

    setProcessing(true);

    try {
      const result = await transferToWallet(
        recipientId,
        amount,
        description || 'Transfert',
        metadata.pin
      );

      if (!result.success) {
        toast.error(result.error || 'Erreur lors du transfert');
        return false;
      }

      toast.success(`Transfert de ${amount.toLocaleString()} ${wallet?.currency || 'GNF'} réussi !`);
      await loadWallet();
      await loadTransactions();

      window.dispatchEvent(new Event('wallet-updated'));
      return true;

    } catch (error: any) {
      console.error('❌ Erreur transfer:', error);
      toast.error(error.message || 'Erreur lors du transfert');
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Actualiser
  const refresh = useCallback(async () => {
    await Promise.all([loadWallet(), loadTransactions()]);
  }, [loadWallet, loadTransactions]);

  // Charger au montage
  useEffect(() => {
    loadWallet();
    loadTransactions();
  }, [loadWallet, loadTransactions]);

  // Écouter les mises à jour (même session)
  useEffect(() => {
    const handleUpdate = () => {
      loadWallet();
      loadTransactions();
    };

    window.addEventListener('wallet-updated', handleUpdate);
    return () => window.removeEventListener('wallet-updated', handleUpdate);
  }, [loadWallet, loadTransactions]);

  // Souscription temps réel : réagit si le PDG change la devise depuis une autre session
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`wallet-hook-${user.id}-${instanceId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        void loadWallet();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadWallet]);

  return {
    wallet,
    transactions,
    stats,
    loading,
    processing,
    deposit,
    withdraw,
    transfer,
    refresh,
    // Helpers
    balance: wallet?.balance || 0,
    currency: wallet?.currency || 'GNF',
    publicId: wallet?.id,
    isBlocked: wallet?.is_blocked || false
  };
};

export default useWallet;

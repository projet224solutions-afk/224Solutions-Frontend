/**
 * 💳🛡️ HOOK WALLET ENTERPRISE - VERSION ULTRA ROBUSTE
 * Gestion wallet avec protection maximale des transactions financières
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMoneyFormat } from '@/components/Money';
import { toast } from 'sonner';
import { circuitBreaker } from '@/lib/circuitBreaker';
import { retryWithBackoff, RetryConfig } from '@/lib/retryWithBackoff';
import { depositToWallet, transferToWallet, withdrawFromWallet } from '@/services/walletBackendService';

export interface WalletData {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  wallet_status: string;
  is_blocked: boolean;
  blocked_reason: string | null;
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

interface OperationResult {
  success: boolean;
  error?: string;
  data?: any;
  transactionId?: string;
}

// Configuration ultra-robuste pour les transactions financières
const FINANCIAL_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 5,
  initialDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  shouldRetry: (error) => {
    // Ne pas retry les erreurs métier
    const nonRetryable = ['insufficient_funds', 'blocked', 'limit_exceeded'];
    return !nonRetryable.some(code => error?.message?.includes(code));
  }
};

const QUERY_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true
};

export const useWalletRobust = () => {
  const { user } = useAuth();
  const { format: fmtMoney, userCurrency } = useMoneyFormat();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Protection contre les doubles transactions
  const pendingOperationsRef = useRef<Set<string>>(new Set());
  const operationLockRef = useRef<Map<string, number>>(new Map());

  // Circuit breaker names
  const queryCircuitName = 'wallet-query';
  const transactionCircuitName = 'wallet-transaction';

  // Subscribe to circuit state changes
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(transactionCircuitName, (state) => {
      if (state === 'OPEN') {
        toast.error('Service de paiement temporairement indisponible');
      }
    });
    return unsubscribe;
  }, []);

  // Générer une clé d'idempotence
  const generateIdempotencyKey = useCallback((
    operation: string,
    amount: number,
    recipientId?: string
  ): string => {
    const base = `${user?.id}_${operation}_${amount}_${recipientId || 'self'}_${Date.now()}`;
    return btoa(base).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  }, [user?.id]);

  // Vérifier si une opération est en cours
  const isOperationLocked = useCallback((key: string): boolean => {
    const lockTime = operationLockRef.current.get(key);
    if (!lockTime) return false;

    // Verrou expiré après 60 secondes
    if (Date.now() - lockTime > 60000) {
      operationLockRef.current.delete(key);
      return false;
    }

    return true;
  }, []);

  // Acquérir un verrou d'opération
  const acquireOperationLock = useCallback((key: string): boolean => {
    if (isOperationLocked(key)) {
      return false;
    }
    operationLockRef.current.set(key, Date.now());
    return true;
  }, [isOperationLocked]);

  // Libérer un verrou
  const releaseOperationLock = useCallback((key: string): void => {
    operationLockRef.current.delete(key);
  }, []);

  // Charger le wallet de manière robuste
  const loadWallet = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      setLoading(false);
      return false;
    }

    try {
      setLoading(true);
      setLastError(null);

      const walletData = await circuitBreaker.execute(queryCircuitName, async () => {
        return await retryWithBackoff(async () => {
          // eslint-disable-next-line prefer-const
          let { data: existingWallet, error: walletError } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .maybeSingle();

          if (walletError) throw walletError;

          // Créer le wallet si inexistant
          if (!existingWallet) {
            console.log('📝 Initialisation wallet via RPC...');
            const { data: _initResult, error: rpcError } = await supabase
              .rpc('initialize_user_wallet', { p_user_id: user.id });

            if (rpcError) throw rpcError;

            // Recharger après création
            const { data: newWallet, error: reloadError } = await supabase
              .from('wallets')
              .select('*')
              .eq('user_id', user.id)
              .order('updated_at', { ascending: false })
              .maybeSingle();

            if (reloadError) throw reloadError;
            existingWallet = newWallet;
          }

          return existingWallet;
        }, QUERY_RETRY_CONFIG);
      });

      if (walletData) {
        setWallet({ ...walletData, id: String(walletData.id) } as WalletData);

        // Charger les stats
        const { data: txData } = await supabase
          .from('wallet_transactions')
          .select('amount, transaction_type, created_at')
          .or(`sender_wallet_id.eq.${walletData.id},receiver_wallet_id.eq.${walletData.id}`)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(100);

        const totalReceived = txData?.filter(t =>
          t.transaction_type === 'deposit' || t.transaction_type === 'mobile_money_in'
        ).reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

        const totalSent = txData?.filter(t =>
          t.transaction_type === 'withdrawal' || t.transaction_type === 'mobile_money_out'
        ).reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

        setStats({
          balance: walletData.balance,
          total_received: totalReceived,
          total_sent: totalSent,
          transactions_count: txData?.length || 0,
          last_transaction: txData?.[0]?.created_at || null
        });

        return true;
      }

      setWallet(null);
      return false;

    } catch (error: any) {
      console.error('❌ Erreur loadWallet:', error);
      setLastError(error.message);
      toast.error('Erreur chargement wallet');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Charger les transactions
  const loadTransactions = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const data = await circuitBreaker.execute(queryCircuitName, async () => {
        return await retryWithBackoff(async () => {
          const { data, error } = await (supabase
            .from('enhanced_transactions' as any)
            .select('*')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(50) as any);

          if (error) throw error;
          return data;
        }, QUERY_RETRY_CONFIG);
      });

      setTransactions((data || []) as TransactionData[]);
      return true;

    } catch (error: any) {
      console.error('❌ Erreur loadTransactions:', error);
      return false;
    }
  }, [user?.id]);

  // Opération financière sécurisée
  const executeFinancialOperation = async <T>(
    operationType: string,
    amount: number,
    operation: (idempotencyKey: string) => Promise<T>,
    recipientId?: string
  ): Promise<OperationResult> => {
    const operationKey = `${operationType}_${amount}_${recipientId || ''}`;

    // Vérifier le verrou
    if (!acquireOperationLock(operationKey)) {
      return {
        success: false,
        error: 'Une opération similaire est déjà en cours'
      };
    }

    const idempotencyKey = generateIdempotencyKey(operationType, amount, recipientId);

    // Vérifier les opérations en attente
    if (pendingOperationsRef.current.has(idempotencyKey)) {
      releaseOperationLock(operationKey);
      return {
        success: false,
        error: 'Opération déjà en cours de traitement'
      };
    }

    pendingOperationsRef.current.add(idempotencyKey);
    setProcessing(true);
    setOperationInProgress(operationType);
    setLastError(null);

    try {
      const result = await circuitBreaker.execute(transactionCircuitName, async () => {
        return await retryWithBackoff(
          () => operation(idempotencyKey),
          FINANCIAL_RETRY_CONFIG
        );
      });

      // Recharger les données après succès
      await Promise.all([loadWallet(), loadTransactions()]);

      // Émettre l'événement de mise à jour
      window.dispatchEvent(new Event('wallet-updated'));

      return {
        success: true,
        data: result
      };

    } catch (error: any) {
      console.error(`❌ Erreur ${operationType}:`, error);
      setLastError(error.message);

      return {
        success: false,
        error: error.message || `Erreur lors de ${operationType}`
      };
    } finally {
      pendingOperationsRef.current.delete(idempotencyKey);
      releaseOperationLock(operationKey);
      setProcessing(false);
      setOperationInProgress(null);
    }
  };

  // Dépôt sécurisé
  const deposit = async (
    amount: number,
    _method: string = 'card',
    metadata: any = {}
  ): Promise<boolean> => {
    if (!wallet) {
      toast.error('Wallet non disponible');
      return false;
    }

    if (amount <= 0) {
      toast.error('Montant invalide');
      return false;
    }

    const result = await executeFinancialOperation(
      'deposit',
      amount,
      async () => {
        const apiResult = await depositToWallet(
          amount,
          metadata.description || 'Dépôt sur wallet'
        );
        if (!apiResult.success) {
          throw new Error(apiResult.error || 'Erreur lors du dépôt');
        }
        return apiResult;
      }
    );

    if (result.success) {
      toast.success(`Dépôt de ${fmtMoney(amount, userCurrency)} réussi !`);
    } else {
      toast.error(result.error || 'Erreur lors du dépôt');
    }

    return result.success;
  };

  // Retrait sécurisé
  const withdraw = async (
    amount: number,
    _method: string = 'card',
    metadata: any = {}
  ): Promise<boolean> => {
    if (!wallet) {
      toast.error('Wallet non disponible');
      return false;
    }

    if (amount <= 0) {
      toast.error('Montant invalide');
      return false;
    }

    if (amount > wallet.balance) {
      toast.error('Solde insuffisant');
      return false;
    }

    if (wallet.is_blocked) {
      toast.error('Wallet bloqué');
      return false;
    }

    const result = await executeFinancialOperation(
      'withdraw',
      amount,
      async () => {
        const apiResult = await withdrawFromWallet(
          amount,
          metadata.description || 'Retrait de wallet',
          metadata.pin
        );
        if (!apiResult.success) {
          throw new Error(apiResult.error || 'Erreur lors du retrait');
        }
        return apiResult;
      }
    );

    if (result.success) {
      toast.success(`Retrait de ${fmtMoney(amount, userCurrency)} réussi !`);
    } else {
      toast.error(result.error || 'Erreur lors du retrait');
    }

    return result.success;
  };

  // Transfert P2P sécurisé
  const transfer = async (
    recipientId: string,
    amount: number,
    description: string = '',
    metadata: any = {}
  ): Promise<boolean> => {
    if (!wallet) {
      toast.error('Wallet non disponible');
      return false;
    }

    if (amount <= 0) {
      toast.error('Montant invalide');
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

    if (wallet.is_blocked) {
      toast.error('Wallet bloqué');
      return false;
    }

    const result = await executeFinancialOperation(
      'transfer',
      amount,
      async () => {
        const apiResult = await transferToWallet(
          recipientId,
          amount,
          description,
          metadata.pin
        );
        if (!apiResult.success) {
          throw new Error(apiResult.error || 'Erreur lors du transfert');
        }
        return apiResult;
      },
      recipientId
    );

    if (result.success) {
      toast.success(`Transfert de ${fmtMoney(amount, userCurrency)} réussi !`);
    } else {
      toast.error(result.error || 'Erreur lors du transfert');
    }

    return result.success;
  };

  // Actualisation
  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([loadWallet(), loadTransactions()]);
  }, [loadWallet, loadTransactions]);

  // Initialisation
  useEffect(() => {
    if (user?.id) {
      loadWallet();
      loadTransactions();
    }
  }, [user?.id, loadWallet, loadTransactions]);

  // Écouter les mises à jour
  useEffect(() => {
    const handleUpdate = () => {
      loadWallet();
      loadTransactions();
    };

    window.addEventListener('wallet-updated', handleUpdate);
    return () => window.removeEventListener('wallet-updated', handleUpdate);
  }, [loadWallet, loadTransactions]);

  return {
    // Données
    wallet,
    transactions,
    stats,

    // États
    loading,
    processing,
    operationInProgress,
    lastError,

    // Opérations
    deposit,
    withdraw,
    transfer,
    refresh,

    // Helpers
    balance: wallet?.balance || 0,
    currency: wallet?.currency || 'GNF',
    publicId: wallet?.id,
    isBlocked: wallet?.is_blocked || false,
    canOperate: !processing && !wallet?.is_blocked && wallet !== null
  };
};

export default useWalletRobust;

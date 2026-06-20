/**
 * 💰🛡️ HOOK TRANSACTIONS FINANCIÈRES - VERSION ENTERPRISE
 * Gestion ultra-sécurisée des transactions inter-systèmes
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { circuitBreaker } from '@/lib/circuitBreaker';
import { retryWithBackoff, RetryConfig } from '@/lib/retryWithBackoff';

export interface FinancialTransaction {
  id: string;
  user_id: string;
  transaction_type: 'card_to_om' | 'wallet_to_card' | 'card_to_wallet';
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'reversed';
  source_reference?: string;
  destination_reference?: string;
  fees: number;
  api_response?: any;
  error_message?: string;
  metadata?: any;
  created_at: string;
  completed_at?: string;
  idempotency_key?: string;
}

interface TransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  data?: any;
}

// Configuration pour transactions critiques
const CRITICAL_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 5,
  initialDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  shouldRetry: (error) => {
    // Erreurs non-retryables
    const permanent = [
      'insufficient_balance',
      'card_blocked',
      'account_suspended',
      'invalid_amount',
      'duplicate_transaction'
    ];
    return !permanent.some(code =>
      error?.message?.toLowerCase().includes(code.replace('_', ' ')) ||
      (error as any)?.code === code
    );
  }
};

const QUERY_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true
};

export function useFinancialTransactionsRobust() {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Protection contre doubles transactions
  const pendingTransactionsRef = useRef<Set<string>>(new Set());
  const transactionLockRef = useRef<Map<string, number>>(new Map());

  // Circuit breakers names par type d'opération
  const cardOmCircuitName = 'financial-card-om';
  const walletCardCircuitName = 'financial-wallet-card';

  // Subscribe to circuit state changes
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(cardOmCircuitName, (state) => {
      if (state === 'OPEN') {
        toast.error('Service Orange Money temporairement indisponible');
      }
    });
    return unsubscribe;
  }, []);

  // Générer clé d'idempotence unique
  const generateIdempotencyKey = useCallback((
    type: string,
    amount: number,
    reference: string
  ): string => {
    const timestamp = Date.now();
    const base = `${type}_${amount}_${reference}_${timestamp}`;
    return btoa(base).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  }, []);

  // Acquérir verrou de transaction
  const acquireTransactionLock = useCallback((key: string): boolean => {
    const existingLock = transactionLockRef.current.get(key);

    // Verrou expiré après 2 minutes
    if (existingLock && Date.now() - existingLock < 120000) {
      return false;
    }

    transactionLockRef.current.set(key, Date.now());
    return true;
  }, []);

  // Libérer verrou
  const releaseTransactionLock = useCallback((key: string): void => {
    transactionLockRef.current.delete(key);
  }, []);

  // Charger les transactions
  const loadTransactions = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);

      const data = await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .from('financial_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data;
      }, QUERY_RETRY_CONFIG);

      setTransactions((data || []) as FinancialTransaction[]);
      return true;

    } catch (error: any) {
      console.error('Erreur chargement transactions:', error);
      toast.error('Erreur lors du chargement des transactions');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Vérifier le statut d'une transaction
  const checkTransactionStatus = useCallback(async (
    transactionId: string
  ): Promise<FinancialTransaction | null> => {
    try {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) throw error;
      return data as FinancialTransaction;

    } catch (error) {
      console.error('Erreur vérification statut:', error);
      return null;
    }
  }, []);

  // Attendre la confirmation d'une transaction
  const waitForTransactionConfirmation = useCallback(async (
    transactionId: string,
    maxWaitMs: number = 30000,
    pollIntervalMs: number = 2000
  ): Promise<FinancialTransaction | null> => {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const transaction = await checkTransactionStatus(transactionId);

      if (transaction) {
        if (transaction.status === 'completed') {
          return transaction;
        }
        if (transaction.status === 'failed' || transaction.status === 'cancelled') {
          throw new Error(transaction.error_message || 'Transaction échouée');
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Timeout: confirmation de transaction non reçue');
  }, [checkTransactionStatus]);

  // Transfert carte virtuelle → Orange Money (SÉCURISÉ)
  const transferCardToOrangeMoney = async (
    cardId: string,
    phoneNumber: string,
    amount: number
  ): Promise<TransactionResult> => {
    const lockKey = `card_to_om_${cardId}_${amount}`;

    if (!acquireTransactionLock(lockKey)) {
      return {
        success: false,
        error: 'Une transaction similaire est déjà en cours'
      };
    }

    const idempotencyKey = generateIdempotencyKey('card_to_om', amount, phoneNumber);

    if (pendingTransactionsRef.current.has(idempotencyKey)) {
      releaseTransactionLock(lockKey);
      return {
        success: false,
        error: 'Transaction déjà en cours de traitement'
      };
    }

    pendingTransactionsRef.current.add(idempotencyKey);
    setProcessing(true);
    setCurrentOperation('card_to_om');
    setLastError(null);

    try {
      console.log('💳→📱 Lancement transfert carte vers Orange Money');

      // TODO: La Edge Function 'card-to-orange-money' n'est pas encore déployée
      toast.error('Le transfert carte → Orange Money est temporairement indisponible');
      return { success: false, error: 'Service temporairement indisponible' };

    } catch (error: any) {
      console.error('Erreur transfert carte→OM:', error);
      const errorMsg = error.message || 'Erreur lors du transfert';
      setLastError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };

    } finally {
      pendingTransactionsRef.current.delete(idempotencyKey);
      releaseTransactionLock(lockKey);
      setProcessing(false);
      setCurrentOperation(null);
    }
  };

  // Recharge carte depuis wallet (SÉCURISÉ)
  const rechargeCardFromWallet = async (
    cardId: string,
    amount: number
  ): Promise<TransactionResult> => {
    const lockKey = `wallet_to_card_${cardId}_${amount}`;

    if (!acquireTransactionLock(lockKey)) {
      return {
        success: false,
        error: 'Une opération similaire est déjà en cours'
      };
    }

    const idempotencyKey = generateIdempotencyKey('wallet_to_card', amount, cardId);

    if (pendingTransactionsRef.current.has(idempotencyKey)) {
      releaseTransactionLock(lockKey);
      return {
        success: false,
        error: 'Opération déjà en cours'
      };
    }

    pendingTransactionsRef.current.add(idempotencyKey);
    setProcessing(true);
    setCurrentOperation('wallet_to_card');
    setLastError(null);

    try {
      console.log('💰→💳 Lancement recharge carte depuis wallet');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const result = await circuitBreaker.execute(walletCardCircuitName, async () => {
        return await retryWithBackoff(async () => {
          const { data, error } = await supabase.rpc('process_wallet_to_card', {
            p_user_id: user.id,
            p_card_id: cardId,
            p_amount: amount,
            p_idempotency_key: idempotencyKey
          });

          if (error) throw error;
          return data;
        }, CRITICAL_RETRY_CONFIG);
      });

      toast.success('✅ Carte virtuelle rechargée avec succès !');
      await loadTransactions();

      window.dispatchEvent(new Event('wallet-updated'));

      return { success: true, transactionId: result };

    } catch (error: any) {
      console.error('Erreur recharge carte:', error);
      const errorMsg = error.message || 'Erreur lors de la recharge';
      setLastError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };

    } finally {
      pendingTransactionsRef.current.delete(idempotencyKey);
      releaseTransactionLock(lockKey);
      setProcessing(false);
      setCurrentOperation(null);
    }
  };

  // Recharge wallet depuis carte (SÉCURISÉ)
  const rechargeWalletFromCard = async (
    cardId: string,
    amount: number
  ): Promise<TransactionResult> => {
    const lockKey = `card_to_wallet_${cardId}_${amount}`;

    if (!acquireTransactionLock(lockKey)) {
      return {
        success: false,
        error: 'Une opération similaire est déjà en cours'
      };
    }

    const idempotencyKey = generateIdempotencyKey('card_to_wallet', amount, cardId);

    if (pendingTransactionsRef.current.has(idempotencyKey)) {
      releaseTransactionLock(lockKey);
      return {
        success: false,
        error: 'Opération déjà en cours'
      };
    }

    pendingTransactionsRef.current.add(idempotencyKey);
    setProcessing(true);
    setCurrentOperation('card_to_wallet');
    setLastError(null);

    try {
      console.log('💳→💰 Lancement recharge wallet depuis carte');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const result = await circuitBreaker.execute(walletCardCircuitName, async () => {
        return await retryWithBackoff(async () => {
          const { data, error } = await supabase.rpc('process_card_to_wallet', {
            p_user_id: user.id,
            p_card_id: cardId,
            p_amount: amount,
            p_idempotency_key: idempotencyKey
          });

          if (error) throw error;
          return data;
        }, CRITICAL_RETRY_CONFIG);
      });

      toast.success('✅ Wallet rechargé avec succès !');
      await loadTransactions();

      window.dispatchEvent(new Event('wallet-updated'));

      return { success: true, transactionId: result };

    } catch (error: any) {
      console.error('Erreur recharge wallet:', error);
      const errorMsg = error.message || 'Erreur lors de la recharge';
      setLastError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };

    } finally {
      pendingTransactionsRef.current.delete(idempotencyKey);
      releaseTransactionLock(lockKey);
      setProcessing(false);
      setCurrentOperation(null);
    }
  };

  // Calculer les frais
  const calculateFees = useCallback((amount: number, type: string): number => {
    const feeRates: Record<string, number> = {
      'card_to_om': 0.02,    // 2%
      'wallet_to_card': 0.01, // 1%
      'card_to_wallet': 0.01  // 1%
    };

    const rate = feeRates[type] || 0;
    return Math.ceil(amount * rate);
  }, []);

  // Annuler une transaction en attente
  const cancelPendingTransaction = useCallback(async (
    transactionId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('financial_transactions')
        .update({
          status: 'cancelled',
          error_message: 'Annulé par l\'utilisateur'
        })
        .eq('id', transactionId)
        .eq('status', 'pending');

      if (error) throw error;

      await loadTransactions();
      toast.success('Transaction annulée');
      return true;

    } catch (_error: any) {
      toast.error('Impossible d\'annuler la transaction');
      return false;
    }
  }, [loadTransactions]);

  return {
    // État
    loading,
    processing,
    transactions,
    currentOperation,
    lastError,

    // Opérations
    loadTransactions,
    transferCardToOrangeMoney,
    rechargeCardFromWallet,
    rechargeWalletFromCard,

    // Utilitaires
    calculateFees,
    checkTransactionStatus,
    waitForTransactionConfirmation,
    cancelPendingTransaction,

    // Helpers
    canOperate: !processing,
    hasPendingTransactions: transactions.some(t => t.status === 'pending')
  };
}

export default useFinancialTransactionsRobust;

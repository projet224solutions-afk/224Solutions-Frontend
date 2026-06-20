/**
 * HOOK STRIPE PAYMENT
 * Gestion complète des paiements Stripe
 * 224SOLUTIONS
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse
} from '@/types/stripePayment';
import type { Database } from '@/integrations/supabase/types';

// Use the database type for stripe transactions
type StripeTransactionRow = Database['public']['Tables']['stripe_transactions']['Row'];

interface UseStripePaymentOptions {
  onSuccess?: (paymentIntentId: string, transactionId: string) => void;
  onError?: (error: string) => void;
}

export function useStripePayment(options: UseStripePaymentOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<CreatePaymentIntentResponse | null>(null);

  /**
   * Créer un PaymentIntent
   */
  const createPaymentIntent = useCallback(async (
    request: CreatePaymentIntentRequest
  ): Promise<CreatePaymentIntentResponse | null> => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Creating PaymentIntent:', {
        amount: request.amount,
        currency: request.currency,
        seller_id: request.seller_id,
      });

      const { data, error: apiError } = await supabase.functions.invoke<CreatePaymentIntentResponse>(
        'create-payment-intent',
        { body: request }
      );

      if (apiError) {
        throw new Error(apiError.message || 'Failed to create payment intent');
      }

      const response = data as any;
      const secret = response?.client_secret || response?.clientSecret;
      if (!secret) {
        throw new Error(response?.error || 'No client secret returned');
      }

      const normalized: CreatePaymentIntentResponse = {
        success: true,
        client_secret: secret,
        payment_intent_id: response.payment_intent_id || response.paymentIntentId || '',
        transaction_id: response.transaction_id || '',
        amount: response.amount || request.amount,
        currency: response.currency || request.currency || 'GNF',
        commission_amount: response.commission_amount || 0,
        seller_net_amount: response.seller_net_amount || 0,
      };

      console.log('✅ PaymentIntent created:', normalized.payment_intent_id);
      setPaymentIntent(normalized);
      return normalized;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du paiement';
      console.error('❌ Create PaymentIntent error:', err);
      setError(message);
      toast.error(message);
      options.onError?.(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  /**
   * Récupérer une transaction par ID
   */
  const getTransaction = useCallback(async (
    transactionId: string
  ): Promise<StripeTransactionRow | null> => {
    try {
      const { data, error: queryError } = await supabase
        .from('stripe_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (queryError) {
        throw queryError;
      }

      return data;
    } catch (err) {
      console.error('❌ Get transaction error:', err);
      return null;
    }
  }, []);

  /**
   * Récupérer les transactions d'un utilisateur
   */
  const getUserTransactions = useCallback(async (
    userId: string,
    limit = 20
  ): Promise<StripeTransactionRow[]> => {
    try {
      const { data, error: queryError } = await supabase
        .from('stripe_transactions')
        .select('*')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (queryError) {
        throw queryError;
      }

      return data || [];
    } catch (err) {
      console.error('❌ Get user transactions error:', err);
      return [];
    }
  }, []);

  /**
   * Récupérer les transactions d'un vendeur
   */
  const getSellerTransactions = useCallback(async (
    sellerId: string,
    status?: string,
    limit = 50
  ): Promise<StripeTransactionRow[]> => {
    try {
      let query = supabase
        .from('stripe_transactions')
        .select('*')
        .eq('seller_id', sellerId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error: queryError } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (queryError) {
        throw queryError;
      }

      return data || [];
    } catch (err) {
      console.error('❌ Get seller transactions error:', err);
      return [];
    }
  }, []);

  /**
   * Obtenir les statistiques de transactions
   */
  const getTransactionStats = useCallback(async (
    userId: string,
    userType: 'buyer' | 'seller'
  ) => {
    try {
      const field = userType === 'buyer' ? 'buyer_id' : 'seller_id';

      const { data, error: queryError } = await supabase
        .from('stripe_transactions')
        .select('status, amount, currency, commission_amount, seller_net_amount')
        .eq(field, userId);

      if (queryError) {
        throw queryError;
      }

      const stats = {
        total_transactions: data.length,
        successful_transactions: data.filter(t => t.status === 'SUCCEEDED').length,
        failed_transactions: data.filter(t => t.status === 'FAILED').length,
        pending_transactions: data.filter(t => t.status === 'PENDING').length,
        total_amount: data
          .filter(t => t.status === 'SUCCEEDED')
          .reduce((sum, t) => sum + t.amount, 0),
        total_commission: userType === 'seller'
          ? data
              .filter(t => t.status === 'SUCCEEDED')
              .reduce((sum, t) => sum + (t.commission_amount || 0), 0)
          : 0,
        net_amount: userType === 'seller'
          ? data
              .filter(t => t.status === 'SUCCEEDED')
              .reduce((sum, t) => sum + (t.seller_net_amount || 0), 0)
          : 0,
      };

      return stats;
    } catch (err) {
      console.error('❌ Get transaction stats error:', err);
      return null;
    }
  }, []);

  /**
   * Reset l'état
   */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setPaymentIntent(null);
  }, []);

  return {
    // État
    loading,
    error,
    paymentIntent,

    // Actions
    createPaymentIntent,
    getTransaction,
    getUserTransactions,
    getSellerTransactions,
    getTransactionStats,
    reset,
  };
}

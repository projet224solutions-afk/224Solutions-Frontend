/**
 * 🔐 SERVICE DE PAIEMENT (LEGACY)
 * Note: ChapChapPay est maintenant le provider principal
 * Ce service est conservé pour rétrocompatibilité uniquement
 */

import { supabase } from '@/integrations/supabase/client';

export type JomyPaymentMethod = 'OM' | 'MOMO' | 'VISA' | 'MASTERCARD' | 'KULU';

export interface JomyPaymentRequest {
  amount: number;
  currency?: string;
  payerPhone?: string;
  paymentMethod: JomyPaymentMethod;
  orderId: string;
  description?: string;
  successUrl?: string;
  failureUrl?: string;
  callbackUrl?: string;
  useGateway?: boolean;
  metadata?: Record<string, unknown>;
}

export interface JomyPaymentResult {
  success: boolean;
  transactionId?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
}

export interface JomyPaymentStatus {
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  transactionId: string;
  amount?: number;
  paidAmount?: number;
  fees?: number;
  message?: string;
}

export class JomyPaymentService {
  /**
   * Initialise un paiement via Jomy.africa
   */
  static async initializePayment(request: JomyPaymentRequest): Promise<JomyPaymentResult> {
    console.log('[JomyPaymentService] Initializing payment:', request);

    try {
        const { data, error } = await supabase.functions.invoke('djomy-payment', {
          body: {
            amount: request.amount,
            currency: request.currency || 'GNF',
            payerPhone: request.payerPhone,
            paymentMethod: request.paymentMethod,
            orderId: request.orderId,
            description: request.description,
            // 🔁 correspond aux champs attendus par l'edge function djomy-payment
            returnUrl: request.successUrl,
            cancelUrl: request.failureUrl,
            callbackUrl: request.callbackUrl,
            useGateway: request.useGateway ?? false,
            metadata: request.metadata,
          }
        });

      if (error) {
        console.error('[JomyPaymentService] Error:', error);
        return {
          success: false,
          error: error.message || 'Erreur lors de l\'initialisation du paiement'
        };
      }

      console.log('[JomyPaymentService] Payment initialized:', data);
      return {
        success: data.success,
        transactionId: data.transactionId,
        redirectUrl: data.redirectUrl,
        message: data.message,
        error: data.error
      };

    } catch (err) {
      console.error('[JomyPaymentService] Exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Vérifie le statut d'un paiement
   */
  static async verifyPayment(transactionId: string): Promise<JomyPaymentStatus | null> {
    console.log('[JomyPaymentService] Verifying payment:', transactionId);

    try {
      const { data, error } = await supabase.functions.invoke('djomy-verify', {
        body: { transactionId }
      });

      if (error) {
        console.error('[JomyPaymentService] Verify error:', error);
        return null;
      }

      return {
        status: data.status,
        transactionId: data.transactionId,
        amount: data.amount,
        paidAmount: data.paidAmount,
        fees: data.fees,
        message: data.message
      };

    } catch (err) {
      console.error('[JomyPaymentService] Verify exception:', err);
      return null;
    }
  }

  /**
   * Récupère l'historique des paiements d'un utilisateur
   */
  static async getUserPayments(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('djomy_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[JomyPaymentService] Get payments error:', error);
      return [];
    }

    return data;
  }

  /**
   * Récupère un paiement spécifique
   */
  static async getPayment(transactionId: string) {
    const { data, error } = await supabase
      .from('djomy_payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (error) {
      console.error('[JomyPaymentService] Get payment error:', error);
      return null;
    }

    return data;
  }

  /**
   * Met à jour le solde wallet après paiement réussi
   * Note: Cette fonction est gérée par le webhook djomy-webhook
   */
  static async processSuccessfulPayment(
    userId: string,
    amount: number,
    transactionId: string,
    _description?: string
  ): Promise<boolean> {
    try {
      // Le webhook djomy-webhook gère automatiquement la mise à jour du wallet
      // Cette fonction est un fallback manuel si nécessaire
      console.log('[JomyPaymentService] Payment processed via webhook:', { userId, amount, transactionId });

      // Émettre événement de mise à jour
      window.dispatchEvent(new CustomEvent('wallet-updated'));

      return true;
    } catch (err) {
      console.error('[JomyPaymentService] Process payment error:', err);
      return false;
    }
  }

  /**
   * Vérifie si Jomy.africa est disponible
   */
  static async checkAvailability(): Promise<boolean> {
    try {
      // Simple ping pour vérifier la disponibilité
      const { error } = await supabase.functions.invoke('djomy-payment', {
        body: { ping: true }
      });

      return !error;
    } catch {
      return false;
    }
  }
}

export default JomyPaymentService;

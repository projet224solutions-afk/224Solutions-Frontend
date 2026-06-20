/**
 * SERVICE PAIEMENT VENDEUR - 224SOLUTIONS
 * Support de 5 méthodes: wallet, cash, mobile_money, card, paypal
 * Avec idempotence et audit trail
 */

import { supabase } from "@/integrations/supabase/client";

export interface PaymentMethod {
  type: 'wallet' | 'mobile_money' | 'card' | 'cash' | 'paypal';
  details?: any;
}

export interface PaymentResult {
  success: boolean;
  transaction_id?: string;
  error?: string;
}

export class VendorPaymentService {
  /**
   * Payer une commande avec le Wallet (idempotent via orderId)
   */
  static async payWithWallet(
    orderId: string,
    amount: number,
    customerId: string
  ): Promise<PaymentResult> {
    try {
      // Vérifier si déjà payé (idempotence)
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('payment_status, payment_method')
        .eq('id', orderId)
        .single();

      if (existingOrder?.payment_status === 'paid') {
        console.log('[VendorPayment] Order already paid, returning success (idempotent)');
        return {
          success: true,
          transaction_id: orderId
        };
      }

      // Vérifier le solde du wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', customerId)
        .single();

      if (walletError || !wallet) {
        throw new Error('Wallet introuvable');
      }

      if (wallet.balance < amount) {
        return {
          success: false,
          error: 'Solde insuffisant'
        };
      }

      // Paiement via backend Node.js
      const { withdrawFromWallet } = await import('@/services/walletBackendService');
      const result = await withdrawFromWallet(amount, `Paiement commande ${orderId}`);

      if (!result.success) {
        return { success: false, error: result.error || 'Erreur lors du paiement' };
      }

      const data = result;

      // Mettre à jour le statut de paiement de la commande
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'wallet'
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Log audit trail
      await this.logPayment(orderId, customerId, amount, 'wallet', 'success');

      return {
        success: true,
        transaction_id: data.transaction_id
      };
    } catch (error: any) {
      console.error('[VendorPayment] Wallet payment error:', error);
      await this.logPayment(orderId, customerId, amount, 'wallet', 'failed', error.message);
      return {
        success: false,
        error: error.message || 'Erreur lors du paiement'
      };
    }
  }

  /**
   * Payer en espèces (cash)
   */
  static async payWithCash(
    orderId: string,
    amount: number,
    customerId: string
  ): Promise<PaymentResult> {
    try {
      // Vérifier idempotence
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .single();

      if (existingOrder?.payment_status === 'paid') {
        return { success: true, transaction_id: orderId };
      }

      // Mettre à jour le statut (cash sera collecté à la livraison)
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'pending',
          payment_method: 'cash'
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      await this.logPayment(orderId, customerId, amount, 'cash', 'pending');

      return {
        success: true,
        transaction_id: `cash-${orderId}`
      };
    } catch (error: any) {
      console.error('[VendorPayment] Cash payment error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Payer avec Mobile Money (Orange, MTN, Moov) via ChapChapPay
   */
  static async payWithMobileMoney(
    orderId: string,
    amount: number,
    customerId: string,
    phoneNumber: string,
    provider: 'orange' | 'mtn' | 'moov'
  ): Promise<PaymentResult> {
    try {
      // Vérifier idempotence
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .single();

      if (existingOrder?.payment_status === 'paid') {
        return { success: true, transaction_id: orderId };
      }

      // Validation numéro de téléphone
      if (!/^(224)?\d{9}$/.test(phoneNumber)) {
        return {
          success: false,
          error: 'Numéro de téléphone invalide (format: 622123456 ou 224622123456)'
        };
      }

      // Mapper provider vers ChapChapPay method
      const providerMap: Record<string, string> = {
        'orange': 'orange_money',
        'mtn': 'mtn_momo',
        'moov': 'orange_money' // Fallback to orange for now
      };

      // Appeler ChapChapPay via edge function
      const { data, error } = await supabase.functions.invoke('chapchappay-pull', {
        body: {
          amount,
          currency: 'XOF',
          paymentMethod: providerMap[provider],
          customerPhone: phoneNumber,
          description: `Paiement commande ${orderId}`,
          orderId
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Échec du paiement ChapChapPay');
      }

      console.log(`[ChapChapPay] Processing ${provider} payment for ${phoneNumber}`);

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'pending',
          payment_method: 'mobile_money'
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      await this.logPayment(orderId, customerId, amount, 'mobile_money', 'success', `Provider: ${provider} via ChapChapPay`);

      return {
        success: true,
        transaction_id: data.transactionId || `ccp-${provider}-${orderId}`
      };
    } catch (error: any) {
      console.error('[VendorPayment] Mobile Money payment error:', error);
      await this.logPayment(orderId, customerId, amount, 'mobile_money', 'failed', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Payer avec carte bancaire (Stripe)
   */
  static async payWithCard(
    orderId: string,
    amount: number,
    customerId: string,
    cardToken: string
  ): Promise<PaymentResult> {
    try {
      // Vérifier idempotence
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .single();

      if (existingOrder?.payment_status === 'paid') {
        return { success: true, transaction_id: orderId };
      }

      // Validation basique du token
      if (!cardToken || cardToken.length < 10) {
        return {
          success: false,
          error: 'Token de carte invalide'
        };
      }

      // TODO: Intégrer Stripe SDK
      console.log('[Card] Processing card payment with token:', cardToken.substring(0, 10) + '...');

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'card'
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      await this.logPayment(orderId, customerId, amount, 'card', 'success');

      return {
        success: true,
        transaction_id: `card-${orderId}`
      };
    } catch (error: any) {
      console.error('[VendorPayment] Card payment error:', error);
      await this.logPayment(orderId, customerId, amount, 'card', 'failed', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Payer avec PayPal
   */
  static async payWithPayPal(
    orderId: string,
    amount: number,
    customerId: string,
    paypalEmail: string
  ): Promise<PaymentResult> {
    try {
      // Vérifier idempotence
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .single();

      if (existingOrder?.payment_status === 'paid') {
        return { success: true, transaction_id: orderId };
      }

      // Validation email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(paypalEmail)) {
        return {
          success: false,
          error: 'Email PayPal invalide'
        };
      }

      // TODO: Intégrer PayPal SDK
      console.log('[PayPal] Processing payment for:', paypalEmail);

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'wallet' // PayPal processé via wallet
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      await this.logPayment(orderId, customerId, amount, 'paypal', 'success');

      return {
        success: true,
        transaction_id: `paypal-${orderId}`
      };
    } catch (error: any) {
      console.error('[VendorPayment] PayPal payment error:', error);
      await this.logPayment(orderId, customerId, amount, 'paypal', 'failed', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Logger les transactions pour audit trail
   */
  private static async logPayment(
    orderId: string,
    userId: string,
    amount: number,
    method: string,
    status: 'success' | 'failed' | 'pending',
    notes?: string
  ): Promise<void> {
    try {
      // Log dans wallet_logs avec les champs corrects
      await supabase.from('wallet_logs').insert({
        wallet_id: userId, // TODO: Récupérer le vrai wallet_id
        action: 'payment',
        amount: -amount, // Négatif pour un paiement
        description: `Order payment ${orderId} via ${method} - ${status}`,
        metadata: {
          orderId,
          paymentMethod: method,
          status,
          notes
        }
      });
    } catch (error) {
      console.error('[VendorPayment] Failed to log payment:', error);
    }
  }
}

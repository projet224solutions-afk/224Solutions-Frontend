/**
 * SERVICE TAXI-MOTO: Paiements
 * Gère Card (Stripe), Orange Money, Wallet 224Solutions
 */

import { supabase } from "@/integrations/supabase/client";

export type PaymentMethod = 'card' | 'orange_money' | 'wallet' | 'cash';

export interface PaymentRequest {
  rideId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  idempotencyKey?: string;
}

export interface PaymentResult {
  success: boolean;
  transaction?: unknown;
  payment?: unknown;
  error?: string;
}

export class PaymentsService {
  /**
   * Initie un paiement
   */
  static async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    console.log('[PaymentsService] Initiating payment', request);

    try {
      const { data, error } = await supabase.functions.invoke('taxi-payment', {
        body: {
          rideId: request.rideId,
          paymentMethod: request.paymentMethod,
          idempotencyKey: request.idempotencyKey || `${request.rideId}-${Date.now()}`
        }
      });

      if (error) throw error;

      console.log('[PaymentsService] Payment initiated', data);
      return data;

    } catch (error) {
      console.error('[PaymentsService] Payment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed'
      };
    }
  }

  /**
   * Vérifie le statut d'un paiement
   */
  static async checkPaymentStatus(rideId: string) {
    const { data, error } = await supabase
      .from('taxi_transactions')
      .select('*')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[PaymentsService] Error checking payment:', error);
      return null;
    }

    return data;
  }

  /**
   * Rembourse un paiement
   */
  static async refundPayment(transactionId: string, reason?: string) {
    console.log('[PaymentsService] Refunding', { transactionId, reason });

    const { data: transaction, error: txError } = await supabase
      .from('taxi_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError) throw txError;
    if (transaction.status !== 'completed') {
      throw new Error('Can only refund completed transactions');
    }

    // Update status
    const currentMetadata = (transaction.metadata as any) || {};
    const { error: updateError } = await supabase
      .from('taxi_transactions')
      .update({
        status: 'refunded',
        metadata: { ...currentMetadata, refund_reason: reason }
      })
      .eq('id', transactionId);

    if (updateError) throw updateError;

    // Process wallet refund if needed
    if (transaction.payment_method === 'wallet') {
      await supabase.rpc('process_wallet_transaction', {
        p_sender_id: transaction.driver_id,
        p_receiver_id: transaction.customer_id,
        p_amount: transaction.amount,
        p_currency: transaction.currency,
        p_description: `Refund for ride ${transaction.ride_id}`
      });
    }

    console.log('[PaymentsService] Refund processed');
    return { success: true };
  }

  /**
   * Calcule le tarif d'une course
   */
  static async calculateFare(distanceKm: number, durationMin: number, surgeMultiplier = 1.0) {
    const { data, error } = await supabase.rpc('calculate_taxi_fare', {
      p_distance_km: distanceKm,
      p_duration_min: durationMin,
      p_surge_multiplier: surgeMultiplier
    });

    if (error) throw error;
    return data;
  }
}
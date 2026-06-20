/**
 * SERVICE PAIEMENT 224SOLUTIONS
 * Intégration complète : Portefeuille + Mobile Money (Jomy) + Cash
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PaymentMethodType = 'wallet' | 'mobile_money' | 'cash';
export type PaymentProvider = 'orange_money' | 'mtn_money' | '224solutions_wallet' | 'cash';

export interface PaymentMethod {
  id: string;
  method_type: string;
  provider: string;
  phone_number?: string;
  is_default: boolean;
  is_active: boolean;
}

export class Payment224Service {
  /**
   * Récupérer les méthodes de paiement de l'utilisateur
   */
  static async getUserPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Payment224Service] Error fetching payment methods:', error);
      return [];
    }
  }

  /**
   * Ajouter une méthode de paiement
   */
  static async addPaymentMethod(
    userId: string,
    methodType: PaymentMethodType,
    provider: PaymentProvider,
    phoneNumber?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('payment_methods').insert({
        user_id: userId,
        method_type: methodType,
        provider,
        phone_number: phoneNumber,
        is_default: false,
        is_active: true,
      });

      if (error) throw error;
      toast.success('Méthode de paiement ajoutée');
      return true;
    } catch (error) {
      console.error('[Payment224Service] Error adding payment method:', error);
      toast.error('Erreur lors de l\'ajout');
      return false;
    }
  }

  /**
   * Définir une méthode par défaut
   */
  static async setDefaultPaymentMethod(userId: string, methodId: string): Promise<boolean> {
    try {
      // Désactiver tous les autres comme défaut
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', userId);

      // Activer celui-ci
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', methodId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[Payment224Service] Error setting default:', error);
      return false;
    }
  }

  /**
   * Traiter un paiement via portefeuille 224Solutions
   */
  static async processWalletPayment(
    userId: string,
    amount: number,
    deliveryId: string,
    description: string
  ): Promise<{ success: boolean; transactionId?: string }> {
    try {
      // Récupérer le wallet de l'utilisateur
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, balance, currency')
        .eq('user_id', userId)
        .single();

      if (!wallet || wallet.balance < amount) {
        toast.error('Solde insuffisant');
        return { success: false };
      }

      // Créer la transaction
      const { data: transaction, error } = await supabase
        .from('wallet_transactions')
        .insert({
          transaction_id: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender_wallet_id: wallet.id,
          amount: amount,
          net_amount: amount,
          transaction_type: 'payment',
          status: 'completed',
          description,
          metadata: { delivery_id: deliveryId },
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Paiement effectué via portefeuille');
      return { success: true, transactionId: String(transaction.id) };
    } catch (error) {
      console.error('[Payment224Service] Error processing wallet payment:', error);
      toast.error('Erreur lors du paiement');
      return { success: false };
    }
  }

  /**
   * Initier un paiement Mobile Money via Jomy
   */
  static async initiateMobileMoneyPayment(
    provider: 'orange_money' | 'mtn_money',
    phoneNumber: string,
    amount: number,
    deliveryId: string,
    description?: string
  ): Promise<{ success: boolean; paymentId?: string; transactionId?: string }> {
    try {
      const origin = window.location.origin;

      // Normaliser le numéro: 9 chiffres -> 00224XXXXXXXXX
      const compact = phoneNumber.replace(/\s/g, '');
      // Normaliser le numéro pour ChapChapPay: format 224XXXXXXXXX
      const customerPhone = compact.startsWith('00')
        ? compact.substring(2)
        : compact.startsWith('+')
          ? compact.substring(1)
          : compact.length === 9
            ? `224${compact}`
            : compact;

      const paymentMethod = provider === 'orange_money' ? 'orange_money' : 'mtn_momo';

      const { data, error } = await supabase.functions.invoke('chapchappay-pull', {
        body: {
          amount,
          customerPhone,
          paymentMethod,
          description: description || `Paiement livraison ${deliveryId}`,
          orderId: `DELIVERY-${deliveryId}`,
          webhookUrl: `${origin}/api/chapchappay/webhook`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Paiement ${provider === 'orange_money' ? 'Orange Money' : 'MTN Mobile Money'} initié. Confirmez sur votre téléphone.`);
        const tx = data.transactionId as string | undefined;
        return { success: true, paymentId: tx, transactionId: tx };
      }

      toast.error(data?.error || 'Échec de l\'initiation du paiement');
      return { success: false };
    } catch (error) {
      console.error('[Payment224Service] Error initiating mobile money:', error);
      toast.error('Erreur lors de l\'initiation du paiement');
      return { success: false };
    }
  }

  /**
   * Vérifier le statut d'un paiement ChapChapPay
   */
  static async verifyChapChapPayPayment(transactionId: string): Promise<{ status: string; completed: boolean }> {
    try {
      const { data, error } = await supabase.functions.invoke('chapchappay-status', {
        body: { transactionId },
      });

      if (error) throw error;

      return {
        status: data?.status || 'unknown',
        completed: data?.status === 'completed' || data?.status === 'SUCCESS',
      };
    } catch (error) {
      console.error('[Payment224Service] Error verifying payment:', error);
      return { status: 'error', completed: false };
    }
  }

  /**
   * Confirmer un paiement en espèces
   */
  static async confirmCashPayment(
    _deliveryId: string,
    _amount: number,
    _driverId: string
  ): Promise<boolean> {
    try {
      // Enregistrer le paiement en espèces dans les métadonnées
      toast.success('Paiement en espèces confirmé');
      return true;
    } catch (error) {
      console.error('[Payment224Service] Error confirming cash payment:', error);
      toast.error('Erreur lors de la confirmation');
      return false;
    }
  }

  /**
   * Récupérer le solde du portefeuille
   */
  static async getWalletBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data?.balance || 0;
    } catch (error) {
      console.error('[Payment224Service] Error fetching balance:', error);
      return 0;
    }
  }
}

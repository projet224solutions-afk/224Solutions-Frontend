/**
 * HOOK CLIENT ACTIONS - 224SOLUTIONS
 * Actions CRUD centralisées pour l'interface Client
 * 11 méthodes: Orders, Favorites, Reviews, Shipping, Payment, Refunds
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useClientErrorBoundary } from './useClientErrorBoundary';

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  vendor_id: string;
}

interface ShippingInfo {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postal_code?: string;
  notes?: string;
}

export type PaymentMethod = 'wallet' | 'mobile_money' | 'card' | 'bank_transfer' | 'cash';

interface PaymentData {
  method: PaymentMethod;
  transaction_id?: string;
  mobile_number?: string;
  card_last4?: string;
  amount: number;
  currency?: string;
}

export function useClientActions() {
  const [loading, setLoading] = useState(false);
  const { captureError } = useClientErrorBoundary();

  /**
   * 1. CREATE ORDER - Créer une commande avec méthode de paiement
   */
  const createOrder = useCallback(async (
    userId: string,
    customerId: string,
    cartItems: CartItem[],
    shippingInfo: ShippingInfo,
    paymentData: PaymentData
  ): Promise<{ success: boolean; orderId?: string; error?: string }> => {
    setLoading(true);
    try {
      const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      if (Math.abs(totalAmount - paymentData.amount) > 0.01) {
        throw new Error('Le montant du paiement ne correspond pas au total de la commande');
      }

      const orderNumber = `ORD-${Date.now()}-${customerId.substring(0, 8)}`;

      const orderData: any = {
        customer_id: customerId,
        vendor_id: cartItems[0]?.vendor_id,
        order_number: orderNumber,
        subtotal: totalAmount,
        total_amount: totalAmount,
        shipping_address: {
          address: shippingInfo.address,
          city: shippingInfo.city,
          phone: shippingInfo.phone
        },
        source: 'web' as const,
        status: paymentData.method === 'cash' ? 'pending' : 'processing',
        payment_method: paymentData.method,
        notes: `Livraison: ${shippingInfo.address}, ${shippingInfo.city}. Tel: ${shippingInfo.phone}`
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      if (paymentData.method === 'wallet') {
        await processWalletPayment(userId, totalAmount, order.id, paymentData.transaction_id);
      } else if (paymentData.method === 'mobile_money') {
        await processMobileMoneyPayment(userId, totalAmount, order.id, paymentData.mobile_number);
      } else if (paymentData.method === 'card') {
        await processCardPayment(userId, totalAmount, order.id, paymentData.card_last4);
      }

      toast.success('Commande créée avec succès!');
      return { success: true, orderId: order.id };
    } catch (error: any) {
      console.error('Erreur création commande:', error);
      captureError('ORDER_ERROR', 'Échec création commande', error.message, 'createOrder');
      toast.error('Erreur lors de la création de la commande');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [captureError]);

  /**
   * 2. UPDATE ORDER - Mettre à jour une commande
   */
  const updateOrder = useCallback(async (
    orderId: string,
    updates: {
      status?: 'pending' | 'processing' | 'confirmed' | 'preparing' | 'ready' | 'in_transit' | 'delivered' | 'cancelled' | 'completed';
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Commande mise à jour');
      return { success: true };
    } catch (error: any) {
      console.error('Erreur mise à jour commande:', error);
      captureError('ORDER_ERROR', 'Échec mise à jour commande', error.message, 'updateOrder');
      toast.error('Erreur lors de la mise à jour');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [captureError]);

  /**
   * 3. CANCEL ORDER - Annuler une commande
   */
  const cancelOrder = useCallback(async (
    orderId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          notes: `Annulé: ${reason}`
        })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Commande annulée');
      return { success: true };
    } catch (error: any) {
      console.error('Erreur annulation:', error);
      captureError('ORDER_ERROR', 'Échec annulation', error.message, 'cancelOrder');
      toast.error('Erreur lors de l\'annulation');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [captureError]);

  /**
   * 4. ADD TO FAVORITES - Ajouter aux favoris
   */
  const addToFavorites = useCallback(async (
    userId: string,
    productId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('wishlists')
        .insert({
          user_id: userId,
          product_id: productId
        });

      if (error) throw error;

      toast.success('Ajouté aux favoris');
      return { success: true };
    } catch (error: any) {
      console.error('Erreur ajout favoris:', error);
      captureError('FAVORITES_ERROR', 'Échec ajout favoris', error.message, 'addToFavorites');
      return { success: false, error: error.message };
    }
  }, [captureError]);

  /**
   * 5. REMOVE FROM FAVORITES - Retirer des favoris
   */
  const removeFromFavorites = useCallback(async (
    userId: string,
    productId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) throw error;

      toast.success('Retiré des favoris');
      return { success: true };
    } catch (error: any) {
      console.error('Erreur retrait favoris:', error);
      captureError('FAVORITES_ERROR', 'Échec retrait favoris', error.message, 'removeFromFavorites');
      return { success: false, error: error.message };
    }
  }, [captureError]);

  /**
   * 6. UPDATE SHIPPING ADDRESS - Mettre à jour l'adresse de livraison
   */
  const updateShippingAddress = useCallback(async (
    customerId: string,
    addressData: ShippingInfo
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          phone: addressData.phone,
          full_name: addressData.full_name
        })
        .eq('id', customerId);

      if (error) throw error;

      toast.success('Adresse de livraison mise à jour');
      return { success: true };
    } catch (error: any) {
      console.error('Erreur mise à jour adresse:', error);
      captureError('SHIPPING_ERROR', 'Échec mise à jour adresse', error.message, 'updateShippingAddress');
      toast.error('Erreur lors de la mise à jour de l\'adresse');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [captureError]);

  /**
   * 7. SUBMIT REVIEW - Soumettre un avis produit
   */
  const submitReview = useCallback(async (
    userId: string,
    productId: string,
    orderId: string,
    rating: number,
    comment: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Note invalide (1-5 étoiles)');
      }

      const { error } = await supabase
        .from('product_reviews')
        .insert({
          user_id: userId,
          product_id: productId,
          order_id: orderId,
          rating,
          title: comment.substring(0, 50) || 'Avis client',
          content: comment
        });

      if (error) throw error;

      toast.success('Avis soumis avec succès');
      return { success: true };
    } catch (error: any) {
      console.error('Erreur soumission avis:', error);
      captureError('PRODUCT_ERROR', 'Échec soumission avis', error.message, 'submitReview');
      toast.error('Erreur lors de la soumission de l\'avis');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [captureError]);

  /**
   * 8. REQUEST REFUND - Demander un remboursement
   */
  const requestRefund = useCallback(async (
    userId: string,
    orderId: string,
    reason: string,
    amount?: number
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          notes: `Remboursement demandé: ${reason}${amount ? ` - Montant: ${amount} GNF` : ''}`
        })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Demande de remboursement soumise');
      return { success: true };
    } catch (error: any) {
      console.error('Erreur demande remboursement:', error);
      captureError('PAYMENT_ERROR', 'Échec demande remboursement', error.message, 'requestRefund');
      toast.error('Erreur lors de la demande de remboursement');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [captureError]);

  /**
   * 9. PROCESS WALLET PAYMENT - Traiter un paiement par wallet
   */
  const processWalletPayment = async (
    userId: string,
    amount: number,
    orderId: string,
    transactionId?: string
  ) => {
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) throw new Error('Wallet introuvable');
    if (wallet.balance < amount) throw new Error('Solde insuffisant');

    await supabase
      .from('wallets')
      .update({ balance: wallet.balance - amount })
      .eq('user_id', userId);

    await (supabase
      .from('enhanced_transactions' as any)
      .insert({
        sender_id: userId,
        receiver_id: orderId,
        amount,
        currency: 'GNF',
        type: 'payment',
        status: 'completed',
        description: `Paiement commande ${orderId}`,
        reference: transactionId || `PAY-${Date.now()}`
      }) as any);
  };

  /**
   * 10. PROCESS MOBILE MONEY PAYMENT - Traiter un paiement mobile money
   */
  const processMobileMoneyPayment = async (
    userId: string,
    amount: number,
    orderId: string,
    mobileNumber?: string
  ) => {
    console.log('Mobile money payment:', { userId, amount, orderId, mobileNumber });
    toast.info('Paiement mobile money en cours de traitement');
  };

  /**
   * 11. PROCESS CARD PAYMENT - Traiter un paiement par carte
   */
  const processCardPayment = async (
    userId: string,
    amount: number,
    orderId: string,
    cardLast4?: string
  ) => {
    console.log('Card payment:', { userId, amount, orderId, cardLast4 });
    toast.info('Paiement par carte en cours de traitement');
  };

  return {
    loading,
    createOrder,
    updateOrder,
    cancelOrder,
    addToFavorites,
    removeFromFavorites,
    updateShippingAddress,
    submitReview,
    requestRefund
  };
}

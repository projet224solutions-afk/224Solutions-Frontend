/**
 * Service de gestion du système Escrow
 * Sécurise les paiements entre clients et vendeurs
 */

import { supabase } from '@/lib/supabaseClient';

export interface EscrowTransaction {
  id: string;
  order_id: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'released' | 'refunded' | 'dispute';
  created_at: string;
  updated_at: string;
}

export class EscrowService {
  /**
   * Initie un escrow pour une commande
   * Bloque les fonds du client dans le système escrow
   */
  static async initiateEscrow(
    orderId: string,
    payerId: string,
    receiverId: string,
    amount: number,
    currency: string = 'GNF'
  ): Promise<{ success: boolean; escrowId?: string; error?: string }> {
    try {
      console.log('🔒 Initiating escrow:', { orderId, payerId, receiverId, amount, currency });

      const { data, error } = await supabase.rpc('initiate_escrow', {
        p_order_id: orderId,
        p_payer_id: payerId,
        p_receiver_id: receiverId,
        p_amount: amount,
        p_currency: currency
      });

      if (error) {
        console.error('❌ Escrow initiation error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Escrow initiated:', data);
      return { success: true, escrowId: data };
    } catch (error) {
      console.error('❌ Escrow service error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Libère les fonds de l'escrow au vendeur
   * Appelé quand le client confirme la réception
   */
  static async releaseEscrow(
    escrowId: string,
    commissionPercent: number = 2.5
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔓 Releasing escrow:', { escrowId, commissionPercent });

      // Utiliser la fonction Edge pour libérer l'escrow
      const { data, error } = await supabase.functions.invoke('escrow-release', {
        body: {
          escrow_id: escrowId,
          notes: `Libération - Commission ${commissionPercent}%`
        }
      });

      if (error) {
        console.error('❌ Escrow release error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        console.error('❌ Escrow release failed:', data?.error);
        return { success: false, error: data?.error || 'Échec de libération' };
      }

      console.log('✅ Escrow released:', data);
      return { success: true };
    } catch (error) {
      console.error('❌ Escrow release service error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Rembourse le client
   */
  static async refundEscrow(escrowId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('💸 Refunding escrow:', escrowId);

      // Utiliser la fonction Edge pour rembourser l'escrow
      const { data, error } = await supabase.functions.invoke('escrow-refund', {
        body: {
          escrow_id: escrowId,
          notes: 'Remboursement client'
        }
      });

      if (error) {
        console.error('❌ Escrow refund error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        console.error('❌ Escrow refund failed:', data?.error);
        return { success: false, error: data?.error || 'Échec du remboursement' };
      }

      console.log('✅ Escrow refunded:', data);
      return { success: true };
    } catch (error) {
      console.error('❌ Escrow refund service error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Ouvre un litige
   */
  static async disputeEscrow(escrowId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('⚠️ Disputing escrow:', escrowId);

      const { data, error } = await supabase.rpc('dispute_escrow', {
        p_escrow_id: escrowId
      });

      if (error) {
        console.error('❌ Escrow dispute error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Escrow disputed:', data);
      return { success: true };
    } catch (error) {
      console.error('❌ Escrow dispute service error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Récupère l'état d'un escrow pour une commande
   */
  static async getEscrowByOrder(orderId: string): Promise<EscrowTransaction | null> {
    try {
      const { data, error } = await supabase
        .from('escrow_transactions')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (error) {
        console.error('❌ Error fetching escrow:', error);
        return null;
      }

      return data as EscrowTransaction;
    } catch (error) {
      console.error('❌ Escrow fetch error:', error);
      return null;
    }
  }

  /**
   * Récupère tous les escrows d'un vendeur
   */
  static async getVendorEscrows(receiverId: string): Promise<EscrowTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('escrow_transactions')
        .select('*')
        .eq('receiver_id', receiverId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching vendor escrows:', error);
        return [];
      }

      return data as EscrowTransaction[];
    } catch (error) {
      console.error('❌ Vendor escrows fetch error:', error);
      return [];
    }
  }
}

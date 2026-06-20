/**
 * SERVICE ESCROW UNIVERSEL 224SOLUTIONS
 * Gère la sécurisation de tous les paiements via escrow
 * Compatible avec: produits, taxi-moto, livraisons, services
 */

import { supabase } from '@/integrations/supabase/client';
import { Escrow224Service, EscrowCreateRequest } from './escrow224Service';

export type TransactionType = 'product' | 'digital_product' | 'taxi' | 'delivery' | 'service' | 'wallet_transfer';
export type PaymentProvider = 'wallet' | 'stripe' | 'cash' | 'orange_money';

export interface UniversalEscrowRequest {
  // Identifiants
  buyer_id: string;
  seller_id: string;
  order_id?: string;

  // Montants
  amount: number;
  currency?: string;

  // Type et méthode
  transaction_type: TransactionType;
  payment_provider: PaymentProvider;

  // Métadonnées
  metadata?: {
    product_ids?: string[];
    ride_id?: string;
    delivery_id?: string;
    description?: string;
    [key: string]: any;
  };

  // Options escrow
  escrow_options?: {
    auto_release_days?: number;
    require_signature?: boolean;
    require_photo?: boolean;
    commission_percent?: number;
  };
}

export interface EscrowStatus {
  escrow_id: string;
  status: 'pending' | 'held' | 'released' | 'refunded' | 'disputed';
  amount: number;
  created_at: string;
  can_release: boolean;
  can_refund: boolean;
  can_dispute: boolean;
}

export class UniversalEscrowService {

  /**
   * Crée une transaction escrow universelle
   */
  static async createEscrow(request: UniversalEscrowRequest): Promise<{
    success: boolean;
    escrow_id?: string;
    status?: string;
    error?: string;
  }> {
    try {
      console.log('[UniversalEscrow] Creating escrow:', request);

      // Valider les paramètres
      if (!request.buyer_id || !request.seller_id || !request.amount) {
        return {
          success: false,
          error: 'Paramètres manquants (buyer_id, seller_id, amount requis)'
        };
      }

      if (request.amount <= 0) {
        return {
          success: false,
          error: 'Montant invalide'
        };
      }

      // Préparer les métadonnées enrichies
      const enrichedMetadata = {
        ...request.metadata,
        transaction_type: request.transaction_type,
        payment_provider: request.payment_provider,
        escrow_options: request.escrow_options || {},
        created_via: 'universal_escrow_service',
        timestamp: new Date().toISOString()
      };

      // Déterminer la méthode de création selon le provider
      let result;

      if (request.payment_provider === 'stripe') {
        // Utiliser l'escrow Stripe avec capture manuelle
        result = await this.createStripeEscrow(request, enrichedMetadata);
      } else if (request.payment_provider === 'wallet') {
        // Utiliser l'escrow wallet 224Solutions
        result = await this.createWalletEscrow(request, enrichedMetadata);
      } else if (request.payment_provider === 'cash') {
        // Créer un escrow "virtuel" pour le cash (paiement à la livraison)
        result = await this.createCashEscrow(request, enrichedMetadata);
      } else {
        return {
          success: false,
          error: `Provider de paiement non supporté: ${request.payment_provider}`
        };
      }

      if (result.success) {
        console.log('[UniversalEscrow] ✅ Escrow created:', result.escrow_id);

        // Log l'action
        if (result.escrow_id) {
          await this.logEscrowAction(result.escrow_id, 'created', request.buyer_id, {
            transaction_type: request.transaction_type,
            payment_provider: request.payment_provider,
            amount: request.amount
          });
        }
      }

      return result;
    } catch (error) {
      console.error('[UniversalEscrow] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la création de l\'escrow'
      };
    }
  }

  /**
   * Crée un escrow avec Stripe (capture manuelle)
   */
  private static async createStripeEscrow(
    request: UniversalEscrowRequest,
    metadata: any
  ): Promise<{ success: boolean; escrow_id?: string; status?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('escrow-create-stripe', {
        body: {
          buyer_id: request.buyer_id,
          seller_id: request.seller_id,
          order_id: request.order_id,
          amount: request.amount,
          currency: request.currency || 'GNF',
          metadata
        }
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Erreur Stripe escrow'
        };
      }

      return {
        success: true,
        escrow_id: data.escrow_id,
        status: data.status
      };
    } catch (error) {
      console.error('[UniversalEscrow] Stripe error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur Stripe'
      };
    }
  }

  /**
   * Crée un escrow avec wallet 224Solutions
   */
  private static async createWalletEscrow(
    request: UniversalEscrowRequest,
    _metadata: any
  ): Promise<{ success: boolean; escrow_id?: string; status?: string; error?: string }> {
    try {
      const escrowRequest: EscrowCreateRequest = {
        buyer_id: request.buyer_id,
        seller_id: request.seller_id,
        order_id: request.order_id || null,
        amount: request.amount,
        currency: request.currency || 'GNF'
      };

      return await Escrow224Service.createEscrow(escrowRequest);
    } catch (error) {
      console.error('[UniversalEscrow] Wallet error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur wallet escrow'
      };
    }
  }

  /**
   * Crée un escrow "virtuel" pour paiement cash
   */
  private static async createCashEscrow(
    request: UniversalEscrowRequest,
    metadata: any
  ): Promise<{ success: boolean; escrow_id?: string; status?: string; error?: string }> {
    try {
      // Pour le cash, on crée juste un enregistrement escrow sans bloquer de fonds
      const { data, error } = await supabase
        .from('escrow_transactions')
        .insert([{
          payer_id: request.buyer_id,
          receiver_id: request.seller_id,
          order_id: request.order_id || null,
          amount: request.amount,
          currency: request.currency || 'GNF',
          status: 'pending' as const,
          metadata: {
            ...metadata,
            payment_type: 'cash_on_delivery',
            note: 'Paiement à la livraison - escrow virtuel'
          }
        }])
        .select('id')
        .single();

      if (error) throw error;

      return {
        success: true,
        escrow_id: data.id,
        status: 'pending'
      };
    } catch (error) {
      console.error('[UniversalEscrow] Cash escrow error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur cash escrow'
      };
    }
  }

  /**
   * Libère les fonds d'un escrow
   */
  static async releaseEscrow(
    escrow_id: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[UniversalEscrow] Releasing escrow:', escrow_id);

      const result = await Escrow224Service.releaseEscrow({
        escrow_id,
        notes: notes || 'Livraison confirmée'
      });

      if (result.success) {
        await this.logEscrowAction(escrow_id, 'released', null, { notes });
      }

      return result;
    } catch (error) {
      console.error('[UniversalEscrow] Release error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la libération'
      };
    }
  }

  /**
   * Rembourse un escrow
   */
  static async refundEscrow(
    escrow_id: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[UniversalEscrow] Refunding escrow:', escrow_id);

      const result = await Escrow224Service.refundEscrow({
        escrow_id,
        reason
      });

      if (result.success) {
        await this.logEscrowAction(escrow_id, 'refunded', null, { reason });
      }

      return result;
    } catch (error) {
      console.error('[UniversalEscrow] Refund error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors du remboursement'
      };
    }
  }

  /**
   * Récupère le statut d'un escrow
   */
  static async getEscrowStatus(escrow_id: string): Promise<EscrowStatus | null> {
    try {
      const { data, error } = await supabase
        .from('escrow_transactions')
        .select('*')
        .eq('id', escrow_id)
        .single();

      if (error) throw error;

      if (!data) return null;

      return {
        escrow_id: data.id,
        status: data.status as 'pending' | 'held' | 'released' | 'refunded' | 'disputed',
        amount: data.amount,
        created_at: data.created_at,
        can_release: data.status === 'held',
        can_refund: data.status === 'held' || data.status === 'pending',
        can_dispute: data.status === 'held'
      };
    } catch (error) {
      console.error('[UniversalEscrow] Get status error:', error);
      return null;
    }
  }

  /**
   * Récupère tous les escrows d'un utilisateur
   */
  static async getUserEscrows(
    user_id: string,
    filter?: {
      transaction_type?: TransactionType;
      status?: string;
    }
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('escrow_transactions')
        .select('*')
        .or(`payer_id.eq.${user_id},receiver_id.eq.${user_id}`)
        .order('created_at', { ascending: false });

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtrer par type de transaction si nécessaire
      if (filter?.transaction_type && data) {
        return data.filter(escrow => {
          const metadata = escrow.metadata as any;
          return metadata?.transaction_type === filter.transaction_type;
        });
      }

      return data || [];
    } catch (error) {
      console.error('[UniversalEscrow] Get user escrows error:', error);
      return [];
    }
  }

  /**
   * Log une action escrow
   */
  private static async logEscrowAction(
    escrow_id: string,
    action: string,
    user_id: string | null,
    metadata?: any
  ): Promise<void> {
    try {
      await supabase.from('escrow_action_logs').insert({
        escrow_id,
        action_type: action,
        performed_by: user_id,
        notes: `Action: ${action}`,
        metadata
      });
    } catch (error) {
      console.error('[UniversalEscrow] Log action error:', error);
      // Non-bloquant
    }
  }

  /**
   * Vérifie si l'escrow est activé pour un type de transaction
   */
  static isEscrowEnabled(transaction_type: TransactionType): boolean {
    // Par défaut, l'escrow est activé pour tous les types sauf wallet_transfer
    return transaction_type !== 'wallet_transfer';
  }

  /**
   * Calcule les frais d'escrow si applicable
   */
  static calculateEscrowFees(amount: number, commission_percent: number = 2.5): {
    amount: number;
    fee: number;
    total: number;
    seller_receives: number;
  } {
    const fee = Math.round(amount * (commission_percent / 100));
    return {
      amount,
      fee,
      total: amount + fee,
      seller_receives: amount - fee
    };
  }
}

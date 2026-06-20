/**
 * Service pour gérer les commissions configurables
 * Connecte les paiements réels (taxi, delivery, e-commerce) aux configurations
 */

import { supabase } from '@/integrations/supabase/client';

export interface CommissionCalculation {
  commission_amount: number;
  commission_rate: number;
  total_amount: number;
  config_id: string | null;
}

export interface ServiceTransactionParams {
  service_name: 'marketplace' | 'taxi' | 'delivery' | 'livreur';
  transaction_type: string; // 'achat', 'vente', 'course', 'livraison', etc.
  amount: number;
  from_user_id: string;
  to_user_id?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export class CommissionService {
  /**
   * Calcule la commission selon la configuration active
   */
  static async calculateCommission(
    serviceName: string,
    transactionType: string,
    amount: number
  ): Promise<CommissionCalculation> {
    try {
      const { data, error } = await supabase.rpc('calculate_commission_from_config', {
        p_service_name: serviceName,
        p_transaction_type: transactionType,
        p_amount: amount
      });

      if (error) {
        console.error('[CommissionService] Error calculating commission:', error);
        // Retourner sans commission en cas d'erreur
        return {
          commission_amount: 0,
          commission_rate: 0,
          total_amount: amount,
          config_id: null
        };
      }

      return data[0] as CommissionCalculation;
    } catch (error) {
      console.error('[CommissionService] Exception calculating commission:', error);
      return {
        commission_amount: 0,
        commission_rate: 0,
        total_amount: amount,
        config_id: null
      };
    }
  }

  /**
   * Enregistre une transaction avec commission automatique
   */
  static async recordTransaction(params: ServiceTransactionParams): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('record_service_transaction', {
        p_service_name: params.service_name,
        p_transaction_type: params.transaction_type,
        p_amount: params.amount,
        p_from_user_id: params.from_user_id,
        p_to_user_id: params.to_user_id || null,
        p_description: params.description || null,
        p_metadata: params.metadata ? JSON.stringify(params.metadata) : null
      });

      if (error) {
        console.error('[CommissionService] Error recording transaction:', error);
        throw error;
      }

      console.log(`✅ [CommissionService] Transaction enregistrée: ${data}`);
      return data as string;
    } catch (error) {
      console.error('[CommissionService] Exception recording transaction:', error);
      throw error;
    }
  }

  /**
   * Récupère les configurations actives pour un service
   */
  static async getActiveConfigs(serviceName: string) {
    try {
      const { data, error } = await supabase
        .from('commission_config')
        .select('*')
        .eq('service_name', serviceName)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[CommissionService] Error fetching configs:', error);
      return [];
    }
  }

  /**
   * Obtient les statistiques de revenus par service
   */
  static async getServiceRevenue(serviceName: string, startDate?: Date, endDate?: Date) {
    try {
      let query = supabase
        .from('wallet_transactions')
        .select('amount, fee, created_at, metadata, transaction_type')
        .eq('status', 'completed');

      // Filtrer selon le type de service
      if (serviceName === 'wallet_transfer') {
        // Inclure tous les types de transferts : transfer, deposit, withdrawal
        query = query.in('transaction_type', ['transfer', 'deposit', 'withdrawal', 'mobile_money_in', 'mobile_money_out']);
      } else if (serviceName === 'subscription') {
        query = query.eq('transaction_type', 'payment');
      } else {
        // Pour les autres services (marketplace, taxi, delivery, livreur)
        query = query.or(`transaction_type.eq.${serviceName},transaction_type.like.${serviceName}_%`);
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log(`📊 [CommissionService] Service ${serviceName}:`, {
        count: data?.length,
        transactions: data?.map(t => ({ type: t.transaction_type, amount: t.amount, fee: t.fee }))
      });

      // Calculer uniquement les montants positifs (revenus) pour éviter d'annuler avec les retraits
      const totalRevenue = data?.reduce((sum, t) => {
        const amount = Number(t.amount);
        return sum + (amount > 0 ? amount : 0);
      }, 0) || 0;

      const totalCommission = data?.reduce((sum, t) => sum + Number(t.fee || 0), 0) || 0;
      const transactionCount = data?.length || 0;

      return {
        service_name: serviceName,
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        transaction_count: transactionCount,
        transactions: data
      };
    } catch (error) {
      console.error('[CommissionService] Error fetching service revenue:', error);
      return {
        service_name: serviceName,
        total_revenue: 0,
        total_commission: 0,
        transaction_count: 0,
        transactions: []
      };
    }
  }

  /**
   * Obtient tous les revenus par service pour le tableau de bord PDG
   */
  static async getAllServicesRevenue(startDate?: Date, endDate?: Date) {
    const services = [
      'wallet_transfer',    // Transferts entre wallets
      'subscription',       // Abonnements vendeurs/livreurs
      'marketplace',        // E-commerce
      'taxi',              // Taxi-moto
      'delivery',          // Livraison
      'livreur'            // Livreur
    ];

    const revenuePromises = services.map(service =>
      this.getServiceRevenue(service, startDate, endDate)
    );

    const revenues = await Promise.all(revenuePromises);

    return {
      services: revenues,
      total_revenue: revenues.reduce((sum, r) => sum + r.total_revenue, 0),
      total_commission: revenues.reduce((sum, r) => sum + r.total_commission, 0),
      total_transactions: revenues.reduce((sum, r) => sum + r.transaction_count, 0)
    };
  }
}

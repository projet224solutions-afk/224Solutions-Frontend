import { supabase } from '@/lib/supabaseClient';
import { formatCurrency } from '@/lib/formatters';

export interface RevenueStats {
  total_revenue: number;
  wallet_fees_revenue: number;
  purchase_fees_revenue: number;
  transaction_count: number;
  wallet_transaction_count: number;
  purchase_transaction_count: number;
}

export interface PdgRevenue {
  id: string;
  source_type: 'frais_transaction_wallet' | 'frais_achat_commande' | 'frais_abonnement';
  transaction_id: string | null;
  user_id: string | null;
  service_id: string | null;
  amount: number;
  percentage_applied: number;
  metadata: any;
  created_at: string;
}

export interface PdgSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export class PdgRevenueService {
  /**
   * Enregistrer un revenu PDG
   */
  static async recordRevenue(params: {
    sourceType: 'frais_transaction_wallet' | 'frais_achat_commande' | 'frais_abonnement';
    amount: number;
    percentage: number;
    transactionId?: string;
    userId?: string;
    serviceId?: string;
    metadata?: any;
  }): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('record_pdg_revenue', {
        p_source_type: params.sourceType,
        p_amount: params.amount,
        p_percentage: params.percentage,
        p_transaction_id: params.transactionId || null,
        p_user_id: params.userId || null,
        p_service_id: params.serviceId || null,
        p_metadata: params.metadata || null,
      });

      if (error) {
        console.error('❌ Erreur enregistrement revenu PDG:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Exception enregistrement revenu:', error);
      return null;
    }
  }

  /**
   * Obtenir les statistiques des revenus
   */
  static async getRevenueStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<RevenueStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_pdg_revenue_stats', {
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null,
      });

      if (error) {
        console.error('❌ Erreur stats revenus:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('❌ Exception stats revenus:', error);
      return null;
    }
  }

  /**
   * Obtenir l'historique des revenus
   */
  static async getRevenueHistory(limit = 100): Promise<PdgRevenue[]> {
    try {
      const { data, error } = await supabase
        .from('revenus_pdg')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Erreur historique revenus:', error);
        return [];
      }

      return (data || []) as PdgRevenue[];
    } catch (error) {
      console.error('❌ Exception historique revenus:', error);
      return [];
    }
  }

  /**
   * Obtenir un paramètre PDG
   */
  static async getSetting(key: string): Promise<PdgSetting | null> {
    try {
      const { data, error } = await supabase
        .from('pdg_settings')
        .select('*')
        .eq('setting_key', key)
        .single();

      if (error) {
        console.error('❌ Erreur récupération paramètre:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Exception récupération paramètre:', error);
      return null;
    }
  }

  /**
   * Obtenir tous les paramètres PDG
   */
  static async getAllSettings(): Promise<PdgSetting[]> {
    try {
      const { data, error } = await supabase
        .from('pdg_settings')
        .select('*')
        .order('setting_key');

      if (error) {
        console.error('❌ Erreur récupération paramètres:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Exception récupération paramètres:', error);
      return [];
    }
  }

  /**
   * Mettre à jour un paramètre PDG
   */
  static async updateSetting(
    key: string,
    value: any,
    userId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pdg_settings')
        .update({
          setting_value: value,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', key);

      if (error) {
        console.error('❌ Erreur mise à jour paramètre:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Exception mise à jour paramètre:', error);
      return false;
    }
  }

  /**
   * Formater un montant en GNF
   */
  static formatAmount(amount: number): string {
    return formatCurrency(amount);
  }
}

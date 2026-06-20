import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

export interface CardTransaction {
  id: string;
  amount: number;
  merchant_name: string;
  merchant_category: string | null;
  status: string;
  created_at: string;
  reference_code: string;
}

export interface CardStats {
  success: boolean;
  card_status?: string;
  daily_limit?: number;
  monthly_limit?: number;
  daily_spent?: number;
  monthly_spent?: number;
  daily_remaining?: number;
  monthly_remaining?: number;
  total_spent?: number;
  transaction_count?: number;
  last_transactions?: CardTransaction[];
  error?: string;
}

export interface PaymentResult {
  success: boolean;
  transaction_id?: string;
  reference_code?: string;
  amount?: number;
  new_balance?: number;
  daily_remaining?: number;
  monthly_remaining?: number;
  error?: string;
  balance?: number;
  required?: number;
  daily_limit?: number;
  daily_spent?: number;
  remaining?: number;
}

export function useVirtualCard() {
  const fc = useFormatCurrency();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CardStats | null>(null);

  /**
   * Effectuer un paiement avec la carte virtuelle
   */
  const processPayment = useCallback(async (
    cardId: string,
    amount: number,
    merchantName: string,
    merchantCategory?: string,
    description?: string
  ): Promise<PaymentResult> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('process_card_payment', {
        p_card_id: cardId,
        p_amount: amount,
        p_merchant_name: merchantName,
        p_merchant_category: merchantCategory || null,
        p_description: description || null
      });

      if (error) throw error;

      const result = data as unknown as PaymentResult;

      if (result.success) {
        toast.success('Paiement effectué !', {
          description: `${fc(amount)} débité chez ${merchantName}`
        });
      } else {
        toast.error('Paiement refusé', {
          description: result.error
        });
      }

      return result;
    } catch (error: any) {
      console.error('[useVirtualCard] Payment error:', error);
      toast.error('Erreur de paiement');
      return {
        success: false,
        error: error.message || 'Erreur inconnue'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Charger les statistiques de la carte
   */
  const loadStats = useCallback(async (cardId: string): Promise<CardStats | null> => {
    try {
      const { data, error } = await supabase.rpc('get_card_stats', {
        p_card_id: cardId
      });

      if (error) throw error;

      const cardStats = data as unknown as CardStats;
      setStats(cardStats);
      return cardStats;
    } catch (error: any) {
      console.error('[useVirtualCard] Stats error:', error);
      return null;
    }
  }, []);

  /**
   * Charger l'historique des transactions
   */
  const loadTransactions = useCallback(async (
    cardId: string,
    limit: number = 20
  ): Promise<CardTransaction[]> => {
    try {
      const { data, error } = await supabase
        .from('card_transactions')
        .select('id, amount, merchant_name, merchant_category, status, created_at, reference_code')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []) as CardTransaction[];
    } catch (error: any) {
      console.error('[useVirtualCard] Transactions error:', error);
      return [];
    }
  }, []);

  /**
   * Geler/Dégeler la carte
   */
  const toggleCardStatus = useCallback(async (
    cardId: string,
    // 'inactive' = état « gelée » (valeur autorisée par la contrainte CHECK de la table,
    // qui n'accepte que 'active' | 'inactive')
    newStatus: 'active' | 'inactive'
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('virtual_cards')
        .update({ status: newStatus })
        .eq('id', cardId);

      if (error) throw error;

      toast.success(newStatus === 'inactive' ? 'Carte gelée' : 'Carte réactivée');
      return true;
    } catch (error: any) {
      console.error('[useVirtualCard] Toggle status error:', error);
      toast.error('Erreur lors du changement de statut');
      return false;
    }
  }, []);

  /**
   * Mettre à jour les limites de la carte
   */
  const updateLimits = useCallback(async (
    cardId: string,
    dailyLimit: number,
    monthlyLimit: number
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('virtual_cards')
        .update({
          daily_limit: dailyLimit,
          monthly_limit: monthlyLimit
        })
        .eq('id', cardId);

      if (error) throw error;

      toast.success('Limites mises à jour');
      return true;
    } catch (error: any) {
      console.error('[useVirtualCard] Update limits error:', error);
      toast.error('Erreur lors de la mise à jour des limites');
      return false;
    }
  }, []);

  return {
    loading,
    stats,
    processPayment,
    loadStats,
    loadTransactions,
    toggleCardStatus,
    updateLimits
  };
}

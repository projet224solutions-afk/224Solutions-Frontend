import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FinancialTransaction {
  id: string;
  user_id: string;
  transaction_type: 'card_to_om' | 'wallet_to_card' | 'card_to_wallet';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  source_reference?: string;
  destination_reference?: string;
  fees: number;
  api_response?: any;
  error_message?: string;
  metadata?: any;
  created_at: string;
  completed_at?: string;
}

export function useFinancialTransactions() {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions((data || []) as FinancialTransaction[]);
    } catch (error: any) {
      console.error('Erreur chargement transactions:', error);
      toast.error('Erreur lors du chargement des transactions');
    }
  };

  // Transfert carte virtuelle → Orange Money
  const transferCardToOrangeMoney = async (
    _cardId: string,
    _phoneNumber: string,
    _amount: number
  ) => {
    setLoading(true);
    try {
      console.log('💳→📱 Lancement transfert carte vers Orange Money');

      // TODO: La Edge Function 'card-to-orange-money' n'est pas encore déployée
      toast.error('Le transfert carte → Orange Money est temporairement indisponible');
      return { success: false, error: 'Service temporairement indisponible' };
    } catch (error: any) {
      console.error('Erreur transfert carte→OM:', error);
      toast.error(error.message || 'Erreur lors du transfert');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Recharge carte virtuelle depuis wallet
  const rechargeCardFromWallet = async (
    cardId: string,
    amount: number
  ) => {
    setLoading(true);
    try {
      console.log('💰→💳 Lancement recharge carte depuis wallet');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase.rpc('process_wallet_to_card', {
        p_user_id: user.id,
        p_card_id: cardId,
        p_amount: amount
      });

      if (error) throw error;

      toast.success('✅ Carte virtuelle rechargée avec succès !');
      await loadTransactions();

      // Émettre événement pour mettre à jour les soldes
      window.dispatchEvent(new Event('wallet-updated'));

      return { success: true, transactionId: data };
    } catch (error: any) {
      console.error('Erreur recharge carte:', error);
      toast.error(error.message || 'Erreur lors de la recharge');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Recharge wallet depuis carte virtuelle
  const rechargeWalletFromCard = async (
    cardId: string,
    amount: number
  ) => {
    setLoading(true);
    try {
      console.log('💳→💰 Lancement recharge wallet depuis carte');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase.rpc('process_card_to_wallet', {
        p_user_id: user.id,
        p_card_id: cardId,
        p_amount: amount
      });

      if (error) throw error;

      toast.success('✅ Wallet rechargé avec succès !');
      await loadTransactions();

      // Émettre événement pour mettre à jour les soldes
      window.dispatchEvent(new Event('wallet-updated'));

      return { success: true, transactionId: data };
    } catch (error: any) {
      console.error('Erreur recharge wallet:', error);
      toast.error(error.message || 'Erreur lors de la recharge');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Calculer les frais de transaction
  const calculateFees = (amount: number, type: string): number => {
    switch (type) {
      case 'card_to_om':
        return amount * 0.02; // 2%
      case 'wallet_to_card':
      case 'card_to_wallet':
        return amount * 0.01; // 1%
      default:
        return 0;
    }
  };

  return {
    loading,
    transactions,
    loadTransactions,
    transferCardToOrangeMoney,
    rechargeCardFromWallet,
    rechargeWalletFromCard,
    calculateFees
  };
}

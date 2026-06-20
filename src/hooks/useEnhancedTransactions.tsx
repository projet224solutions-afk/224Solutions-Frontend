import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface EnhancedTransaction {
  id: string;
  custom_id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

export const useEnhancedTransactions = () => {
  const [transactions, setTransactions] = useState<EnhancedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('enhanced_transactions' as any)
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50) as any);

      if (error) throw error;
      setTransactions((data || []) as EnhancedTransaction[]);
    } catch (err) {
      console.error('Erreur lors du chargement des transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createWalletTransaction = async (
    receiverEmail: string,
    amount: number,
    currency: string = 'GNF',
    description?: string
  ) => {
    if (!user) throw new Error('Utilisateur non authentifié');

    try {
      // Trouver le destinataire par email
      const { data: receiverProfile, error: receiverError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', receiverEmail)
        .single();

      if (receiverError || !receiverProfile) {
        throw new Error('Destinataire non trouvé');
      }

      if (receiverProfile.id === user.id) {
        throw new Error('Vous ne pouvez pas vous envoyer de l\'argent à vous-même');
      }

      // Appeler la fonction de traitement de transaction
      const { data, error } = await supabase.rpc('process_wallet_transaction', {
        p_sender_id: user.id,
        p_receiver_id: receiverProfile.id,
        p_amount: amount,
        p_currency: currency,
        p_description: description
      });

      if (error) throw error;

      // Rafraîchir les transactions
      await fetchTransactions();

      toast({
        title: "Transaction réussie",
        description: `${amount} ${currency} envoyés à ${receiverEmail}`,
      });

      return data;
    } catch (error) {
      console.error('Erreur transaction:', error);
      toast({
        title: "Erreur de transaction",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  const createEscrowTransaction = async (
    receiverEmail: string,
    amount: number,
    currency: string = 'GNF',
    description?: string
  ) => {
    if (!user) throw new Error('Utilisateur non authentifié');

    try {
      // Trouver le destinataire par email
      const { data: receiverProfile, error: receiverError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', receiverEmail)
        .single();

      if (receiverError || !receiverProfile) {
        throw new Error('Destinataire non trouvé');
      }

      // Créer transaction Escrow
      const { data, error } = await (supabase
        .from('enhanced_transactions' as any)
        .insert({
          sender_id: user.id,
          receiver_id: receiverProfile.id,
          amount,
          currency,
          method: 'escrow',
          status: 'pending',
          metadata: { description: description || '', escrow_status: 'holding' }
        })
        .select()
        .single() as any);

      if (error) throw error;

      await fetchTransactions();

      toast({
        title: "Transaction Escrow créée",
        description: `${amount} ${currency} en attente de confirmation`,
      });

      return data;
    } catch (error) {
      console.error('Erreur transaction escrow:', error);
      toast({
        title: "Erreur de transaction",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  const searchTransactions = async (
    searchQuery: string,
    filters?: {
      status?: string;
      method?: string;
      dateFrom?: string;
      dateTo?: string;
      minAmount?: number;
      maxAmount?: number;
    }
  ) => {
    if (!user) return;

    try {
      setLoading(true);
      let query = supabase
        .from('enhanced_transactions' as any)
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      // Recherche par custom_id
      if (searchQuery.trim()) {
        query = query.ilike('custom_id', `%${searchQuery}%`);
      }

      // Filtres
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.method) {
        query = query.eq('method', filters.method);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      if (filters?.minAmount) {
        query = query.gte('amount', filters.minAmount);
      }
      if (filters?.maxAmount) {
        query = query.lte('amount', filters.maxAmount);
      }

      const { data, error } = await (query
        .order('created_at', { ascending: false })
        .limit(100) as any);

      if (error) throw error;
      setTransactions((data || []) as EnhancedTransaction[]);
    } catch (err) {
      console.error('Erreur lors de la recherche:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    createWalletTransaction,
    createEscrowTransaction,
    searchTransactions,
    refetch: fetchTransactions
  };
};
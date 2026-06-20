/**
 * 💰 SERVICE WALLET - 224SOLUTIONS
 * Service pour la gestion des portefeuilles utilisateurs
 * Intégration avec Supabase et création automatique
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// =====================================================
// TYPES ET INTERFACES
// =====================================================

type DbWallet = Database['public']['Tables']['wallets']['Row'];
type DbTransaction = Database['public']['Tables']['wallet_transactions']['Row'];

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  transaction_id: string;
  transaction_type: string;
  amount: number;
  net_amount: number;
  fee: number;
  currency: string;
  description: string | null;
  status: string;
  sender_wallet_id: string | null;
  receiver_wallet_id: string | null;
  metadata?: unknown;
  created_at: string;
  completed_at: string | null;
}

export interface WalletStats {
  totalBalance: number;
  totalTransactions: number;
  totalCredits: number;
  totalDebits: number;
  pendingTransactions: number;
  monthlyVolume: number;
}

// =====================================================
// SERVICE WALLET
// =====================================================

class WalletService {
  // Récupérer le wallet d'un utilisateur
  /**
   * Récupère le wallet d'un utilisateur, le crée si inexistant ou inactif
   */
  async getUserWallet(userId: string): Promise<Wallet | null> {
    if (!userId) {
      console.error('getUserWallet: userId manquant');
      return null;
    }
    try {
      let { data: wallet, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      // Si le wallet n'existe pas, le créer
      if (!wallet) {
        const { data: created, error: createError } = await supabase
          .from('wallets')
          .insert({ user_id: userId, balance: 0, currency: 'GNF', wallet_status: 'active' })
          .select('*')
          .maybeSingle();
        if (createError) throw createError;
        wallet = created;
      }

      // Si le wallet est bloqué ou inactif, log et refuse l'accès
      if (wallet.is_blocked || wallet.wallet_status !== 'active') {
        console.error('getUserWallet: wallet bloqué ou inactif', wallet);
        return null;
      }

      return wallet;
    } catch (error) {
      console.error('❌ Erreur récupération wallet:', error);
      return null;
    }
  }

  // Créer un wallet pour un utilisateur
  async createUserWallet(userId: string, initialBalance: number = 10000): Promise<Wallet | null> {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .insert({
          user_id: userId,
          balance: initialBalance,
          currency: 'GNF'
        })
        .select()
        .single();

      if (error) throw error;

      // Créer la transaction de bonus de bienvenue
      if (data && initialBalance > 0) {
        await this.createTransaction({
          transaction_id: `WELCOME_${Date.now()}`,
          transaction_type: 'credit',
          amount: initialBalance,
          net_amount: initialBalance,
          fee: 0,
          currency: 'GNF',
          description: 'Bonus de bienvenue 224Solutions',
          status: 'completed',
          receiver_wallet_id: data.id
        });
      }

      console.log('✅ Wallet créé avec succès');
      return data;
    } catch (error) {
      console.error('❌ Erreur création wallet:', error);
      return null;
    }
  }

  // Récupérer les transactions d'un wallet
  async getWalletTransactions(walletId: string, limit: number = 50): Promise<Transaction[]> {
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .or(`sender_wallet_id.eq.${walletId},receiver_wallet_id.eq.${walletId}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erreur récupération transactions:', error);
      return [];
    }
  }

  // Créer une transaction
  async createTransaction(transactionData: Partial<Transaction>): Promise<Transaction | null> {
    try {
      const transaction_id = transactionData.transaction_id || `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const { data, error } = await supabase
        .from('wallet_transactions')
        .insert({
          transaction_id,
          transaction_type: transactionData.transaction_type || 'transfer',
          amount: transactionData.amount || 0,
          net_amount: transactionData.net_amount || 0,
          fee: transactionData.fee || 0,
          currency: transactionData.currency || 'GNF',
          description: transactionData.description,
          status: transactionData.status || 'pending',
          sender_wallet_id: transactionData.sender_wallet_id,
          receiver_wallet_id: transactionData.receiver_wallet_id,
          metadata: transactionData.metadata
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erreur création transaction:', error);
      return null;
    }
  }

  // Effectuer un transfert entre wallets
  // ⚠️ DÉPRÉCIÉ: Utiliser l'Edge Function wallet-transfer à la place
  // Cette méthode n'est PAS sécurisée (pas de HMAC, pas d'audit, race conditions)
  async transferFunds(fromWalletId: string, toWalletId: string, amount: number, description: string): Promise<boolean> {
    console.error('⚠️ ATTENTION: walletService.transferFunds() est déprécié!');
    console.error('➡️ Utilisez plutôt: supabase.functions.invoke("wallet-transfer")');

    throw new Error('Cette méthode est désactivée. Utilisez l\'Edge Function wallet-transfer à la place.');

    /* CODE DÉSACTIVÉ - CONSERVER POUR RÉFÉRENCE
    try {
      // Vérifier le solde du wallet source
      const { data: fromWallet, error: fromError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', fromWalletId)
        .single();

      if (fromError || !fromWallet || fromWallet.balance < amount) {
        throw new Error('Solde insuffisant');
      }

      const fee = amount * 0.01; // 1% de frais
      const net_amount = amount - fee;

      // Créer la transaction de transfert
      const transaction_id = `TRANSFER_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          transaction_id,
          transaction_type: 'transfer',
          amount,
          net_amount,
          fee,
          currency: 'GNF',
          description,
          status: 'completed',
          sender_wallet_id: fromWalletId,
          receiver_wallet_id: toWalletId
        });

      if (transactionError) throw transactionError;

      // Mettre à jour les soldes
      const { error: updateFromError } = await supabase
        .from('wallets')
        .update({ balance: fromWallet.balance - amount })
        .eq('id', fromWalletId);

      if (updateFromError) throw updateFromError;

      const { data: toWallet, error: toWalletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', toWalletId)
        .single();

      if (toWalletError || !toWallet) throw new Error('Wallet destinataire introuvable');

      const { error: updateToError } = await supabase
        .from('wallets')
        .update({ balance: toWallet.balance + net_amount })
        .eq('id', toWalletId);

      if (updateToError) throw updateToError;

      return true;
    } catch (error) {
      console.error('❌ Erreur transfert:', error);
      return false;
    }
    */
  }

  // Obtenir les statistiques d'un wallet
  async getWalletStats(walletId: string): Promise<WalletStats> {
    try {
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('transaction_type, amount, status, created_at, sender_wallet_id, receiver_wallet_id')
        .or(`sender_wallet_id.eq.${walletId},receiver_wallet_id.eq.${walletId}`);

      if (error) throw error;

      const stats: WalletStats = {
        totalBalance: 0,
        totalTransactions: transactions?.length || 0,
        totalCredits: 0,
        totalDebits: 0,
        pendingTransactions: 0,
        monthlyVolume: 0
      };

      if (transactions) {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        transactions.forEach(tx => {
          if (tx.status === 'completed') {
            // Crédit si on reçoit
            if (tx.receiver_wallet_id === walletId) {
              stats.totalCredits += tx.amount;
            }
            // Débit si on envoie
            if (tx.sender_wallet_id === walletId) {
              stats.totalDebits += tx.amount;
            }

            // Volume mensuel
            const txDate = new Date(tx.created_at);
            if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
              stats.monthlyVolume += tx.amount;
            }
          } else if (tx.status === 'pending') {
            stats.pendingTransactions++;
          }
        });
      }

      // Récupérer le solde actuel
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', walletId)
        .single();

      stats.totalBalance = wallet?.balance || 0;

      return stats;
    } catch (error) {
      console.error('❌ Erreur statistiques wallet:', error);
      return {
        totalBalance: 0,
        totalTransactions: 0,
        totalCredits: 0,
        totalDebits: 0,
        pendingTransactions: 0,
        monthlyVolume: 0
      };
    }
  }

  // Fonction appelée lors de l'inscription d'un utilisateur
  async onUserRegistration(userId: string): Promise<void> {
    try {
      // Vérifier si l'utilisateur a déjà un wallet
      const existingWallet = await this.getUserWallet(userId);

      if (!existingWallet) {
        await this.createUserWallet(userId);
        console.log('✅ Wallet créé automatiquement');
      }
    } catch (error) {
      console.error('❌ Erreur création wallet inscription:', error);
    }
  }

  // Utilitaires
  formatAmount(amount: number, currency: string = 'GNF'): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount) + ' ' + currency;
  }

  validateAmount(amount: number): boolean {
    return amount > 0 && amount <= 10000000; // Max 10M GNF
  }
}

// Export de l'instance singleton
const walletService = new WalletService();
export default walletService;

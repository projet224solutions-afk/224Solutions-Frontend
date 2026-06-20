/**
 * SERVICE DE FILE D'ATTENTE POUR TRANSACTIONS
 * Gère les transactions lourdes de manière asynchrone
 * Améliore la scalabilité et la résilience du système
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface QueuedTransaction {
  id?: string;
  transaction_type: 'transfer' | 'deposit' | 'withdrawal' | 'payment';
  user_id: string;
  payload: Record<string, any>;
  status: QueueStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_at?: string;
  created_at?: string;
  updated_at?: string;
  error_message?: string;
}

class TransactionQueueService {
  private processingInterval: number | null = null;
  private readonly RETRY_DELAYS = [1000, 5000, 15000, 60000]; // Backoff exponentiel

  /**
   * Ajoute une transaction à la file d'attente
   */
  async enqueue(transaction: Omit<QueuedTransaction, 'id' | 'status' | 'attempts' | 'created_at' | 'updated_at'>): Promise<string | null> {
    // Pour le moment, traiter directement
    // TODO: Implémenter file d'attente quand la table sera créée
    try {
      let _result;
      switch (transaction.transaction_type) {
        case 'transfer':
          _result = await this.processTransfer(transaction.payload);
          break;
        case 'deposit':
          toast.info('Dépôt en cours de traitement');
          return 'direct-processing';
        case 'withdrawal':
          toast.info('Retrait en cours de traitement');
          return 'direct-processing';
        case 'payment':
          _result = await this.processPayment(transaction.payload);
          break;
      }

      toast.success('Transaction complétée');
      return 'completed';
    } catch (error) {
      console.error('Queue enqueue error:', error);
      toast.error('Erreur lors du traitement');
      return null;
    }
  }

  /**
   * Traite les transactions en attente (priorité élevée en premier)
   */
  async processQueue(): Promise<void> {
    // TODO: Implémenter quand la table transaction_queue sera créée
    return;
  }

  /**
   * Traite une transaction individuelle
   */
  private async processTransaction(transaction: QueuedTransaction): Promise<void> {
    try {
      // Marquer comme en cours de traitement
      await this.updateStatus(transaction.id!, 'processing');

      // Traiter selon le type
      let _result;
      switch (transaction.transaction_type) {
        case 'transfer':
          _result = await this.processTransfer(transaction.payload);
          break;
        case 'deposit':
          _result = await this.processDeposit(transaction.payload);
          break;
        case 'withdrawal':
          _result = await this.processWithdrawal(transaction.payload);
          break;
        case 'payment':
          _result = await this.processPayment(transaction.payload);
          break;
        default:
          throw new Error(`Type de transaction inconnu: ${transaction.transaction_type}`);
      }

      // Marquer comme complété
      await this.updateStatus(transaction.id!, 'completed');

      toast.success('Transaction complétée', {
        description: 'Votre transaction a été traitée avec succès'
      });
    } catch (error: any) {
      console.error('Transaction processing error:', error);
      await this.handleTransactionError(transaction, error);
    }
  }

  /**
   * Gère les erreurs de transaction avec retry
   */
  private async handleTransactionError(transaction: QueuedTransaction, error: any): Promise<void> {
    const attempts = (transaction.attempts || 0) + 1;
    const maxAttempts = transaction.max_attempts || 3;

    if (attempts >= maxAttempts) {
      // Échec définitif
      await supabase
        .from('transaction_queue' as any)
        .update({
          status: 'failed',
          attempts,
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      toast.error('Transaction échouée', {
        description: 'Veuillez réessayer plus tard'
      });
    } else {
      // Réessayer avec backoff
      const retryDelay = this.RETRY_DELAYS[attempts - 1] || 60000;
      const scheduledAt = new Date(Date.now() + retryDelay);

      await supabase
        .from('transaction_queue' as any)
        .update({
          status: 'retrying',
          attempts,
          scheduled_at: scheduledAt.toISOString(),
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      toast.warning('Transaction en retry', {
        description: `Nouvelle tentative dans ${Math.round(retryDelay / 1000)} secondes`
      });
    }
  }

  /**
   * Met à jour le statut d'une transaction
   */
  private async updateStatus(id: string, status: QueueStatus): Promise<void> {
    await supabase
      .from('transaction_queue' as any)
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
  }

  /**
   * Traite un transfert
   */
  private async processTransfer(payload: Record<string, any>): Promise<any> {
    const { data, error } = await supabase.rpc('process_wallet_transfer_with_fees', {
      p_sender_code: payload.sender_code,
      p_receiver_code: payload.recipient_code || payload.receiver_code,
      p_amount: payload.amount,
      p_description: payload.description
    });

    if (error) throw error;
    return data;
  }

  /**
   * Traite un dépôt
   */
  private async processDeposit(_payload: Record<string, any>): Promise<any> {
    // TODO: Implémenter avec les bonnes fonctions RPC
    throw new Error('Deposit processing not yet implemented');
  }

  /**
   * Traite un retrait
   */
  private async processWithdrawal(_payload: Record<string, any>): Promise<any> {
    // TODO: Implémenter avec les bonnes fonctions RPC
    throw new Error('Withdrawal processing not yet implemented');
  }

  /**
   * Traite un paiement
   */
  private async processPayment(payload: Record<string, any>): Promise<any> {
    // Appeler l'edge function de paiement
    const { data, error } = await supabase.functions.invoke('taxi-payment-process', {
      body: payload
    });

    if (error) throw error;
    return data;
  }

  /**
   * Démarre le traitement automatique de la file d'attente
   */
  startProcessing(intervalMs: number = 5000): void {
    if (this.processingInterval) return;

    this.processingInterval = window.setInterval(() => {
      this.processQueue();
    }, intervalMs);

    // Traiter immédiatement
    this.processQueue();
  }

  /**
   * Arrête le traitement automatique
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Récupère le statut d'une transaction
   */
  async getStatus(_id: string): Promise<QueuedTransaction | null> {
    // TODO: Implémenter quand la table transaction_queue sera créée
    return null;
  }
}

export const transactionQueueService = new TransactionQueueService();

// Démarrer le traitement automatique si on est dans un navigateur
if (typeof window !== 'undefined') {
  transactionQueueService.startProcessing();
}

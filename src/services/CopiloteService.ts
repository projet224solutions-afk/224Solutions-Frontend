/**
 * 🤖 SERVICE COPILOTE 224
 * Service frontend pour interagir avec le Copilote IA via Supabase
 * Version 3.0 - Sécurité renforcée avec circuit breaker et audit trail
 */

import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface UserContext {
  name: string;
  role: string;
  balance: number;
  currency: string;
}

export interface CopiloteResponse {
  reply: string;
  timestamp: string;
  user_context: UserContext;
}

// 🔒 WHITELIST DES ACTIONS AUTORISÉES (doit correspondre au backend)
export type AllowedBusinessActionType =
  | 'wallet_balance'
  | 'transaction_history'
  | 'finance_simulation'
  | 'rate_show'
  | 'system_stats';

export interface BusinessAction {
  type: AllowedBusinessActionType;
  data: Record<string, unknown>;
  result?: unknown;
}

// 🚦 Circuit Breaker
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

class CopiloteService {
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed'
  };

  private readonly MAX_FAILURES = 3;
  private readonly RESET_TIMEOUT = 30000; // 30 secondes
  private readonly HALF_OPEN_TIMEOUT = 10000; // 10 secondes

  /**
   * Vérifier l'état du circuit breaker
   */
  private checkCircuitBreaker(): { allowed: boolean; reason?: string } {
    const now = Date.now();

    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = now - this.circuitBreaker.lastFailureTime;

      if (timeSinceLastFailure > this.RESET_TIMEOUT) {
        // Passer en half-open pour tester
        this.circuitBreaker.state = 'half-open';
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Circuit breaker ouvert - Service temporairement indisponible'
      };
    }

    return { allowed: true };
  }

  /**
   * Enregistrer un succès (réinitialiser le circuit breaker)
   */
  private recordSuccess(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = 'closed';
  }

  /**
   * Enregistrer un échec (incrémenter le compteur)
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.MAX_FAILURES) {
      this.circuitBreaker.state = 'open';
      console.warn('🚨 Circuit breaker ouvert - Trop d\'échecs détectés');
    }
  }

  /**
   * Logger une action dans l'audit trail
   */
  private async logAudit(action: string, data: any, success: boolean, error?: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // TODO: Créer la table copilot_audit_logs dans la base de données
      console.log('[CopiloteService] Audit log:', { action, success, error });
      // await supabase.from('copilot_audit_logs').insert({
      //   user_id: user.user.id,
      //   action_type: action,
      //   action_data: data,
      //   success,
      //   error_message: error || null,
      //   created_at: new Date().toISOString()
      // });
    } catch (e) {
      console.error('Failed to log audit:', e);
    }
  }
  async sendMessage(message: string): Promise<CopiloteResponse> {
    // Vérifier circuit breaker
    const circuitCheck = this.checkCircuitBreaker();
    if (!circuitCheck.allowed) {
      await this.logAudit('send_message_blocked', { message: message.substring(0, 50) }, false, circuitCheck.reason);
      throw new Error(circuitCheck.reason);
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Non authentifié');

      // ✅ Appel fiable via supabase.functions.invoke (pas de fetch direct)
      const { data, error } = await supabase.functions.invoke('pdg-ai-assistant', {
        body: { action: 'chat', message, stream: false },
      });

      if (error) {
        this.recordFailure();
        await this.logAudit('send_message', { message: message.substring(0, 50) }, false, error.message);
        throw new Error(error.message);
      }

      const reply = (data as any)?.reply ?? (data as any)?.answer ?? '';
      const timestamp = (data as any)?.timestamp ?? new Date().toISOString();
      const user_context = (data as any)?.user_context ?? { name: 'PDG', role: 'admin', balance: 0, currency: 'GNF' };

      this.recordSuccess();
      await this.logAudit('send_message', { message: message.substring(0, 50) }, true);

      return { reply, timestamp, user_context };
    } catch (error) {
      this.recordFailure();
      console.error('Erreur CopiloteService.sendMessage:', error);
      await this.logAudit(
        'send_message',
        { message: message.substring(0, 50) },
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  async getHistory(limit: number = 20): Promise<Message[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      const { data, error } = await supabase
        .from('copilot_conversations')
        .select('*')
        .eq('pdg_user_id', user.user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const messages: Message[] = [];
      (data || []).forEach((conv: Record<string, unknown>) => {
        messages.push({ id: `${conv.id as string}-in`, role: 'user', content: conv.message_in as string, timestamp: conv.created_at as string });
        messages.push({ id: `${conv.id as string}-out`, role: 'assistant', content: conv.message_out as string, timestamp: conv.created_at as string });
      });

      return messages.reverse();
    } catch (error) {
      console.error('Erreur CopiloteService.getHistory:', error);
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('copilot_conversations')
        .delete()
        .eq('pdg_user_id', user.user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Erreur CopiloteService.clearHistory:', error);
      throw error;
    }
  }

  async getStatus(): Promise<{ status: string; version: string; uptime?: number }> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return { status: 'offline', version: '3.0' };

      const { data, error } = await supabase.functions.invoke('pdg-ai-assistant', {
        body: { action: 'status' },
      });

      if (error) return { status: 'degraded', version: '3.0' };

      return (data as any) || { status: 'online', version: '3.0' };
    } catch (error) {
      console.error('Erreur CopiloteService.getStatus:', error);
      return { status: 'degraded', version: '3.0' };
    }
  }

  async executeBusinessAction(action: BusinessAction): Promise<unknown> {
    // Vérifier circuit breaker
    const circuitCheck = this.checkCircuitBreaker();
    if (!circuitCheck.allowed) {
      await this.logAudit('business_action_blocked', action, false, circuitCheck.reason);
      throw new Error(circuitCheck.reason);
    }

    // Vérifier que l'action est dans la whitelist
    const allowedActions: AllowedBusinessActionType[] = [
      'wallet_balance',
      'transaction_history',
      'finance_simulation',
      'rate_show',
      'system_stats'
    ];

    if (!allowedActions.includes(action.type)) {
      const errorMsg = `Action non autorisée: ${action.type}`;
      await this.logAudit('business_action_rejected', action, false, errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const { data, error } = await supabase.functions.invoke('pdg-ai-assistant', {
        body: { action: 'business_action', businessAction: action }
      });

      if (error) {
        this.recordFailure();
        await this.logAudit('business_action', action, false, error.message);
        throw error;
      }

      this.recordSuccess();
      await this.logAudit('business_action', action, true);
      return data;
    } catch (error) {
      this.recordFailure();
      console.error('Erreur CopiloteService.executeBusinessAction:', error);
      await this.logAudit('business_action', action, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getWalletBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Non authentifié');

      const { data: wallet, error } = await supabase
        .from('wallets')
        .select('balance, currency')
        .eq('user_id', user.user.id)
        .single();

      if (error) throw error;
      return wallet;
    } catch (error) {
      console.error('Erreur lors de la récupération du solde:', error);
      throw error;
    }
  }

  async getTransactionHistory(limit: number = 10): Promise<Record<string, unknown>[]> {
    try {
      const { data: transactions, error } = await (supabase
        .from('enhanced_transactions' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit) as any);

      if (error) throw error;
      return (transactions || []) as Record<string, unknown>[];
    } catch (error) {
      console.error('Erreur lors de la récupération des transactions:', error);
      throw error;
    }
  }

  async simulateCurrencyConversion(amount: number, fromCurrency: string, toCurrency: string) {
    try {
      const { data: rate, error } = await supabase
        .from('exchange_rates')
        .select('rate')
        .eq('from_currency', fromCurrency)
        .eq('to_currency', toCurrency)
        .single();

      if (error || !rate) throw new Error('Taux de change non trouvé');

      const convertedAmount = amount * rate.rate;
      const fees = convertedAmount * 0.005;

      return {
        originalAmount: amount,
        convertedAmount,
        rate: rate.rate,
        fees,
        totalCost: amount + fees
      };
    } catch (error) {
      console.error('Erreur lors de la simulation:', error);
      throw error;
    }
  }

  async getExchangeRates(): Promise<unknown[]> {
    try {
      const { data: rates, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return rates || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des taux:', error);
      throw error;
    }
  }

  async analyzeSystem(): Promise<CopiloteResponse> {
    // Vérifier circuit breaker
    const circuitCheck = this.checkCircuitBreaker();
    if (!circuitCheck.allowed) {
      await this.logAudit('analyze_system_blocked', {}, false, circuitCheck.reason);
      throw new Error(circuitCheck.reason);
    }

    try {
      const [transactionsData, profilesData, walletsData] = await Promise.all([
        supabase.from('enhanced_transactions' as any).select('*').limit(50) as any,
        supabase.from('profiles').select('id, role, status, created_at').limit(100),
        supabase.from('wallets').select('*').limit(50)
      ]);

      const transactions = (transactionsData.data || []) as Record<string, unknown>[];
      const profiles = profilesData.data || [];
      const wallets = walletsData.data || [];

      const completedTransactions = transactions.filter((t: Record<string, unknown>) => t.status === 'completed');
      const totalRevenue = completedTransactions.reduce((sum: number, t: Record<string, unknown>) => sum + (t.amount as number || 0), 0);

      const analysisMessage = `
📊 ANALYSE SYSTÈME 224SOLUTIONS
- ${profiles.length} utilisateurs
- ${transactions.length} transactions (${completedTransactions.length} complétées)
- Revenu: ${totalRevenue.toLocaleString()} GNF
- ${wallets.length} wallets actifs
`;

      const result = await this.sendMessage(analysisMessage);
      await this.logAudit('analyze_system', { users: profiles.length, transactions: transactions.length }, true);
      return result;
    } catch (error) {
      console.error('❌ Erreur analyse système:', error);
      await this.logAudit('analyze_system', {}, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getAIStats(): Promise<{ total_conversations: number; service_status: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Non authentifié');

      const { count } = await supabase
        .from('copilot_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('pdg_user_id', user.user.id);

      return { total_conversations: count || 0, service_status: 'online' };
    } catch (_error) {
      return { total_conversations: 0, service_status: 'offline' };
    }
  }

  async cleanupOldLogs(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await supabase
      .from('copilot_conversations')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());
  }
}

export const copiloteService = new CopiloteService();
export default copiloteService;

import { supabase } from '@/integrations/supabase/client';
import { backendFetch, generateIdempotencyKey } from './backendApi';

export interface DriverSubscription {
  id: string;
  user_id: string;
  type: 'taxi' | 'livreur';
  price: number;
  status: 'active' | 'expired' | 'pending' | 'suspended';
  start_date: string;
  end_date: string;
  payment_method: 'wallet' | 'mobile_money' | 'card';
  transaction_id?: string;
  days_remaining?: number;
  billing_cycle?: 'monthly' | 'yearly';
  metadata?: any;
}

export interface DriverSubscriptionConfig {
  id: string;
  subscription_type: 'taxi' | 'livreur' | 'both';
  price: number;
  duration_days: number;
  is_active: boolean;
  yearly_price?: number;
  yearly_discount_percentage?: number;
}

export interface SubscriptionRevenue {
  id: string;
  subscription_id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  transaction_id?: string;
  created_at: string;
}

export class DriverSubscriptionService {
  // Initialiser un wallet si absent
  static async ensureWallet(userId: string): Promise<{ exists: boolean; balance: number }> {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (!error && data) return { exists: true, balance: data.balance || 0 };

      // Si non trouvé, créer un wallet à 0
      const { error: insertError } = await supabase
        .from('wallets')
        .insert({ user_id: userId, balance: 0, currency: 'GNF', updated_at: new Date().toISOString() });
      if (insertError) {
        console.error('Erreur création wallet:', insertError);
        return { exists: false, balance: 0 };
      }
      return { exists: true, balance: 0 };
    } catch (e) {
      console.error('Exception ensureWallet:', e);
      return { exists: false, balance: 0 };
    }
  }
  // Obtenir la configuration de l'abonnement
  static async getConfig(): Promise<DriverSubscriptionConfig> {
    try {
      const { data, error } = await supabase
        .from('driver_subscription_config')
        .select('*')
        .eq('subscription_type', 'both')
        .eq('is_active', true)
        .single();

      if (error) {
        // Si pas de config trouvée, utiliser valeurs par défaut
        if (error.code === 'PGRST116') {
          console.warn('Aucune config trouvée, utilisation valeurs par défaut');
          return this.getDefaultConfig();
        }
        console.error('Erreur récupération config:', error);
        return this.getDefaultConfig();
      }
      return data as DriverSubscriptionConfig;
    } catch (error) {
      console.error('Exception récupération config:', error);
      return this.getDefaultConfig();
    }
  }

  // Configuration par défaut
  private static getDefaultConfig(): DriverSubscriptionConfig {
    return {
      id: 'default',
      subscription_type: 'both',
      price: 50000,
      duration_days: 30,
      is_active: true,
      yearly_price: 570000,
      yearly_discount_percentage: 5
    };
  }

  // Mettre à jour le prix (Admin seulement)
  static async updatePrice(newPrice: number): Promise<boolean> {
    const { error } = await supabase
      .from('driver_subscription_config')
      .update({ price: newPrice, updated_at: new Date().toISOString() })
      .eq('subscription_type', 'both');

    if (error) {
      console.error('Erreur mise à jour prix:', error);
      return false;
    }
    return true;
  }

  // Vérifier si l'utilisateur a un abonnement actif
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('has_active_driver_subscription', { p_user_id: userId });

      if (error) {
        // Si la fonction n'existe pas, vérifier manuellement
        if (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.warn('RPC function not found, checking manually');
          return await this.hasActiveSubscriptionManual(userId);
        }
        console.error('Erreur vérification abonnement:', error);
        return false;
      }
      return data || false;
    } catch (error) {
      console.error('Exception vérification abonnement:', error);
      return false;
    }
  }

  // Vérification manuelle (fallback)
  private static async hasActiveSubscriptionManual(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('driver_subscriptions')
        .select('id, status, end_date')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .limit(1);

      if (error) {
        console.error('Erreur vérification manuelle:', error);
        return false;
      }
      return !!(data && data.length > 0);
    } catch (error) {
      console.error('Exception vérification manuelle:', error);
      return false;
    }
  }

  // Obtenir l'abonnement actif de l'utilisateur
  static async getActiveSubscription(userId: string): Promise<DriverSubscription | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_active_driver_subscription', { p_user_id: userId });

      if (error) {
        // Si la fonction n'existe pas, récupérer manuellement
        if (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.warn('RPC function not found, fetching manually');
          return await this.getActiveSubscriptionManual(userId);
        }
        // Si pas de résultat, retourner null au lieu de throw
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Erreur récupération abonnement:', error);
        return null; // Au lieu de throw
      }

      if (data && data.length > 0) {
        return { ...data[0], user_id: userId } as DriverSubscription;
      }
      return null;
    } catch (error: any) {
      console.error('Exception récupération abonnement:', error);
      // Pas d'abonnement n'est pas une erreur
      if (error?.code === 'PGRST116' || error?.message?.includes('No rows')) {
        return null;
      }
      return null; // Au lieu de throw pour éviter de casser l'UI
    }
  }

  // Récupération manuelle (fallback)
  private static async getActiveSubscriptionManual(userId: string): Promise<DriverSubscription | null> {
    try {
      const { data, error } = await supabase
        .from('driver_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // Si pas d'abonnement, ce n'est pas une erreur
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Erreur récupération manuelle:', error);
        return null;
      }

      // Calculer days_remaining
      if (data) {
        const endDate = new Date(data.end_date);
        const now = new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: data.id,
          user_id: data.user_id,
          type: data.type,
          price: data.price,
          status: data.status,
          start_date: data.start_date,
          end_date: data.end_date,
          payment_method: data.payment_method,
          transaction_id: data.transaction_id,
          days_remaining: daysRemaining,
          billing_cycle: data.billing_cycle,
          metadata: data.metadata
        } as DriverSubscription;
      }

      return null;
    } catch (error) {
      console.error('Exception récupération manuelle:', error);
      return null;
    }
  }
  // S'abonner ou renouveler (via Wallet)
  // Toute la logique est gérée par le backend Node.js : POST /api/subscriptions/driver/purchase
  // (débit wallet TRACÉ dans wallet_transactions, anti-double-facturation si déjà actif).
  static async subscribeWithWallet(
    userId: string,
    userType: 'taxi' | 'livreur',
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
      const response = await backendFetch<{ subscription_id: string; already_active?: boolean }>(
        '/api/subscriptions/driver/purchase',
        {
          method: 'POST',
          body: { type: userType, billing_cycle: billingCycle, payment_method: 'wallet' },
          idempotencyKey: generateIdempotencyKey(),
        }
      );

      if (!response.success) {
        return { success: false, error: response.error || 'Erreur création abonnement' };
      }
      return { success: true, subscriptionId: response.data?.subscription_id };
    } catch (error: any) {
      console.error('Erreur abonnement wallet:', error);
      return { success: false, error: error?.message || 'Erreur système' };
    }
  }

  // Obtenir tous les abonnements (Admin)
  static async getAllSubscriptions(
    status?: string,
    limit: number = 50
  ): Promise<DriverSubscription[]> {
    let query = supabase
      .from('driver_subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur récupération abonnements:', error);
      return [];
    }
    return (data || []) as DriverSubscription[];
  }

  // Obtenir les revenus d'abonnement (Admin)
  static async getRevenues(
    startDate?: string,
    endDate?: string
  ): Promise<SubscriptionRevenue[]> {
    let query = supabase
      .from('driver_subscription_revenues')
      .select('*')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur récupération revenus:', error);
      return [];
    }
    return data || [];
  }

  // Suspendre un abonnement (Admin)
  static async suspendSubscription(subscriptionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('driver_subscriptions')
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', subscriptionId);

    if (error) {
      console.error('Erreur suspension abonnement:', error);
      return false;
    }
    return true;
  }

  // Réactiver un abonnement (Admin)
  static async reactivateSubscription(subscriptionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('driver_subscriptions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', subscriptionId);

    if (error) {
      console.error('Erreur réactivation abonnement:', error);
      return false;
    }
    return true;
  }

  // Marquer les abonnements expirés (Cron / Admin)
  static async markExpiredSubscriptions(): Promise<number> {
    const { data, error } = await supabase
      .rpc('mark_expired_driver_subscriptions');

    if (error) {
      console.error('Erreur marquage expirés:', error);
      return 0;
    }
    return data || 0;
  }

  // Statistiques pour le dashboard Admin
  static async getStatistics(): Promise<{
    total_active: number;
    total_expired: number;
    total_revenue: number;
    revenue_this_month: number;
    active_taxi: number;
    active_livreur: number;
  }> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 3 requêtes au lieu de 6 : récupérer toutes les données en une passe
    const [{ data: allSubscriptions }, { data: allRevenues }] = await Promise.all([
      supabase.from('driver_subscriptions').select('status, type'),
      supabase.from('driver_subscription_revenues').select('amount, created_at')
    ]);

    const subs = allSubscriptions || [];
    const revs = allRevenues || [];
    const total_active = subs.filter(s => s.status === 'active').length;
    const total_expired = subs.filter(s => s.status === 'expired').length;
    const active_taxi = subs.filter(s => s.status === 'active' && s.type === 'taxi').length;
    const active_livreur = subs.filter(s => s.status === 'active' && s.type === 'livreur').length;
    const total_revenue = revs.reduce((sum, r) => sum + (r.amount || 0), 0);
    const revenue_this_month = revs
      .filter(r => r.created_at >= firstDayOfMonth)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      total_active,
      total_expired,
      total_revenue,
      revenue_this_month,
      active_taxi: active_taxi || 0,
      active_livreur: active_livreur || 0
    };
  }
}

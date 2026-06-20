import { supabase } from '@/lib/supabaseClient';
import { backendFetch, generateIdempotencyKey } from './backendApi';

// ============================================
// INTERFACES UNIFIÉES
// ============================================

export interface UnifiedPlan {
  id: string;
  name: string;
  display_name: string;
  monthly_price_gnf: number;
  yearly_price_gnf?: number;
  yearly_discount_percentage?: number;
  user_role: 'vendeur' | 'taxi' | 'livreur' | 'all';
  duration_days: number;
  max_products: number | null;
  max_images_per_product: number | null;
  analytics_access: boolean;
  priority_support: boolean;
  featured_products: boolean;
  api_access: boolean;
  custom_branding: boolean;
  features: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface UnifiedSubscription {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  plan_display_name: string;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing' | 'expired';
  current_period_end: string;
  auto_renew: boolean;
  price_paid: number;
  billing_cycle: string;
  user_role: string;
  duration_days: number;
  max_products: number | null;
  max_images_per_product: number | null;
  analytics_access: boolean;
  priority_support: boolean;
  featured_products: boolean;
  api_access: boolean;
  custom_branding: boolean;
  features: string[];
}

export interface SubscriptionStats {
  total_active: number;
  total_expired: number;
  total_revenue: number;
  monthly_revenue: number;
  by_role: {
    vendeur: number;
    taxi: number;
    livreur: number;
  };
}

// ============================================
// SERVICE UNIFIÉ
// ============================================

export class UnifiedSubscriptionService {

  /**
   * Récupérer tous les plans actifs
   */
  static async getAllPlans(): Promise<UnifiedPlan[]> {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) {
        console.error('❌ Erreur récupération plans:', error);
        return [];
      }

      return (data || []) as UnifiedPlan[];
    } catch (error) {
      console.error('❌ Exception récupération plans:', error);
      return [];
    }
  }

  /**
   * Récupérer les plans pour un rôle spécifique
   */
  static async getPlansByRole(role?: 'vendeur' | 'taxi' | 'livreur'): Promise<UnifiedPlan[]> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_plans_for_role', {
        p_role: role || null,
      });

      if (error) {
        console.error('❌ Erreur récupération plans par rôle:', error);
        return [];
      }

      return (data || []) as UnifiedPlan[];
    } catch (error) {
      console.error('❌ Exception récupération plans par rôle:', error);
      return [];
    }
  }

  /**
   * Récupérer l'abonnement actif de l'utilisateur
   */
  static async getActiveSubscription(userId: string): Promise<UnifiedSubscription | null> {
    try {
      const { data, error } = await supabase.rpc('get_active_subscription', {
        p_user_id: userId,
      });

      if (error) {
        console.error('❌ Erreur récupération abonnement actif:', error);
        return null;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        return null;
      }

      // Si c'est un tableau, prendre le premier élément
      const subscription = Array.isArray(data) ? data[0] : data;

      return subscription as unknown as UnifiedSubscription;
    } catch (error) {
      console.error('❌ Exception récupération abonnement:', error);
      return null;
    }
  }

  /**
   * Vérifier si l'utilisateur a un abonnement actif
   */
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    try {
      const { data, error } = await (supabase.rpc as any)('has_active_subscription', {
        p_user_id: userId,
      });

      if (error) {
        console.error('❌ Erreur vérification abonnement:', error);
        return false;
      }

      return Boolean(data);
    } catch (error) {
      console.error('❌ Exception vérification abonnement:', error);
      return false;
    }
  }

  /**
   * Souscrire à un plan
   */
  static async subscribe(params: {
    userId: string;
    planId: string;
    paymentMethod?: 'wallet' | 'mobile_money' | 'card';
    transactionId?: string;
    billingCycle?: 'monthly' | 'yearly';
  }): Promise<string | null> {
    // Redirigé vers le backend Node.js (mêmes tables plans/subscriptions que le vendeur) :
    // débit wallet tracé, déduction au changement de plan, période conservée.
    // (Remplace l'ancienne RPC subscribe_user cassée.)
    const response = await backendFetch<{ subscription_id: string }>(
      '/api/subscriptions/purchase',
      {
        method: 'POST',
        body: {
          plan_id: params.planId,
          billing_cycle: params.billingCycle || 'monthly',
          payment_method: params.paymentMethod || 'wallet',
        },
        idempotencyKey: generateIdempotencyKey(),
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la souscription');
    }
    return response.data?.subscription_id ?? null;
  }

  /**
   * Calculer le prix en fonction du cycle de facturation
   */
  static calculatePrice(plan: UnifiedPlan, billingCycle: 'monthly' | 'yearly'): number {
    if (billingCycle === 'yearly' && plan.yearly_price_gnf) {
      return plan.yearly_price_gnf;
    }

    if (billingCycle === 'yearly') {
      // Calculer avec la réduction
      const discount = plan.yearly_discount_percentage || 5;
      return Math.round(plan.monthly_price_gnf * 12 * (1 - discount / 100));
    }

    return plan.monthly_price_gnf;
  }

  /**
   * Obtenir les jours restants d'un abonnement
   */
  static getDaysRemaining(endDate: string): number {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Vérifier si un abonnement est expiré
   */
  static isExpired(endDate: string): boolean {
    return new Date(endDate) <= new Date();
  }

  /**
   * Formater le prix en GNF
   */
  static formatPrice(price: number): string {
    return `${price.toLocaleString('fr-FR')} GNF`;
  }

  /**
   * Annuler l'abonnement (désactiver le renouvellement automatique)
   */
  static async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          auto_renew: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);

      if (error) {
        console.error('❌ Erreur annulation abonnement:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Exception annulation abonnement:', error);
      return false;
    }
  }

  /**
   * Réactiver le renouvellement automatique
   */
  static async enableAutoRenew(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          auto_renew: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);

      if (error) {
        console.error('❌ Erreur réactivation auto-renew:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Exception réactivation auto-renew:', error);
      return false;
    }
  }

  /**
   * Marquer les abonnements expirés
   */
  static async markExpiredSubscriptions(): Promise<number> {
    try {
      const { data, error } = await (supabase.rpc as any)('mark_expired_subscriptions');

      if (error) {
        console.error('❌ Erreur marquage expirations:', error);
        return 0;
      }

      return data as number;
    } catch (error) {
      console.error('❌ Exception marquage expirations:', error);
      return 0;
    }
  }

  /**
   * Obtenir les statistiques d'abonnement (Admin)
   */
  static async getSubscriptionStats(): Promise<SubscriptionStats | null> {
    try {
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const [
        activeRes,
        expiredRes,
        totalRevenueRes,
        monthlyRevenueRes,
        vendeurRes,
        taxiRes,
        livreurRes
      ] = await Promise.all([
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
        supabase.from('revenus_pdg').select('amount').eq('source_type', 'frais_abonnement'),
        supabase.from('revenus_pdg').select('amount').eq('source_type', 'frais_abonnement').gte('created_at', firstDayOfMonth.toISOString()),
        supabase.from('subscriptions').select('id, profiles!inner(role)', { count: 'exact', head: true }).eq('status', 'active').eq('profiles.role', 'vendeur'),
        supabase.from('subscriptions').select('id, profiles!inner(role)', { count: 'exact', head: true }).eq('status', 'active').eq('profiles.role', 'taxi'),
        supabase.from('subscriptions').select('id, profiles!inner(role)', { count: 'exact', head: true }).eq('status', 'active').eq('profiles.role', 'livreur')
      ]);

      const totalRevenue = (totalRevenueRes.data || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      const monthlyRevenue = (monthlyRevenueRes.data || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

      return {
        total_active: activeRes.count || 0,
        total_expired: expiredRes.count || 0,
        total_revenue: totalRevenue,
        monthly_revenue: monthlyRevenue,
        by_role: {
          vendeur: vendeurRes.count || 0,
          taxi: taxiRes.count || 0,
          livreur: livreurRes.count || 0,
        }
      };
    } catch (error) {
      console.error('❌ Exception récupération stats:', error);
      return null;
    }
  }

  /**
   * Vérifier les limites de produits (pour vendeurs)
   */
  static async checkProductLimit(userId: string): Promise<{
    current_count: number;
    max_products: number | null;
    can_add: boolean;
    is_unlimited: boolean;
  } | null> {
    try {
      const { data, error } = await supabase.rpc('check_product_limit', {
        p_user_id: userId,
      });

      if (error) {
        console.error('❌ Erreur vérification limite produits:', error);
        return null;
      }

      return data as any;
    } catch (error) {
      console.error('❌ Exception vérification limite:', error);
      return null;
    }
  }

  /**
   * Obtenir l'historique des abonnements d'un utilisateur
   */
  static async getSubscriptionHistory(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plans (
            name,
            display_name,
            user_role
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur récupération historique:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Exception récupération historique:', error);
      return [];
    }
  }
}

// ============================================
// EXPORTS POUR COMPATIBILITÉ
// ============================================

// Exporter aussi sous l'ancien nom pour compatibilité
export const SubscriptionService = UnifiedSubscriptionService;
export const DriverSubscriptionService = UnifiedSubscriptionService;

export default UnifiedSubscriptionService;

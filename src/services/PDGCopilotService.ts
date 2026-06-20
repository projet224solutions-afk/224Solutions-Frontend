/**
 * 🎯 SERVICE COPILOTE PDG - 224SOLUTIONS
 * Service d'analyse exécutive pour le PDG
 * Analyse automatique à partir d'un ID seul
 */

import { supabase } from '@/integrations/supabase/client';

export interface VendorAnalysis {
  // Identité
  vendor_id: string;
  shop_name: string;
  user_email: string;
  created_at: string;

  // Statut
  is_active: boolean;
  subscription_status: string;
  kyc_status: string;

  // Activité commerciale
  total_products: number;
  active_products: number;
  blocked_products: number;
  total_orders: number;
  revenue: number;
  payment_success_rate: number;

  // Finances
  wallet_balance: number;
  total_withdrawals: number;
  blocked_funds: number;
  failed_payments: number;

  // Clients & Réputation
  total_customers: number;
  recurring_customers: number;
  average_rating: number;
  negative_reviews: number;
  disputes: number;

  // Logistique
  successful_deliveries: number;
  failed_deliveries: number;
  support_tickets_open: number;
  support_tickets_closed: number;

  // Marketing
  active_campaigns: number;
  campaign_performance: number;

  // Conformité & Risque
  alerts: number;
  penalties: number;
  trust_score: number;
  risk_level: 'low' | 'medium' | 'high';
}

export interface CustomerAnalysis {
  // Identité
  customer_id: string;
  user_email: string;
  created_at: string;

  // Activité
  total_orders: number;
  total_spent: number;
  average_order_value: number;

  // Paiements
  successful_payments: number;
  failed_payments: number;
  payment_methods: string[];

  // Wallet
  wallet_balance: number;
  wallet_transactions: number;

  // Réputation
  disputes_filed: number;
  disputes_won: number;
  reliability_score: number;

  // Risque
  fraud_alerts: number;
  risk_level: 'low' | 'medium' | 'high';
}

export interface FinancialSummary {
  period: string;
  total_transactions: number;
  total_revenue: number;
  successful_payments: number;
  failed_payments: number;
  payment_methods: {
    method: string;
    count: number;
    amount: number;
  }[];
  top_vendors: {
    vendor_id: string;
    shop_name: string;
    revenue: number;
  }[];
}

export class PDGCopilotService {
  /**
   * 📊 ANALYSE COMPLÈTE D'UN VENDEUR
   */
  static async analyzeVendor(vendorId: string): Promise<VendorAnalysis | null> {
    try {
      // 1. Informations de base du vendeur
      // Cast to any to bypass type checking for columns that may not be in the generated types
      const { data: vendor } = await (supabase as any)
        .from('vendors')
        .select(`
          id,
          business_name,
          user_id,
          is_active,
          subscription_tier,
          kyc_status,
          created_at
        `)
        .eq('id', vendorId)
        .single();

      if (!vendor) return null;

      // 2. Produits
      const { data: products } = await supabase
        .from('products')
        .select('id, is_active')
        .eq('vendor_id', vendorId);

      const total_products = products?.length || 0;
      const active_products = products?.filter(p => p.is_active)?.length || 0;
      const blocked_products = total_products - active_products;

      // 3. Commandes et revenus
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount, payment_status')
        .eq('vendor_id', vendorId);

      const total_orders = orders?.length || 0;
      const revenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const successful_payments = orders?.filter(o => o.payment_status === 'paid')?.length || 0;
      const payment_success_rate = total_orders > 0 ? (successful_payments / total_orders) * 100 : 0;
      const failed_payments = total_orders - successful_payments;

      // 4. Wallet
      const { data: wallet } = await (supabase as any)
        .from('wallets')
        .select('balance')
        .eq('user_id', vendor.user_id)
        .single();

      // 5. Retraits (using type column instead of operation)
      const { data: withdrawals } = await (supabase as any)
        .from('wallet_logs')
        .select('amount')
        .eq('user_id', vendor.user_id)
        .eq('type', 'withdrawal');

      const total_withdrawals = withdrawals?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;

      // 6. Clients uniques
      const { data: customers } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('vendor_id', vendorId);

      const unique_customers = new Set(customers?.map(c => c.customer_id));
      const total_customers = unique_customers.size;

      // 7. Clients récurrents (2+ commandes)
      const customer_counts = customers?.reduce((acc: any, order) => {
        acc[order.customer_id] = (acc[order.customer_id] || 0) + 1;
        return acc;
      }, {});
      const recurring_customers = Object.values(customer_counts || {}).filter((count: any) => count >= 2).length;

      // 8. Livraisons
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('status')
        .eq('vendor_id', vendorId);

      const successful_deliveries = deliveries?.filter(d => d.status === 'delivered')?.length || 0;
      const failed_deliveries = deliveries?.filter((d: any) => d.status === 'cancelled')?.length || 0;

      // 9. Support tickets
      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('status')
        .eq('vendor_id', vendorId);

      const support_tickets_open = tickets?.filter(t => t.status === 'open')?.length || 0;
      const support_tickets_closed = tickets?.filter(t => t.status === 'closed')?.length || 0;

      // 10. Avis et notes
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('vendor_id', vendorId);

      const average_rating = reviews?.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;
      const negative_reviews = reviews?.filter(r => r.rating <= 2)?.length || 0;

      // 11. Litiges
      const { data: disputes } = await supabase
        .from('disputes')
        .select('id')
        .eq('vendor_id', vendorId);

      // 12. Campagnes marketing
      const { data: campaigns } = await supabase
        .from('marketing_campaigns')
        .select('id, status')
        .eq('vendor_id', vendorId);

      const active_campaigns = campaigns?.filter(c => c.status === 'active')?.length || 0;

      // 13. Calcul du score de confiance et niveau de risque
      let trust_score = 100;
      let risk_level: 'low' | 'medium' | 'high' = 'low';

      // Pénalités selon critères
      if (payment_success_rate < 80) trust_score -= 20;
      if (negative_reviews > 5) trust_score -= 15;
      if (disputes?.length > 3) trust_score -= 25;
      if (failed_deliveries > 10) trust_score -= 10;
      if (support_tickets_open > 5) trust_score -= 10;

      if (trust_score < 50) risk_level = 'high';
      else if (trust_score < 75) risk_level = 'medium';

      return {
        vendor_id: vendorId,
        shop_name: vendor.business_name || 'Inconnu',
        user_email: vendor.email || 'N/A',
        created_at: vendor.created_at,

        is_active: vendor.is_active,
        subscription_status: vendor.subscription_tier || 'free',
        kyc_status: vendor.kyc_status || 'pending',

        total_products,
        active_products,
        blocked_products,
        total_orders,
        revenue,
        payment_success_rate: Math.round(payment_success_rate),

        wallet_balance: wallet?.balance || 0,
        total_withdrawals,
        blocked_funds: 0, // TODO: Calculer si existe
        failed_payments,

        total_customers,
        recurring_customers,
        average_rating: Math.round(average_rating * 10) / 10,
        negative_reviews,
        disputes: disputes?.length || 0,

        successful_deliveries,
        failed_deliveries,
        support_tickets_open,
        support_tickets_closed,

        active_campaigns,
        campaign_performance: 0, // TODO: Calculer

        alerts: 0, // TODO: Système d'alertes
        penalties: 0, // TODO: Système de pénalités
        trust_score,
        risk_level,
      };

    } catch (error) {
      console.error('[PDGCopilot] Erreur analyse vendeur:', error);
      return null;
    }
  }

  /**
   * 👤 ANALYSE COMPLÈTE D'UN CLIENT
   */
  static async analyzeCustomer(customerId: string): Promise<CustomerAnalysis | null> {
    try {
      // 1. Info client (using any to bypass type checking)
      const { data: customer } = await (supabase as any)
        .from('customers')
        .select('id, user_id, created_at')
        .eq('id', customerId)
        .single();

      if (!customer) return null;

      // Get email from profiles
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('email')
        .eq('id', customer.user_id)
        .single();

      // 2. Commandes
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, payment_status, payment_method')
        .eq('customer_id', customerId);

      const total_orders = orders?.length || 0;
      const total_spent = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const average_order_value = total_orders > 0 ? total_spent / total_orders : 0;

      const successful_payments = orders?.filter(o => o.payment_status === 'paid')?.length || 0;
      const failed_payments = total_orders - successful_payments;

      const payment_methods = [...new Set(orders?.map(o => o.payment_method).filter(Boolean))];

      // 3. Wallet
      const { data: wallet } = await (supabase as any)
        .from('wallets')
        .select('balance')
        .eq('user_id', customer.user_id)
        .single();

      const { data: wallet_logs } = await (supabase as any)
        .from('wallet_logs')
        .select('id')
        .eq('user_id', customer.user_id);

      // 4. Litiges
      const { data: disputes_filed } = await (supabase as any)
        .from('disputes')
        .select('id, status')
        .eq('customer_id', customerId);

      const disputes_won = disputes_filed?.filter(d => d.status === 'resolved_customer')?.length || 0;

      // 5. Score de fiabilité
      let reliability_score = 100;
      let risk_level: 'low' | 'medium' | 'high' = 'low';

      if (failed_payments > 3) reliability_score -= 20;
      if (disputes_filed && disputes_filed.length > 2) reliability_score -= 25;
      if (successful_payments === 0 && total_orders > 0) reliability_score -= 30;

      if (reliability_score < 50) risk_level = 'high';
      else if (reliability_score < 75) risk_level = 'medium';

      return {
        customer_id: customerId,
        user_email: profile?.email || 'N/A',
        created_at: customer.created_at,

        total_orders,
        total_spent,
        average_order_value: Math.round(average_order_value),

        successful_payments,
        failed_payments,
        payment_methods: payment_methods as string[],

        wallet_balance: wallet?.balance || 0,
        wallet_transactions: wallet_logs?.length || 0,

        disputes_filed: disputes_filed?.length || 0,
        disputes_won,
        reliability_score,

        fraud_alerts: 0, // TODO: Système d'alertes fraude
        risk_level,
      };

    } catch (error) {
      console.error('[PDGCopilot] Erreur analyse client:', error);
      return null;
    }
  }

  /**
   * 💰 RÉSUMÉ FINANCIER (PÉRIODE)
   */
  static async getFinancialSummary(
    startDate?: string,
    endDate?: string
  ): Promise<FinancialSummary | null> {
    try {
      const start = startDate || new Date().toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      // Transactions de la période (using any to bypass type checking)
      const { data: transactions } = await (supabase as any)
        .from('wallet_logs')
        .select('amount, type, payment_method, created_at')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`);

      const total_transactions = (transactions as any[])?.length || 0;
      const total_revenue = (transactions as any[])?.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0;

      // Commandes de la période
      const { data: orders } = await supabase
        .from('orders')
        .select('payment_status, payment_method, vendor_id, total_amount')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`);

      const successful_payments = orders?.filter(o => o.payment_status === 'paid')?.length || 0;
      const failed_payments = (orders?.length || 0) - successful_payments;

      // Moyens de paiement
      const payment_methods_map = orders?.reduce((acc: any, order) => {
        const method = order.payment_method || 'unknown';
        if (!acc[method]) {
          acc[method] = { method, count: 0, amount: 0 };
        }
        acc[method].count++;
        acc[method].amount += order.total_amount || 0;
        return acc;
      }, {});

      const payment_methods = Object.values(payment_methods_map || {}) as any[];

      // Top vendeurs
      const vendors_map = orders?.reduce((acc: any, order) => {
        const vid = order.vendor_id;
        if (!acc[vid]) {
          acc[vid] = { vendor_id: vid, revenue: 0 };
        }
        acc[vid].revenue += order.total_amount || 0;
        return acc;
      }, {});

      const top_vendors = Object.values(vendors_map || {})
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 10) as any[];

      // Enrichir avec business_name
      for (const vendor of top_vendors) {
        const { data } = await (supabase as any)
          .from('vendors')
          .select('business_name')
          .eq('id', vendor.vendor_id)
          .single();
        vendor.shop_name = data?.business_name || 'Inconnu';
      }

      return {
        period: `${start} → ${end}`,
        total_transactions,
        total_revenue,
        successful_payments,
        failed_payments,
        payment_methods,
        top_vendors,
      };

    } catch (error) {
      console.error('[PDGCopilot] Erreur résumé financier:', error);
      return null;
    }
  }

  /**
   * 🔍 RECHERCHE INTELLIGENTE (AUTO-DÉTECTION)
   */
  static async smartSearch(query: string): Promise<{
    type: 'vendor' | 'customer' | 'user' | 'unknown';
    entity_id: string | null;
  }> {
    try {
      // Tenter de détecter le type d'ID

      // 1. Chercher dans vendors
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .or(`id.eq.${query},shop_name.ilike.%${query}%`)
        .limit(1)
        .single();

      if (vendor) {
        return { type: 'vendor', entity_id: vendor.id };
      }

      // 2. Chercher dans customers
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', query)
        .limit(1)
        .single();

      if (customer) {
        return { type: 'customer', entity_id: customer.id };
      }

      // 3. Chercher dans profiles (instead of users)
      const { data: userProfile } = await (supabase as any)
        .from('profiles')
        .select('id')
        .or(`id.eq.${query},email.ilike.%${query}%`)
        .limit(1)
        .single();

      if (userProfile) {
        return { type: 'user', entity_id: (userProfile as any).id };
      }

      return { type: 'unknown', entity_id: null };

    } catch (error) {
      console.error('[PDGCopilot] Erreur recherche:', error);
      return { type: 'unknown', entity_id: null };
    }
  }
}

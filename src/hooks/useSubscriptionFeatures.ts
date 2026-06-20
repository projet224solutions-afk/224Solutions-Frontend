import { useVendorSubscription } from './useVendorSubscription';
import { Plan } from '@/services/subscriptionService';

/**
 * Types de fonctionnalités disponibles dans le système d'abonnement vendeur
 * Chaque fonctionnalité est liée à un ou plusieurs plans
 */
export type SubscriptionFeature =
  // Modules de base
  | 'pos_system'           // POS - Point de vente
  | 'inventory_management' // Inventaire
  | 'products_basic'       // Produits (avec restriction)
  | 'products_unlimited'   // Produits illimités
  | 'delivery_tracking'    // Livraison
  | 'ratings'              // Avis clients
  | 'support_basic'        // Support basique
  | 'support_tickets'      // Support tickets avancé
  | 'communication_hub'    // Messages
  | 'copilot_ai'           // Copilot IA
  | 'crm_basic'            // Clients basique
  | 'crm_advanced'         // Clients avancé
  | 'wallet_basic'         // Wallet (avec restriction)
  | 'wallet_unlimited'     // Wallet sans restriction
  // Marketing
  | 'marketing_promotions' // Marketing
  // Finance avancée (Business+)
  | 'quotes_invoices'      // Devis & Factures
  | 'payments'             // Paiements
  | 'payment_links'        // Lien de paiement
  | 'expenses'             // Dépenses
  | 'debt_management'      // Dettes
  | 'contracts'            // Contrats
  // Premium
  | 'analytics_basic'      // Analytics basique
  | 'analytics_advanced'   // Analytics avancé
  | 'analytics_realtime'   // Analytics temps réel
  | 'orders_simple'        // Commandes simples
  | 'orders_detailed'      // Commandes détaillées
  | 'notifications_push'   // Notifications push
  | 'affiliate_program'    // Programme affiliation
  | 'sales_agents'         // Agents de vente
  | 'supplier_management'  // Fournisseurs
  | 'multi_warehouse'      // Entrepôts multiples
  | 'expense_management'   // Gestion dépenses
  | 'data_export'          // Export données
  | 'prospect_management'  // Gestion prospects
  | 'advanced_integrations'// Intégrations avancées
  | 'multi_user'           // Multi-utilisateurs
  | 'gemini_ai'            // Assistant IA Gemini
  | 'advanced_security'    // Sécurité avancée
  | 'dedicated_manager'    // Account manager dédié
  | 'custom_branding'      // Branding personnalisé
  | 'training'             // Formation dédiée
  | 'offline_mode'         // Mode hors ligne
  | 'cloud_sync'           // Synchronisation cloud
  | 'priority_support'     // Support prioritaire
  | 'featured_products'    // Produits en vedette
  | 'email_support'        // Support email
  | 'auto_billing'         // Facturation auto
  | 'stock_alerts'         // Alertes stocks
  | 'complete_history'     // Historique complet
  | 'custom_reports'       // Rapports personnalisés
  | 'unlimited_modules'    // Tous les modules
  | 'custom_commissions'   // Commissions personnalisées
  | 'unlimited_integrations'; // Intégrations illimitées

/**
 * Mapping des modules de la sidebar vers les features
 */
export const MODULE_FEATURE_MAP: Record<string, SubscriptionFeature> = {
  'dashboard': 'orders_simple',
  'analytics': 'analytics_basic',
  'pos': 'pos_system',
  'products': 'products_basic',
  'orders': 'orders_simple',
  'inventory': 'inventory_management',
  'warehouse': 'multi_warehouse',
  'suppliers': 'supplier_management',
  'clients': 'crm_basic',
  'agents': 'sales_agents',
  'prospects': 'prospect_management',
  'marketing': 'marketing_promotions',
  'campaigns': 'marketing_promotions',
  'wallet': 'wallet_basic',
  'virtual-card': 'wallet_basic',
  'quotes-invoices': 'quotes_invoices',
  'payments': 'payments',
  'payment-links': 'payment_links',
  'expenses': 'expenses',
  'debts': 'debt_management',
  'contracts': 'contracts',
  'affiliate': 'affiliate_program',
  'delivery': 'delivery_tracking',
  'ratings': 'ratings',
  'support': 'support_basic',
  'communication': 'communication_hub',
  'reports': 'data_export',
  'copilote': 'copilot_ai',
  'settings': 'orders_simple', // Toujours accessible
};

/**
 * Mapping des fonctionnalités par plan
 * 
 * GRATUIT: Fonctionnalités actuelles sans modification
 * BASIC: POS, Inventaire, Produits (restriction), Livraison, Avis, Support, Messages, Copilot, Clients, Wallet (restriction)
 * PRO: BASIC + Clients avancé + Marketing (restriction produits)
 * BUSINESS: PRO + Devis, Paiements, Lien paiement, Dépenses, Dettes, Contrats + Produits illimités
 * PREMIUM: Tout sans restriction
 */
const PLAN_FEATURES: Record<string, SubscriptionFeature[]> = {
  // ========== GRATUIT ==========
  // Garder exactement les fonctionnalités actuelles
  'free': [
    'products_basic',
    'orders_simple',
    'wallet_basic',
    'ratings',
    'support_basic',
  ],

  // ========== BASIC ==========
  // POS, Inventaire, Produits (restriction), Livraison, Avis, Support, Messages, Copilot IA, Wallet (restriction)
  // ⚠️ CRM + Agents déplacés au plan Premium
  'basic': [
    'pos_system',
    'inventory_management',
    'products_basic',
    'delivery_tracking',
    'ratings',
    'support_basic',
    'support_tickets',
    'communication_hub',
    'copilot_ai',
    'wallet_basic',
    'orders_simple',
    'orders_detailed',
    'notifications_push',
    'email_support',
    'auto_billing',
    'analytics_basic',
  ],

  // ========== PRO ==========
  // BASIC + Marketing + Analytics avancés
  // ⚠️ CRM + Agents déplacés au plan Premium
  'pro': [
    // Tout de BASIC
    'pos_system',
    'inventory_management',
    'products_basic',
    'delivery_tracking',
    'ratings',
    'support_basic',
    'support_tickets',
    'communication_hub',
    'copilot_ai',
    'wallet_basic',
    'orders_simple',
    'orders_detailed',
    'notifications_push',
    'email_support',
    'auto_billing',
    'analytics_basic',
    // Nouveautés PRO
    'marketing_promotions',
    'analytics_advanced',
    'affiliate_program',
    'stock_alerts',
    'complete_history',
    'priority_support',
    'featured_products',
  ],

  // ========== BUSINESS ==========
  // PRO + Devis, Paiements, Lien de paiement, Dépenses, Dettes, Contrats + Produits illimités
  // ⚠️ CRM + Agents déplacés au plan Premium
  'business': [
    // Tout de PRO
    'pos_system',
    'inventory_management',
    'products_basic',
    'products_unlimited', // ✅ Produits illimités
    'delivery_tracking',
    'ratings',
    'support_basic',
    'support_tickets',
    'communication_hub',
    'copilot_ai',
    'wallet_basic',
    'wallet_unlimited', // ✅ Wallet sans restriction
    'orders_simple',
    'orders_detailed',
    'notifications_push',
    'email_support',
    'auto_billing',
    'analytics_basic',
    'analytics_advanced',
    'marketing_promotions',
    'affiliate_program',
    'stock_alerts',
    'complete_history',
    'priority_support',
    'featured_products',
    // Nouveautés BUSINESS
    'quotes_invoices',
    'payments',
    'payment_links',
    'expenses',
    'expense_management',
    'debt_management',
    'contracts',
    'supplier_management',
    'multi_warehouse',
    'data_export',
    'prospect_management',
    'advanced_integrations',
    'multi_user',
    'gemini_ai', // ✅ IA Gemini ajouté au plan Business
  ],

  // ========== PREMIUM ==========
  // Toutes les fonctionnalités vendeur sans aucune restriction
  'premium': [
    // Toutes les fonctionnalités
    'pos_system',
    'inventory_management',
    'products_basic',
    'products_unlimited',
    'delivery_tracking',
    'ratings',
    'support_basic',
    'support_tickets',
    'communication_hub',
    'copilot_ai',
    'crm_basic',
    'crm_advanced',
    'wallet_basic',
    'wallet_unlimited',
    'orders_simple',
    'orders_detailed',
    'notifications_push',
    'email_support',
    'auto_billing',
    'analytics_basic',
    'analytics_advanced',
    'analytics_realtime',
    'marketing_promotions',
    'affiliate_program',
    'sales_agents',
    'stock_alerts',
    'complete_history',
    'priority_support',
    'featured_products',
    'quotes_invoices',
    'payments',
    'payment_links',
    'expenses',
    'expense_management',
    'debt_management',
    'contracts',
    'supplier_management',
    'multi_warehouse',
    'data_export',
    'prospect_management',
    'advanced_integrations',
    'multi_user',
    'gemini_ai',
    'advanced_security',
    'dedicated_manager',
    'custom_branding',
    'training',
    'offline_mode',
    'cloud_sync',
    'custom_reports',
    'unlimited_modules',
    'custom_commissions',
    'unlimited_integrations',
  ]
};

/**
 * @deprecated Ne plus utiliser de limites hardcodées.
 * Utiliser getProductLimit() qui lit depuis les plans DB.
 */

/**
 * Noms des plans minimum requis pour chaque fonctionnalité
 */
export const FEATURE_MIN_PLAN: Record<SubscriptionFeature, string> = {
  // Gratuit
  'products_basic': 'free',
  'orders_simple': 'free',
  'wallet_basic': 'free',
  'ratings': 'free',
  'support_basic': 'free',

  // Basic
  'pos_system': 'basic',
  'inventory_management': 'basic',
  'delivery_tracking': 'basic',
  'support_tickets': 'basic',
  'communication_hub': 'basic',
  'copilot_ai': 'basic',
  'crm_basic': 'premium',
  'orders_detailed': 'basic',
  'notifications_push': 'basic',
  'email_support': 'basic',
  'auto_billing': 'basic',
  'analytics_basic': 'basic',

  // Pro
  'crm_advanced': 'premium',
  'marketing_promotions': 'pro',
  'analytics_advanced': 'pro',
  'affiliate_program': 'pro',
  'sales_agents': 'premium',
  'stock_alerts': 'pro',
  'complete_history': 'pro',
  'priority_support': 'pro',
  'featured_products': 'pro',

  // Business
  'products_unlimited': 'business',
  'wallet_unlimited': 'business',
  'quotes_invoices': 'business',
  'payments': 'business',
  'payment_links': 'business',
  'expenses': 'business',
  'expense_management': 'business',
  'debt_management': 'business',
  'contracts': 'business',
  'supplier_management': 'business',
  'multi_warehouse': 'business',
  'data_export': 'business',
  'prospect_management': 'business',
  'advanced_integrations': 'business',
  'multi_user': 'business',

  // Premium
  'analytics_realtime': 'premium',
  'gemini_ai': 'business', // ✅ Changé de premium à business
  'advanced_security': 'premium',
  'dedicated_manager': 'premium',
  'custom_branding': 'premium',
  'training': 'premium',
  'offline_mode': 'premium',
  'cloud_sync': 'premium',
  'custom_reports': 'premium',
  'unlimited_modules': 'premium',
  'custom_commissions': 'premium',
  'unlimited_integrations': 'premium',
};

export function useSubscriptionFeatures() {
  const { subscription, plans, loading } = useVendorSubscription();

  const canAccessFeature = (feature: SubscriptionFeature): boolean => {
    // Bloquer l'accès pendant le chargement (sécurité par défaut)
    if (loading) {
      return false;
    }

    // Pas d'abonnement = accès aux fonctionnalités gratuites uniquement
    if (!subscription) {
      const freeFeatures = PLAN_FEATURES['free'] || [];
      return freeFeatures.includes(feature);
    }

    // Vérifier que l'abonnement est actif
    if (subscription.status !== 'active') {
      const freeFeatures = PLAN_FEATURES['free'] || [];
      return freeFeatures.includes(feature);
    }

    const planName = subscription.plan_name?.toLowerCase() || 'free';
    const planFeatures = PLAN_FEATURES[planName] || PLAN_FEATURES['free'];

    return planFeatures.includes(feature);
  };

  const hasAnyFeature = (features: SubscriptionFeature[]): boolean => {
    return features.some(feature => canAccessFeature(feature));
  };

  const hasAllFeatures = (features: SubscriptionFeature[]): boolean => {
    return features.every(feature => canAccessFeature(feature));
  };

  const getAvailableFeatures = (): SubscriptionFeature[] => {
    // Pas d'abonnement ou pas actif = seulement fonctionnalités gratuites
    if (!subscription || subscription.status !== 'active') {
      return PLAN_FEATURES['free'] || [];
    }

    const planName = subscription.plan_name?.toLowerCase() || 'free';
    return PLAN_FEATURES[planName] || PLAN_FEATURES['free'];
  };

  const getPlanName = (): string => {
    return subscription?.plan_display_name || subscription?.plan_name || 'Gratuit';
  };

  const getPlanKey = (): string => {
    return subscription?.plan_name?.toLowerCase() || 'free';
  };

  const isActive = (): boolean => {
    if (!subscription) return false;
    if (subscription.status !== 'active') return false;

    // Vérifier aussi la date d'expiration
    if (subscription.current_period_end) {
      const endDate = new Date(subscription.current_period_end);
      const now = new Date();
      if (endDate <= now) return false;
    }

    return true;
  };

  const getProductLimit = (): number | null => {
    // Lire directement depuis les plans DB — aucune valeur hardcodée
    const planName = subscription?.plan_name?.toLowerCase() || 'free';
    const plan = plans.find((p: Plan) => p.name === planName);
    if (plan) return plan.max_products;
    // Fallback: chercher le plan free en DB
    const freePlan = plans.find((p: Plan) => p.name === 'free');
    return freePlan?.max_products ?? null;
  };

  const isUnlimitedProducts = (): boolean => {
    return getProductLimit() === null;
  };

  const getMinPlanForFeature = (feature: SubscriptionFeature): string => {
    return FEATURE_MIN_PLAN[feature] || 'premium';
  };

  const canAccessModule = (modulePath: string): boolean => {
    const feature = MODULE_FEATURE_MAP[modulePath];
    if (!feature) return true; // Module sans restriction
    return canAccessFeature(feature);
  };

  return {
    subscription,
    loading,
    canAccessFeature,
    hasAnyFeature,
    hasAllFeatures,
    getAvailableFeatures,
    getPlanName,
    getPlanKey,
    isActive,
    getProductLimit,
    isUnlimitedProducts,
    getMinPlanForFeature,
    canAccessModule,
  };
}

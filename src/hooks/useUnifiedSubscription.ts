import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import UnifiedSubscriptionService, { UnifiedSubscription, UnifiedPlan } from '@/services/unifiedSubscriptionService';
import walletService from '@/services/walletService';
import { toast } from 'sonner';

interface UseUnifiedSubscriptionReturn {
  // État
  subscription: UnifiedSubscription | null;
  plans: UnifiedPlan[];
  loading: boolean;
  subscribing: boolean;
  walletBalance: number;

  // Statut
  hasAccess: boolean;
  isExpired: boolean;
  daysRemaining: number;

  // Fonctions
  loadSubscription: () => Promise<void>;
  loadPlans: (role?: 'vendeur' | 'taxi' | 'livreur') => Promise<void>;
  subscribe: (planId: string, paymentMethod: 'wallet' | 'mobile_money' | 'card', billingCycle: 'monthly' | 'yearly') => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;
  enableAutoRenew: () => Promise<boolean>;
  refreshWalletBalance: () => Promise<void>;

  // Utilitaires
  formatPrice: (price: number) => string;
  calculatePrice: (plan: UnifiedPlan, billingCycle: 'monthly' | 'yearly') => number;
}

export function useUnifiedSubscription(autoLoad: boolean = true): UseUnifiedSubscriptionReturn {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<UnifiedSubscription | null>(null);
  const [plans, setPlans] = useState<UnifiedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  /**
   * Charger l'abonnement actif
   */
  const loadSubscription = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await UnifiedSubscriptionService.getActiveSubscription(user.id);
      setSubscription(data);
    } catch (error) {
      console.error('❌ Erreur chargement abonnement:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Charger les plans disponibles
   */
  const loadPlans = useCallback(async (role?: 'vendeur' | 'taxi' | 'livreur') => {
    try {
      const data = await UnifiedSubscriptionService.getPlansByRole(role);
      setPlans(data);
    } catch (error) {
      console.error('❌ Erreur chargement plans:', error);
      setPlans([]);
    }
  }, []);

  /**
   * Charger le solde du wallet
   */
  const refreshWalletBalance = useCallback(async () => {
    if (!user?.id) return;

    try {
      const wallet = await walletService.getUserWallet(user.id);
      setWalletBalance(wallet?.balance || 0);
    } catch (error) {
      console.error('❌ Erreur chargement wallet:', error);
      setWalletBalance(0);
    }
  }, [user?.id]);

  /**
   * Souscrire à un plan
   */
  const subscribe = useCallback(async (
    planId: string,
    paymentMethod: 'wallet' | 'mobile_money' | 'card',
    billingCycle: 'monthly' | 'yearly'
  ): Promise<boolean> => {
    if (!user?.id) {
      toast.error('Vous devez être connecté');
      return false;
    }

    // Trouver le plan
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      toast.error('Plan non trouvé');
      return false;
    }

    // Calculer le prix
    const price = UnifiedSubscriptionService.calculatePrice(plan, billingCycle);

    // Vérifier le solde pour paiement wallet
    if (paymentMethod === 'wallet' && walletBalance < price) {
      toast.error('Solde insuffisant', {
        description: `Solde: ${UnifiedSubscriptionService.formatPrice(walletBalance)}. Prix: ${UnifiedSubscriptionService.formatPrice(price)}`
      });
      return false;
    }

    try {
      setSubscribing(true);

      // Souscrire
      const subscriptionId = await UnifiedSubscriptionService.subscribe({
        userId: user.id,
        planId: planId,
        paymentMethod: paymentMethod,
        billingCycle: billingCycle,
      });

      if (subscriptionId) {
        toast.success('✅ Abonnement activé avec succès !', {
          description: `Plan ${plan.display_name} - ${billingCycle === 'yearly' ? 'Annuel' : 'Mensuel'}`
        });

        // Recharger l'abonnement et le wallet
        await Promise.all([
          loadSubscription(),
          refreshWalletBalance()
        ]);

        return true;
      } else {
        toast.error('Erreur lors de l\'activation de l\'abonnement');
        return false;
      }
    } catch (error: any) {
      console.error('❌ Erreur souscription:', error);
      toast.error('Erreur système', {
        description: error.message || 'Veuillez réessayer'
      });
      return false;
    } finally {
      setSubscribing(false);
    }
  }, [user?.id, plans, walletBalance, loadSubscription, refreshWalletBalance]);

  /**
   * Annuler l'abonnement
   */
  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    if (!subscription?.subscription_id) {
      toast.error('Aucun abonnement actif');
      return false;
    }

    try {
      const success = await UnifiedSubscriptionService.cancelSubscription(subscription.subscription_id);

      if (success) {
        toast.success('Abonnement annulé', {
          description: 'Le renouvellement automatique est désactivé'
        });
        await loadSubscription();
        return true;
      } else {
        toast.error('Erreur lors de l\'annulation');
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      toast.error('Erreur système lors de l\'annulation');
      return false;
    }
  }, [subscription, loadSubscription]);

  /**
   * Réactiver le renouvellement automatique
   */
  const enableAutoRenew = useCallback(async (): Promise<boolean> => {
    if (!subscription?.subscription_id) {
      toast.error('Aucun abonnement actif');
      return false;
    }

    try {
      const success = await UnifiedSubscriptionService.enableAutoRenew(subscription.subscription_id);

      if (success) {
        toast.success('Renouvellement automatique activé');
        await loadSubscription();
        return true;
      } else {
        toast.error('Erreur lors de l\'activation');
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur activation auto-renew:', error);
      toast.error('Erreur système');
      return false;
    }
  }, [subscription, loadSubscription]);

  /**
   * Calculer les jours restants
   */
  const daysRemaining = subscription?.current_period_end
    ? UnifiedSubscriptionService.getDaysRemaining(subscription.current_period_end)
    : 0;

  /**
   * Vérifier si expiré
   */
  const isExpired = subscription?.current_period_end
    ? UnifiedSubscriptionService.isExpired(subscription.current_period_end)
    : true;

  /**
   * Vérifier l'accès
   */
  const hasAccess = Boolean(subscription && !isExpired);

  /**
   * Charger les données au montage
   */
  useEffect(() => {
    if (autoLoad && user?.id) {
      loadSubscription();
      refreshWalletBalance();

      // Charger les plans selon le rôle
      if (profile?.role) {
        const roleMap: Record<string, 'vendeur' | 'taxi' | 'livreur' | undefined> = {
          'vendeur': 'vendeur',
          'taxi_driver': 'taxi',
          'livreur': 'livreur',
        };
        loadPlans(roleMap[profile.role]);
      } else {
        loadPlans();
      }
    }
  }, [user?.id, profile?.role, autoLoad, loadSubscription, loadPlans, refreshWalletBalance]);

  return {
    // État
    subscription,
    plans,
    loading,
    subscribing,
    walletBalance,

    // Statut
    hasAccess,
    isExpired,
    daysRemaining,

    // Fonctions
    loadSubscription,
    loadPlans,
    subscribe,
    cancelSubscription,
    enableAutoRenew,
    refreshWalletBalance,

    // Utilitaires
    formatPrice: UnifiedSubscriptionService.formatPrice,
    calculatePrice: UnifiedSubscriptionService.calculatePrice,
  };
}

// Export par défaut
export default useUnifiedSubscription;

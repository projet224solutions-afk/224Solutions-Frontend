import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabaseClient';
import {
  ServiceSubscriptionService,
  ServicePlan,
} from '@/services/serviceSubscriptionService';

export interface ActiveServiceSubscription {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  plan_display_name: string;
  status: string;
  current_period_end: string | null;
  auto_renew: boolean;
  price_paid: number;
  max_bookings: number | null;
  max_products: number | null;
  max_staff: number | null;
  priority_listing: boolean;
  analytics_access: boolean;
  can_upload_video: boolean;
  features: string[];
}

interface UseServiceSubscriptionProps {
  serviceId?: string;
  serviceTypeId?: string;
}

export function useServiceSubscription({ serviceId, serviceTypeId }: UseServiceSubscriptionProps = {}) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<ActiveServiceSubscription | null>(null);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const plansData = await ServiceSubscriptionService.getPlans(serviceTypeId);
      setPlans(plansData);

      if (!serviceId) {
        setSubscription(null);
        return;
      }

      // Utiliser le RPC SECURITY DEFINER plutôt qu'une requête directe
      // → contourne les problèmes de RLS (user_id mismatch sur les subscriptions seedées)
      const { data, error } = await supabase
        .rpc('get_service_subscription', { p_service_id: serviceId });

      if (error) {
        console.error('❌ Erreur RPC get_service_subscription:', error);
        setSubscription(null);
        return;
      }

      const row = (data as any[])?.[0];

      // Si le RPC retourne le plan gratuit sans subscription_id → pas d'abonnement actif payant
      if (!row || !row.subscription_id) {
        setSubscription(null);
        return;
      }

      const rawFeatures = row.features;
      setSubscription({
        subscription_id: row.subscription_id,
        plan_id: row.plan_id,
        plan_name: row.plan_name || 'free',
        plan_display_name: row.plan_display_name || 'Gratuit',
        status: row.status || 'active',
        current_period_end: row.current_period_end,
        auto_renew: row.auto_renew ?? false,
        price_paid: row.price_paid || 0,
        max_bookings: row.max_bookings ?? null,
        max_products: row.max_products ?? null,
        max_staff: row.max_staff ?? null,
        priority_listing: row.priority_listing ?? false,
        analytics_access: row.analytics_access ?? false,
        can_upload_video: row.can_upload_video === true,
        features: Array.isArray(rawFeatures)
          ? rawFeatures
          : (typeof rawFeatures === 'string' ? JSON.parse(rawFeatures) : []),
      });
    } catch (error) {
      console.error('❌ Erreur chargement abonnement service:', error);
    } finally {
      setLoading(false);
    }
  }, [serviceId, serviceTypeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const subscribe = async (planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') => {
    if (!user || !serviceId) {
      throw new Error('Utilisateur ou service non défini');
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      throw new Error('Plan non trouvé');
    }

    const price = billingCycle === 'yearly'
      ? (plan.yearly_price_gnf || plan.monthly_price_gnf * 12)
      : plan.monthly_price_gnf;

    const subscriptionId = await ServiceSubscriptionService.recordSubscriptionPayment({
      userId: user.id,
      serviceId,
      planId,
      pricePaid: price,
      billingCycle,
    });

    if (!subscriptionId) {
      throw new Error('La souscription a échoué — aucun identifiant retourné');
    }

    await loadData();
    return subscriptionId;
  };

  const cancel = async () => {
    if (!subscription?.subscription_id) {
      throw new Error('Aucun abonnement actif');
    }

    const success = await ServiceSubscriptionService.cancelSubscription(subscription.subscription_id);
    if (success) {
      await loadData();
    }
    return success;
  };

  // subscription null = plan gratuit par défaut (jamais souscrit)
  const isFree = subscription === null;
  const isActive = subscription !== null && subscription.status === 'active';
  const isExpired = subscription !== null &&
    (subscription.status === 'expired' || subscription.status === 'cancelled');
  const isPremium = subscription?.can_upload_video === true
    || subscription?.plan_name === 'premium'
    || subscription?.plan_name === 'pro';

  const daysRemaining = subscription?.current_period_end
    ? Math.max(0, Math.ceil(
        (new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : 0;

  const isExpiringSoon = isActive && daysRemaining <= 7 && daysRemaining > 0;

  const canAccessFeature = (feature: string): boolean => {
    if (!subscription) return false;
    switch (feature) {
      case 'analytics':       return subscription.analytics_access;
      case 'priority_listing': return subscription.priority_listing;
      case 'unlimited_bookings': return subscription.max_bookings === null;
      case 'unlimited_products': return subscription.max_products === null;
      case 'unlimited_staff':    return subscription.max_staff === null;
      default: return subscription.features?.includes(feature) || false;
    }
  };

  return {
    subscription,
    plans,
    loading,
    isFree,
    isActive,
    isExpired,
    isPremium,
    isExpiringSoon,
    daysRemaining,
    subscribe,
    cancel,
    canAccessFeature,
    refresh: loadData,
    formatAmount: ServiceSubscriptionService.formatAmount,
  };
}

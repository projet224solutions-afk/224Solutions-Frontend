import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { SubscriptionService, ActiveSubscription, ProductLimit } from '@/services/subscriptionService';

export function useSubscription() {
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [productLimit, setProductLimit] = useState<ProductLimit | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptionData();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setSubscription(null);
        setProductLimit(null);
        setUserId(null);
        return;
      }

      setUserId(user.id);

      const [subscriptionData, limitData] = await Promise.all([
        SubscriptionService.getActiveSubscription(user.id),
        SubscriptionService.checkProductLimit(user.id),
      ]);

      setSubscription(subscriptionData);
      setProductLimit(limitData);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('subscription_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        () => {
          fetchSubscriptionData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const canAddProduct = (): boolean => {
    return productLimit?.can_add ?? false;
  };

  const hasFeature = (feature: keyof ActiveSubscription): boolean => {
    if (!subscription) return false;
    return subscription[feature] === true;
  };

  const isFreePlan = (): boolean => {
    // Pas d'abonnement = plan gratuit (nouvel inscrit, PAS expiré)
    return subscription?.plan_name === 'free' || !subscription;
  };

  const isPremiumPlan = (): boolean => {
    return subscription?.plan_name === 'premium';
  };

  const getDaysRemaining = (): number | null => {
    if (!subscription?.current_period_end) return null;
    return SubscriptionService.getDaysRemaining(subscription.current_period_end);
  };

  return {
    subscription,
    productLimit,
    loading,
    userId,
    canAddProduct,
    hasFeature,
    isFreePlan,
    isPremiumPlan,
    getDaysRemaining,
    refetch: fetchSubscriptionData,
  };
}

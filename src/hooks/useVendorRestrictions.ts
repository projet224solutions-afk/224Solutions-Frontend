import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export interface VendorRestrictions {
  isRestricted: boolean;
  canCreateProducts: boolean;
  canSendMessages: boolean;
  canMakeCalls: boolean;
  canTransfer: boolean;
  canUseVirtualCard: boolean;
  canReceivePayments: boolean;
  subscriptionStatus: 'active' | 'expired' | 'past_due' | 'cancelled' | null;
  daysUntilExpiry: number | null;
  isInGracePeriod: boolean;
  gracePeriodDaysRemaining: number | null;
}

const GRACE_PERIOD_DAYS = 7;

export function useVendorRestrictions() {
  const { user } = useAuth();
  const [restrictions, setRestrictions] = useState<VendorRestrictions>({
    isRestricted: false, // Par défaut non restreint (plan gratuit)
    canCreateProducts: true,
    canSendMessages: true,
    canMakeCalls: true,
    canTransfer: true,
    canUseVirtualCard: false,
    canReceivePayments: true,
    subscriptionStatus: null,
    daysUntilExpiry: null,
    isInGracePeriod: false,
    gracePeriodDaysRemaining: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadRestrictions();
    const cleanup = setupRealtimeSubscription();

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadRestrictions = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get active subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error('Error loading subscription:', subError);
      }

      // Pas d'abonnement = Plan gratuit (PAS restreint, PAS expiré)
      // L'utilisateur n'a jamais souscrit, il est sur le plan gratuit
      if (!subscription) {
        setRestrictions({
          isRestricted: false,
          canCreateProducts: true,
          canSendMessages: true,
          canMakeCalls: true,
          canTransfer: true,
          canUseVirtualCard: false,
          canReceivePayments: true,
          subscriptionStatus: null,
          daysUntilExpiry: null,
          isInGracePeriod: false,
          gracePeriodDaysRemaining: null,
        });
        return;
      }

      const now = new Date();
      const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : new Date(0);
      const daysDiff = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Vérifier si vraiment actif (status + date de fin dans le futur)
      const isReallyActive = subscription.status === 'active' && periodEnd > now;
      const isExpired = !isReallyActive || subscription.status === 'expired' || subscription.status === 'past_due' || subscription.status === 'cancelled';
      const isInGracePeriod = isExpired && daysDiff > -GRACE_PERIOD_DAYS;
      const gracePeriodDaysRemaining = isInGracePeriod ? GRACE_PERIOD_DAYS + daysDiff : null;

      // Apply restrictions based on subscription status
      const newRestrictions: VendorRestrictions = {
        isRestricted: isExpired,
        canCreateProducts: !isExpired || isInGracePeriod, // Can create during grace period
        canSendMessages: !isExpired, // Blocked immediately
        canMakeCalls: !isExpired, // Blocked immediately
        canTransfer: !isExpired, // Blocked immediately
        canUseVirtualCard: !isExpired, // Blocked immediately
        canReceivePayments: !isExpired, // Blocked immediately
        subscriptionStatus: subscription.status as 'active' | 'expired' | 'past_due' | 'cancelled',
        daysUntilExpiry: daysDiff > 0 ? daysDiff : null,
        isInGracePeriod,
        gracePeriodDaysRemaining,
      };

      setRestrictions(newRestrictions);

    } catch (error) {
      console.error('Error loading restrictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('subscription_restrictions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          loadRestrictions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    restrictions,
    loading,
    refresh: loadRestrictions,
  };
}

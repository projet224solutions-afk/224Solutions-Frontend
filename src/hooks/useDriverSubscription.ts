/**
 * Hook pour gérer l'abonnement du livreur/taxi
 * Vérifie l'accès aux fonctionnalités et la validité de l'abonnement
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface DriverSubscription {
  id: string;
  user_id: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  billing_cycle: string;
  payment_method: string;
  price: number;
  created_at: string;
  updated_at: string;
  days_remaining?: number;
}

interface SubscriptionConfig {
  price: number;
  yearly_price: number;
  yearly_discount_percentage: number;
}

interface UseDriverSubscriptionResult {
  subscription: DriverSubscription | null;
  config: SubscriptionConfig;
  loading: boolean;
  isDriver: boolean;
  hasAccess: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  expiryDate: Date | null;
  priceFormatted: string;
  refreshSubscription: () => Promise<void>;
  subscribe: (paymentMethod: string, billingCycle: string) => Promise<void>;
}

const DEFAULT_CONFIG: SubscriptionConfig = {
  price: 50000, // 50,000 GNF par mois (harmonisé avec service et migration)
  yearly_price: 570000, // 12 mois * 50,000 * 0.95
  yearly_discount_percentage: 5,
};

export function useDriverSubscription(): UseDriverSubscriptionResult {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<DriverSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const isDriver = useMemo(() => {
    return profile?.role === 'livreur' || profile?.role === 'taxi';
  }, [profile?.role]);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Récupérer l'abonnement depuis driver_subscriptions
      const { data: subData, error: subError } = await supabase
        .from('driver_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error('[useDriverSubscription] Error fetching subscription:', subError);
      } else if (subData) {
        // Calculer les jours restants
        const now = new Date();
        const endDate = new Date(subData.end_date);
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        setSubscription({
          ...subData,
          days_remaining: Math.max(0, diffDays),
        } as DriverSubscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('[useDriverSubscription] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Calculer les propriétés dérivées
  const { isExpired, isExpiringSoon, daysRemaining, hasAccess, expiryDate } = useMemo(() => {
    if (!subscription || !subscription.end_date) {
      return {
        isExpired: false,
        isExpiringSoon: false,
        daysRemaining: 0,
        hasAccess: false, // PAS d'accès si pas d'abonnement actif
        expiryDate: null,
      };
    }

    const now = new Date();
    const endDate = new Date(subscription.end_date);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const expired = diffDays < 0 || subscription.status === 'expired';
    const expiringSoon = !expired && diffDays <= 7;
    const access = !expired && subscription.status === 'active';

    return {
      isExpired: expired,
      isExpiringSoon: expiringSoon,
      daysRemaining: Math.max(0, diffDays),
      hasAccess: access, // Accès UNIQUEMENT si abonnement actif
      expiryDate: endDate,
    };
  }, [subscription]);

  const priceFormatted = useMemo(() => {
    if (!subscription) return DEFAULT_CONFIG.price.toLocaleString('fr-FR');
    return (subscription.price || DEFAULT_CONFIG.price).toLocaleString('fr-FR');
  }, [subscription]);

  const subscribe = useCallback(async (paymentMethod: string, billingCycle: string) => {
    if (!user) {
      toast.error('Vous devez être connecté pour souscrire');
      return;
    }

    if (!profile?.role || !['taxi', 'livreur'].includes(profile.role)) {
      toast.error('Seuls les chauffeurs taxi/livreur peuvent souscrire');
      return;
    }

    try {
      // Utiliser la fonction RPC subscribe_driver pour le débit wallet
      const { data, error } = await supabase.rpc('subscribe_driver', {
        p_user_id: user.id,
        p_type: profile.role, // 'taxi' ou 'livreur' selon le rôle
        p_payment_method: paymentMethod,
        p_billing_cycle: billingCycle
      });

      if (error) {
        console.error('[useDriverSubscription] Error subscribing:', error);

        // Message d'erreur détaillé
        if (error.message?.includes('Solde insuffisant')) {
          toast.error('Solde insuffisant', {
            description: 'Rechargez votre wallet pour souscrire'
          });
        } else if (error.message?.includes('Configuration')) {
          toast.error('Configuration manquante', {
            description: 'Contactez le support'
          });
        } else {
          toast.error('Erreur lors de la souscription', {
            description: error.message
          });
        }
        return;
      }

      toast.success('Abonnement activé avec succès !');
      await fetchSubscription();
    } catch (error: any) {
      console.error('[useDriverSubscription] Error:', error);
      toast.error('Erreur lors de la souscription', {
        description: error.message
      });
    }
  }, [user, profile, fetchSubscription]);

  return {
    subscription,
    config: DEFAULT_CONFIG,
    loading,
    isDriver,
    hasAccess: hasAccess || !isDriver, // Non-drivers ont toujours accès
    isExpired,
    isExpiringSoon,
    daysRemaining,
    expiryDate,
    priceFormatted,
    refreshSubscription: fetchSubscription,
    subscribe,
  };
}

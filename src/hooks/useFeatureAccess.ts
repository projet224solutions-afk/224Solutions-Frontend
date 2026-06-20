import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';
import { useVendorSubscription } from './useVendorSubscription';

export interface FeatureRestriction {
  feature_key: string;
  feature_name: string;
  feature_description: string | null;
  free_plan_access: boolean;
  basic_plan_access: boolean;
  pro_plan_access: boolean;
  business_plan_access: boolean;
  premium_plan_access: boolean;
}

export function useFeatureAccess() {
  const { user } = useAuth();
  const { subscription } = useVendorSubscription();
  const [restrictions, setRestrictions] = useState<FeatureRestriction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRestrictions();
  }, []);

  const loadRestrictions = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_restrictions' as any)
        .select('*');

      if (error) throw error;
      setRestrictions((data as any) || []);
    } catch (error) {
      console.error('Erreur chargement restrictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasAccess = (featureKey: string): boolean => {
    if (!user || !subscription) return false;

    const restriction = restrictions.find(r => r.feature_key === featureKey);
    if (!restriction) return true; // Si pas de restriction définie, accès par défaut

    const planName = subscription.plan_name?.toLowerCase();

    switch (planName) {
      case 'free':
        return restriction.free_plan_access;
      case 'basic':
        return restriction.basic_plan_access;
      case 'pro':
        return restriction.pro_plan_access;
      case 'business':
        return restriction.business_plan_access;
      case 'premium':
        return restriction.premium_plan_access;
      default:
        return false;
    }
  };

  const logAccess = async (featureKey: string, granted: boolean) => {
    if (!user) return;

    try {
      await supabase
        .from('user_feature_access_log' as any)
        .insert({
          user_id: user.id,
          feature_key: featureKey,
          access_granted: granted,
          user_plan: subscription?.plan_name || 'none'
        });
    } catch (error) {
      console.error('Erreur log accès:', error);
    }
  };

  const checkAndLogAccess = async (featureKey: string): Promise<boolean> => {
    const granted = hasAccess(featureKey);
    await logAccess(featureKey, granted);
    return granted;
  };

  return {
    hasAccess,
    checkAndLogAccess,
    restrictions,
    loading,
    userPlan: subscription?.plan_name || 'none'
  };
}

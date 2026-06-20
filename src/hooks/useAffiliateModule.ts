import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export interface AffiliateModuleState {
  loading: boolean;
  hasActiveSubscription: boolean;
  hasEligibleActiveSubscription: boolean;
  requiresDedicatedAffiliatePlan: boolean;
  activeSubscriptionPlanName: string | null;
  subscriptionId: string | null;
  affiliateRowId: string | null;
  affiliateCode: string | null;
  affiliateStatus: string | null;
  isAffiliateEnabled: boolean;
}

const ACTIVE_AFFILIATE_STATUSES = new Set(['approved', 'active']);
const AFFILIATE_PLAN_KEYWORDS = ['affiliate', 'affiliation', 'affilie'];
const AFFILIATE_FEATURE_FLAGS = ['affiliate_access', 'affiliate_module', 'module_affiliate', 'travel_affiliate'];

function generateAffiliateCode() {
  const prefix = 'AFF';
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

function extractFeatureStrings(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item) => String(item).toLowerCase());
  if (typeof raw === 'object') return Object.keys(raw as Record<string, unknown>).map((key) => key.toLowerCase());
  return [String(raw).toLowerCase()];
}

function isDedicatedAffiliatePlan(plan: { name?: string | null; display_name?: string | null; features?: unknown }): boolean {
  const text = `${plan.name || ''} ${plan.display_name || ''}`.toLowerCase();
  if (AFFILIATE_PLAN_KEYWORDS.some((keyword) => text.includes(keyword))) return true;
  const featureList = extractFeatureStrings(plan.features);
  return AFFILIATE_FEATURE_FLAGS.some((flag) => featureList.some((value) => value.includes(flag)));
}

export function useAffiliateModule() {
  const { user } = useAuth();
  const [state, setState] = useState<AffiliateModuleState>({
    loading: true,
    hasActiveSubscription: false,
    hasEligibleActiveSubscription: false,
    requiresDedicatedAffiliatePlan: false,
    activeSubscriptionPlanName: null,
    subscriptionId: null,
    affiliateRowId: null,
    affiliateCode: null,
    affiliateStatus: null,
    isAffiliateEnabled: false,
  });

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setState({
        loading: false,
        hasActiveSubscription: false,
        hasEligibleActiveSubscription: false,
        requiresDedicatedAffiliatePlan: false,
        activeSubscriptionPlanName: null,
        subscriptionId: null,
        affiliateRowId: null,
        affiliateCode: null,
        affiliateStatus: null,
        isAffiliateEnabled: false,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    const nowIso = new Date().toISOString();

    const [{ data: subData }, { data: allPlans }, { data: affiliateData }] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('id,status,current_period_end,plans(name,display_name,features)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('current_period_end', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('plans')
        .select('name,display_name,features')
        .eq('is_active', true),
      (supabase as any)
        .from('travel_affiliates')
        .select('id,affiliate_code,status')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const dedicatedPlans = (allPlans || []).filter((plan) => isDedicatedAffiliatePlan(plan as any));
    const requiresDedicatedAffiliatePlan = dedicatedPlans.length > 0;

    const hasActiveSubscription = !!subData?.id;
    const activePlan = (subData as any)?.plans;
    const _activePlanEligible = activePlan ? isDedicatedAffiliatePlan(activePlan) : false;
    // Nouveau comportement: l'activation affiliation est gratuite et indépendante de l'abonnement.
    const hasEligibleActiveSubscription = true;

    const affiliateStatus = affiliateData?.status || null;
    const isAffiliateEnabled = !!affiliateStatus && ACTIVE_AFFILIATE_STATUSES.has(String(affiliateStatus));

    setState({
      loading: false,
      hasActiveSubscription,
      hasEligibleActiveSubscription,
      requiresDedicatedAffiliatePlan,
      activeSubscriptionPlanName: activePlan?.display_name || activePlan?.name || null,
      subscriptionId: subData?.id || null,
      affiliateRowId: affiliateData?.id || null,
      affiliateCode: affiliateData?.affiliate_code || null,
      affiliateStatus,
      isAffiliateEnabled,
    });
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activateWithExistingSubscription = useCallback(async () => {
    if (!user?.id) throw new Error('Utilisateur non connecté');

    const payload = {
      user_id: user.id,
      status: 'approved',
      affiliate_code: state.affiliateCode || generateAffiliateCode(),
      specialization: ['general'],
    };

    const { error } = await (supabase as any)
      .from('travel_affiliates')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) throw new Error(error.message || 'Impossible d\'activer le module affilié');
    await refresh();
  }, [refresh, state.affiliateCode, user?.id]);

  const subscribeAndActivate = useCallback(
    async (planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') => {
      // Compatibilité API: l'activation est désormais gratuite, le plan n'est plus utilisé.
      void planId;
      void billingCycle;
      await activateWithExistingSubscription();
      return 'free_activation';
    },
    [activateWithExistingSubscription]
  );

  return useMemo(
    () => ({
      ...state,
      isDedicatedAffiliatePlan,
      refresh,
      activateWithExistingSubscription,
      subscribeAndActivate,
    }),
    [activateWithExistingSubscription, refresh, state, subscribeAndActivate]
  );
}

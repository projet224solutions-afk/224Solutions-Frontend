import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabaseClient';
import { Plan } from '@/services/subscriptionService';

export interface VendorSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  plan_name: string;
  plan_display_name: string;
  price_paid: number;
  auto_renew: boolean;
}

export function useVendorSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<VendorSubscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSubscriptionData();
    } else {
      setLoading(false);
      setSubscription(null);
      setHasAccess(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadSubscriptionData = async () => {
    if (!user) return;

    // Clés de cache : l'abonnement persiste pour que le vendeur garde l'accès à ses
    // modules HORS LIGNE (la date d'expiration réelle est conservée → pas d'accès infini).
    const SUB_CACHE_KEY = `vendor_subscription_cache_${user.id}`;
    const PLANS_CACHE_KEY = 'vendor_plans_cache';

    // Lit le cache. `hasEntry=false` => aucune donnée jamais mise en cache (clé absente).
    const readCache = (): { subscription: VendorSubscription | null; plans: Plan[]; hasEntry: boolean } => {
      try {
        const rawSub = localStorage.getItem(SUB_CACHE_KEY);
        const rawPlans = localStorage.getItem(PLANS_CACHE_KEY);
        return {
          subscription: rawSub !== null ? (JSON.parse(rawSub) as VendorSubscription | null) : null,
          plans: rawPlans ? (JSON.parse(rawPlans) as Plan[]) : [],
          hasEntry: rawSub !== null,
        };
      } catch {
        return { subscription: null, plans: [], hasEntry: false };
      }
    };

    const applyCache = (label: string) => {
      const cached = readCache();
      setSubscription(cached.subscription);
      setHasAccess(cached.subscription?.status === 'active');
      if (cached.plans.length) setPlans(cached.plans);
      console.log(`📴 Abonnement restauré depuis cache (${label}):`, cached.subscription?.plan_name ?? 'aucun');
    };

    // ⚡ PEINTURE INSTANTANÉE (stale-while-revalidate) : afficher le dernier abonnement
    // connu TOUT DE SUITE → les sections (FeatureGuard) se rendent sans skeleton d'attente.
    const firstPaint = readCache();
    const hadCache = firstPaint.hasEntry || firstPaint.plans.length > 0;
    if (hadCache) {
      setSubscription(firstPaint.subscription);
      setHasAccess(firstPaint.subscription?.status === 'active');
      if (firstPaint.plans.length) setPlans(firstPaint.plans);
      setLoading(false);
    }

    // 📴 HORS LIGNE : on s'en tient au dernier abonnement connu, sans réseau.
    // (Sinon la requête renvoie { data: null } sans exception → abonnement vu comme
    // expiré → tous les modules basic/business POS/inventaire/fournisseurs… bloqués.)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (!hadCache) applyCache('offline');
      setLoading(false);
      return;
    }

    try {
      // Ne PAS re-bloquer le rendu si on a déjà peint depuis le cache (revalidation en fond).
      if (!hadCache) setLoading(true);

      // Requête directe pour récupérer l'abonnement actif avec le plan
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          id,
          user_id,
          plan_id,
          status,
          current_period_end,
          price_paid_gnf,
          auto_renew,
          plans!inner(name, display_name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        // Échec réseau silencieux : NE PAS dégrader le vendeur — conserver le cache.
        console.error('❌ Erreur récupération abonnement:', subError);
        applyCache('after_error');
        setLoading(false);
        return;
      }

      if (subData) {
        const planInfo = subData.plans as any;
        const vendorSub: VendorSubscription = {
          id: subData.id,
          user_id: subData.user_id,
          plan_id: subData.plan_id,
          status: subData.status,
          current_period_end: subData.current_period_end,
          plan_name: planInfo?.name || 'unknown',
          plan_display_name: planInfo?.display_name || 'Inconnu',
          price_paid: subData.price_paid_gnf || 0,
          auto_renew: subData.auto_renew || false,
        };
        setSubscription(vendorSub);
        setHasAccess(vendorSub.status === 'active');
        try { localStorage.setItem(SUB_CACHE_KEY, JSON.stringify(vendorSub)); } catch { }
        console.log('✅ Abonnement chargé:', vendorSub);
      } else {
        // Réponse réseau propre sans abonnement actif → réellement plan gratuit.
        setSubscription(null);
        setHasAccess(false);
        try { localStorage.setItem(SUB_CACHE_KEY, JSON.stringify(null)); } catch { }
        console.log('ℹ️ Aucun abonnement actif trouvé');
      }

      // Charger les plans
      const { data: plansData } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (plansData && plansData.length) {
        setPlans(plansData as Plan[]);
        try { localStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(plansData)); } catch { }
      } else {
        // Pas de plans (réseau) → garder ceux en cache plutôt qu'une liste vide.
        const cached = readCache();
        setPlans(cached.plans);
      }

    } catch (error) {
      console.error('❌ Erreur chargement abonnement:', error);
      applyCache('catch');
    } finally {
      setLoading(false);
    }
  };

  const isExpiringSoon = () => {
    if (!subscription || !subscription.current_period_end) return false;
    const endDate = new Date(subscription.current_period_end);
    const now = new Date();
    const daysRemaining = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining <= 7 && daysRemaining > 0;
  };

  const isExpired = () => {
    // Pas d'abonnement = plan gratuit, PAS expiré (jamais souscrit)
    if (!subscription || !subscription.current_period_end) return false;
    return subscription.status !== 'active' || new Date(subscription.current_period_end) < new Date();
  };

  const getDaysRemaining = () => {
    if (!subscription || !subscription.current_period_end) return 0;
    const endDate = new Date(subscription.current_period_end);
    const now = new Date();
    const days = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const getExpiryDate = () => {
    if (!subscription || !subscription.current_period_end) return null;
    return new Date(subscription.current_period_end);
  };

  const formatPrice = () => {
    if (!subscription) return '0';
    return subscription.price_paid.toLocaleString('fr-FR');
  };

  return {
    subscription,
    plans,
    loading,
    hasAccess,
    isExpiringSoon: isExpiringSoon(),
    isExpired: isExpired(),
    daysRemaining: getDaysRemaining(),
    expiryDate: getExpiryDate(),
    priceFormatted: formatPrice(),
    refresh: loadSubscriptionData,
  };
}

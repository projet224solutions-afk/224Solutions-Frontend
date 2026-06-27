/**
 * Hook pour vérifier et appliquer les limites d'abonnement de service.
 *
 * RÈGLE CLÉ : les limites du PLAN COURANT s'appliquent TOUJOURS.
 * - Abonnement payant actif → limites de son plan.
 * - Pas d'abonnement / expiré → limites du PLAN GRATUIT (plancher), JAMAIS illimité.
 * Le RPC get_service_subscription renvoie déjà le plan gratuit comme repli,
 * donc `subscription` n'est jamais « vide de limites ».
 */
import { useCallback } from 'react';
import { useServiceSubscription } from './useServiceSubscription';

// Plancher de sécurité = plan gratuit (10 bookings / 5 produits / 1 staff).
// Utilisé seulement si le RPC ne renvoie rien du tout (cas dégénéré).
const FREE_FLOOR = { maxBookings: 10, maxProducts: 5, maxStaff: 1 };

interface ServiceLimits {
  maxBookings: number | null;
  maxProducts: number | null;
  maxStaff: number | null;
  hasAnalytics: boolean;
  hasSms: boolean;
  hasEmail: boolean;
  hasBranding: boolean;
  hasApiAccess: boolean;
  hasPriorityListing: boolean;
  hasVideoUpload: boolean;
  planName: string;
  isPaidActive: boolean; // true = plan payant en cours ; false = gratuit/expiré
}

interface LimitCheck {
  allowed: boolean;
  current: number;
  max: number | null;
  message: string;
}

export function useServiceLimits(serviceId?: string, serviceTypeId?: string) {
  const { subscription, isActive, loading } = useServiceSubscription({ serviceId, serviceTypeId });

  // ✅ Les limites viennent TOUJOURS de `subscription` (plan payant OU gratuit-plancher).
  //    Si subscription est absent (cas dégénéré), on applique le plancher gratuit.
  const limits: ServiceLimits = {
    maxBookings:  subscription?.max_bookings ?? FREE_FLOOR.maxBookings,
    maxProducts:  subscription?.max_products ?? FREE_FLOOR.maxProducts,
    maxStaff:     subscription?.max_staff    ?? FREE_FLOOR.maxStaff,
    // ✅ Flags lus depuis le plan réel (plus de hardcode false)
    hasAnalytics:       subscription?.analytics_access ?? false,
    hasSms:             subscription?.sms_notifications ?? false,
    hasEmail:           subscription?.email_notifications ?? true,
    hasBranding:        subscription?.custom_branding ?? false,
    hasApiAccess:       subscription?.api_access ?? false,
    hasPriorityListing: subscription?.priority_listing ?? false,
    hasVideoUpload:     subscription?.can_upload_video ?? false,
    planName:           subscription?.plan_name || 'free',
    isPaidActive:       isActive,
  };

  // Helper générique : la limite du plan COURANT s'applique toujours.
  // max === null signifie « illimité » UNIQUEMENT si le plan le définit ainsi
  // (ex: plan Pro avec max_bookings NULL = réservations illimitées) — ce n'est
  // PAS le cas d'un abonnement absent (le plancher gratuit a des valeurs numériques).
  const makeCheck = (max: number | null, current: number, label: string): LimitCheck => {
    if (max === null) {
      return { allowed: true, current, max: null, message: '' };
    }
    const allowed = current < max;
    return {
      allowed,
      current,
      max,
      message: allowed
        ? ''
        : `Limite atteinte : ${current}/${max} ${label}. Passez à un plan supérieur pour en ajouter plus.`,
    };
  };

  const checkBookingLimit = useCallback(
    (currentCount: number) => makeCheck(limits.maxBookings, currentCount, 'réservations'),
    [limits.maxBookings]
  );

  const checkProductLimit = useCallback(
    (currentCount: number) => makeCheck(limits.maxProducts, currentCount, 'produits'),
    [limits.maxProducts]
  );

  const checkStaffLimit = useCallback(
    (currentCount: number) => makeCheck(limits.maxStaff, currentCount, 'employés'),
    [limits.maxStaff]
  );

  // Vérification d'accès à une fonctionnalité (analytics, sms, branding, api…)
  const checkFeature = useCallback(
    (feature: 'analytics' | 'sms' | 'branding' | 'api' | 'priority' | 'video'): boolean => {
      switch (feature) {
        case 'analytics': return limits.hasAnalytics;
        case 'sms':       return limits.hasSms;
        case 'branding':  return limits.hasBranding;
        case 'api':       return limits.hasApiAccess;
        case 'priority':  return limits.hasPriorityListing;
        case 'video':     return limits.hasVideoUpload;
        default:          return false;
      }
    },
    [limits]
  );

  return {
    limits,
    loading,
    checkBookingLimit,
    checkProductLimit,
    checkStaffLimit,
    checkFeature,
  };
}

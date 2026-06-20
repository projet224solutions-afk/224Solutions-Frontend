/**
 * Hook pour vérifier et appliquer les limites d'abonnement de service
 */
import { useCallback } from 'react';
import { useServiceSubscription } from './useServiceSubscription';

interface ServiceLimits {
  maxBookings: number | null;
  maxProducts: number | null;
  maxStaff: number | null;
  hasAnalytics: boolean;
  hasSms: boolean;
  hasEmail: boolean;
  hasBranding: boolean;
  hasPriorityListing: boolean;
  planName: string;
  isActive: boolean;
}

interface LimitCheck {
  allowed: boolean;
  current: number;
  max: number | null;
  message: string;
}

export function useServiceLimits(serviceId?: string, serviceTypeId?: string) {
  const { subscription, isActive, loading } = useServiceSubscription({ serviceId, serviceTypeId });

  const limits: ServiceLimits = {
    maxBookings: subscription?.max_bookings ?? null,
    maxProducts: subscription?.max_products ?? null,
    maxStaff: subscription?.max_staff ?? null,
    hasAnalytics: subscription?.analytics_access ?? false,
    hasSms: false,
    hasEmail: false,
    hasBranding: false,
    hasPriorityListing: subscription?.priority_listing ?? false,
    planName: subscription?.plan_name || 'free',
    isActive: isActive,
  };

  const checkBookingLimit = useCallback((currentCount: number): LimitCheck => {
    if (!isActive || limits.maxBookings === null) {
      return { allowed: true, current: currentCount, max: null, message: '' };
    }
    const allowed = currentCount < limits.maxBookings;
    return {
      allowed,
      current: currentCount,
      max: limits.maxBookings,
      message: allowed ? '' : `Limite atteinte : ${currentCount}/${limits.maxBookings} réservations. Passez à un plan supérieur.`
    };
  }, [isActive, limits.maxBookings]);

  const checkProductLimit = useCallback((currentCount: number): LimitCheck => {
    if (!isActive || limits.maxProducts === null) {
      return { allowed: true, current: currentCount, max: null, message: '' };
    }
    const allowed = currentCount < limits.maxProducts;
    return {
      allowed,
      current: currentCount,
      max: limits.maxProducts,
      message: allowed ? '' : `Limite atteinte : ${currentCount}/${limits.maxProducts} produits. Passez à un plan supérieur.`
    };
  }, [isActive, limits.maxProducts]);

  const checkStaffLimit = useCallback((currentCount: number): LimitCheck => {
    if (!isActive || limits.maxStaff === null) {
      return { allowed: true, current: currentCount, max: null, message: '' };
    }
    const allowed = currentCount < limits.maxStaff;
    return {
      allowed,
      current: currentCount,
      max: limits.maxStaff,
      message: allowed ? '' : `Limite atteinte : ${currentCount}/${limits.maxStaff} employés. Passez à un plan supérieur.`
    };
  }, [isActive, limits.maxStaff]);

  return {
    limits,
    loading,
    checkBookingLimit,
    checkProductLimit,
    checkStaffLimit,
  };
}

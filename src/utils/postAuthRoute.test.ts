import { describe, expect, it, vi } from 'vitest';

import {
  getValidatedPostAuthRedirect,
  isAllowedPostAuthPath,
  isPublicPostAuthPath,
  resolvePostAuthRouteSync,
} from '@/utils/postAuthRoute';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

vi.mock('@/hooks/useRoleRedirect', () => ({
  getDashboardRoute: (role: string) => `/dashboard/${role.toLowerCase()}`,
}));

describe('postAuthRoute auth guards', () => {
  it('allows public commerce and payment routes after auth', () => {
    expect(isPublicPostAuthPath('/marketplace/product/abc?from=share')).toBe(true);
    expect(isPublicPostAuthPath('/payment/success')).toBe(true);
    expect(isPublicPostAuthPath('/wallet')).toBe(true);
  });

  it('allows protected dashboard routes only for matching roles', () => {
    expect(isAllowedPostAuthPath('/vendeur/orders', 'vendeur')).toBe(true);
    expect(isAllowedPostAuthPath('/vendeur/orders', 'client')).toBe(false);
    expect(isAllowedPostAuthPath('/pdg/security', 'ceo')).toBe(true);
  });

  it('falls back when a stored redirect is not allowed for the role', () => {
    expect(getValidatedPostAuthRedirect('/pdg/security', 'client', '/client')).toBe('/client');
    expect(getValidatedPostAuthRedirect('/my-purchases', 'client', '/client')).toBe('/my-purchases');
  });

  it('resolves common roles synchronously for root redirects', () => {
    expect(resolvePostAuthRouteSync('client')).toBe('/client');
    expect(resolvePostAuthRouteSync('vendeur')).toBe('/vendeur');
    expect(resolvePostAuthRouteSync('prestataire')).toBe('/service-selection');
    expect(resolvePostAuthRouteSync('unknown')).toBe('/dashboard/unknown');
  });
});

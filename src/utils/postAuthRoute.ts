// ============================================================================
// Post-Auth Route Resolution
// Single source of truth for determining where to redirect after authentication
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import { getDashboardRoute } from '@/hooks/useRoleRedirect';

export interface PostAuthRouteOptions {
  userId: string;
  role: string;
  vendorShopType?: string | null;
}

const PUBLIC_ROUTE_PREFIXES = [
  '/home',
  '/marketplace',
  '/tracking',
  '/client-tracking',
  '/profil',
  '/profile',
  '/messages',
  '/services-proximite',
  '/taxi-moto',
  '/taxi',
  '/delivery',
  '/delivery-request',
  '/devis',
  '/payment',
  '/wallet',
  '/cart',
  '/product',
  '/produit',
  '/shop',
  '/boutique',
  '/s',
  '/contact-user',
  '/communication',
  '/bug-bounty',
  '/proximite',
  '/categories',
  '/digital-products',
  '/boutiques',
  '/ref',
  '/service',
  '/restaurant',
  '/restaurants',
  '/pharmacie',
  '/digital-product',
  '/vendor-agent',
  '/payment/success',
  '/orders',
  '/my-purchases',
  '/mes-commandes',
  '/my-digital-purchases',
  '/my-digital-subscriptions',
];

const PROTECTED_ROUTE_RULES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/client/contracts', roles: ['client', 'admin'] },
  { prefix: '/client', roles: ['client', 'admin'] },
  { prefix: '/vendeur-digital', roles: ['vendeur', 'admin'] },
  { prefix: '/vendeur/subscription', roles: ['vendeur', 'admin'] },
  { prefix: '/vendeur', roles: ['vendeur', 'admin'] },
  { prefix: '/livreur/profile', roles: ['livreur', 'admin'] },
  { prefix: '/livreur/settings', roles: ['livreur', 'admin'] },
  { prefix: '/livreur/help', roles: ['livreur', 'admin'] },
  { prefix: '/livreur', roles: ['livreur', 'admin'] },
  { prefix: '/taxi-moto/driver', roles: ['taxi', 'driver', 'admin'] },
  { prefix: '/driver-subscription', roles: ['taxi', 'driver', 'livreur', 'admin'] },
  { prefix: '/transitaire', roles: ['transitaire', 'admin'] },
  { prefix: '/syndicat', roles: ['syndicat', 'admin'] },
  { prefix: '/bureau/change-password', roles: ['syndicat', 'admin'] },
  { prefix: '/bureau', roles: ['syndicat', 'admin'] },
  { prefix: '/restaurant-agent', roles: ['restaurant_agent', 'admin'] },
  { prefix: '/agent/change-password', roles: ['agent', 'admin'] },
  { prefix: '/agent-dashboard', roles: ['agent', 'admin'] },
  { prefix: '/agent', roles: ['agent', 'admin'] },
  // Prestataires de service — AJOUTS (CRITIQUE 3 : manquaient → redirection vers le
  // fallback au lieu du dashboard prestataire renvoyé par resolvePostAuthRoute).
  { prefix: '/dashboard/service', roles: ['prestataire', 'admin'] },
  { prefix: '/service-selection', roles: ['prestataire', 'admin'] },
  { prefix: '/client/dashboard', roles: ['client', 'admin'] },
  { prefix: '/admin/migrate-ids', roles: ['admin'] },
  { prefix: '/admin', roles: ['admin', 'pdg', 'ceo'] },
  { prefix: '/pdg224solutionssoulbah', roles: ['admin', 'pdg', 'ceo'] },
  { prefix: '/pdg', roles: ['admin', 'pdg', 'ceo'] },
];

function normalizeRoleForRouteCheck(role: string): string {
  const normalizedRole = role.toLowerCase();
  return normalizedRole === 'ceo' ? 'pdg' : normalizedRole;
}

function normalizePath(path: string): string {
  if (!path) return '/';

  try {
    const url = new URL(path, window.location.origin);
    return url.pathname;
  } catch {
    return path.split('?')[0]?.split('#')[0] || '/';
  }
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPostAuthPath(path: string): boolean {
  const pathname = normalizePath(path);
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix));
}

export function isAllowedPostAuthPath(path: string, role: string): boolean {
  const pathname = normalizePath(path);
  const normalizedRole = normalizeRoleForRouteCheck(role);

  if (isPublicPostAuthPath(pathname)) {
    return true;
  }

  const matchedRule = PROTECTED_ROUTE_RULES.find((rule) => pathMatchesPrefix(pathname, rule.prefix));
  if (!matchedRule) {
    return false;
  }

  return matchedRule.roles.map(normalizeRoleForRouteCheck).includes(normalizedRole);
}

export function getValidatedPostAuthRedirect(path: string | null, role: string, fallbackRoute: string): string {
  if (!path) {
    return fallbackRoute;
  }

  return isAllowedPostAuthPath(path, role) ? path : fallbackRoute;
}

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string, fallback: T): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = window.setTimeout(() => {
      console.warn('⚠️ [postAuthRoute] Timeout query', { label, timeoutMs });
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

/**
 * Resolves the correct dashboard route for a user based on their role and metadata.
 * This is the SINGLE source of truth — used by Auth.tsx login, signup, OAuth callback,
 * checkExistingSession, and useRoleRedirect.
 */
export async function resolvePostAuthRoute(opts: PostAuthRouteOptions): Promise<string> {
  const { userId, role, vendorShopType } = opts;
  const normalizedRole = role.toLowerCase();
  const startedAt = performance.now();
  console.log('🧭 [postAuthRoute] start', { userId, role: normalizedRole });

  try {
    // vendor_agent → lookup access_token
    if (normalizedRole === 'vendor_agent') {
      const { data: va } = await withTimeout(
        supabase
          .from('vendor_agents')
          .select('access_token')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle(),
        2000,
        'vendor_agents_active',
        { data: null, error: null } as any,
      );

      if (va?.access_token) {
        return `/vendor-agent/${va.access_token}`;
      }
      // Fallback without is_active filter
      const { data: vaAny } = await withTimeout(
        supabase
          .from('vendor_agents')
          .select('access_token')
          .eq('user_id', userId)
          .maybeSingle(),
        2000,
        'vendor_agents_any',
        { data: null, error: null } as any,
      );

      return vaAny?.access_token ? `/vendor-agent/${vaAny.access_token}` : '/home';
    }

    // restaurant_agent → interface agent dédiée (filtrée par permissions). On vérifie qu'il est
    // bien rattaché à un restaurant actif, sinon /home (l'interface gère aussi le cas vide).
    if (normalizedRole === 'restaurant_agent') {
      const { data: ra } = await withTimeout(
        supabase.from('restaurant_agents').select('id').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
        2000, 'restaurant_agents_active', { data: null, error: null } as any,
      );
      return ra ? '/restaurant-agent' : '/home';
    }

    // vendeur → use DB as source of truth; local intent is only a fallback
    if (normalizedRole === 'vendeur') {
      const { data: vendor } = await withTimeout(
        supabase
          .from('vendors')
          .select('business_type')
          .eq('user_id', userId)
          .maybeSingle(),
        2000,
        'vendors_business_type',
        { data: null, error: null } as any,
      );

      // DB wins whenever a vendor row exists.
      if (vendor?.business_type) {
        return vendor.business_type === 'digital' ? '/vendeur-digital' : '/vendeur';
      }

      // Fallback only for fresh signup/oauth intent before vendors row exists.
      if (vendorShopType === 'digital') {
        return '/vendeur-digital';
      }

      return '/vendeur';
    }

    // prestataire → lookup professional_service
    if (normalizedRole === 'prestataire') {
      const { data: ps } = await withTimeout(
        supabase
          .from('professional_services')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle(),
        2000,
        'professional_services_by_user',
        { data: null, error: null } as any,
      );

      return ps?.id ? `/dashboard/service/${ps.id}` : '/service-selection';
    }

    // All other roles use the standard mapping
    return getDashboardRoute(role);
  } catch (error) {
    console.error('❌ [postAuthRoute] Erreur résolution, fallback mapping local', error);
    return getDashboardRoute(role);
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    console.log('🧭 [postAuthRoute] end', { role: normalizedRole, durationMs });
  }
}

/**
 * Cleans up all OAuth-related localStorage flags.
 * Call after any post-auth redirect is complete.
 */
/**
 * Synchronous route resolution for instant redirects (no DB lookups).
 * Uses getDashboardRoute mapping + known special cases.
 */
export function resolvePostAuthRouteSync(role: string): string {
  const r = role.toLowerCase();
  if (r === 'vendeur') return '/vendeur';
  // Note: 'vendeur_digital' n'est PAS un rôle Profile (cas mort retiré). Le sous-type
  // digital vit dans vendors.business_type et est résolu par resolvePostAuthRoute (async).
  if (r === 'client') return '/client';
  if (r === 'livreur') return '/livreur';
  if (r === 'pdg' || r === 'admin') return '/pdg';
  if (r === 'prestataire') return '/service-selection';
  if (r === 'vendor_agent') return '/home';
  if (r === 'restaurant_agent') return '/restaurant-agent';
  return getDashboardRoute(role);
}

export function cleanupOAuthFlags(): void {
  const keysToRemove = [
    'oauth_intent_role',
    'oauth_is_new_signup',
    'oauth_vendor_shop_type',
    'oauth_service_type',
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

/**
 * Cleans up affiliate data from localStorage.
 */
export function cleanupAffiliateFlags(): void {
  const keysToRemove = [
    'affiliate_token',
    'affiliate_agent_name',
    'affiliate_agent_id',
    'affiliate_target_role',
    'affiliate_timestamp',
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

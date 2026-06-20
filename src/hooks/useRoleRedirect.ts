import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Routes publiques où l'utilisateur peut rester sans redirection automatique
 * Ces routes sont accessibles à tous les utilisateurs, connectés ou non
 * ⚠️ IMPORTANT: Les liens partagés (/s/, /boutique/, /shop/, /product/) doivent être ici!
 */
const PUBLIC_ROUTES = [
  '/home',        // Page d'accueil - accessible aux utilisateurs connectés
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
  '/shop',        // Boutique par vendorId - IMPORTANT pour les liens partagés
  '/boutique',    // Boutique par slug - IMPORTANT pour les liens partagés
  '/s',           // Short links - très important!
  '/contact-user',
  '/communication',
  '/bug-bounty',
  '/proximite',
  '/categories',
  '/digital-products',
  '/boutiques',
  '/ref',         // Affiliate links
  '/service',     // Page de détail d'un service professionnel
  '/restaurant',  // Menu restaurant public
  '/digital-product', // Produit numérique
  '/vendor-agent', // Interface agent vendeur
  '/vendeur-digital', // Interface vendeur digital (produits numériques)
];

/**
 * Routes qui déclenchent toujours une redirection vers le dashboard approprié
 * Ce sont les pages d'entrée principales où un utilisateur connecté doit être redirigé
 * ⚡ IMPORTANT: Les utilisateurs connectés avec un rôle (livreur, vendeur, etc.)
 *    seront automatiquement redirigés vers leur dashboard depuis ces routes
 * ⚠️ NOTE: /home est exclu pour permettre l'accès via le bouton Accueil du footer
 */
const REDIRECT_TRIGGER_ROUTES = [
  '/auth',
];

/**
 * Retourne la route du dashboard selon le rôle
 */
export const getDashboardRoute = (role: string | null | undefined): string => {
  if (!role) return '/home';

  // Normaliser le rôle (pdg/ceo/admin -> pdg)
  const normalizedRole = role.toLowerCase();

  const roleRoutes: Record<string, string> = {
    pdg: '/pdg',
    admin: '/pdg',
    ceo: '/pdg',
    vendeur: '/vendeur',
    prestataire: '/home', // Les prestataires sont redirigés vers /dashboard/service/:id dynamiquement
    livreur: '/livreur',
    taxi: '/taxi',
    driver: '/taxi',
    syndicat: '/syndicat',
    bureau: '/bureau',
    transitaire: '/transitaire',
    actionnaire: '/actionnaire/dashboard',
    client: '/client',
    agent: '/agent-dashboard',
    vendor_agent: '/home', // Les vendor_agents sont redirigés via leur access_token
    restaurant_agent: '/restaurant-agent', // Agent de restaurant → son interface dédiée filtrée par permissions
  };

  return roleRoutes[normalizedRole] || '/home';
};

/**
 * Hook pour rediriger automatiquement l'utilisateur vers son dashboard
 * en fonction de son rôle après connexion
 *
 * ⚡ OPTIMISÉ:
 * - Redirection immédiate depuis /, /home, /auth vers le dashboard
 * - Pas de redirection si déjà sur le bon dashboard ou une route publique autorisée
 * - Utilise un ref pour éviter les redirections multiples
 */
export const useRoleRedirect = () => {
  const { profile, user, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname;

    console.log('🔍 [useRoleRedirect] État:', {
      loading,
      profileLoading,
      hasUser: !!user,
      hasProfile: !!profile,
      role: profile?.role,
      currentPath,
    });

    // ⚡ Attendre que l'auth soit chargée
    if (loading) {
      console.log('⏳ [useRoleRedirect] Auth en cours de chargement...');
      return;
    }

    // ⚡ Attendre que le profil soit chargé si l'utilisateur est connecté
    if (user && profileLoading) {
      console.log('⏳ [useRoleRedirect] Profil en cours de chargement...');
      return;
    }

    // Si utilisateur connecté avec profil et rôle
    if (user && profile && profile.role) {
      // ✅ FIX: Pour les vendor_agents, rediriger vers leur interface dédiée
      if (profile.role === 'vendor_agent') {
        // Rediriger depuis /, /auth, /home, /profil, /client vers l'interface agent
        const vendorAgentRedirectRoutes = [...REDIRECT_TRIGGER_ROUTES, '/home', '/profil', '/profile', '/client'];
        const shouldRedirectVendorAgent = vendorAgentRedirectRoutes.some(route =>
          currentPath === route || currentPath === route + '/'
        );

        // Ne pas rediriger si déjà sur l'interface vendor-agent
        if (currentPath.startsWith('/vendor-agent')) {
          return;
        }

        if (shouldRedirectVendorAgent) {
          const redirectVendorAgent = async () => {
            try {
              console.log('🔍 [useRoleRedirect] Recherche access_token pour vendor_agent user_id:', user.id);

              const { data: vendorAgent, error: vaError } = await supabase
                .from('vendor_agents')
                .select('access_token')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();

              console.log('📋 [useRoleRedirect] Résultat vendor_agent:', { vendorAgent, vaError });

              if (vaError) {
                console.error('❌ [useRoleRedirect] Erreur query vendor_agents:', vaError);
              }

              if (vendorAgent?.access_token) {
                console.log('🚀 [useRoleRedirect] Redirection vendor_agent vers /vendor-agent/[token-masque]');
                navigate(`/vendor-agent/${vendorAgent.access_token}`, { replace: true });
              } else {
                console.warn('⚠️ [useRoleRedirect] Aucun access_token trouvé, tentative sans filtre is_active...');
                // Fallback: essayer sans le filtre is_active
                const { data: vendorAgentAny, error: vaError2 } = await supabase
                  .from('vendor_agents')
                  .select('access_token, is_active')
                  .eq('user_id', user.id)
                  .maybeSingle();

                console.log('📋 [useRoleRedirect] Résultat vendor_agent (sans filtre):', { vendorAgentAny, vaError2 });

                if (vendorAgentAny?.access_token) {
                  navigate(`/vendor-agent/${vendorAgentAny.access_token}`, { replace: true });
                } else {
                  console.error('❌ [useRoleRedirect] Aucun vendor_agent trouvé pour cet utilisateur');
                }
              }
            } catch (err) {
              console.error('❌ [useRoleRedirect] Exception redirect vendor_agent:', err);
            }
          };
          redirectVendorAgent();
        }
        return;
      }

      const targetRoute = getDashboardRoute(profile.role);

      // Vérifier si on est sur une route qui déclenche une redirection
      const isOnRedirectTriggerRoute = REDIRECT_TRIGGER_ROUTES.some(route =>
        currentPath === route || currentPath === route + '/'
      );

      // ⚡ TOUJOURS rediriger depuis les pages d'entrée (/, /auth) vers le dashboard
      if (isOnRedirectTriggerRoute) {
        // ✅ FIX: Pour les vendeurs, vérifier le business_type avant de rediriger
        if (profile.role === 'vendeur') {
          const redirectVendor = async () => {
            const { data: vendor } = await supabase
              .from('vendors')
              .select('business_type')
              .eq('user_id', user.id)
              .maybeSingle();

            let finalRoute = targetRoute;
            if (vendor?.business_type === 'digital') {
              finalRoute = '/vendeur-digital';
            }
            console.log(`🚀 [useRoleRedirect] Redirection vendeur depuis ${currentPath} vers ${finalRoute}`);
            navigate(finalRoute, { replace: true });
          };
          redirectVendor();
          return;
        }

        // ✅ NOUVEAU: Pour les prestataires, chercher le professional_service
        if ((profile.role as string) === 'prestataire') {
          const redirectPrestataire = async () => {
            const { data: proService } = await supabase
              .from('professional_services')
              .select('id')
              .eq('user_id', user.id)
              .limit(1)
              .maybeSingle();

            const finalRoute = proService ? `/dashboard/service/${proService.id}` : '/service-selection';
            console.log(`🚀 [useRoleRedirect] Redirection prestataire depuis ${currentPath} vers ${finalRoute}`);
            navigate(finalRoute, { replace: true });
          };
          redirectPrestataire();
          return;
        }

        console.log(`🚀 [useRoleRedirect] Redirection depuis ${currentPath} vers ${targetRoute} (rôle: ${profile.role})`);
        navigate(targetRoute, { replace: true });
        return;
      }

      // ✅ Pour les prestataires sur /service-selection, rediriger vers leur dashboard
      // NOTE: /home est exclu pour permettre aux prestataires de naviguer librement sur l'accueil
      if ((profile.role as string) === 'prestataire' && currentPath === '/service-selection') {
        const redirectPrestaFromHome = async () => {
          const { data: proService } = await supabase
            .from('professional_services')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (proService) {
            const finalRoute = `/dashboard/service/${proService.id}`;
            console.log(`🚀 [useRoleRedirect] Prestataire sur ${currentPath} → redirection vers ${finalRoute}`);
            navigate(finalRoute, { replace: true });
          }
        };
        redirectPrestaFromHome();
        return;
      }

      // Ne pas rediriger si l'utilisateur est déjà sur la bonne route
      if (currentPath.startsWith(targetRoute)) {
        console.log('✅ [useRoleRedirect] Déjà sur la bonne route:', currentPath);
        return;
      }

      // Ne pas rediriger si l'utilisateur est sur une route publique autorisée
      const isOnPublicRoute = PUBLIC_ROUTES.some(route =>
        currentPath === route || currentPath.startsWith(route + '/')
      );

      if (isOnPublicRoute) {
        console.log('📍 [useRoleRedirect] Route publique autorisée:', currentPath);
        return;
      }

      console.log('📍 [useRoleRedirect] Sur une autre route:', currentPath);
    } else if (user && !profile && !profileLoading) {
      // L'utilisateur est connecté mais n'a pas de profil (rare)
      console.log('⚠️ [useRoleRedirect] Utilisateur sans profil détecté');
    }
  }, [user, profile, loading, profileLoading, navigate, location.pathname]);
};

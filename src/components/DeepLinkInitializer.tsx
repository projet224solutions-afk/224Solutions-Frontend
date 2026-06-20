/**
 * 🔗 DEEP LINK INITIALIZER
 * Composant qui initialise le système de deep linking au niveau de l'app
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeepLinking } from '@/hooks/useDeepLinking';

// Chemins publics accessibles sans authentification — restaurés directement
const PUBLIC_PATH_PREFIXES = [
  '/boutique/',
  '/shop/',
  '/product/',
  '/produit/',
  '/pay/',
  '/payment/',
  '/reset-password',
  '/marketplace',
  '/services-proximite/',
  '/service/',
  '/digital-product/',
  '/s/',
  '/profile/',
  '/restaurant/',
  '/home',
  '/auth',
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function DeepLinkInitializer() {
  const { handleDeepLink } = useDeepLinking();
  const navigate = useNavigate();

  useEffect(() => {
    const safelyHandleDeepLink = (url: string, source: string) => {
      void handleDeepLink(url).catch((error) => {
        console.error('🔗 [DeepLinkInitializer] Erreur deep link', { source, url, error });
      });
    };

    // ─── RESTAURATION DU LIEN PARTAGÉ (SPA 404 redirect) ───────────────────
    // Quand le serveur renvoie 404 sur une URL directe (/boutique/x, /product/y…),
    // le fichier 404.html sauvegarde l'URL dans sessionStorage puis redirige vers /.
    // On relit ici cette valeur pour renvoyer l'utilisateur à sa destination réelle.
    const savedRedirect = sessionStorage.getItem('redirect');
    if (savedRedirect) {
      sessionStorage.removeItem('redirect');
      console.log('🔗 [DeepLinkInitializer] Restauration lien partagé:', savedRedirect);

      // Construire le chemin propre (retirer éventuelles lovable preview params)
      let targetPath = savedRedirect;
      try {
        const url = new URL(savedRedirect, window.location.origin);
        Array.from(url.searchParams.keys()).forEach((key) => {
          if (key.startsWith('__lovable')) url.searchParams.delete(key);
        });
        targetPath = url.pathname + url.search + url.hash;
      } catch {
        // savedRedirect est déjà un chemin relatif – on l'utilise tel quel
      }

      if (targetPath && targetPath !== '/' && targetPath !== window.location.pathname) {
        if (isPublicPath(targetPath)) {
          // Route publique → naviguer directement sans condition d'auth
          navigate(targetPath, { replace: true });
        } else {
          // Route protégée → mémoriser pour redirection post-login
          sessionStorage.setItem('post_auth_redirect', targetPath);
          // Pas de navigate ici : ProtectedRoute gérera la redirection vers /auth
        }
      }
      return; // Ne pas traiter l'URL courante comme un deep link supplémentaire
    }
    // ────────────────────────────────────────────────────────────────────────

    // Gérer les deep links web (Universal Links / App Links)
    // Skip short links (/s/) — handled by ShortLinkRedirect component
    const currentUrl = window.location.href;
    const isShortLink = /\/s\/[a-zA-Z0-9]+/.test(window.location.pathname);

    if (!isShortLink) {
      console.log('🔗 [DeepLinkInitializer] Current URL:', currentUrl);
      safelyHandleDeepLink(currentUrl, 'initial-load');
    } else {
      console.log('🔗 [DeepLinkInitializer] Short link detected, skipping (handled by ShortLinkRedirect)');
    }

    // Écouter les événements de navigation pour les deep links
    const handlePopState = () => {
      const nextUrl = window.location.href;
      if (/\/s\/[a-zA-Z0-9]+/.test(window.location.pathname)) {
        console.log('🔗 [DeepLinkInitializer] Short link detected in popstate, skipping');
        return;
      }
      console.log('🔗 [DeepLinkInitializer] Navigation detected:', nextUrl);
      safelyHandleDeepLink(nextUrl, 'popstate');
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleDeepLink, navigate]);

  // Ce composant ne rend rien, il initialise juste le système
  return null;
}

export default DeepLinkInitializer;

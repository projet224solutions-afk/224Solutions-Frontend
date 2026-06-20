/**
 * 🔗 DEEP LINKING HOOK
 * Gère les deep links pour web et mobile (Capacitor).
 * NOTE: La création / résolution de short links est dans src/services/shortLinkService.ts
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface DeepLinkHandler {
  pattern: RegExp;
  handler: (matches: RegExpMatchArray) => string;
}

// Patterns de deep linking supportés
const DEEP_LINK_PATTERNS: DeepLinkHandler[] = [
  // Lien de paiement public: /pay/:token
  {
    pattern: /(?:myapp:\/\/|.*\/)(pay)\/([a-zA-Z0-9_-]+)/,
    handler: (matches) => `/pay/${matches[2]}`,
  },
  // Lien de paiement legacy: /payment/:paymentId
  {
    pattern: /(?:myapp:\/\/|.*\/)(payment)\/([a-zA-Z0-9_-]+)/,
    handler: (matches) => `/payment/${matches[2]}`,
  },
  // Shop: /shop/:vendorId — preserve /shop/ prefix
  {
    pattern: /(?:myapp:\/\/|.*\/)(shop)\/([a-zA-Z0-9-]+)/,
    handler: (matches) => `/shop/${matches[2]}`,
  },
  // Boutique: /boutique/:slug — preserve /boutique/ prefix
  {
    pattern: /(?:myapp:\/\/|.*\/)(boutique)\/([a-zA-Z0-9-]+)/,
    handler: (matches) => `/boutique/${matches[2]}`,
  },
  // Produit: /product/:productId or /produit/:productId — normalize to /product/
  {
    pattern: /(?:myapp:\/\/|.*\/)(?:product|produit)\/([a-zA-Z0-9-]+)/,
    handler: (matches) => `/product/${matches[1]}`,
  },
  // Marketplace avec catégorie
  {
    pattern: /(?:myapp:\/\/|.*\/)marketplace\?category=([a-zA-Z0-9-]+)/,
    handler: (matches) => `/marketplace?category=${matches[1]}`
  },
  // Service de proximité
  {
    pattern: /(?:myapp:\/\/|.*\/)services-proximite\/([a-zA-Z0-9-]+)/,
    handler: (matches) => `/services-proximite/${matches[1]}`
  }
];

export function useDeepLinking() {
  const navigate = useNavigate();

  const parseDeepLink = useCallback((url: string): string | null => {
    for (const { pattern, handler } of DEEP_LINK_PATTERNS) {
      const matches = url.match(pattern);
      if (matches) {
        return handler(matches);
      }
    }
    return null;
  }, []);

  const handleDeepLink = useCallback(async (url: string) => {
    // Skip short links — handled exclusively by ShortLinkRedirect
    if (/\/s\/[a-zA-Z0-9]+/.test(url)) {
      console.log('🔗 [DeepLink] Skipping short link (handled by ShortLinkRedirect):', url);
      return false;
    }

    console.log('🔗 [DeepLink] Handling:', url);

    const route = parseDeepLink(url);
    if (route) {
      const currentPath = window.location.pathname;
      if (currentPath === route) {
        console.log('🔗 [DeepLink] Already on correct route, skipping:', route);
        return true;
      }

      console.log('🔗 [DeepLink] Navigating to:', route);
      navigate(route);
      return true;
    }

    console.warn('🔗 [DeepLink] No matching pattern for:', url);
    return false;
  }, [navigate, parseDeepLink]);

  // Capacitor native deep links
  useEffect(() => {
    const capacitor = (window as any).Capacitor;
    if (!capacitor || !capacitor.isNativePlatform?.()) return;

    const plugins = capacitor.Plugins;
    if (!plugins?.App) return;

    const App = plugins.App;

    const handleAppUrlOpen = (event: { url: string }) => {
      console.log('🔗 [Capacitor] App opened with URL:', event.url);
      handleDeepLink(event.url);
    };

    App.addListener('appUrlOpen', handleAppUrlOpen);

    App.getLaunchUrl().then((result: { url?: string } | null) => {
      if (result?.url) {
        console.log('🔗 [Capacitor] App launched with URL:', result.url);
        handleDeepLink(result.url);
      }
    }).catch(() => {});

    return () => {
      App.removeAllListeners?.();
    };
  }, [handleDeepLink]);

  return { handleDeepLink, parseDeepLink };
}

export default useDeepLinking;

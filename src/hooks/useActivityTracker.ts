/**
 * 📊 HOOK DE TRACKING D'ACTIVITÉ - 224SOLUTIONS
 * Track automatiquement product_view, product_click, add_to_cart, purchase, search, etc.
 * Non-bloquant, fail-safe, fonctionne pour connecté et invité
 */

import { useEffect, useRef } from 'react';
import { trackActivity } from './useSmartRecommendations';

/** Track automatiquement une vue de produit (avec délai anti-bounce de 3s) */
export function useTrackProductView(productId: string | null | undefined, vendorId?: string, categoryId?: string) {
  const tracked = useRef<string | null>(null);

  useEffect(() => {
    if (!productId || productId === tracked.current) return;

    const timer = setTimeout(() => {
      tracked.current = productId;
      trackActivity('product_view', { productId, vendorId, categoryId });
    }, 3000);

    return () => clearTimeout(timer);
  }, [productId, vendorId, categoryId]);
}

/** Track un clic produit (depuis une liste) */
export function trackProductClick(productId: string, vendorId?: string) {
  trackActivity('product_click', { productId, vendorId });
}

/** Track un ajout au panier */
export function trackAddToCart(productId: string, vendorId?: string) {
  trackActivity('add_to_cart', { productId, vendorId });
}

/** Track un achat */
export function trackPurchase(productId: string, vendorId?: string) {
  trackActivity('purchase', { productId, vendorId });
}

/** Track une recherche */
export function trackSearch(query: string, resultsCount?: number) {
  trackActivity('search', { query, metadata: { results_count: resultsCount } });
}

/** Track une vue catégorie */
export function trackCategoryView(categoryId: string) {
  trackActivity('category_view', { categoryId });
}

/** Track une vue vendeur */
export function trackVendorView(vendorId: string) {
  trackActivity('vendor_view', { vendorId });
}

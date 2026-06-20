/**
 * 🎛️ CONFIGURATION CENTRALISÉE DES RECOMMANDATIONS MARKETPLACE
 * Tous les paramètres de cache, filtrage et scoring en un seul endroit
 */

/** Type de vendeur exclu du marketplace en ligne (boutique physique seulement) */
export const EXCLUDED_BUSINESS_TYPE = 'physical';

/** Durées de cache React Query (en millisecondes) */
export const CACHE_TTL = {
  /** Sélection pour vous */
  personalized: {
    staleTime: 5 * 60 * 1000,   // 5 min (réduit de 10 min)
    gcTime: 15 * 60 * 1000,
  },
  /** Tendances du moment */
  trending: {
    staleTime: 5 * 60 * 1000,   // 5 min (réduit de 15 min)
    gcTime: 15 * 60 * 1000,
  },
  /** À découvrir */
  discovery: {
    staleTime: 5 * 60 * 1000,   // 5 min (réduit de 20 min)
    gcTime: 15 * 60 * 1000,
  },
  /** Contextuelles */
  contextual: {
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  },
  /** Post-achat */
  postPurchase: {
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  },
} as const;

/** Critères de scoring pour les tendances (fallback) */
export const TRENDING_WEIGHTS = {
  /** Nombre de commandes récentes (7 derniers jours) */
  recentOrders: 3,
  /** Nombre d'avis */
  reviewsCount: 1,
  /** Note moyenne */
  rating: 2,
} as const;

/** Seuil minimum de produits pour la section Découvrir avant fallback */
export const DISCOVERY_MIN_PRODUCTS = 4;

/** Exclut uniquement les vendeurs explicitement "physical" (boutique physique sans vente en ligne) */
export function filterByAllowedVendors<T extends { vendors?: { business_type?: string | null } | null }>(
  products: T[]
): T[] {
  return products.filter(p => {
    const bt = p.vendors?.business_type;
    return bt !== EXCLUDED_BUSINESS_TYPE;
  });
}

/**
 * Hook Universel des Produits - 224SOLUTIONS
 * Système unifié pour charger et gérer les produits dans toute l'application
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCurrencyForCountry } from '@/data/countryMappings';

export interface UniversalProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  description?: string;
  images: string[];
  vendor_id: string;
  vendor_name: string;
  vendor_user_id: string;
  vendor_public_id?: string;
  vendor_rating: number;
  vendor_rating_count: number;
  vendor_country?: string;
  category_id?: string;
  category_name?: string;
  stock_quantity: number;
  rating: number;
  reviews_count: number;
  is_hot?: boolean;
  is_new?: boolean;
  free_shipping?: boolean;
  created_at: string;
}

interface UseUniversalProductsOptions {
  limit?: number;
  category?: string;
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  vendorId?: string;
  country?: string;
  city?: string;
  /**
   * Quand true, inclut aussi les produits des vendeurs "physical".
   * Par défaut (false), ils sont exclus.
   */
  includePhysicalVendors?: boolean;
  sortBy?: 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  autoLoad?: boolean;
}

const PRODUCT_QUERY_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;

export const useUniversalProducts = (options: UseUniversalProductsOptions = {}) => {
  const {
    limit,
    category,
    searchQuery,
    minPrice,
    maxPrice,
    minRating,
    vendorId,
    country,
    city,
    includePhysicalVendors = false,
    sortBy = 'newest',
    autoLoad = true
  } = options;

  const [products, setProducts] = useState<UniversalProduct[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Permet d'ignorer les réponses "anciennes" quand l'utilisateur change rapidement les filtres/tri
  const requestIdRef = useRef(0);
  const loadingOwnerRequestIdRef = useRef<number | null>(null);
  const lastLoadedAtRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const loadingRef = useRef(false);
  const refreshRef = useRef<(silent?: boolean) => void>(() => {});
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const STALE_REFRESH_MS = 45_000;
  const SAFETY_REFRESH_INTERVAL_MS = 60_000;
  const REALTIME_DEBOUNCE_MS = 1_200;

  const normalizeLocation = (value: string) => value.trim().replace(/\s+/g, ' ');

  const loadProducts = useCallback(async (reset = false, loadOptions: { silent?: boolean } = {}) => {
    const { silent = false } = loadOptions;
    const requestId = ++requestIdRef.current;
    const shouldShowLoading = !silent && (!reset || products.length === 0);
    const filters = {
      category,
      searchQuery,
      minPrice,
      maxPrice,
      minRating,
      vendorId,
      country,
      city,
      includePhysicalVendors,
      sortBy,
    };

    let _lastError: any = null;

    try {
      if (shouldShowLoading) {
        loadingOwnerRequestIdRef.current = requestId;
        setLoading(true);
      }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const currentPage = reset ? 1 : page;
      const pageLimit = limit || 12;
      const from = (currentPage - 1) * pageLimit;
      const to = from + pageLimit - 1;

      // Requête simple sans filtre complexe sur les relations
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          description,
          images,
          vendor_id,
          category_id,
          stock_quantity,
          rating,
          reviews_count,
          is_hot,
          free_shipping,
          created_at,
          is_active,
          seller_currency,
          vendors(
            business_name,
            user_id,
            country,
            city,
            business_type,
            public_id,
            shop_currency
          ),
          categories(
            name
          )
        `, { count: 'exact' })
        .eq('is_active', true);

      // Filtres - utiliser les valeurs du filters object
      if (filters.vendorId) {
        query = query.eq('vendor_id', filters.vendorId);
      }

      if (filters.category && filters.category !== 'all') {
        // Vérifier si c'est un UUID valide ou un nom de catégorie
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.category);
        if (isUUID) {
          query = query.eq('category_id', filters.category);
        } else {
          // Filtrer par nom de catégorie (ilike pour être insensible à la casse)
          query = query.ilike('categories.name', `%${filters.category}%`);
        }
      }

      if (filters.searchQuery && filters.searchQuery.trim()) {
        const q = filters.searchQuery.trim();
        query = query.ilike('name', `%${q}%`);
      }

      if (filters.minPrice && filters.minPrice > 0) {
        query = query.gte('price', filters.minPrice);
      }

      if (filters.maxPrice && filters.maxPrice > 0) {
        query = query.lte('price', filters.maxPrice);
      }

      if (filters.minRating && filters.minRating > 0) {
        query = query.gte('rating', filters.minRating);
      }

      // Filtre par pays (tolérant aux espaces / casse)
      if (filters.country && filters.country !== 'all') {
        const c = normalizeLocation(filters.country);
        query = query.ilike('vendors.country', `%${c}%`);
      }

      // Filtre par ville (tolérant aux espaces / casse)
      if (filters.city && filters.city !== 'all') {
        const c = normalizeLocation(filters.city);
        query = query.ilike('vendors.city', `%${c}%`);
      }

      // Tri - utiliser filters.sortBy
      switch (filters.sortBy) {
        case 'price_asc':
          query = query.order('price', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('price', { ascending: false });
          break;
        case 'rating':
          query = query.order('rating', { ascending: false });
          break;
        case 'popular':
          query = query.order('reviews_count', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Pagination
      query = query.range(from, to);

      let queryTimeout: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        queryTimeout = setTimeout(() => reject(new Error('products_query_timeout')), PRODUCT_QUERY_TIMEOUT_MS);
      });

      let result: {
        data: any[] | null;
        error: any;
        count: number | null;
      };

      try {
        result = await Promise.race([query, timeoutPromise]) as {
          data: any[] | null;
          error: any;
          count: number | null;
        };
      } finally {
        if (queryTimeout) clearTimeout(queryTimeout);
      }

      const { data, error, count } = result;

      if (error) {
        _lastError = error;
        if (attempt < MAX_RETRIES) {
          console.warn(`[Products] Attempt ${attempt} failed, retrying...`, error.message);
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw error;
      }

      // Filtrer côté client: exclure uniquement les vendeurs "physical" (sans vente en ligne)
      let filteredData = data || [];
      if (!filters.includePhysicalVendors) {
        filteredData = filteredData.filter(product => {
          const vendor = product.vendors as any;
          return vendor?.business_type !== 'physical';
        });
      }

      // Transformation directe sans requête supplémentaire
      const formattedProducts: UniversalProduct[] = filteredData.map(product => {
        const vendor = product.vendors as any;
        const category = product.categories as any;
        const isNew = new Date(product.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        // DEVISE = PAYS DU VENDEUR (source fiable). Un vendeur du Sénégal price en XOF, de Guinée en
        // GNF. On déduit de `vendors.country` (texte fiable), PAS de shop_currency (parfois faux,
        // ex. Fusion=EUR) NI du champ produit (toujours GNF par défaut). getCurrencyForCountry gère
        // « Guinée »→GNF, « Sénégal »→XOF (accents/espaces inclus), défaut GNF.
        const derivedCurrency = getCurrencyForCountry(vendor?.country || '');

        return {
          id: product.id,
          name: product.name,
          price: product.price,
          currency: derivedCurrency,
          description: product.description || '',
          images: Array.isArray(product.images) ? product.images : [],
          vendor_id: product.vendor_id,
          vendor_name: vendor?.business_name || 'Vendeur',
          vendor_user_id: vendor?.user_id || '',
          vendor_public_id: vendor?.public_id || undefined,
          vendor_rating: product.rating || 0,
          vendor_rating_count: product.reviews_count || 0,
          vendor_country: vendor?.country || '',
          category_id: product.category_id || '',
          category_name: category?.name || 'Général',
          stock_quantity: product.stock_quantity || 0,
          rating: product.rating || 0,
          reviews_count: product.reviews_count || 0,
          is_hot: product.is_hot || false,
          is_new: isNew,
          free_shipping: product.free_shipping || false,
          created_at: product.created_at
        };
      });

      if (reset) {
        setProducts(formattedProducts);
        setPage(1);
      } else {
        setProducts(prev => [...prev, ...formattedProducts]);
      }

      setTotal(count || 0);
      setHasMore(formattedProducts.length === pageLimit);
      lastLoadedAtRef.current = Date.now();
      hasLoadedOnceRef.current = true;
      return; // Success — exit retry loop
    } catch (error) {
      _lastError = error;
      if (attempt < MAX_RETRIES) {
        const errorMessage = error instanceof Error ? error.message : 'unknown';
        console.warn(`[Products] Attempt ${attempt} failed (${errorMessage}), retrying in ${attempt}s...`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      // Last attempt failed — show error
      if (!silent && requestId === requestIdRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'unknown_error';
        if (errorMessage === 'products_query_timeout') {
          console.error('[TIMEOUT TRIGGERED] Produits accueil - timeout', {
            scope: 'useUniversalProducts',
            timeoutMs: PRODUCT_QUERY_TIMEOUT_MS,
            filters,
          });
          toast.error('Connexion lente. Tirez vers le bas pour réessayer.');
        } else {
          console.error('Erreur chargement produits:', error);
          toast.error('Erreur de chargement. Réessayez.');
        }
      }
    }
    } // end retry loop

    } finally {
      if (shouldShowLoading && requestId === loadingOwnerRequestIdRef.current) {
        loadingOwnerRequestIdRef.current = null;
        setLoading(false);
      }
    }
  }, [
    page,
    limit,
    category,
    searchQuery,
    minPrice,
    maxPrice,
    minRating,
    vendorId,
    country,
    city,
    products.length,
    includePhysicalVendors,
    sortBy,
  ]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore]);

  const refresh = useCallback(() => {
    loadProducts(true, { silent: false });
  }, [loadProducts]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    refreshRef.current = (silent = false) => {
      void loadProducts(true, { silent });
    };
  }, [loadProducts]);

  // Charger automatiquement au montage et quand les options changent
  useEffect(() => {
    if (!autoLoad) return;

    setPage(1);
    loadProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    category,
    searchQuery,
    minPrice,
    maxPrice,
    minRating,
    vendorId,
    country,
    city,
    includePhysicalVendors,
    sortBy,
    autoLoad,
  ]);

  // Charger plus quand la page change (pagination)
  useEffect(() => {
    if (page > 1 && autoLoad) {
      loadProducts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Rechargement temps réel avec debounce
  useEffect(() => {
    if (!autoLoad) return;

    const scheduleRefresh = () => {
      if (!hasLoadedOnceRef.current) return;

      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = setTimeout(() => {
        refreshRef.current(true);
      }, REALTIME_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel('home-products-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [autoLoad]);

  // Fallback robuste si Realtime décroche (mobile/PWA)
  useEffect(() => {
    if (!autoLoad) return;

    const refreshIfStale = () => {
      if (!hasLoadedOnceRef.current || loadingRef.current) return;

      const isVisible = document.visibilityState === 'visible';
      const staleForMs = Date.now() - lastLoadedAtRef.current;

      if (isVisible && staleForMs > STALE_REFRESH_MS) {
        refreshRef.current(true);
      }
    };

    const safetyInterval = setInterval(refreshIfStale, SAFETY_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshIfStale);
    window.addEventListener('online', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);

    return () => {
      clearInterval(safetyInterval);
      window.removeEventListener('focus', refreshIfStale);
      window.removeEventListener('online', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [autoLoad]);

  return {
    products,
    loading,
    total,
    hasMore,
    loadMore,
    refresh,
    page
  };
};

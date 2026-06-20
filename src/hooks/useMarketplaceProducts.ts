/**
 * USE MARKETPLACE PRODUCTS HOOK
 * Hook React pour récupérer les produits marketplace
 * Unifie automatiquement les produits classiques et dropship
 *
 * @module useMarketplaceProducts
 * @version 1.0.0
 * @author 224Solutions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  dropshipMarketplace,
  MarketplaceProduct,
  ProductQueryOptions,
  ProductQueryResult
} from '@/services/dropship';

interface UseMarketplaceProductsOptions extends Omit<ProductQueryOptions, 'page'> {
  initialPage?: number;
  autoFetch?: boolean;
}

interface UseMarketplaceProductsReturn {
  // Data
  products: MarketplaceProduct[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;

  // States
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;

  // Actions
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setPage: (page: number) => Promise<void>;
  search: (query: string) => Promise<void>;
  setFilters: (filters: Partial<ProductQueryOptions>) => void;

  // Single product
  getProduct: (id: string) => Promise<MarketplaceProduct | null>;
}

export function useMarketplaceProducts(
  options: UseMarketplaceProductsOptions = {}
): UseMarketplaceProductsReturn {
  const {
    category,
    subcategory,
    priceMin,
    priceMax,
    vendorId,
    searchQuery: initialSearch,
    sortBy = 'newest',
    limit = 20,
    initialPage = 1,
    autoFetch = true,
    includeDropship = true
  } = options;

  // State
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Filtres actifs
  const [filters, setFiltersState] = useState<Partial<ProductQueryOptions>>({
    category,
    subcategory,
    priceMin,
    priceMax,
    vendorId,
    searchQuery: initialSearch,
    sortBy,
    includeDropship
  });

  // Fetch products
  const fetchProducts = useCallback(async (
    pageNum: number,
    append = false
  ): Promise<void> => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await dropshipMarketplace.getProducts({
        ...filters,
        page: pageNum,
        limit
      });

      if (append) {
        setProducts(prev => [...prev, ...result.products]);
      } else {
        setProducts(result.products);
      }

      setTotal(result.total);
      setPageState(result.page);
      setTotalPages(result.totalPages);
      setHasMore(result.hasMore);

    } catch (err: any) {
      console.error('[useMarketplaceProducts] Error:', err);
      setError(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, limit]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      fetchProducts(initialPage);
    }
  }, [autoFetch, initialPage, fetchProducts]);

  // Refresh
  const refresh = useCallback(async (): Promise<void> => {
    await fetchProducts(1, false);
  }, [fetchProducts]);

  // Load more (pagination infinie)
  const loadMore = useCallback(async (): Promise<void> => {
    if (hasMore && !loadingMore) {
      await fetchProducts(page + 1, true);
    }
  }, [hasMore, loadingMore, page, fetchProducts]);

  // Set page (pagination classique)
  const setPage = useCallback(async (newPage: number): Promise<void> => {
    if (newPage >= 1 && newPage <= totalPages) {
      await fetchProducts(newPage, false);
    }
  }, [totalPages, fetchProducts]);

  // Search
  const search = useCallback(async (query: string): Promise<void> => {
    setFiltersState(prev => ({ ...prev, searchQuery: query }));
    // Le useEffect re-fetch automatiquement
  }, []);

  // Set filters
  const setFilters = useCallback((newFilters: Partial<ProductQueryOptions>): void => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Re-fetch quand les filtres changent
  useEffect(() => {
    if (autoFetch) {
      fetchProducts(1, false);
    }
  }, [filters, autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get single product
  const getProduct = useCallback(async (id: string): Promise<MarketplaceProduct | null> => {
    try {
      return await dropshipMarketplace.getProductById(id);
    } catch (err) {
      console.error('[useMarketplaceProducts] Error getting product:', err);
      return null;
    }
  }, []);

  return {
    products,
    total,
    page,
    totalPages,
    hasMore,
    loading,
    loadingMore,
    error,
    refresh,
    loadMore,
    setPage,
    search,
    setFilters,
    getProduct
  };
}

// ==================== SPECIALIZED HOOKS ====================

/**
 * Hook pour les produits recommandés
 */
export function useRecommendedProducts(
  currentProductId?: string,
  category?: string,
  limit = 8
) {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const recommended = await dropshipMarketplace.getRecommendedProducts(
          currentProductId,
          category,
          limit
        );
        setProducts(recommended);
      } catch (err) {
        console.error('[useRecommendedProducts] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [currentProductId, category, limit]);

  return { products, loading };
}

/**
 * Hook pour la recherche de produits
 */
export function useProductSearch() {
  const [results, setResults] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setQuery(searchQuery);
    setLoading(true);

    try {
      const products = await dropshipMarketplace.searchProducts(searchQuery, 20);
      setResults(products);
    } catch (err) {
      console.error('[useProductSearch] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setQuery('');
  }, []);

  return { results, loading, query, search, clear };
}

/**
 * Hook pour un seul produit
 */
export function useProduct(productId: string | undefined) {
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      if (!productId) {
        setProduct(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await dropshipMarketplace.getProductById(productId);
        setProduct(data);
      } catch (err: any) {
        console.error('[useProduct] Error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [productId]);

  return { product, loading, error };
}

export default useMarketplaceProducts;

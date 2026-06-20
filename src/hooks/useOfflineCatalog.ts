/**
 * Hook useOfflineCatalog - Navigation du catalogue en mode offline
 * 224SOLUTIONS - Mode Offline Avancé
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  searchProducts,
  getVendorProducts,
  getProduct,
  getCategories,
  getProductsByCategory,
  getCacheStats,
  getFeaturedProducts,
  type CachedProduct,
  type CachedCategory
} from '@/lib/offline/catalogCache';
import { useAuth } from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';
import { toast } from 'sonner';

export function useOfflineCatalog() {
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();

  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [categories, setCategories] = useState<CachedCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [cacheStats, setCacheStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalCategories: 0,
    cachedImages: 0,
    cacheSize: 0,
    lastUpdated: null as string | null
  });

  /**
   * Charger les catégories
   */
  const loadCategories = useCallback(async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('[useOfflineCatalog] Erreur chargement catégories:', error);
    }
  }, []);

  /**
   * Charger les produits
   */
  const loadProducts = useCallback(async (options?: {
    categoryId?: string;
    inStockOnly?: boolean;
  }) => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const prods = await getVendorProducts(user.id, {
        categoryId: options?.categoryId,
        inStockOnly: options?.inStockOnly,
        activeOnly: true
      });

      setProducts(prods);
    } catch (error) {
      console.error('[useOfflineCatalog] Erreur chargement produits:', error);
      toast.error('Erreur lors du chargement du catalogue');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Rechercher des produits
   */
  const search = useCallback(async (query: string, options?: {
    categoryId?: string;
    inStockOnly?: boolean;
  }) => {
    if (!user?.id || !query.trim()) {
      await loadProducts(options);
      return;
    }

    try {
      setLoading(true);
      setSearchQuery(query);

      const results = await searchProducts(user.id, query, {
        categoryId: options?.categoryId,
        inStockOnly: options?.inStockOnly
      });

      setProducts(results);
    } catch (error) {
      console.error('[useOfflineCatalog] Erreur recherche:', error);
      toast.error('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadProducts]);

  /**
   * Filtrer par catégorie
   */
  const filterByCategory = useCallback(async (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setSearchQuery('');

    if (categoryId) {
      await loadProducts({ categoryId });
    } else {
      await loadProducts();
    }
  }, [loadProducts]);

  /**
   * Obtenir un produit par ID
   */
  const getProductById = useCallback(async (productId: string) => {
    return await getProduct(productId);
  }, []);

  /**
   * Charger les statistiques du cache
   */
  const loadCacheStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const stats = await getCacheStats(user.id);
      setCacheStats(stats);
    } catch (error) {
      console.error('[useOfflineCatalog] Erreur stats:', error);
    }
  }, [user?.id]);

  /**
   * Obtenir les produits mis en avant
   */
  const loadFeaturedProducts = useCallback(async (limit: number = 10) => {
    if (!user?.id) return [];

    try {
      return await getFeaturedProducts(user.id, limit);
    } catch (error) {
      console.error('[useOfflineCatalog] Erreur featured:', error);
      return [];
    }
  }, [user?.id]);

  /**
   * Produits filtrés (basé sur recherche et catégorie)
   */
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filtrer par catégorie si sélectionnée
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    return filtered;
  }, [products, selectedCategory]);

  /**
   * Vérifier si le cache est disponible
   */
  const isCacheAvailable = cacheStats.totalProducts > 0;

  /**
   * Charger au montage
   */
  useEffect(() => {
    if (user?.id) {
      loadCategories();
      loadProducts();
      loadCacheStats();
    }
  }, [user?.id, loadCategories, loadProducts, loadCacheStats]);

  /**
   * Avertir si offline et pas de cache
   */
  useEffect(() => {
    if (!isOnline && !isCacheAvailable) {
      toast.warning('Mode hors ligne: le catalogue n\'est pas disponible', {
        description: 'Connectez-vous pour télécharger le catalogue'
      });
    }
  }, [isOnline, isCacheAvailable]);

  return {
    products: filteredProducts,
    allProducts: products,
    categories,
    selectedCategory,
    searchQuery,
    loading,
    cacheStats,
    isCacheAvailable,
    isOnline,
    search,
    filterByCategory,
    getProductById,
    loadFeaturedProducts,
    reload: loadProducts,
    setSearchQuery
  };
}

export default useOfflineCatalog;

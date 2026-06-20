/**
 * Hook pour charger les produits numériques
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DigitalProduct {
  id: string;
  merchant_id: string;
  vendor_id: string | null;
  title: string;
  description: string | null;
  short_description: string | null;
  images: string[];
  video_url?: string | null;
  product_type?: string | null;
  category: 'dropshipping' | 'voyage' | 'logiciel' | 'formation' | 'livre' | 'custom' | 'ai';
  product_mode: 'direct' | 'affiliate';
  price: number;
  original_price: number | null;
  commission_rate: number;
  currency: string;
  affiliate_url: string | null;
  affiliate_platform: string | null;
  source_url: string | null;
  source_platform: string | null;
  file_urls: string[];
  file_type: string | null;
  tags: string[];
  status: 'draft' | 'pending' | 'published' | 'rejected' | 'archived';
  is_featured: boolean;
  is_premium: boolean;
  views_count: number;
  sales_count: number;
  rating: number;
  reviews_count: number;
  created_at: string;
  published_at: string | null;
  // Pricing fields
  pricing_type?: string | null;
  subscription_interval?: string | null;
  access_duration?: string | null;
  // Joined fields
  merchant_name?: string;
  vendor_name?: string;
}

interface UseDigitalProductsOptions {
  category?: string;
  productMode?: 'direct' | 'affiliate' | 'all';
  searchQuery?: string;
  merchantId?: string;
  limit?: number;
  includeOwn?: boolean;
}

export function useDigitalProducts(options: UseDigitalProductsOptions = {}) {
  const {
    category,
    productMode = 'all',
    searchQuery,
    merchantId,
    limit = 24,
    includeOwn = false
  } = options;

  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('digital_products')
        .select('*', { count: 'exact' });

      // Filtrer par statut publié (sauf si on veut voir ses propres produits)
      if (!includeOwn) {
        query = query.eq('status', 'published');
      }

      // Filtrer par catégorie
      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      // Filtrer par mode
      if (productMode !== 'all') {
        query = query.eq('product_mode', productMode);
      }

      // Filtrer par marchand
      if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      }

      // Recherche
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Ordre et limite
      query = query
        .order('created_at', { ascending: false })
        .limit(limit);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      const formattedProducts: DigitalProduct[] = (data || []).map((p) => ({
        ...p,
        merchant_name: 'Vendeur',
        vendor_name: null
      } as DigitalProduct));

      setProducts(formattedProducts);
      setTotal(count || 0);
    } catch (err) {
      console.error('Erreur chargement produits numériques:', err);
      setError('Impossible de charger les produits');
    } finally {
      setLoading(false);
    }
  }, [category, productMode, searchQuery, merchantId, limit, includeOwn]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    products,
    loading,
    error,
    total,
    refresh: loadProducts
  };
}

/**
 * Hook pour un seul produit numérique
 */
export function useDigitalProduct(productId: string | undefined) {
  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    const loadProduct = async () => {
      setLoading(true);
      try {
        const { data, error: queryError } = await supabase
          .from('digital_products')
          .select('*')
          .eq('id', productId)
          .maybeSingle();

        if (queryError) throw queryError;
        if (!data) {
          setProduct(null);
          setError('Produit introuvable');
          return;
        }

        setProduct({
          ...data,
          merchant_name: 'Vendeur',
          vendor_name: null
        } as DigitalProduct);
      } catch (err) {
        console.error('Erreur chargement produit:', err);
        setError('Produit introuvable');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId]);

  return { product, loading, error };
}

/**
 * Hook pour les produits d'un marchand
 */
export function useMerchantDigitalProducts() {
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // Récupérer l'ID vendor (vendors.id) si l'utilisateur a une boutique
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let query = supabase
        .from('digital_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (vendor?.id) {
        query = query.or(`merchant_id.eq.${user.id},vendor_id.eq.${vendor.id}`);
      } else {
        query = query.eq('merchant_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setProducts((data || []) as DigitalProduct[]);
    } catch (err) {
      console.error('Erreur chargement produits marchand:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return { products, loading, refresh: loadProducts };
}

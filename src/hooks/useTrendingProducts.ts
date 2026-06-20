import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrencyForCountry } from '@/data/countryMappings';

export interface TrendingProduct {
  product_id: string;
  view_count: number;
  wishlist_count: number;
  review_count: number;
  avg_rating: number;
  trend_score: number;
  product?: {
    id: string;
    name: string;
    price: number;
    images?: string[];
    rating?: number;
    /** Devise du prix = devise du vendeur (shop_currency en priorité). */
    sellerCurrency?: string;
  };
}

/**
 * Hook pour charger les produits tendances (comme Amazon "Best Sellers")
 */
export const useTrendingProducts = (days: number = 7, limit: number = 20) => {
  const [products, setProducts] = useState<TrendingProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTrendingProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_trending_products', {
        p_days: days,
        p_limit: limit
      });

      if (error) throw error;

      // Enrichir avec les données produits
      if (data && data.length > 0) {
        const productIds = data.map((item: any) => item.product_id);

        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, price, images, rating, vendors(country)')
          .in('id', productIds);

        const enriched = data.map((item: any) => {
          const p: any = productsData?.find((pp: any) => pp.id === item.product_id);
          // Devise du prix = devise du PAYS du vendeur (Guinée→GNF, Sénégal→XOF).
          const country = p ? (Array.isArray(p.vendors) ? p.vendors[0]?.country : p.vendors?.country) : '';
          const sellerCurrency = getCurrencyForCountry(country || '');
          return { ...item, product: p ? { ...p, sellerCurrency } : undefined };
        });

        setProducts(enriched);
      }
    } catch (error: any) {
      console.error('Error loading trending products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrendingProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, limit]);

  return {
    products,
    loading,
    reload: loadTrendingProducts
  };
};

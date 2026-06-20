import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HomeProduct {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
  promotional_videos?: string[] | null;
  rating?: number;
  reviews_count?: number;
  category_id?: string;
}

export const useHomeProducts = (limit: number = 4) => {
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, images, promotional_videos, category_id, rating, reviews_count, vendors(business_type)')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(limit * 2);

        if (error) throw error;

        // Exclure uniquement les vendeurs explicitement "physical"
        const filtered = (data || [])
          .filter(product => (product.vendors as any)?.business_type !== 'physical')
          .slice(0, limit);

        setProducts(filtered);
      } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [limit]);

  return { products, loading };
};

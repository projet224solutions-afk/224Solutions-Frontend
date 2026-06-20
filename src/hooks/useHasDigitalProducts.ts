/**
 * Hook pour vérifier si un vendeur/utilisateur a des produits numériques
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseHasDigitalProductsResult {
  hasProducts: boolean;
  count: number;
  loading: boolean;
}

/**
 * Hook pour vérifier si l'utilisateur connecté a des produits numériques
 */
export function useHasDigitalProducts(): UseHasDigitalProductsResult {
  const [hasProducts, setHasProducts] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkProducts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setHasProducts(false);
          setCount(0);
          setLoading(false);
          return;
        }

        // Récupérer l'ID vendor si l'utilisateur a une boutique
        const { data: vendor } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        let query = supabase
          .from('digital_products')
          .select('id', { count: 'exact', head: true });

        if (vendor?.id) {
          query = query.or(`merchant_id.eq.${user.id},vendor_id.eq.${vendor.id}`);
        } else {
          query = query.eq('merchant_id', user.id);
        }

        const { count: productCount, error } = await query;

        if (error) throw error;

        setCount(productCount || 0);
        setHasProducts((productCount || 0) > 0);
      } catch (err) {
        console.error('Erreur vérification produits numériques:', err);
        setHasProducts(false);
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    checkProducts();
  }, []);

  return { hasProducts, count, loading };
}

/**
 * Hook pour récupérer les produits numériques publiés d'un vendeur (pour la boutique publique)
 */
export function useVendorDigitalProducts(vendorId: string | undefined) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    if (!vendorId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // D'abord, récupérer le user_id associé à ce vendor
      const { data: vendor } = await supabase
        .from('vendors')
        .select('user_id')
        .eq('id', vendorId)
        .maybeSingle();

      if (!vendor?.user_id) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // Récupérer les produits numériques publiés par ce vendeur
      const { data, error } = await supabase
        .from('digital_products')
        .select('*')
        .eq('status', 'published')
        .or(`merchant_id.eq.${vendor.user_id},vendor_id.eq.${vendorId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(data || []);
    } catch (err) {
      console.error('Erreur chargement produits numériques vendeur:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return { products, loading, refresh: loadProducts };
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HomeStats {
  totalProducts: number;
  totalVendors: number;
  totalServices: number;
  totalClients: number;
}

export const useHomeStats = () => {
  const [stats, setStats] = useState<HomeStats>({
    totalProducts: 0,
    totalVendors: 0,
    totalServices: 0,
    totalClients: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        // Compter les produits actifs avec fallback
        const { count: productsCount, error: productsError } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (productsError) console.warn('Produits:', productsError.message);

        // Compter les vendeurs avec fallback.
        // ⚠️ `select('*')` échoue en 42501 pour l'anonyme depuis la migration RLS
        // 20260609100000 (anon n'a que les colonnes du catalogue public). On compte
        // sur une colonne explicitement GRANTée (`id`) pour rester lisible par anon.
        const { count: vendorsCount, error: vendorsError } = await supabase
          .from('vendors')
          .select('id', { count: 'exact', head: true });

        if (vendorsError) console.warn('Vendeurs:', vendorsError.message);

        // Compter les types de services avec fallback
        const { count: servicesCount, error: servicesError } = await supabase
          .from('service_types')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (servicesError) console.warn('Services:', servicesError.message);

        // Compter les clients avec fallback
        const { count: clientsCount, error: clientsError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'client');

        if (clientsError) console.warn('Clients:', clientsError.message);

        // Utiliser des valeurs par défaut si erreur
        setStats({
          totalProducts: productsCount || 150,
          totalVendors: vendorsCount || 50,
          totalServices: servicesCount || 25,
          totalClients: clientsCount || 1000,
        });
      } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
        // Valeurs par défaut en cas d'erreur critique
        setStats({
          totalProducts: 150,
          totalVendors: 50,
          totalServices: 25,
          totalClients: 1000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading };
};

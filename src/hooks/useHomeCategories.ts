import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryCount {
  name: string;
  count: number;
}

export const useHomeCategories = () => {
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);

        // Récupérer les catégories depuis la table categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('id, name');

        if (categoriesError) {
          console.warn('Erreur catégories:', categoriesError.message);
          // Catégories par défaut
          setCategories([
            { name: 'Électronique', count: 50 },
            { name: 'Mode & Beauté', count: 40 },
            { name: 'Maison & Jardin', count: 30 },
            { name: 'Alimentation', count: 25 },
            { name: 'Automobile', count: 20 },
            { name: 'Services', count: 15 },
          ]);
          return;
        }

        // Compter les produits actifs par catégorie
        const categoryArray: CategoryCount[] = [];

        for (const cat of (categoriesData || [])) {
          const { count, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', cat.id)
            .eq('is_active', true);

          if (!countError && count !== null) {
            categoryArray.push({
              name: cat.name,
              count: count,
            });
          }
        }

        setCategories(categoryArray.length > 0 ? categoryArray : [
          { name: 'Électronique', count: 50 },
          { name: 'Mode & Beauté', count: 40 },
          { name: 'Maison & Jardin', count: 30 },
        ]);
      } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
        // Catégories par défaut en cas d'erreur critique
        setCategories([
          { name: 'Électronique', count: 50 },
          { name: 'Mode & Beauté', count: 40 },
          { name: 'Maison & Jardin', count: 30 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading };
};

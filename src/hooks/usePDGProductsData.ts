import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Product {
  id: string;
  vendor_id: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  is_active: boolean;
  category_id?: string;
  images?: string[];
  created_at: string;
  updated_at?: string;
  total_stock?: number;
  vendor_name?: string;
  vendor_is_active?: boolean;
}

export interface ProductStats {
  total: number;
  active: number;
  inactive: number;
  lowStock: number;
  totalValue: number;
  totalStock: number;
  orphanProducts: number; // Produits sans boutique active
}

export interface VendorInfo {
  id: string;
  user_id: string;
  business_name: string;
  is_active: boolean;
}

export function usePDGProductsData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<VendorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProductStats>({
    total: 0,
    active: 0,
    inactive: 0,
    lowStock: 0,
    totalValue: 0,
    totalStock: 0,
    orphanProducts: 0
  });

  // Charger les produits avec leur stock et infos vendeur
  const loadProducts = async () => {
    try {
      setLoading(true);

      // Récupérer les produits
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Récupérer tout l'inventaire
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('product_id, quantity');

      // Récupérer tous les vendeurs avec leurs infos
      const { data: vendorsData } = await supabase
        .from('vendors')
        .select('id, user_id, business_name, is_active');

      // Créer un map pour les vendeurs
      const vendorByIdMap = new Map<string, VendorInfo>();
      const vendorByUserIdMap = new Map<string, VendorInfo>();
      (vendorsData || []).forEach((v: any) => {
        const vendor: VendorInfo = {
          id: v.id,
          user_id: v.user_id,
          business_name: v.business_name || 'Boutique inconnue',
          is_active: v.is_active ?? true
        };
        vendorByIdMap.set(v.id, vendor);
        vendorByUserIdMap.set(v.user_id, vendor);
      });

      // Créer un map pour le stock par produit
      const stockMap = new Map<string, number>();
      (inventoryData || []).forEach(inv => {
        const current = stockMap.get(inv.product_id) || 0;
        stockMap.set(inv.product_id, current + (inv.quantity || 0));
      });

      // Ajouter le stock et les infos vendeur à chaque produit
      const productsWithStock = (productsData || []).map(product => {
        const vendor = vendorByIdMap.get(product.vendor_id) || vendorByUserIdMap.get(product.vendor_id);
        return {
          ...product,
          total_stock: stockMap.get(product.id) || 0,
          vendor_name: vendor?.business_name || 'Boutique supprimée',
          vendor_is_active: vendor?.is_active ?? false
        };
      });

      setProducts(productsWithStock);

      // Calculer les statistiques
      const activeProducts = productsWithStock.filter(p => p.is_active);
      const orphanProducts = productsWithStock.filter(p => !p.vendor_is_active);
      const totalValue = productsWithStock.reduce((sum, p) => sum + ((p.price || 0) * (p.total_stock || 0)), 0);
      const totalStock = productsWithStock.reduce((sum, p) => sum + (p.total_stock || 0), 0);

      setStats({
        total: productsWithStock.length,
        active: activeProducts.length,
        inactive: productsWithStock.length - activeProducts.length,
        lowStock: productsWithStock.filter(p => (p.total_stock || 0) <= 10).length,
        totalValue,
        totalStock,
        orphanProducts: orphanProducts.length
      });
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      toast.error('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  };

  // Charger les vendeurs
  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, user_id, business_name, is_active')
        .order('business_name', { ascending: true });

      if (error) throw error;
      setVendors((data || []).map((v: any) => ({
        id: v.id,
        user_id: v.user_id,
        business_name: v.business_name || 'Boutique inconnue',
        is_active: v.is_active ?? true
      })));
    } catch (error) {
      console.error('Erreur chargement vendeurs:', error);
    }
  };

  // Bloquer/Débloquer un produit
  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', productId);

      if (error) throw error;

      toast.success(`Produit ${!currentStatus ? 'activé' : 'désactivé'} avec succès`);
      await loadProducts();
    } catch (error) {
      console.error('Erreur modification statut:', error);
      toast.error('Erreur lors de la modification du statut');
    }
  };

  // Supprimer un produit
  const deleteProduct = async (productId: string) => {
    try {
      // Supprimer le produit directement (les cascades doivent être gérées au niveau de la DB)
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produit supprimé avec succès');
      await loadProducts();
    } catch (error) {
      console.error('Erreur suppression produit:', error);
      toast.error('Erreur lors de la suppression du produit');
    }
  };

  // Mettre à jour un produit
  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produit mis à jour avec succès');
      await loadProducts();
      return true;
    } catch (error) {
      console.error('Erreur mise à jour produit:', error);
      toast.error('Erreur lors de la mise à jour du produit');
      return false;
    }
  };

  // Obtenir les détails d'un produit avec les infos du vendeur
  const getProductWithVendor = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendors (
            id,
            user_id
          )
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur chargement détails produit:', error);
      return null;
    }
  };

  useEffect(() => {
    loadProducts();
    loadVendors();
  }, []);

  return {
    products,
    vendors,
    loading,
    stats,
    loadProducts,
    toggleProductStatus,
    deleteProduct,
    updateProduct,
    getProductWithVendor
  };
}

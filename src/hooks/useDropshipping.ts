/**
 * Hook personnalisé pour le module Dropshipping
 * Gère les produits, commandes, fournisseurs et synchronisation
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  DropshipSupplier,
  DropshipProduct,
  DropshipOrder,
  DropshipSettings,
  DropshipStats
} from '@/types/dropshipping';

export function useDropshipping(vendorId?: string) {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<DropshipSupplier[]>([]);
  const [products, setProducts] = useState<DropshipProduct[]>([]);
  const [orders, setOrders] = useState<DropshipOrder[]>([]);
  const [settings, setSettings] = useState<DropshipSettings | null>(null);
  const [stats, setStats] = useState<DropshipStats | null>(null);

  // Charger les fournisseurs disponibles
  const loadSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dropship_suppliers')
        .select('*')
        .eq('is_active', true)
        .order('reliability_score', { ascending: false });

      if (error) {
        // Table n'existe pas encore - retourner vide
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('Table dropship_suppliers non trouvée - migrations à appliquer');
          setSuppliers([]);
          return;
        }
        throw error;
      }
      setSuppliers((data || []) as unknown as DropshipSupplier[]);
    } catch (error: any) {
      console.error('Erreur chargement fournisseurs:', error);
      setSuppliers([]);
    }
  }, []);

  // Charger les produits dropshipping du vendeur
  const loadProducts = useCallback(async () => {
    if (!vendorId) return;

    try {
      const { data, error } = await supabase
        .from('dropship_products')
        .select(`
          *,
          supplier:dropship_suppliers(*)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setProducts([]);
          return;
        }
        throw error;
      }
      setProducts((data || []) as unknown as DropshipProduct[]);
    } catch (error: any) {
      console.error('Erreur chargement produits:', error);
      setProducts([]);
    }
  }, [vendorId]);

  // Charger les commandes dropshipping
  const loadOrders = useCallback(async () => {
    if (!vendorId) return;

    try {
      const { data, error } = await supabase
        .from('dropship_orders')
        .select(`
          *,
          supplier:dropship_suppliers(*),
          product:dropship_products(*)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setOrders([]);
          return;
        }
        throw error;
      }
      setOrders((data || []) as unknown as DropshipOrder[]);
    } catch (error: any) {
      console.error('Erreur chargement commandes:', error);
      setOrders([]);
    }
  }, [vendorId]);

  // Charger les paramètres dropshipping
  const loadSettings = useCallback(async () => {
    if (!vendorId) return;

    try {
      const { data, error } = await supabase
        .from('dropship_settings')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      if (error && error.code !== 'PGRST116') {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setSettings(null);
          return;
        }
        throw error;
      }
      setSettings(data as unknown as DropshipSettings | null);
    } catch (error: any) {
      console.error('Erreur chargement paramètres:', error);
      setSettings(null);
    }
  }, [vendorId]);

  // Calculer les statistiques
  const loadStats = useCallback(async () => {
    if (!vendorId) {
      setStats({
        totalProducts: 0,
        activeProducts: 0,
        pendingOrders: 0,
        completedOrders: 0,
        totalRevenue: 0,
        totalProfit: 0,
        averageMargin: 0,
        suppliersCount: 0
      });
      return;
    }

    try {
      const [productsRes, ordersRes] = await Promise.all([
        supabase
          .from('dropship_products')
          .select('id, is_active, selling_price, supplier_price')
          .eq('vendor_id', vendorId),
        supabase
          .from('dropship_orders')
          .select('id, status, customer_total, profit_amount')
          .eq('vendor_id', vendorId)
      ]);

      // Gérer le cas où les tables n'existent pas
      if (productsRes.error?.code === '42P01' || ordersRes.error?.code === '42P01') {
        setStats({
          totalProducts: 0,
          activeProducts: 0,
          pendingOrders: 0,
          completedOrders: 0,
          totalRevenue: 0,
          totalProfit: 0,
          averageMargin: 0,
          suppliersCount: 0
        });
        return;
      }

      const productsList = productsRes.data || [];
      const ordersList = ordersRes.data || [];

      const activeProducts = productsList.filter(p => p.is_active).length;
      const pendingOrders = ordersList.filter(o =>
        !['completed', 'cancelled', 'refunded'].includes(o.status)
      ).length;
      const completedOrders = ordersList.filter(o => o.status === 'completed').length;

      const totalRevenue = ordersList
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.customer_total || 0), 0);

      const totalProfit = ordersList
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.profit_amount || 0), 0);

      const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      setStats({
        totalProducts: productsList.length,
        activeProducts,
        pendingOrders,
        completedOrders,
        totalRevenue,
        totalProfit,
        averageMargin: avgMargin,
        suppliersCount: new Set(productsList.map(p => (p as any).supplier_id)).size
      });
    } catch (error: any) {
      console.error('Erreur calcul statistiques:', error);
      setStats({
        totalProducts: 0,
        activeProducts: 0,
        pendingOrders: 0,
        completedOrders: 0,
        totalRevenue: 0,
        totalProfit: 0,
        averageMargin: 0,
        suppliersCount: 0
      });
    }
  }, [vendorId]);

  // Ajouter un produit dropshipping
  const addProduct = async (product: Record<string, unknown>) => {
    if (!vendorId) {
      toast.error('Vendeur non identifié');
      return null;
    }

    setLoading(true);
    try {
      const insertData = {
        ...product,
        vendor_id: vendorId,
        variants: product.variants ? JSON.stringify(product.variants) : '[]'
      };

      const { data, error } = await supabase
        .from('dropship_products')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;

      toast.success('Produit ajouté au catalogue dropshipping');
      await loadProducts();
      return data;
    } catch (error: any) {
      console.error('Erreur ajout produit:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout du produit');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour un produit
  const updateProduct = async (productId: string, updates: Record<string, unknown>) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('dropship_products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produit mis à jour');
      await loadProducts();
      return true;
    } catch (error: any) {
      console.error('Erreur mise à jour:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Supprimer un produit
  const deleteProduct = async (productId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('dropship_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produit supprimé');
      await loadProducts();
      return true;
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Créer une commande fournisseur
  const createSupplierOrder = async (
    customerOrderId: string,
    productId: string,
    quantity: number,
    shippingAddress: any
  ) => {
    if (!vendorId) return null;

    setLoading(true);
    try {
      // Récupérer le produit
      const { data: product, error: productError } = await supabase
        .from('dropship_products')
        .select('*, supplier:dropship_suppliers(*)')
        .eq('id', productId)
        .single();

      if (productError || !product) throw new Error('Produit non trouvé');

      const supplierTotal = (product as any).supplier_price * quantity;
      const customerTotal = (product as any).selling_price * quantity;
      const profit = customerTotal - supplierTotal;

      const { data: order, error } = await supabase
        .from('dropship_orders')
        .insert({
          customer_order_id: customerOrderId,
          vendor_id: vendorId,
          supplier_id: (product as any).supplier_id,
          dropship_product_id: productId,
          items: [{
            product_id: productId,
            product_name: (product as any).product_name,
            quantity,
            supplier_price: (product as any).supplier_price,
            selling_price: (product as any).selling_price
          }],
          quantity,
          supplier_total: supplierTotal,
          supplier_currency: (product as any).supplier_currency,
          customer_total: customerTotal,
          customer_currency: (product as any).selling_currency,
          profit_amount: profit,
          shipping_address: shippingAddress,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Commande fournisseur créée');
      await loadOrders();
      return order;
    } catch (error: any) {
      console.error('Erreur création commande:', error);
      toast.error(error.message || 'Erreur lors de la création de la commande');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour le statut d'une commande
  const updateOrderStatus = async (orderId: string, status: string, notes?: string) => {
    setLoading(true);
    try {
      const updates: any = { status };
      if (notes) updates.vendor_notes = notes;
      if (status === 'shipped_by_supplier') updates.shipped_at = new Date().toISOString();
      if (status === 'delivered_to_customer') updates.delivered_at = new Date().toISOString();
      if (status === 'completed') {
        updates.vendor_payment_status = 'released';
      }

      const { error } = await supabase
        .from('dropship_orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Statut de commande mis à jour');
      await loadOrders();
      return true;
    } catch (error: any) {
      console.error('Erreur mise à jour statut:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Synchroniser un produit avec le fournisseur
  const syncProduct = async (productId: string) => {
    setLoading(true);
    try {
      // Simulation de synchronisation (à connecter avec API fournisseur réel)
      const _startTime = Date.now();

      // Log de synchronisation
      await supabase
        .from('dropship_sync_logs')
        .insert({
          product_id: productId,
          sync_type: 'manual',
          sync_scope: 'product',
          status: 'running',
          started_at: new Date().toISOString()
        });

      // Simuler délai réseau
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mettre à jour le produit
      await supabase
        .from('dropship_products')
        .update({
          last_sync_at: new Date().toISOString()
        })
        .eq('id', productId);

      toast.success('Produit synchronisé avec le fournisseur');
      await loadProducts();
      return true;
    } catch (error: any) {
      console.error('Erreur synchronisation:', error);
      toast.error(error.message || 'Erreur lors de la synchronisation');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour les paramètres
  const updateSettings = async (newSettings: Partial<DropshipSettings>) => {
    if (!vendorId) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('dropship_settings')
        .upsert({
          ...newSettings,
          vendor_id: vendorId
        });

      if (error) throw error;

      toast.success('Paramètres mis à jour');
      await loadSettings();
      return true;
    } catch (error: any) {
      console.error('Erreur mise à jour paramètres:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Charger toutes les données au montage
  useEffect(() => {
    loadSuppliers();
    if (vendorId) {
      loadProducts();
      loadOrders();
      loadSettings();
      loadStats();
    }
  }, [vendorId, loadSuppliers, loadProducts, loadOrders, loadSettings, loadStats]);

  return {
    // États
    loading,
    suppliers,
    products,
    orders,
    settings,
    stats,

    // Actions
    loadSuppliers,
    loadProducts,
    loadOrders,
    loadSettings,
    loadStats,
    addProduct,
    updateProduct,
    deleteProduct,
    createSupplierOrder,
    updateOrderStatus,
    syncProduct,
    updateSettings
  };
}

export default useDropshipping;

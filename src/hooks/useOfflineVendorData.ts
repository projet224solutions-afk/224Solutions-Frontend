/**
 * HOOK USE OFFLINE VENDOR DATA - 224SOLUTIONS
 * Gestion complète des données vendeur en mode offline
 *
 * Fonctionnalités:
 * - Cache des produits avec mise à jour automatique
 * - File d'attente des ventes hors ligne
 * - Synchronisation automatique au retour en ligne
 * - Gestion du stock local
 * - Statistiques de cache
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import localforage from 'localforage';

// Stores LocalForage
const productsStore = localforage.createInstance({
  name: '224Solutions',
  storeName: 'vendor_products_v2'
});

const salesQueueStore = localforage.createInstance({
  name: '224Solutions',
  storeName: 'vendor_sales_queue_v2'
});

const stockStore = localforage.createInstance({
  name: '224Solutions',
  storeName: 'vendor_stock_v2'
});

const clientsStore = localforage.createInstance({
  name: '224Solutions',
  storeName: 'vendor_clients_v2'
});

const syncMetaStore = localforage.createInstance({
  name: '224Solutions',
  storeName: 'vendor_sync_meta_v2'
});

// Types
export interface OfflineProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  price_carton?: number;
  stock_quantity: number;
  min_stock?: number;
  barcode?: string;
  sku?: string;
  category_id?: string;
  category_name?: string;
  images?: string[];
  is_active: boolean;
  sell_by_carton?: boolean;
  units_per_carton?: number;
  vendor_id: string;
  created_at: string;
  updated_at: string;
}

export interface OfflineSale {
  id: string;
  vendor_id: string;
  customer_id?: string;
  customer_name: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    sku?: string;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: 'cash' | 'mobile_money' | 'card' | 'credit';
  payment_status: 'paid' | 'pending' | 'partial';
  notes?: string;
  receipt_number: string;
  created_at: string;
  synced: boolean;
  sync_error?: string;
  sync_attempts: number;
}

export interface OfflineClient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  total_purchases: number;
  last_purchase_at?: string;
  credit_balance: number;
  is_synced: boolean;
}

interface SyncMeta {
  lastProductsSync: string | null;
  lastClientsSync: string | null;
  lastFullSync: string | null;
  pendingSalesCount: number;
  failedSalesCount: number;
}

interface UseOfflineVendorDataReturn {
  // État
  isLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;

  // Produits
  products: OfflineProduct[];
  loadProducts: () => Promise<void>;
  getProduct: (id: string) => Promise<OfflineProduct | null>;
  searchProducts: (query: string) => Promise<OfflineProduct[]>;
  getProductByBarcode: (barcode: string) => Promise<OfflineProduct | null>;

  // Ventes
  pendingSales: OfflineSale[];
  createSale: (sale: Omit<OfflineSale, 'id' | 'receipt_number' | 'created_at' | 'synced' | 'sync_attempts'>) => Promise<OfflineSale>;
  syncSales: () => Promise<{ success: number; failed: number }>;

  // Stock
  updateLocalStock: (productId: string, quantity: number) => Promise<void>;
  getLocalStock: (productId: string) => Promise<number>;

  // Clients
  clients: OfflineClient[];
  loadClients: () => Promise<void>;
  addClient: (client: Omit<OfflineClient, 'id' | 'is_synced'>) => Promise<OfflineClient>;

  // Sync
  syncAll: () => Promise<void>;
  lastSyncAt: Date | null;
  syncStats: {
    pendingSales: number;
    failedSales: number;
    cachedProducts: number;
    cachedClients: number;
  };
}

// Générer un ID unique
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Générer un numéro de reçu
function generateReceiptNumber(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `OFF-${dateStr}-${random}`;
}

export function useOfflineVendorData(): UseOfflineVendorDataReturn {
  const { user } = useAuth();
  const vendorId = user?.id;

  const { isOnline } = useOfflineStatus({
    showToasts: false,
    onOnline: () => {
      // Déclencher la synchronisation automatique
      if (vendorId) {
        syncAllData();
      }
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [products, setProducts] = useState<OfflineProduct[]>([]);
  const [pendingSales, setPendingSales] = useState<OfflineSale[]>([]);
  const [clients, setClients] = useState<OfflineClient[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncStats, setSyncStats] = useState({
    pendingSales: 0,
    failedSales: 0,
    cachedProducts: 0,
    cachedClients: 0
  });

  const syncInProgressRef = useRef(false);

  // ===================== PRODUITS =====================

  const loadProducts = useCallback(async () => {
    if (!vendorId) return;

    try {
      setIsLoading(true);

      if (isOnline) {
        // Charger depuis Supabase
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            categories:category_id (name)
          `)
          .eq('vendor_id', vendorId)
          .eq('is_active', true)
          .order('name');

        if (error) throw error;

        const productsWithCategory = (data || []).map(p => ({
          ...p,
          category_name: p.categories?.name || 'Sans catégorie'
        }));

        // Sauvegarder dans le cache
        await productsStore.setItem(`vendor_${vendorId}`, {
          products: productsWithCategory,
          timestamp: Date.now()
        });

        // Mettre à jour le stock local
        for (const product of productsWithCategory) {
          await stockStore.setItem(product.id, product.stock_quantity || 0);
        }

        setProducts(productsWithCategory);

        // Mettre à jour les métadonnées
        const meta = await syncMetaStore.getItem<SyncMeta>(`vendor_${vendorId}`) || {} as SyncMeta;
        await syncMetaStore.setItem(`vendor_${vendorId}`, {
          ...meta,
          lastProductsSync: new Date().toISOString()
        });

        console.log(`✅ [OfflineVendorData] ${productsWithCategory.length} produits chargés et mis en cache`);
      } else {
        // Charger depuis le cache
        const cached = await productsStore.getItem<{
          products: OfflineProduct[];
          timestamp: number;
        }>(`vendor_${vendorId}`);

        if (cached) {
          // Appliquer les stocks locaux
          const productsWithLocalStock = await Promise.all(
            cached.products.map(async (p) => {
              const localStock = await stockStore.getItem<number>(p.id);
              return {
                ...p,
                stock_quantity: localStock ?? p.stock_quantity
              };
            })
          );

          setProducts(productsWithLocalStock);
          console.log(`📦 [OfflineVendorData] ${productsWithLocalStock.length} produits chargés depuis le cache`);
        } else {
          console.warn('⚠️ [OfflineVendorData] Aucun produit en cache');
          setProducts([]);
        }
      }
    } catch (error) {
      console.error('❌ [OfflineVendorData] Erreur chargement produits:', error);

      // Fallback sur le cache
      const cached = await productsStore.getItem<{
        products: OfflineProduct[];
      }>(`vendor_${vendorId}`);

      if (cached) {
        setProducts(cached.products);
      }
    } finally {
      setIsLoading(false);
    }
  }, [vendorId, isOnline]);

  const getProduct = useCallback(async (id: string): Promise<OfflineProduct | null> => {
    const product = products.find(p => p.id === id);
    return product || null;
  }, [products]);

  const searchProducts = useCallback(async (query: string): Promise<OfflineProduct[]> => {
    const lowerQuery = query.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.sku?.toLowerCase().includes(lowerQuery) ||
      p.barcode?.toLowerCase().includes(lowerQuery)
    );
  }, [products]);

  const getProductByBarcode = useCallback(async (barcode: string): Promise<OfflineProduct | null> => {
    return products.find(p => p.barcode === barcode) || null;
  }, [products]);

  // ===================== VENTES =====================

  const loadPendingSales = useCallback(async () => {
    if (!vendorId) return;

    const keys = await salesQueueStore.keys();
    const sales: OfflineSale[] = [];

    for (const key of keys) {
      if (key.startsWith(`sale_${vendorId}_`)) {
        const sale = await salesQueueStore.getItem<OfflineSale>(key);
        if (sale && !sale.synced) {
          sales.push(sale);
        }
      }
    }

    sales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPendingSales(sales);

    // Mettre à jour les stats
    const failed = sales.filter(s => s.sync_attempts > 0 && s.sync_error).length;
    setSyncStats(prev => ({
      ...prev,
      pendingSales: sales.length,
      failedSales: failed
    }));
  }, [vendorId]);

  const createSale = useCallback(async (
    saleData: Omit<OfflineSale, 'id' | 'receipt_number' | 'created_at' | 'synced' | 'sync_attempts'>
  ): Promise<OfflineSale> => {
    const sale: OfflineSale = {
      ...saleData,
      id: generateId(),
      receipt_number: generateReceiptNumber(),
      created_at: new Date().toISOString(),
      synced: false,
      sync_attempts: 0
    };

    // Sauvegarder dans la file d'attente
    await salesQueueStore.setItem(`sale_${sale.vendor_id}_${sale.id}`, sale);

    // Décrémenter le stock local
    for (const item of sale.items) {
      const currentStock = await stockStore.getItem<number>(item.product_id) || 0;
      await stockStore.setItem(item.product_id, Math.max(0, currentStock - item.quantity));
    }

    // Recharger les ventes en attente
    await loadPendingSales();

    console.log(`📝 [OfflineVendorData] Vente créée: ${sale.receipt_number}`);

    // Si en ligne, essayer de synchroniser immédiatement
    if (isOnline && !syncInProgressRef.current) {
      syncSales();
    }

    return sale;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, loadPendingSales]);

  const syncSales = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (!vendorId || !isOnline || syncInProgressRef.current) {
      return { success: 0, failed: 0 };
    }

    syncInProgressRef.current = true;
    setIsSyncing(true);

    let success = 0;
    let failed = 0;

    try {
      const keys = await salesQueueStore.keys();

      for (const key of keys) {
        if (!key.startsWith(`sale_${vendorId}_`)) continue;

        const sale = await salesQueueStore.getItem<OfflineSale>(key);
        if (!sale || sale.synced) continue;

        try {
          // Créer la commande dans Supabase
          const orderNumber = `OFF-${sale.receipt_number}`;

          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([{
              vendor_id: sale.vendor_id,
              customer_id: sale.customer_id || null,
              order_number: orderNumber,
              total_amount: sale.total,
              subtotal: sale.subtotal,
              tax_amount: sale.tax,
              discount_amount: sale.discount,
              payment_status: sale.payment_status === 'paid' ? 'paid' : 'pending',
              status: 'confirmed',
              payment_method: sale.payment_method as any,
              shipping_address: { address: 'Point de vente' } as any,
              notes: `${sale.notes || ''} [Vente offline: ${sale.receipt_number}]`.trim(),
              source: 'pos'
            }])
            .select('id')
            .single();

          if (orderError) throw orderError;

          // Créer les items de commande
          const orderItems = sale.items.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total
          }));

          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

          if (itemsError) throw itemsError;

          // Marquer comme synchronisé
          sale.synced = true;
          sale.sync_error = undefined;
          await salesQueueStore.setItem(key, sale);

          success++;
          console.log(`✅ [OfflineVendorData] Vente synchronisée: ${sale.receipt_number}`);
        } catch (error) {
          sale.sync_attempts++;
          sale.sync_error = error instanceof Error ? error.message : 'Erreur inconnue';
          await salesQueueStore.setItem(key, sale);

          failed++;
          console.error(`❌ [OfflineVendorData] Échec sync vente ${sale.receipt_number}:`, error);
        }
      }

      if (success > 0) {
        toast.success(`${success} vente(s) synchronisée(s)`);
      }

      if (failed > 0) {
        toast.error(`${failed} vente(s) en échec`, {
          description: 'Nouvelle tentative à la prochaine connexion'
        });
      }

      // Recharger la liste
      await loadPendingSales();
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
    }

    return { success, failed };
  }, [vendorId, isOnline, loadPendingSales]);

  // ===================== STOCK =====================

  const updateLocalStock = useCallback(async (productId: string, quantity: number) => {
    await stockStore.setItem(productId, quantity);

    setProducts(prev =>
      prev.map(p =>
        p.id === productId ? { ...p, stock_quantity: quantity } : p
      )
    );
  }, []);

  const getLocalStock = useCallback(async (productId: string): Promise<number> => {
    return await stockStore.getItem<number>(productId) || 0;
  }, []);

  // ===================== CLIENTS =====================

  const loadClients = useCallback(async () => {
    if (!vendorId) return;

    try {
      if (isOnline) {
        // Charger depuis Supabase (clients du vendeur)
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone, email')
          .limit(500);

        if (error) throw error;

        const clientsList: OfflineClient[] = (data || []).map(c => ({
          id: c.id,
          name: c.full_name || 'Client',
          phone: c.phone,
          email: c.email,
          total_purchases: 0,
          credit_balance: 0,
          is_synced: true
        }));

        await clientsStore.setItem(`vendor_${vendorId}`, clientsList);
        setClients(clientsList);
      } else {
        const cached = await clientsStore.getItem<OfflineClient[]>(`vendor_${vendorId}`);
        setClients(cached || []);
      }
    } catch (error) {
      console.error('❌ [OfflineVendorData] Erreur chargement clients:', error);
      const cached = await clientsStore.getItem<OfflineClient[]>(`vendor_${vendorId}`);
      setClients(cached || []);
    }
  }, [vendorId, isOnline]);

  const addClient = useCallback(async (
    clientData: Omit<OfflineClient, 'id' | 'is_synced'>
  ): Promise<OfflineClient> => {
    const client: OfflineClient = {
      ...clientData,
      id: generateId(),
      is_synced: false
    };

    const current = await clientsStore.getItem<OfflineClient[]>(`vendor_${vendorId}`) || [];
    current.push(client);
    await clientsStore.setItem(`vendor_${vendorId}`, current);

    setClients(current);
    return client;
  }, [vendorId]);

  // ===================== SYNC ALL =====================

  const syncAllData = useCallback(async () => {
    if (!vendorId || !isOnline || syncInProgressRef.current) return;

    console.log('🔄 [OfflineVendorData] Synchronisation complète...');
    setIsSyncing(true);

    try {
      // 1. Synchroniser les ventes en attente
      await syncSales();

      // 2. Recharger les produits depuis le serveur
      await loadProducts();

      // 3. Recharger les clients
      await loadClients();

      // 4. Mettre à jour les métadonnées
      await syncMetaStore.setItem(`vendor_${vendorId}`, {
        lastProductsSync: new Date().toISOString(),
        lastClientsSync: new Date().toISOString(),
        lastFullSync: new Date().toISOString(),
        pendingSalesCount: 0,
        failedSalesCount: 0
      });

      setLastSyncAt(new Date());
      console.log('✅ [OfflineVendorData] Synchronisation complète terminée');
    } catch (error) {
      console.error('❌ [OfflineVendorData] Erreur synchronisation:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [vendorId, isOnline, syncSales, loadProducts, loadClients]);

  // ===================== EFFETS =====================

  // Chargement initial
  useEffect(() => {
    if (vendorId) {
      loadProducts();
      loadPendingSales();
      loadClients();

      // Récupérer la date de dernière sync
      syncMetaStore.getItem<SyncMeta>(`vendor_${vendorId}`).then(meta => {
        if (meta?.lastFullSync) {
          setLastSyncAt(new Date(meta.lastFullSync));
        }
      });
    }
  }, [vendorId, loadProducts, loadPendingSales, loadClients]);

  // Mettre à jour les stats
  useEffect(() => {
    setSyncStats({
      pendingSales: pendingSales.length,
      failedSales: pendingSales.filter(s => s.sync_error).length,
      cachedProducts: products.length,
      cachedClients: clients.length
    });
  }, [pendingSales, products, clients]);

  return {
    isLoading,
    isOnline,
    isSyncing,

    products,
    loadProducts,
    getProduct,
    searchProducts,
    getProductByBarcode,

    pendingSales,
    createSale,
    syncSales,

    updateLocalStock,
    getLocalStock,

    clients,
    loadClients,
    addClient,

    syncAll: syncAllData,
    lastSyncAt,
    syncStats
  };
}

export default useOfflineVendorData;

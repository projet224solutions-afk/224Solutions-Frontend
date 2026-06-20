/**
 * GESTIONNAIRE OFFLINE POS & INVENTAIRE
 * Cache local et synchronisation différée pour le système de caisse
 * 224SOLUTIONS - Mode hors ligne
 */

import localforage from 'localforage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Store pour produits (cache)
const productsCache = localforage.createInstance({
  name: '224Solutions',
  storeName: 'pos_products_cache'
});

// Store pour ventes hors ligne (queue)
const salesQueue = localforage.createInstance({
  name: '224Solutions',
  storeName: 'pos_sales_queue'
});

// Store pour inventaire (cache)
const inventoryCache = localforage.createInstance({
  name: '224Solutions',
  storeName: 'pos_inventory_cache'
});

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity?: number;
  images?: string[];
  category_id?: string;
  barcode?: string;
  sku?: string;
  is_active: boolean;
  sell_by_carton?: boolean;
  units_per_carton?: number;
  price_carton?: number;
}

interface OfflineSale {
  id: string;
  vendorId: string;
  customerId: string;
  customerName?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  timestamp: number;
  synced: boolean;
  notes?: string;
}

/**
 * 1. CACHE DES PRODUITS
 */

// Charger et mettre en cache les produits
export async function cacheProducts(vendorId: string): Promise<Product[]> {
  try {
    console.log('📦 Chargement des produits pour cache...');

    // Essayer de charger depuis Supabase
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('name');

    if (!error && products) {
      // Sauvegarder dans le cache
      await productsCache.setItem(`vendor_${vendorId}`, {
        products,
        timestamp: Date.now(),
        vendorId
      });

      console.log('✅ Produits mis en cache:', products.length);
      return products;
    }
  } catch (onlineError) {
    console.warn('⚠️ Erreur chargement online, utilisation du cache:', onlineError);
  }

  // Fallback: charger depuis le cache
  const cached = await productsCache.getItem<{
    products: Product[];
    timestamp: number;
  }>(`vendor_${vendorId}`);

  if (cached) {
    const cacheAge = Date.now() - cached.timestamp;
    const cacheAgeMinutes = Math.floor(cacheAge / 60000);

    console.log(`📂 Produits chargés depuis le cache (${cacheAgeMinutes} min):`, cached.products.length);
    toast.info('Mode hors ligne', {
      description: `${cached.products.length} produits en cache`
    });
    return cached.products;
  }

  console.warn('❌ Aucun produit en cache');
  return [];
}

// Obtenir les produits depuis le cache uniquement
export async function getCachedProducts(vendorId: string): Promise<Product[]> {
  const cached = await productsCache.getItem<{
    products: Product[];
  }>(`vendor_${vendorId}`);

  return cached?.products || [];
}

// Vider le cache des produits
export async function clearProductsCache(vendorId: string): Promise<void> {
  await productsCache.removeItem(`vendor_${vendorId}`);
  console.log('🗑️ Cache produits vidé');
}

/**
 * 2. QUEUE DES VENTES HORS LIGNE
 */

// Enregistrer une vente hors ligne
export async function queueOfflineSale(sale: Omit<OfflineSale, 'synced' | 'timestamp'>): Promise<void> {
  const offlineSale: OfflineSale = {
    ...sale,
    timestamp: Date.now(),
    synced: false
  };

  await salesQueue.setItem(sale.id, offlineSale);
  console.log('📴 Vente enregistrée hors ligne:', sale.id);

  toast.success('Vente enregistrée', {
    description: 'Sera synchronisée lors de la reconnexion'
  });

  // Mettre à jour le stock local
  await updateLocalStock(sale.items);
}

// Synchroniser les ventes en attente
export async function syncOfflineSales(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const keys = await salesQueue.keys();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log(`🔄 Synchronisation de ${keys.length} ventes...`);

  for (const key of keys) {
    const sale = await salesQueue.getItem<OfflineSale>(key);
    if (!sale || sale.synced) continue;

    try {
      // Générer un numéro de commande unique
      const orderNumber = `OFF-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Mapper la méthode de paiement au type enum
      const paymentMethodEnum = sale.paymentMethod as 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'wallet';

      // Créer la commande dans Supabase
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          vendor_id: sale.vendorId,
          customer_id: sale.customerId,
          order_number: orderNumber,
          total_amount: sale.total,
          subtotal: sale.subtotal,
          tax_amount: sale.tax,
          discount_amount: sale.discount,
          payment_status: 'paid',
          status: 'confirmed',
          payment_method: paymentMethodEnum,
          shipping_address: { address: 'Point de vente' },
          notes: sale.notes || `Vente hors ligne - ${new Date(sale.timestamp).toLocaleString()}`,
          source: 'pos'
        })
        .select('id, order_number')
        .single();

      if (orderError) throw orderError;

      // Créer les items de commande
      const orderItems = sale.items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Stock: géré côté base de données lors de l'insertion des order_items
      // (ne pas décrémenter ici sinon double décrément possible)

      // Marquer comme synchronisé
      sale.synced = true;
      await salesQueue.setItem(key, sale);
      success++;

      console.log(`✅ Vente synchronisée: ${key} (${order.order_number})`);
    } catch (error: any) {
      const errorMsg = `Vente ${key}: ${error.message}`;
      console.error('❌ Erreur sync vente:', errorMsg);
      errors.push(errorMsg);
      failed++;
    }
  }

  console.log(`📊 Sync terminée: ${success} réussies, ${failed} échecs`);
  return { success, failed, errors };
}

// Obtenir le nombre de ventes en attente
export async function getPendingSalesCount(): Promise<number> {
  const keys = await salesQueue.keys();
  let pending = 0;

  for (const key of keys) {
    const sale = await salesQueue.getItem<OfflineSale>(key);
    if (sale && !sale.synced) pending++;
  }

  return pending;
}

// Obtenir les ventes en attente
export async function getPendingSales(): Promise<OfflineSale[]> {
  const keys = await salesQueue.keys();
  const sales: OfflineSale[] = [];

  for (const key of keys) {
    const sale = await salesQueue.getItem<OfflineSale>(key);
    if (sale && !sale.synced) {
      sales.push(sale);
    }
  }

  return sales.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * 3. GESTION DU STOCK LOCAL
 */

// Mettre à jour le stock local
async function updateLocalStock(items: Array<{ productId: string; quantity: number }>) {
  for (const item of items) {
    const cached = await inventoryCache.getItem<{ quantity: number }>(item.productId);
    const currentQuantity = cached?.quantity || 0;
    const newQuantity = Math.max(0, currentQuantity - item.quantity);

    await inventoryCache.setItem(item.productId, {
      quantity: newQuantity,
      lastUpdate: Date.now()
    });

    console.log(`📦 Stock local mis à jour: ${item.productId} -> ${newQuantity}`);
  }
}



// Synchroniser l'inventaire depuis Supabase vers cache local
export async function syncInventory(vendorId: string): Promise<void> {
  try {
    console.log('🔄 Synchronisation inventaire...');

    const { data: products } = await supabase
      .from('products')
      .select('id, stock_quantity')
      .eq('vendor_id', vendorId);

    if (products) {
      for (const product of products) {
        await inventoryCache.setItem(product.id, {
          quantity: product.stock_quantity || 0,
          lastUpdate: Date.now()
        });
      }
      console.log('✅ Inventaire synchronisé:', products.length, 'produits');
    }
  } catch (error) {
    console.error('❌ Erreur sync inventaire:', error);
    throw error;
  }
}

// Obtenir le stock local
export async function getLocalStock(productId: string): Promise<number> {
  const cached = await inventoryCache.getItem<{ quantity: number }>(productId);
  return cached?.quantity || 0;
}

/**
 * 4. DÉTECTION DU STATUT RÉSEAU
 */

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onNetworkChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => {
    console.log('🟢 Connexion rétablie');
    callback(true);
  };

  const handleOffline = () => {
    console.log('🔴 Connexion perdue');
    callback(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Retourner la fonction de nettoyage
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * 5. SYNCHRONISATION AUTOMATIQUE
 */

export async function autoSync(vendorId: string): Promise<{
  success: boolean;
  salesSynced: number;
  errors: string[];
}> {
  if (!isOnline()) {
    console.log('📴 Hors ligne - Sync différée');
    return { success: false, salesSynced: 0, errors: ['Pas de connexion'] };
  }

  console.log('🔄 Synchronisation automatique...');
  const errors: string[] = [];

  try {
    // 1. Synchroniser les ventes en attente
    const salesResult = await syncOfflineSales();

    if (salesResult.success > 0) {
      toast.success(`${salesResult.success} vente(s) synchronisée(s)`);
    }

    if (salesResult.failed > 0) {
      toast.error(`${salesResult.failed} vente(s) en échec`);
      errors.push(...salesResult.errors);
    }

    // 2. Rafraîchir le cache des produits
    await cacheProducts(vendorId);

    // 3. Synchroniser l'inventaire
    await syncInventory(vendorId);

    console.log('✅ Synchronisation terminée');
    return {
      success: true,
      salesSynced: salesResult.success,
      errors
    };
  } catch (error: any) {
    console.error('❌ Erreur synchronisation:', error);
    errors.push(error.message);
    return {
      success: false,
      salesSynced: 0,
      errors
    };
  }
}

/**
 * 6. NETTOYAGE
 */

// Nettoyer les ventes synchronisées (> 7 jours)
export async function cleanupSyncedSales(): Promise<number> {
  const keys = await salesQueue.keys();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  let cleaned = 0;

  for (const key of keys) {
    const sale = await salesQueue.getItem<OfflineSale>(key);
    if (sale && sale.synced && sale.timestamp < sevenDaysAgo) {
      await salesQueue.removeItem(key);
      cleaned++;
      console.log('🗑️ Vente nettoyée:', key);
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 ${cleaned} vente(s) nettoyée(s)`);
  }

  return cleaned;
}

// Vider tout le cache (reset complet)
export async function clearAllCache(): Promise<void> {
  await productsCache.clear();
  await salesQueue.clear();
  await inventoryCache.clear();
  console.log('🗑️ Tout le cache vidé');
  toast.success('Cache vidé avec succès');
}

/**
 * 7. STATISTIQUES
 */

export async function getCacheStats(vendorId: string): Promise<{
  productsCount: number;
  pendingSales: number;
  cacheSize: string;
  lastSync: Date | null;
}> {
  const cached = await productsCache.getItem<{
    products: Product[];
    timestamp: number;
  }>(`vendor_${vendorId}`);

  const pendingSales = await getPendingSalesCount();

  return {
    productsCount: cached?.products?.length || 0,
    pendingSales,
    cacheSize: 'N/A', // localforage ne fournit pas la taille
    lastSync: cached?.timestamp ? new Date(cached.timestamp) : null
  };
}

// Export par défaut
export default {
  // Produits
  cacheProducts,
  getCachedProducts,
  clearProductsCache,

  // Ventes
  queueOfflineSale,
  syncOfflineSales,
  getPendingSalesCount,
  getPendingSales,

  // Inventaire
  syncInventory,
  getLocalStock,

  // Réseau
  isOnline,
  onNetworkChange,

  // Sync
  autoSync,
  cleanupSyncedSales,
  clearAllCache,

  // Stats
  getCacheStats
};

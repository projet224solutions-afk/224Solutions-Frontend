/**
 * Local Stock Manager - Gestionnaire de stock local
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Gère le stock en mode hors ligne avec:
 * - Synchronisation bidirectionnelle avec le serveur
 * - Décompte automatique après ventes POS
 * - Alertes stock bas (locales)
 * - Historique des mouvements de stock
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { globalSyncQueue, SyncPriority } from './sync/advancedSyncEngine';
import { storeEvent } from '@/lib/offlineDB';

/**
 * Structure d'un produit en stock local
 */
export interface LocalStockItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  vendor_id: string;
  quantity: number;
  reserved_quantity: number; // Quantité réservée (paniers clients)
  available_quantity: number; // quantity - reserved_quantity
  min_stock_alert: number; // Seuil d'alerte
  unit: string; // pièce, kg, litre, etc.
  last_updated: string;
  synced: boolean;
  local_changes: boolean; // true si modifié localement
}

/**
 * Mouvement de stock
 */
export interface StockMovement {
  id: string;
  product_id: string;
  vendor_id: string;
  type: 'sale' | 'adjustment' | 'restock' | 'return' | 'damage' | 'transfer';
  quantity_change: number; // Positif ou négatif
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  reference?: string; // ID vente POS, bon de livraison, etc.
  created_at: string;
  created_by?: string;
  synced: boolean;
}

/**
 * Alerte de stock bas
 */
export interface StockAlert {
  id: string;
  product_id: string;
  product_name: string;
  current_quantity: number;
  min_quantity: number;
  severity: 'warning' | 'critical' | 'out_of_stock';
  created_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
}

/**
 * Schéma de la base de données stock local
 */
interface LocalStockSchema extends DBSchema {
  stock_items: {
    key: string; // product_id
    value: LocalStockItem;
    indexes: {
      'by-vendor': string;
      'by-sync-status': number;
      'by-low-stock': number;
    };
  };
  stock_movements: {
    key: string;
    value: StockMovement;
    indexes: {
      'by-product': string;
      'by-vendor': string;
      'by-type': string;
      'by-date': string;
      'by-sync-status': number;
    };
  };
  stock_alerts: {
    key: string;
    value: StockAlert;
    indexes: {
      'by-product': string;
      'by-severity': string;
      'by-acknowledged': number;
    };
  };
}

let stockDB: IDBPDatabase<LocalStockSchema> | null = null;

/**
 * Initialiser la base de données stock local
 */
async function initStockDB(): Promise<IDBPDatabase<LocalStockSchema>> {
  if (stockDB) return stockDB;

  stockDB = await openDB<LocalStockSchema>('224Solutions-LocalStock', 1, {
    upgrade(database) {
      console.log('[LocalStock] Création du schéma DB');

      // Store des items en stock
      if (!database.objectStoreNames.contains('stock_items')) {
        const stockStore = database.createObjectStore('stock_items', { keyPath: 'product_id' });
        stockStore.createIndex('by-vendor', 'vendor_id');
        stockStore.createIndex('by-sync-status', 'synced');
        stockStore.createIndex('by-low-stock', 'available_quantity');
      }

      // Store des mouvements de stock
      if (!database.objectStoreNames.contains('stock_movements')) {
        const movementStore = database.createObjectStore('stock_movements', { keyPath: 'id' });
        movementStore.createIndex('by-product', 'product_id');
        movementStore.createIndex('by-vendor', 'vendor_id');
        movementStore.createIndex('by-type', 'type');
        movementStore.createIndex('by-date', 'created_at');
        movementStore.createIndex('by-sync-status', 'synced');
      }

      // Store des alertes stock
      if (!database.objectStoreNames.contains('stock_alerts')) {
        const alertStore = database.createObjectStore('stock_alerts', { keyPath: 'id' });
        alertStore.createIndex('by-product', 'product_id');
        alertStore.createIndex('by-severity', 'severity');
        alertStore.createIndex('by-acknowledged', 'acknowledged');
      }
    }
  });

  console.log('[LocalStock] ✅ Base de données initialisée');
  return stockDB;
}

/**
 * Charger le stock initial du serveur (à faire au premier lancement)
 */
export async function loadInitialStock(vendorId: string, products: any[]): Promise<void> {
  const db = await initStockDB();

  for (const product of products) {
    // ✨ FIX: Supporter à la fois stock_quantity (Supabase) et stock (cache local)
    const stockQuantity = product.stock_quantity ?? product.stock ?? 0;

    const stockItem: LocalStockItem = {
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      vendor_id: vendorId,
      quantity: stockQuantity,
      reserved_quantity: 0,
      available_quantity: stockQuantity,
      min_stock_alert: product.min_stock || 5,
      unit: product.unit || 'pièce',
      last_updated: new Date().toISOString(),
      synced: true,
      local_changes: false
    };

    await db.put('stock_items', stockItem);

    // Vérifier les alertes
    await checkAndCreateAlert(stockItem);
  }

  console.log(`[LocalStock] ✅ ${products.length} produits chargés (stock initialisé)`);
}

/**
 * Obtenir le stock d'un produit
 */
export async function getProductStock(productId: string): Promise<LocalStockItem | null> {
  const db = await initStockDB();
  const item = await db.get('stock_items', productId);
  return item || null;
}

/**
 * Obtenir tout le stock d'un vendeur
 */
export async function getVendorStock(vendorId: string, options?: {
  lowStockOnly?: boolean;
  limit?: number;
}): Promise<LocalStockItem[]> {
  const db = await initStockDB();
  let items = await db.getAllFromIndex('stock_items', 'by-vendor', vendorId);

  // Filtrer stock bas si demandé
  if (options?.lowStockOnly) {
    items = items.filter(item => item.available_quantity <= item.min_stock_alert);
  }

  // Trier par quantité disponible (stock bas en premier)
  items.sort((a, b) => a.available_quantity - b.available_quantity);

  // Limiter
  if (options?.limit) {
    items = items.slice(0, options.limit);
  }

  return items;
}

/**
 * Décompter le stock après une vente POS
 */
export async function decrementStockFromSale(
  productId: string,
  quantity: number,
  saleReference: string
): Promise<{ success: boolean; error?: string; newQuantity?: number }> {
  try {
    const db = await initStockDB();
    const item = await db.get('stock_items', productId);

    if (!item) {
      return { success: false, error: 'Produit non trouvé dans le stock local' };
    }

    if (item.available_quantity < quantity) {
      return {
        success: false,
        error: `Stock insuffisant (disponible: ${item.available_quantity} ${item.unit})`
      };
    }

    const previousQuantity = item.quantity;
    item.quantity -= quantity;
    item.available_quantity = item.quantity - item.reserved_quantity;
    item.last_updated = new Date().toISOString();
    item.local_changes = true;
    item.synced = false;

    await db.put('stock_items', item);

    // Enregistrer le mouvement
    await recordStockMovement({
      product_id: productId,
      vendor_id: item.vendor_id,
      type: 'sale',
      quantity_change: -quantity,
      previous_quantity: previousQuantity,
      new_quantity: item.quantity,
      reference: saleReference,
      created_at: new Date().toISOString(),
      synced: false
    });

    // Vérifier les alertes
    await checkAndCreateAlert(item);

    // Ajouter à la queue de sync
    globalSyncQueue.enqueue('vendor_products', {
      id: productId,
      stock: item.quantity
    }, SyncPriority.HIGH);

    console.log(`[LocalStock] ✅ Stock décompté: ${productId} -${quantity} → ${item.quantity}`);

    return { success: true, newQuantity: item.quantity };
  } catch (error: any) {
    console.error('[LocalStock] ❌ Erreur décompte stock:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ajuster manuellement le stock
 */
export async function adjustStock(
  productId: string,
  vendorId: string,
  newQuantity: number,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await initStockDB();
    const item = await db.get('stock_items', productId);

    if (!item) {
      return { success: false, error: 'Produit non trouvé' };
    }

    const previousQuantity = item.quantity;
    const quantityChange = newQuantity - previousQuantity;

    item.quantity = newQuantity;
    item.available_quantity = item.quantity - item.reserved_quantity;
    item.last_updated = new Date().toISOString();
    item.local_changes = true;
    item.synced = false;

    await db.put('stock_items', item);

    // Enregistrer le mouvement
    await recordStockMovement({
      product_id: productId,
      vendor_id: vendorId,
      type: 'adjustment',
      quantity_change: quantityChange,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      reason,
      created_at: new Date().toISOString(),
      synced: false
    });

    // Vérifier les alertes
    await checkAndCreateAlert(item);

    // Sync
    globalSyncQueue.enqueue('vendor_products', {
      id: productId,
      stock: newQuantity
    }, SyncPriority.MEDIUM);

    console.log(`[LocalStock] ✅ Stock ajusté: ${productId} ${previousQuantity} → ${newQuantity}`);

    return { success: true };
  } catch (error: any) {
    console.error('[LocalStock] ❌ Erreur ajustement:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Enregistrer un mouvement de stock
 */
async function recordStockMovement(
  movement: Omit<StockMovement, 'id'>
): Promise<void> {
  const db = await initStockDB();
  const movementId = `movement_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const fullMovement: StockMovement = {
    ...movement,
    id: movementId
  };

  await db.put('stock_movements', fullMovement);

  // Stocker dans le système d'événements pour sync
  await storeEvent({
    type: 'stock_movement',
    data: fullMovement,
    vendor_id: movement.vendor_id,
    created_at: movement.created_at
  }, false); // Pas besoin de crypter les mouvements de stock
}

/**
 * Obtenir l'historique des mouvements d'un produit
 */
export async function getProductMovements(
  productId: string,
  options?: { limit?: number; startDate?: Date; endDate?: Date }
): Promise<StockMovement[]> {
  const db = await initStockDB();
  let movements = await db.getAllFromIndex('stock_movements', 'by-product', productId);

  // Filtrer par date
  if (options?.startDate) {
    const startTime = options.startDate.getTime();
    movements = movements.filter(m => new Date(m.created_at).getTime() >= startTime);
  }

  if (options?.endDate) {
    const endTime = options.endDate.getTime();
    movements = movements.filter(m => new Date(m.created_at).getTime() <= endTime);
  }

  // Trier par date (plus récent en premier)
  movements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Limiter
  if (options?.limit) {
    movements = movements.slice(0, options.limit);
  }

  return movements;
}

/**
 * Vérifier et créer une alerte si nécessaire
 */
async function checkAndCreateAlert(item: LocalStockItem): Promise<void> {
  const db = await initStockDB();

  // Déterminer la sévérité
  let severity: 'warning' | 'critical' | 'out_of_stock';

  if (item.available_quantity === 0) {
    severity = 'out_of_stock';
  } else if (item.available_quantity <= item.min_stock_alert / 2) {
    severity = 'critical';
  } else if (item.available_quantity <= item.min_stock_alert) {
    severity = 'warning';
  } else {
    // Stock OK, supprimer les alertes existantes
    const existingAlerts = await db.getAllFromIndex('stock_alerts', 'by-product', item.product_id);
    for (const alert of existingAlerts) {
      if (!alert.acknowledged) {
        await db.delete('stock_alerts', alert.id);
      }
    }
    return;
  }

  // Vérifier si une alerte existe déjà
  const existingAlerts = await db.getAllFromIndex('stock_alerts', 'by-product', item.product_id);
  const hasActiveAlert = existingAlerts.some(a => !a.acknowledged && a.severity === severity);

  if (hasActiveAlert) return; // Alerte déjà existante

  // Créer nouvelle alerte
  const alert: StockAlert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    product_id: item.product_id,
    product_name: item.product_name,
    current_quantity: item.available_quantity,
    min_quantity: item.min_stock_alert,
    severity,
    created_at: new Date().toISOString(),
    acknowledged: false
  };

  await db.put('stock_alerts', alert);

  console.log(`[LocalStock] ⚠️ Alerte créée: ${item.product_name} (${severity})`);
}

/**
 * Obtenir toutes les alertes actives
 */
export async function getActiveAlerts(vendorId: string): Promise<StockAlert[]> {
  const db = await initStockDB();
  // Get all alerts and filter by acknowledged=false (index expects number since boolean index was changed)
  const allAlerts = await db.getAll('stock_alerts');
  const nonAcknowledgedAlerts = allAlerts.filter(a => !a.acknowledged);

  // Filtrer par vendeur (en vérifiant le produit)
  const stockItems = await getVendorStock(vendorId);
  const vendorProductIds = new Set(stockItems.map(s => s.product_id));

  const vendorAlerts = nonAcknowledgedAlerts.filter(a => vendorProductIds.has(a.product_id));

  // Trier par sévérité (out_of_stock > critical > warning)
  const severityOrder = { out_of_stock: 0, critical: 1, warning: 2 };
  vendorAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return vendorAlerts;
}

/**
 * Acquitter une alerte
 */
export async function acknowledgeAlert(alertId: string): Promise<void> {
  const db = await initStockDB();
  const alert = await db.get('stock_alerts', alertId);

  if (alert) {
    alert.acknowledged = true;
    alert.acknowledged_at = new Date().toISOString();
    await db.put('stock_alerts', alert);
    console.log(`[LocalStock] ✅ Alerte acquittée: ${alertId}`);
  }
}

/**
 * Obtenir les statistiques de stock
 */
export async function getStockStats(vendorId: string): Promise<{
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  activeAlertsCount: number;
  recentMovementsCount: number;
}> {
  const db = await initStockDB();
  const stockItems = await getVendorStock(vendorId);
  const alerts = await getActiveAlerts(vendorId);

  const lowStockCount = stockItems.filter(i =>
    i.available_quantity > 0 && i.available_quantity <= i.min_stock_alert
  ).length;

  const outOfStockCount = stockItems.filter(i => i.available_quantity === 0).length;

  // Compter les mouvements des dernières 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const allMovements = await db.getAll('stock_movements');
  const recentMovements = allMovements.filter(m =>
    new Date(m.created_at) > oneDayAgo &&
    stockItems.some(s => s.product_id === m.product_id)
  );

  return {
    totalProducts: stockItems.length,
    totalValue: 0, // TODO: calculer avec les prix
    lowStockCount,
    outOfStockCount,
    activeAlertsCount: alerts.length,
    recentMovementsCount: recentMovements.length
  };
}

/**
 * Synchroniser le stock avec le serveur
 */
export async function syncStockWithServer(vendorId: string, serverStock: any[]): Promise<{
  updated: number;
  conflicts: number;
}> {
  const db = await initStockDB();
  let updated = 0;
  let conflicts = 0;

  for (const serverItem of serverStock) {
    const localItem = await db.get('stock_items', serverItem.id);

    if (!localItem) {
      // Nouveau produit du serveur
      const newItem: LocalStockItem = {
        id: crypto.randomUUID(),
        product_id: serverItem.id,
        product_name: serverItem.name,
        product_sku: serverItem.sku,
        vendor_id: vendorId,
        quantity: serverItem.stock,
        reserved_quantity: 0,
        available_quantity: serverItem.stock,
        min_stock_alert: serverItem.min_stock || 5,
        unit: serverItem.unit || 'pièce',
        last_updated: new Date().toISOString(),
        synced: true,
        local_changes: false
      };
      await db.put('stock_items', newItem);
      updated++;
    } else if (localItem.local_changes) {
      // Conflit: modifications locales non synchronisées
      conflicts++;
      console.warn(`[LocalStock] ⚠️ Conflit: ${serverItem.name}`);
      // TODO: Utiliser le conflict resolver
    } else {
      // Mise à jour simple depuis le serveur
      localItem.quantity = serverItem.stock;
      localItem.available_quantity = serverItem.stock - localItem.reserved_quantity;
      localItem.last_updated = new Date().toISOString();
      localItem.synced = true;
      await db.put('stock_items', localItem);
      updated++;
    }
  }

  console.log(`[LocalStock] ✅ Sync: ${updated} mis à jour, ${conflicts} conflits`);

  return { updated, conflicts };
}

/**
 * Nettoyer les anciens mouvements (> 90 jours)
 */
export async function cleanupOldMovements(): Promise<number> {
  const db = await initStockDB();
  const allMovements = await db.getAll('stock_movements');
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

  let cleaned = 0;

  for (const movement of allMovements) {
    const movementTime = new Date(movement.created_at).getTime();
    if (movement.synced && movementTime < ninetyDaysAgo) {
      await db.delete('stock_movements', movement.id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[LocalStock] 🧹 ${cleaned} mouvements anciens nettoyés`);
  }

  return cleaned;
}

export default {
  initStockDB,
  loadInitialStock,
  getProductStock,
  getVendorStock,
  decrementStockFromSale,
  adjustStock,
  getProductMovements,
  getActiveAlerts,
  acknowledgeAlert,
  getStockStats,
  syncStockWithServer,
  cleanupOldMovements
};

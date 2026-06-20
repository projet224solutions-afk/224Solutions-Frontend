/**
 * OFFLINE QUEUE MANAGER - 224SOLUTIONS
 * Gestionnaire avancé de file d'attente pour opérations offline
 * Avec priorités, retry exponential backoff, et batch processing
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { encryptData, decryptData } from './encryption';

// Types
export type OperationType =
  | 'create_order'
  | 'update_order'
  | 'create_product'
  | 'update_product'
  | 'delete_product'
  | 'update_stock'
  | 'pos_sale'
  | 'wallet_transfer'
  | 'message_send'
  | 'review_submit'
  | 'profile_update'
  | 'address_save'
  | 'cart_sync'
  | 'analytics_event';

export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface QueuedOperation {
  id: string;
  type: OperationType;
  priority: Priority;
  data: any;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  created_at: string;
  scheduled_at?: string;
  attempts: number;
  max_attempts: number;
  last_attempt?: string;
  last_error?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  user_id?: string;
  encrypted: boolean;
  dependencies?: string[]; // IDs d'opérations qui doivent être complétées avant
  callback_data?: any; // Données à passer au callback
}

interface OfflineQueueSchema extends DBSchema {
  operations: {
    key: string;
    value: QueuedOperation;
    indexes: {
      'by-status': string;
      'by-priority': string;
      'by-type': string;
      'by-created': string;
      'by-user': string;
    };
  };
  sync_metadata: {
    key: string;
    value: {
      key: string;
      last_sync: string;
      sync_count: number;
      error_count: number;
    };
  };
}

// Priorités numériques pour tri
const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3
};

// Configuration retry avec backoff exponentiel
const _RETRY_CONFIG = {
  base_delay: 1000, // 1 seconde
  max_delay: 300000, // 5 minutes
  multiplier: 2
};

// Singleton instance
let db: IDBPDatabase<OfflineQueueSchema> | null = null;
let isProcessing = false;
let processingPromise: Promise<void> | null = null;

/**
 * Initialiser la base de données
 */
async function initDB(): Promise<IDBPDatabase<OfflineQueueSchema>> {
  if (db) return db;

  db = await openDB<OfflineQueueSchema>('224Solutions-OfflineQueue', 2, {
    upgrade(database, oldVersion) {
      console.log(`[OfflineQueue] Upgrading DB from v${oldVersion}`);

      if (!database.objectStoreNames.contains('operations')) {
        const store = database.createObjectStore('operations', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-priority', 'priority');
        store.createIndex('by-type', 'type');
        store.createIndex('by-created', 'created_at');
        store.createIndex('by-user', 'user_id');
      }

      if (!database.objectStoreNames.contains('sync_metadata')) {
        database.createObjectStore('sync_metadata', { keyPath: 'key' });
      }
    }
  });

  return db;
}

/**
 * Générer un ID unique
 */
function generateId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Ajouter une opération à la file d'attente
 */
export async function enqueue(
  type: OperationType,
  data: any,
  options: {
    endpoint: string;
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    priority?: Priority;
    max_attempts?: number;
    user_id?: string;
    encrypt?: boolean;
    headers?: Record<string, string>;
    dependencies?: string[];
    scheduled_at?: string;
  }
): Promise<string> {
  const database = await initDB();
  const id = generateId();

  const operation: QueuedOperation = {
    id,
    type,
    priority: options.priority || 'normal',
    data: options.encrypt !== false ? encryptData(data) : data,
    endpoint: options.endpoint,
    method: options.method || 'POST',
    headers: options.headers,
    created_at: new Date().toISOString(),
    scheduled_at: options.scheduled_at,
    attempts: 0,
    max_attempts: options.max_attempts || 5,
    status: 'pending',
    user_id: options.user_id,
    encrypted: options.encrypt !== false,
    dependencies: options.dependencies
  };

  await database.put('operations', operation);
  console.log(`[OfflineQueue] Enqueued operation: ${id} (${type})`);

  // Tenter de traiter si online
  if (navigator.onLine && !isProcessing) {
    processQueue();
  }

  return id;
}

/**
 * Raccourcis pour les opérations communes
 */
export const queueOperations = {
  // Commandes
  createOrder: (data: any, userId: string) => enqueue('create_order', data, {
    endpoint: '/api/orders',
    method: 'POST',
    priority: 'high',
    user_id: userId
  }),

  // Produits
  updateProduct: (productId: string, data: any, userId: string) => enqueue('update_product', data, {
    endpoint: `/api/products/${productId}`,
    method: 'PATCH',
    priority: 'normal',
    user_id: userId
  }),

  updateStock: (productId: string, quantity: number, userId: string) => enqueue('update_stock', { productId, quantity }, {
    endpoint: `/api/products/${productId}/stock`,
    method: 'PATCH',
    priority: 'high',
    user_id: userId
  }),

  // POS
  posSale: (saleData: any, userId: string) => enqueue('pos_sale', saleData, {
    endpoint: '/api/pos/sales',
    method: 'POST',
    priority: 'critical',
    user_id: userId
  }),

  // Wallet
  walletTransfer: (transferData: any, userId: string) => enqueue('wallet_transfer', transferData, {
    endpoint: '/api/v2/wallet/transfer',
    method: 'POST',
    priority: 'critical',
    user_id: userId,
    max_attempts: 3 // Moins de tentatives pour les transferts
  }),

  // Messages
  sendMessage: (messageData: any, userId: string) => enqueue('message_send', messageData, {
    endpoint: '/api/messages',
    method: 'POST',
    priority: 'normal',
    user_id: userId
  }),

  // Analytics (basse priorité)
  trackEvent: (eventData: any, userId?: string) => enqueue('analytics_event', eventData, {
    endpoint: '/api/analytics/events',
    method: 'POST',
    priority: 'low',
    user_id: userId,
    encrypt: false // Pas besoin de crypter les analytics
  })
};

/**
 * Obtenir les opérations en attente
 */
export async function getPendingOperations(
  filters?: {
    type?: OperationType;
    priority?: Priority;
    user_id?: string;
    limit?: number;
  }
): Promise<QueuedOperation[]> {
  const database = await initDB();

  let operations = await database.getAllFromIndex('operations', 'by-status', 'pending');

  // Filtrer
  if (filters?.type) {
    operations = operations.filter(op => op.type === filters.type);
  }
  if (filters?.priority) {
    operations = operations.filter(op => op.priority === filters.priority);
  }
  if (filters?.user_id) {
    operations = operations.filter(op => op.user_id === filters.user_id);
  }

  // Trier par priorité puis par date
  operations.sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Limiter
  if (filters?.limit) {
    operations = operations.slice(0, filters.limit);
  }

  // Décrypter les données
  return operations.map(op => ({
    ...op,
    data: op.encrypted ? decryptData(op.data) : op.data
  }));
}

/**
 * Traiter la file d'attente
 */
export async function processQueue(): Promise<{
  processed: number;
  failed: number;
  remaining: number;
}> {
  if (isProcessing) {
    console.log('[OfflineQueue] Already processing, waiting...');
    if (processingPromise) await processingPromise;
    return { processed: 0, failed: 0, remaining: 0 };
  }

  if (!navigator.onLine) {
    console.log('[OfflineQueue] Offline, skipping processing');
    const pending = await getPendingOperations();
    return { processed: 0, failed: 0, remaining: pending.length };
  }

  isProcessing = true;
  let processed = 0;
  let failed = 0;

  processingPromise = (async () => {
    try {
      const database = await initDB();
      const pending = await getPendingOperations();

      console.log(`[OfflineQueue] Processing ${pending.length} operations`);

      for (const operation of pending) {
        // Vérifier les dépendances
        if (operation.dependencies && operation.dependencies.length > 0) {
          const deps = await Promise.all(
            operation.dependencies.map(depId => database.get('operations', depId))
          );
          const pendingDeps = deps.filter(d => d && d.status !== 'completed');
          if (pendingDeps.length > 0) {
            console.log(`[OfflineQueue] Skipping ${operation.id}, has pending dependencies`);
            continue;
          }
        }

        // Vérifier si programmé pour plus tard
        if (operation.scheduled_at && new Date(operation.scheduled_at) > new Date()) {
          continue;
        }

        // Marquer comme en cours
        await database.put('operations', {
          ...operation,
          data: operation.encrypted ? encryptData(operation.data) : operation.data,
          status: 'processing',
          last_attempt: new Date().toISOString()
        });

        try {
          // Exécuter l'opération
          const response = await fetch(operation.endpoint, {
            method: operation.method,
            headers: {
              'Content-Type': 'application/json',
              ...operation.headers
            },
            body: JSON.stringify(operation.data)
          });

          if (response.ok) {
            // Succès
            await database.put('operations', {
              ...operation,
              data: operation.encrypted ? encryptData(operation.data) : operation.data,
              status: 'completed',
              attempts: operation.attempts + 1
            });
            processed++;
            console.log(`[OfflineQueue] ✅ Completed: ${operation.id}`);
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

        } catch (error: any) {
          const attempts = operation.attempts + 1;
          const status = attempts >= operation.max_attempts ? 'failed' : 'pending';

          await database.put('operations', {
            ...operation,
            data: operation.encrypted ? encryptData(operation.data) : operation.data,
            status,
            attempts,
            last_error: error.message
          });

          if (status === 'failed') {
            failed++;
            console.error(`[OfflineQueue] ❌ Failed permanently: ${operation.id}`, error);
          } else {
            console.warn(`[OfflineQueue] ⚠️ Retry later: ${operation.id} (attempt ${attempts})`);
          }
        }

        // Petit délai entre les opérations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } finally {
      isProcessing = false;
      processingPromise = null;
    }
  })();

  await processingPromise;

  const remaining = (await getPendingOperations()).length;
  console.log(`[OfflineQueue] Done: ${processed} processed, ${failed} failed, ${remaining} remaining`);

  // Mettre à jour les métadonnées
  const database = await initDB();
  await database.put('sync_metadata', {
    key: 'last_process',
    last_sync: new Date().toISOString(),
    sync_count: processed,
    error_count: failed
  });

  return { processed, failed, remaining };
}

/**
 * Annuler une opération
 */
export async function cancelOperation(operationId: string): Promise<boolean> {
  const database = await initDB();
  const operation = await database.get('operations', operationId);

  if (!operation || operation.status === 'completed') {
    return false;
  }

  await database.put('operations', {
    ...operation,
    status: 'cancelled'
  });

  console.log(`[OfflineQueue] Cancelled: ${operationId}`);
  return true;
}

/**
 * Réessayer une opération échouée
 */
export async function retryOperation(operationId: string): Promise<boolean> {
  const database = await initDB();
  const operation = await database.get('operations', operationId);

  if (!operation || operation.status !== 'failed') {
    return false;
  }

  await database.put('operations', {
    ...operation,
    status: 'pending',
    attempts: 0,
    last_error: undefined
  });

  console.log(`[OfflineQueue] Retrying: ${operationId}`);

  if (navigator.onLine) {
    processQueue();
  }

  return true;
}

/**
 * Nettoyer les opérations anciennes
 */
export async function cleanupOldOperations(
  olderThanDays: number = 7
): Promise<number> {
  const database = await initDB();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const allOps = await database.getAll('operations');
  let deleted = 0;

  for (const op of allOps) {
    if (
      (op.status === 'completed' || op.status === 'cancelled') &&
      new Date(op.created_at) < cutoff
    ) {
      await database.delete('operations', op.id);
      deleted++;
    }
  }

  console.log(`[OfflineQueue] Cleaned up ${deleted} old operations`);
  return deleted;
}

/**
 * Obtenir les statistiques de la file
 */
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  by_type: Record<OperationType, number>;
  by_priority: Record<Priority, number>;
}> {
  const database = await initDB();
  const allOps = await database.getAll('operations');

  const stats = {
    total: allOps.length,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    by_type: {} as Record<OperationType, number>,
    by_priority: {} as Record<Priority, number>
  };

  allOps.forEach(op => {
    stats[op.status]++;
    stats.by_type[op.type] = (stats.by_type[op.type] || 0) + 1;
    stats.by_priority[op.priority] = (stats.by_priority[op.priority] || 0) + 1;
  });

  return stats;
}

/**
 * Écouter les changements de connectivité
 */
export function setupConnectivityListener(): () => void {
  const handleOnline = () => {
    console.log('[OfflineQueue] Back online, processing queue...');
    processQueue();
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

// Export par défaut
export default {
  enqueue,
  queueOperations,
  getPendingOperations,
  processQueue,
  cancelOperation,
  retryOperation,
  cleanupOldOperations,
  getQueueStats,
  setupConnectivityListener
};

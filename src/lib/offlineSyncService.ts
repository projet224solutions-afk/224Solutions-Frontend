/**
 * OFFLINE DATA SYNC SERVICE - 224SOLUTIONS
 * Service de synchronisation bidirectionnelle avec gestion de conflits
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';
import { encryptData, decryptData } from './encryption';
import { toast } from 'sonner';

// Types de données à synchroniser
export type SyncableEntity =
  | 'products'
  | 'orders'
  | 'cart_items'
  | 'user_addresses'
  | 'favorites'
  | 'messages'
  | 'notifications'
  | 'reviews'
  | 'settings'
  | 'vendor_products'
  | 'pos_sales';

export interface SyncConfig {
  entity: SyncableEntity;
  table: string;
  primaryKey: string;
  columns: string[];
  userIdColumn?: string;
  lastModifiedColumn: string;
  conflictResolution: 'server-wins' | 'client-wins' | 'merge' | 'manual';
  syncDirection: 'pull' | 'push' | 'bidirectional';
  batchSize: number;
  retentionDays: number;
  encryptLocally: boolean;
}

export interface SyncRecord {
  id: string;
  entity: SyncableEntity;
  local_data: any;
  server_data: any;
  version: number;
  last_synced_at: string | null;
  local_modified_at: string;
  server_modified_at: string | null;
  status: 'synced' | 'pending_upload' | 'pending_download' | 'conflict';
  conflict_resolution?: 'pending' | 'resolved';
  checksum: string;
}

export interface SyncMetadata {
  entity: SyncableEntity;
  last_full_sync: string | null;
  last_incremental_sync: string | null;
  records_count: number;
  pending_changes: number;
  conflicts_count: number;
}

interface OfflineSyncSchema extends DBSchema {
  sync_data: {
    key: string;
    value: SyncRecord;
    indexes: {
      'by-entity': SyncableEntity;
      'by-status': string;
      'by-modified': string;
    };
  };
  sync_metadata: {
    key: SyncableEntity;
    value: SyncMetadata;
  };
  sync_conflicts: {
    key: string;
    value: {
      id: string;
      entity: SyncableEntity;
      local_data: any;
      server_data: any;
      detected_at: string;
      resolved_at?: string;
      resolution?: 'local' | 'server' | 'merged';
    };
  };
}

// Configurations par défaut pour chaque entité
const DEFAULT_SYNC_CONFIGS: Record<SyncableEntity, SyncConfig> = {
  products: {
    entity: 'products',
    table: 'products',
    primaryKey: 'id',
    columns: ['id', 'name', 'description', 'price', 'stock', 'images', 'vendor_id', 'category_id', 'updated_at'],
    lastModifiedColumn: 'updated_at',
    conflictResolution: 'server-wins',
    syncDirection: 'pull',
    batchSize: 100,
    retentionDays: 7,
    encryptLocally: false
  },
  orders: {
    entity: 'orders',
    table: 'orders',
    primaryKey: 'id',
    columns: ['id', 'user_id', 'status', 'total', 'items', 'shipping_address', 'created_at', 'updated_at'],
    userIdColumn: 'user_id',
    lastModifiedColumn: 'updated_at',
    conflictResolution: 'server-wins',
    syncDirection: 'bidirectional',
    batchSize: 50,
    retentionDays: 30,
    encryptLocally: true
  },
  cart_items: {
    entity: 'cart_items',
    table: 'cart_items',
    primaryKey: 'id',
    columns: ['id', 'user_id', 'product_id', 'quantity', 'updated_at'],
    userIdColumn: 'user_id',
    lastModifiedColumn: 'updated_at',
    conflictResolution: 'client-wins',
    syncDirection: 'bidirectional',
    batchSize: 100,
    retentionDays: 14,
    encryptLocally: false
  },
  user_addresses: {
    entity: 'user_addresses',
    table: 'user_addresses',
    primaryKey: 'id',
    columns: ['id', 'user_id', 'label', 'address', 'city', 'country', 'phone', 'is_default', 'updated_at'],
    userIdColumn: 'user_id',
    lastModifiedColumn: 'updated_at',
    conflictResolution: 'client-wins',
    syncDirection: 'bidirectional',
    batchSize: 20,
    retentionDays: 365,
    encryptLocally: true
  },
  favorites: {
    entity: 'favorites',
    table: 'favorites',
    primaryKey: 'id',
    columns: ['id', 'user_id', 'product_id', 'created_at'],
    userIdColumn: 'user_id',
    lastModifiedColumn: 'created_at',
    conflictResolution: 'merge',
    syncDirection: 'bidirectional',
    batchSize: 200,
    retentionDays: 365,
    encryptLocally: false
  },
  messages: {
    entity: 'messages',
    table: 'messages',
    primaryKey: 'id',
    columns: ['id', 'sender_id', 'receiver_id', 'content', 'read', 'created_at'],
    userIdColumn: 'sender_id',
    lastModifiedColumn: 'created_at',
    conflictResolution: 'server-wins',
    syncDirection: 'bidirectional',
    batchSize: 100,
    retentionDays: 90,
    encryptLocally: true
  },
  notifications: {
    entity: 'notifications',
    table: 'notifications',
    primaryKey: 'id',
    columns: ['id', 'user_id', 'title', 'body', 'read', 'type', 'created_at'],
    userIdColumn: 'user_id',
    lastModifiedColumn: 'created_at',
    conflictResolution: 'server-wins',
    syncDirection: 'pull',
    batchSize: 50,
    retentionDays: 30,
    encryptLocally: false
  },
  reviews: {
    entity: 'reviews',
    table: 'reviews',
    primaryKey: 'id',
    columns: ['id', 'user_id', 'product_id', 'rating', 'comment', 'created_at', 'updated_at'],
    userIdColumn: 'user_id',
    lastModifiedColumn: 'updated_at',
    conflictResolution: 'client-wins',
    syncDirection: 'bidirectional',
    batchSize: 50,
    retentionDays: 365,
    encryptLocally: false
  },
  settings: {
    entity: 'settings',
    table: 'user_settings',
    primaryKey: 'user_id',
    columns: ['user_id', 'theme', 'language', 'notifications_enabled', 'currency', 'updated_at'],
    userIdColumn: 'user_id',
    lastModifiedColumn: 'updated_at',
    conflictResolution: 'client-wins',
    syncDirection: 'bidirectional',
    batchSize: 1,
    retentionDays: 365,
    encryptLocally: false
  },
  vendor_products: {
    entity: 'vendor_products',
    table: 'products',
    primaryKey: 'id',
    columns: ['id', 'name', 'description', 'price', 'stock', 'images', 'vendor_id', 'category_id', 'updated_at'],
    userIdColumn: 'vendor_id',
    lastModifiedColumn: 'updated_at',
    conflictResolution: 'merge',
    syncDirection: 'bidirectional',
    batchSize: 50,
    retentionDays: 30,
    encryptLocally: false
  },
  pos_sales: {
    entity: 'pos_sales',
    table: 'pos_sales',
    primaryKey: 'id',
    columns: ['id', 'vendor_id', 'items', 'total', 'payment_method', 'created_at'],
    userIdColumn: 'vendor_id',
    lastModifiedColumn: 'created_at',
    conflictResolution: 'client-wins',
    syncDirection: 'push',
    batchSize: 100,
    retentionDays: 365,
    encryptLocally: true
  }
};

// Singleton DB instance
let db: IDBPDatabase<OfflineSyncSchema> | null = null;

/**
 * Initialiser la base de données de sync
 */
async function initSyncDB(): Promise<IDBPDatabase<OfflineSyncSchema>> {
  if (db) return db;

  db = await openDB<OfflineSyncSchema>('224Solutions-OfflineSync', 2, {
    upgrade(database, oldVersion) {
      console.log(`[OfflineSync] Upgrading DB from v${oldVersion}`);

      if (!database.objectStoreNames.contains('sync_data')) {
        const store = database.createObjectStore('sync_data', { keyPath: 'id' });
        store.createIndex('by-entity', 'entity');
        store.createIndex('by-status', 'status');
        store.createIndex('by-modified', 'local_modified_at');
      }

      if (!database.objectStoreNames.contains('sync_metadata')) {
        database.createObjectStore('sync_metadata', { keyPath: 'entity' });
      }

      if (!database.objectStoreNames.contains('sync_conflicts')) {
        database.createObjectStore('sync_conflicts', { keyPath: 'id' });
      }
    }
  });

  return db;
}

/**
 * Calculer un checksum simple pour détecter les changements
 */
function calculateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Classe principale de synchronisation
 */
export class OfflineSyncService {
  private userId: string | null = null;
  private configs: Map<SyncableEntity, SyncConfig> = new Map();
  private syncInProgress: Set<SyncableEntity> = new Set();
  private listeners: Map<string, (event: any) => void> = new Map();

  constructor() {
    // Charger les configs par défaut
    Object.entries(DEFAULT_SYNC_CONFIGS).forEach(([entity, config]) => {
      this.configs.set(entity as SyncableEntity, config);
    });
  }

  /**
   * Initialiser le service avec l'utilisateur courant
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    await initSyncDB();
    console.log(`[OfflineSync] Initialized for user: ${userId}`);
  }

  /**
   * Sauvegarder des données localement
   */
  async saveLocal<T extends Record<string, any>>(
    entity: SyncableEntity,
    data: T | T[]
  ): Promise<void> {
    const database = await initSyncDB();
    const config = this.configs.get(entity)!;
    const records = Array.isArray(data) ? data : [data];

    const tx = database.transaction('sync_data', 'readwrite');

    for (const record of records) {
      const id = `${entity}:${record[config.primaryKey]}`;
      const existing = await tx.store.get(id);

      const localData = config.encryptLocally ? encryptData(record) : record;
      const now = new Date().toISOString();

      const syncRecord: SyncRecord = {
        id,
        entity,
        local_data: localData,
        server_data: existing?.server_data || null,
        version: (existing?.version || 0) + 1,
        last_synced_at: existing?.last_synced_at || null,
        local_modified_at: now,
        server_modified_at: existing?.server_modified_at || null,
        status: 'pending_upload',
        checksum: calculateChecksum(record)
      };

      await tx.store.put(syncRecord);
    }

    await tx.done;
    console.log(`[OfflineSync] Saved ${records.length} ${entity} locally`);

    // Trigger sync si online
    if (navigator.onLine) {
      this.syncEntity(entity);
    }
  }

  /**
   * Récupérer des données locales
   */
  async getLocal<T>(
    entity: SyncableEntity,
    options?: {
      id?: string;
      filter?: (record: T) => boolean;
      limit?: number;
    }
  ): Promise<T[]> {
    const database = await initSyncDB();
    const config = this.configs.get(entity)!;

    let records: SyncRecord[];

    if (options?.id) {
      const record = await database.get('sync_data', `${entity}:${options.id}`);
      records = record ? [record] : [];
    } else {
      records = await database.getAllFromIndex('sync_data', 'by-entity', entity);
    }

    let results = records.map(r => {
      const data = config.encryptLocally ? decryptData(r.local_data) : r.local_data;
      return data as T;
    });

    if (options?.filter) {
      results = results.filter(options.filter);
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Supprimer des données locales
   */
  async deleteLocal(entity: SyncableEntity, id: string): Promise<void> {
    const database = await initSyncDB();
    await database.delete('sync_data', `${entity}:${id}`);
    console.log(`[OfflineSync] Deleted ${entity}:${id}`);
  }

  /**
   * Synchroniser une entité spécifique
   */
  async syncEntity(entity: SyncableEntity): Promise<{
    uploaded: number;
    downloaded: number;
    conflicts: number;
  }> {
    if (this.syncInProgress.has(entity)) {
      console.log(`[OfflineSync] Sync already in progress for ${entity}`);
      return { uploaded: 0, downloaded: 0, conflicts: 0 };
    }

    if (!navigator.onLine) {
      console.log(`[OfflineSync] Offline, skipping sync for ${entity}`);
      return { uploaded: 0, downloaded: 0, conflicts: 0 };
    }

    this.syncInProgress.add(entity);
    const config = this.configs.get(entity)!;
    const database = await initSyncDB();

    let uploaded = 0;
    let downloaded = 0;
    let conflicts = 0;

    try {
      // 1. PUSH: Envoyer les changements locaux
      if (config.syncDirection !== 'pull') {
        const pendingUpload = await database.getAllFromIndex('sync_data', 'by-entity', entity);
        const toUpload = pendingUpload.filter(r => r.status === 'pending_upload');

        for (const record of toUpload) {
          try {
            const localData = config.encryptLocally
              ? decryptData(record.local_data)
              : record.local_data;

            const { data, error } = await (supabase as any)
              .from(config.table)
              .upsert(localData, { onConflict: config.primaryKey })
              .select()
              .single();

            if (error) throw error;

            await database.put('sync_data', {
              ...record,
              server_data: config.encryptLocally ? encryptData(data) : data,
              last_synced_at: new Date().toISOString(),
              server_modified_at: data[config.lastModifiedColumn],
              status: 'synced'
            });

            uploaded++;
          } catch (error) {
            console.error(`[OfflineSync] Failed to upload ${record.id}:`, error);
          }
        }
      }

      // 2. PULL: Récupérer les changements du serveur
      if (config.syncDirection !== 'push') {
        const metadata = await database.get('sync_metadata', entity);
        const lastSync = metadata?.last_incremental_sync;

        let query = (supabase as any)
          .from(config.table)
          .select(config.columns.join(','))
          .order(config.lastModifiedColumn, { ascending: false })
          .limit(config.batchSize);

        if (config.userIdColumn && this.userId) {
          query = query.eq(config.userIdColumn, this.userId);
        }

        if (lastSync) {
          query = query.gt(config.lastModifiedColumn, lastSync);
        }

        const { data: serverRecords, error } = await query;

        if (error) throw error;

        for (const serverRecord of serverRecords || []) {
          const id = `${entity}:${serverRecord[config.primaryKey]}`;
          const existing = await database.get('sync_data', id);

          if (existing && existing.status === 'pending_upload') {
            // Conflit détecté!
            await this.handleConflict(entity, existing, serverRecord, config);
            conflicts++;
          } else {
            // Pas de conflit, mise à jour normale
            await database.put('sync_data', {
              id,
              entity,
              local_data: config.encryptLocally ? encryptData(serverRecord) : serverRecord,
              server_data: config.encryptLocally ? encryptData(serverRecord) : serverRecord,
              version: (existing?.version || 0) + 1,
              last_synced_at: new Date().toISOString(),
              local_modified_at: serverRecord[config.lastModifiedColumn],
              server_modified_at: serverRecord[config.lastModifiedColumn],
              status: 'synced',
              checksum: calculateChecksum(serverRecord)
            });
            downloaded++;
          }
        }

        // Mettre à jour les métadonnées
        await database.put('sync_metadata', {
          entity,
          last_full_sync: metadata?.last_full_sync || new Date().toISOString(),
          last_incremental_sync: new Date().toISOString(),
          records_count: (metadata?.records_count || 0) + downloaded,
          pending_changes: 0,
          conflicts_count: conflicts
        });
      }

      console.log(`[OfflineSync] Synced ${entity}: ↑${uploaded} ↓${downloaded} ⚠${conflicts}`);

      // Notifier les listeners
      this.notifyListeners({
        type: 'sync_complete',
        entity,
        uploaded,
        downloaded,
        conflicts
      });

    } catch (error) {
      console.error(`[OfflineSync] Sync failed for ${entity}:`, error);
      this.notifyListeners({
        type: 'sync_error',
        entity,
        error
      });
    } finally {
      this.syncInProgress.delete(entity);
    }

    return { uploaded, downloaded, conflicts };
  }

  /**
   * Gérer un conflit de synchronisation
   */
  private async handleConflict(
    entity: SyncableEntity,
    localRecord: SyncRecord,
    serverRecord: any,
    config: SyncConfig
  ): Promise<void> {
    const database = await initSyncDB();
    const localData = config.encryptLocally
      ? decryptData(localRecord.local_data)
      : localRecord.local_data;

    const conflictId = `conflict:${localRecord.id}:${Date.now()}`;

    switch (config.conflictResolution) {
      case 'server-wins':
        // Le serveur gagne, écraser les données locales
        await database.put('sync_data', {
          ...localRecord,
          local_data: config.encryptLocally ? encryptData(serverRecord) : serverRecord,
          server_data: config.encryptLocally ? encryptData(serverRecord) : serverRecord,
          status: 'synced',
          checksum: calculateChecksum(serverRecord)
        });
        break;

      case 'client-wins':
        // Le client gagne, renvoyer au serveur
        // L'upload sera retenté au prochain sync
        break;

      case 'merge':
        // Fusionner les données (stratégie simple: prendre les valeurs les plus récentes)
        const merged = { ...serverRecord };
        for (const key of Object.keys(localData)) {
          if (localData[key] !== undefined &&
              new Date(localRecord.local_modified_at) > new Date(serverRecord[config.lastModifiedColumn])) {
            merged[key] = localData[key];
          }
        }
        await database.put('sync_data', {
          ...localRecord,
          local_data: config.encryptLocally ? encryptData(merged) : merged,
          status: 'pending_upload',
          checksum: calculateChecksum(merged)
        });
        break;

      case 'manual':
        // Stocker le conflit pour résolution manuelle
        await database.put('sync_conflicts', {
          id: conflictId,
          entity,
          local_data: localData,
          server_data: serverRecord,
          detected_at: new Date().toISOString()
        });
        await database.put('sync_data', {
          ...localRecord,
          status: 'conflict',
          conflict_resolution: 'pending'
        });
        toast.warning(`Conflit détecté pour ${entity}`, {
          description: 'Veuillez résoudre le conflit manuellement'
        });
        break;
    }
  }

  /**
   * Résoudre un conflit manuellement
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'server' | 'merged',
    mergedData?: any
  ): Promise<void> {
    const database = await initSyncDB();
    const conflict = await database.get('sync_conflicts', conflictId);

    if (!conflict) {
      throw new Error('Conflict not found');
    }

    const recordId = conflictId.split(':')[1] + ':' + conflictId.split(':')[2];
    const record = await database.get('sync_data', recordId);
    const config = this.configs.get(conflict.entity)!;

    let finalData: any;

    switch (resolution) {
      case 'local':
        finalData = conflict.local_data;
        break;
      case 'server':
        finalData = conflict.server_data;
        break;
      case 'merged':
        finalData = mergedData || conflict.local_data;
        break;
    }

    if (record) {
      await database.put('sync_data', {
        ...record,
        local_data: config.encryptLocally ? encryptData(finalData) : finalData,
        status: resolution === 'server' ? 'synced' : 'pending_upload',
        conflict_resolution: 'resolved',
        checksum: calculateChecksum(finalData)
      });
    }

    await database.put('sync_conflicts', {
      ...conflict,
      resolved_at: new Date().toISOString(),
      resolution
    });

    console.log(`[OfflineSync] Conflict resolved: ${conflictId} -> ${resolution}`);
  }

  /**
   * Obtenir les conflits en attente
   */
  async getPendingConflicts(): Promise<Array<{
    id: string;
    entity: SyncableEntity;
    local_data: any;
    server_data: any;
    detected_at: string;
  }>> {
    const database = await initSyncDB();
    const all = await database.getAll('sync_conflicts');
    return all.filter(c => !c.resolved_at);
  }

  /**
   * Synchroniser toutes les entités
   */
  async syncAll(): Promise<void> {
    console.log('[OfflineSync] Starting full sync...');

    const entities = Array.from(this.configs.keys());

    for (const entity of entities) {
      await this.syncEntity(entity);
    }

    console.log('[OfflineSync] Full sync complete');
  }

  /**
   * Obtenir le statut de synchronisation
   */
  async getSyncStatus(): Promise<{
    isOnline: boolean;
    syncInProgress: SyncableEntity[];
    entities: SyncMetadata[];
    totalPending: number;
    totalConflicts: number;
  }> {
    const database = await initSyncDB();
    const metadata = await database.getAll('sync_metadata');
    const conflicts = await this.getPendingConflicts();

    const pending = await database.getAllFromIndex('sync_data', 'by-status', 'pending_upload');

    return {
      isOnline: navigator.onLine,
      syncInProgress: Array.from(this.syncInProgress),
      entities: metadata,
      totalPending: pending.length,
      totalConflicts: conflicts.length
    };
  }

  /**
   * Nettoyer les données expirées
   */
  async cleanup(): Promise<number> {
    const database = await initSyncDB();
    let deleted = 0;

    for (const [entity, config] of this.configs) {
      const cutoff = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000);
      const records = await database.getAllFromIndex('sync_data', 'by-entity', entity);

      for (const record of records) {
        if (
          record.status === 'synced' &&
          new Date(record.last_synced_at!) < cutoff
        ) {
          await database.delete('sync_data', record.id);
          deleted++;
        }
      }
    }

    console.log(`[OfflineSync] Cleaned up ${deleted} expired records`);
    return deleted;
  }

  /**
   * S'abonner aux événements de sync
   */
  subscribe(callback: (event: any) => void): () => void {
    const id = Math.random().toString(36).substring(2);
    this.listeners.set(id, callback);
    return () => this.listeners.delete(id);
  }

  private notifyListeners(event: any): void {
    this.listeners.forEach(callback => callback(event));
  }
}

// Instance singleton
export const offlineSyncService = new OfflineSyncService();

// Export par défaut
export default offlineSyncService;

/**
 * OFFLINE DATABASE - Stockage IndexedDB pour mode hors ligne
 * 224SOLUTIONS - Gestion des événements offline avec cryptage
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { encryptData, decryptData, generateSecureToken } from './encryption';

export interface OfflineEvent {
  client_event_id: string;
  type: string;
  data: any;
  vendor_id?: string;
  created_at: string;
  status: 'pending' | 'synced' | 'failed';
  error_message?: string;
  retry_count: number;
  encrypted: boolean;
}

interface CachedData {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  encrypted: boolean;
}

interface OfflineFile {
  id: string;
  event_id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64
  created_at: string;
}

interface OfflineDBSchema extends DBSchema {
  events: {
    key: string;
    value: OfflineEvent;
    indexes: {
      'by-status': string;
      'by-type': string;
      'by-created': string;
    };
  };
  cache: {
    key: string;
    value: CachedData;
  };
  files: {
    key: string;
    value: OfflineFile;
    indexes: {
      'by-event': string;
    };
  };
}

let db: IDBPDatabase<OfflineDBSchema> | null = null;
let dbInitPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

/**
 * Initialise la base de données IndexedDB
 */
async function initDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  // Si déjà initialisé, retourner l'instance
  if (db) return db;

  // Si une initialisation est en cours, attendre
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      // Vérifier si IndexedDB est disponible
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB non disponible dans ce navigateur');
      }

      db = await openDB<OfflineDBSchema>('224Solutions-OfflineDB', 3, {
        upgrade(database, oldVersion, newVersion, _transaction) {
          console.log(`📦 Mise à jour DB offline: v${oldVersion} -> v${newVersion}`);

          // Store pour les événements
          if (!database.objectStoreNames.contains('events')) {
            const eventStore = database.createObjectStore('events', {
              keyPath: 'client_event_id'
            });
            eventStore.createIndex('by-status', 'status');
            eventStore.createIndex('by-type', 'type');
            eventStore.createIndex('by-created', 'created_at');
          }

          // Store pour le cache
          if (!database.objectStoreNames.contains('cache')) {
            database.createObjectStore('cache', { keyPath: 'key' });
          }

          // Store pour les fichiers
          if (!database.objectStoreNames.contains('files')) {
            const fileStore = database.createObjectStore('files', { keyPath: 'id' });
            fileStore.createIndex('by-event', 'event_id');
          }
        },
        blocked() {
          console.warn('⚠️ Base de données bloquée par un autre onglet');
        },
        blocking() {
          // Fermer la connexion si une nouvelle version est disponible
          db?.close();
          db = null;
        },
        terminated() {
          console.warn('⚠️ Connexion à la base de données terminée de manière inattendue');
          db = null;
        }
      });

      console.log('✅ Base de données offline initialisée');
      return db;
    } catch (error: any) {
      console.error('❌ Erreur initialisation IndexedDB:', error);
      dbInitPromise = null;
      throw new Error(`Impossible d'initialiser le stockage offline: ${error.message || 'Erreur inconnue'}`);
    }
  })();

  return dbInitPromise;
}

/**
 * Stocke un événement pour synchronisation ultérieure (avec cryptage)
 */
async function storeEvent(
  event: Omit<OfflineEvent, 'client_event_id' | 'status' | 'retry_count' | 'encrypted'>,
  encrypt: boolean = true
): Promise<string> {
  try {
    const database = await initDB();
    const clientEventId = `evt_${Date.now()}_${generateSecureToken().substring(0, 12)}`;

    // S'assurer que created_at est présent
    const createdAt = event.created_at || new Date().toISOString();

    // Crypter les données sensibles (avec fallback si erreur)
    let eventData;
    try {
      eventData = encrypt ? encryptData(event.data) : event.data;
    } catch (encryptError) {
      console.warn('⚠️ Erreur cryptage, stockage non crypté:', encryptError);
      eventData = event.data;
      encrypt = false;
    }

    const fullEvent: OfflineEvent = {
      ...event,
      data: eventData,
      created_at: createdAt,
      client_event_id: clientEventId,
      status: 'pending',
      retry_count: 0,
      encrypted: encrypt
    };

    await database.put('events', fullEvent);
    console.log('📦 Événement stocké offline:', clientEventId, encrypt ? '(crypté)' : '(non crypté)');

    return clientEventId;
  } catch (error: any) {
    console.error('❌ Erreur storeEvent:', error);
    throw new Error(`Impossible de stocker l'événement offline: ${error.message || 'Erreur inconnue'}`);
  }
}

/**
 * Récupère tous les événements en attente (décryptés)
 */
async function getPendingEvents(): Promise<OfflineEvent[]> {
  const database = await initDB();
  const events = await database.getAllFromIndex('events', 'by-status', 'pending');

  // Décrypter les données
  return events.map(event => ({
    ...event,
    data: event.encrypted ? decryptData(event.data) : event.data
  }));
}

/**
 * Récupère les événements échoués
 */
async function getFailedEvents(): Promise<OfflineEvent[]> {
  const database = await initDB();
  const events = await database.getAllFromIndex('events', 'by-status', 'failed');

  return events.map(event => ({
    ...event,
    data: event.encrypted ? decryptData(event.data) : event.data
  }));
}

/**
 * Marque un événement comme synchronisé
 */
async function markEventAsSynced(clientEventId: string): Promise<void> {
  const database = await initDB();
  const event = await database.get('events', clientEventId);

  if (event) {
    event.status = 'synced';
    await database.put('events', event);
    console.log('✅ Événement synchronisé:', clientEventId);
  }
}

/**
 * Marque un événement comme échoué
 */
async function markEventAsFailed(clientEventId: string, errorMessage: string): Promise<void> {
  const database = await initDB();
  const event = await database.get('events', clientEventId);

  if (event) {
    event.status = 'failed';
    event.error_message = errorMessage;
    event.retry_count++;
    await database.put('events', event);
    console.log('❌ Événement échoué:', clientEventId, errorMessage);
  }
}

/**
 * Marque un événement à RÉESSAYER après un échec TRANSITOIRE (réseau, 5xx, timeout, auth).
 * IMPORTANT : NE PAS incrémenter retry_count → un incident temporaire ne doit jamais pousser
 * une VRAIE vente vers l'abandon. L'événement reste synchronisable indéfiniment (en silence).
 */
async function markEventForRetry(clientEventId: string, errorMessage: string): Promise<void> {
  const database = await initDB();
  const event = await database.get('events', clientEventId);

  if (event) {
    event.status = 'failed';
    event.error_message = errorMessage;
    // retry_count INCHANGÉ volontairement.
    await database.put('events', event);
  }
}

/**
 * Abandonne définitivement un événement (échec NON récupérable, ex : données corrompues).
 * On le marque 'failed' avec un retry_count terminal (>= MAX_SYNC_ATTEMPTS) pour qu'il soit
 * exclu des resynchronisations automatiques et du compteur "en attente" → plus de spam.
 */
async function abandonEvent(clientEventId: string, errorMessage: string): Promise<void> {
  const database = await initDB();
  const event = await database.get('events', clientEventId);

  if (event) {
    event.status = 'failed';
    event.error_message = errorMessage;
    event.retry_count = 999; // terminal : ne sera plus jamais retenté
    await database.put('events', event);
    console.warn('🛑 Événement abandonné (non récupérable):', clientEventId, errorMessage);
  }
}

/**
 * Réinitialise un événement échoué pour nouvelle tentative
 */
async function retryEvent(clientEventId: string): Promise<void> {
  const database = await initDB();
  const event = await database.get('events', clientEventId);

  if (event && event.retry_count < 5) {
    event.status = 'pending';
    await database.put('events', event);
    console.log('🔄 Événement réinitialisé pour retry:', clientEventId);
  }
}

/**
 * Supprime les événements synchronisés anciens (> 24h)
 */
async function cleanupSyncedEvents(): Promise<number> {
  const database = await initDB();
  const allEvents = await database.getAll('events');
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  let cleaned = 0;

  for (const event of allEvents) {
    const eventTime = new Date(event.created_at).getTime();
    if (event.status === 'synced' && eventTime < oneDayAgo) {
      await database.delete('events', event.client_event_id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 ${cleaned} événements anciens nettoyés`);
  }

  return cleaned;
}

/**
 * Obtient les statistiques des événements
 */
async function getEventStats(): Promise<{
  total: number;
  pending: number;
  synced: number;
  failed: number;
  by_type: Record<string, number>;
}> {
  const database = await initDB();
  const allEvents = await database.getAll('events');

  const stats = {
    total: allEvents.length,
    pending: 0,
    synced: 0,
    failed: 0,
    by_type: {} as Record<string, number>
  };

  for (const event of allEvents) {
    if (event.status === 'pending') stats.pending++;
    else if (event.status === 'synced') stats.synced++;
    else if (event.status === 'failed') stats.failed++;

    stats.by_type[event.type] = (stats.by_type[event.type] || 0) + 1;
  }

  return stats;
}

/**
 * Stocke des données en cache avec TTL (cryptées)
 */
async function cacheData(key: string, data: any, ttlMs: number = 3600000, encrypt: boolean = true): Promise<void> {
  try {
    const database = await initDB();

    // Crypter avec fallback
    let dataToStore = data;
    let wasEncrypted = encrypt;

    if (encrypt) {
      try {
        dataToStore = encryptData(data);
      } catch (encErr) {
        console.warn('⚠️ Erreur cryptage cache, stockage non crypté:', encErr);
        wasEncrypted = false;
      }
    }

    const cachedData: CachedData = {
      key,
      data: dataToStore,
      timestamp: Date.now(),
      ttl: ttlMs,
      encrypted: wasEncrypted
    };

    await database.put('cache', cachedData);
    console.log('💾 Données mises en cache:', key);
  } catch (error: any) {
    console.error('❌ Erreur cacheData:', error);
    // Ne pas propager l'erreur pour ne pas bloquer l'app
  }
}

/**
 * Récupère des données du cache (décryptées)
 */
async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const database = await initDB();
    const cached = await database.get('cache', key);

    if (!cached) return null;

    // Vérifier le TTL
    if (Date.now() - cached.timestamp > cached.ttl) {
      await database.delete('cache', key);
      return null;
    }

    // Décrypter si nécessaire
    try {
      const data = cached.encrypted ? decryptData(cached.data) : cached.data;
      return data as T;
    } catch (decryptError) {
      console.warn('⚠️ Erreur décryptage cache:', decryptError);
      // Essayer de retourner les données brutes
      return cached.data as T;
    }
  } catch (error: any) {
    console.error('❌ Erreur getCachedData:', error);
    return null;
  }
}

/**
 * Efface tout le cache
 */
async function clearCache(): Promise<void> {
  const database = await initDB();
  await database.clear('cache');
  console.log('🧹 Cache effacé');
}

/**
 * Récupère un événement par ID
 */
async function getEvent(clientEventId: string): Promise<OfflineEvent | undefined> {
  const database = await initDB();
  const event = await database.get('events', clientEventId);

  if (event && event.encrypted) {
    return {
      ...event,
      data: decryptData(event.data)
    };
  }

  return event;
}

/**
 * Supprime un événement
 */
async function deleteEvent(clientEventId: string): Promise<void> {
  const database = await initDB();
  await database.delete('events', clientEventId);
}

/**
 * Stocke un fichier en base64
 */
async function storeFile(file: File, eventId: string): Promise<string> {
  const database = await initDB();
  const fileId = `file_${Date.now()}_${generateSecureToken().substring(0, 8)}`;

  // Convertir le fichier en base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const offlineFile: OfflineFile = {
    id: fileId,
    event_id: eventId,
    name: file.name,
    type: file.type,
    size: file.size,
    data: encryptData(base64), // Crypter le fichier
    created_at: new Date().toISOString()
  };

  await database.put('files', offlineFile);
  console.log('📎 Fichier stocké offline:', fileId);

  return fileId;
}

/**
 * Récupère un fichier stocké
 */
async function getStoredFile(fileId: string): Promise<OfflineFile | undefined> {
  const database = await initDB();
  const file = await database.get('files', fileId);

  if (file) {
    return {
      ...file,
      data: decryptData(file.data)
    };
  }

  return file;
}

/**
 * Récupère les fichiers d'un événement
 */
async function getFilesByEvent(eventId: string): Promise<OfflineFile[]> {
  const database = await initDB();
  const files = await database.getAllFromIndex('files', 'by-event', eventId);

  return files.map(file => ({
    ...file,
    data: decryptData(file.data)
  }));
}

/**
 * Supprime un fichier stocké
 */
async function deleteStoredFile(fileId: string): Promise<void> {
  const database = await initDB();
  await database.delete('files', fileId);
}

/**
 * Récupère tous les fichiers stockés
 */
async function getAllStoredFiles(): Promise<OfflineFile[]> {
  const database = await initDB();
  const files = await database.getAll('files');

  return files.map(file => ({
    ...file,
    data: decryptData(file.data)
  }));
}

// Named exports pour compatibilité avec les imports destructurés
export {
  initDB,
  storeEvent,
  getPendingEvents,
  getFailedEvents,
  markEventAsSynced,
  markEventAsFailed,
  markEventForRetry,
  abandonEvent,
  retryEvent,
  cleanupSyncedEvents,
  getEventStats,
  cacheData,
  getCachedData,
  clearCache,
  getEvent,
  deleteEvent,
  storeFile,
  getStoredFile,
  getFilesByEvent,
  deleteStoredFile,
  getAllStoredFiles
};

// Export par défaut pour compatibilité
export default {
  initDB,
  storeEvent,
  getPendingEvents,
  getFailedEvents,
  markEventAsSynced,
  markEventAsFailed,
  markEventForRetry,
  abandonEvent,
  retryEvent,
  cleanupSyncedEvents,
  getEventStats,
  cacheData,
  getCachedData,
  clearCache,
  getEvent,
  deleteEvent,
  storeFile,
  getStoredFile,
  getFilesByEvent,
  deleteStoredFile,
  getAllStoredFiles
};

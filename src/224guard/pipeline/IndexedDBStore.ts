/**
 * 224Guard — persistance durable des alertes via IndexedDB (cf. garantie D4 : aucune
 * alerte CRITIQUE perdue). Fallback : si IndexedDB indisponible, utiliser MemoryStore.
 */

import { GUARD_CONFIG } from '../config';
import type { Alert224 } from '../core/types';
import type { PersistentStore } from './ResilientAlertQueue';

function reqToPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export class IndexedDBStore implements PersistentStore {
  private dbPromise: Promise<IDBDatabase>;

  constructor(
    private dbName = '224guard',
    private storeName = GUARD_CONFIG.queue.storeName,
  ) {
    this.dbPromise = this.open();
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(this.storeName)) {
          req.result.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbPromise;
    return db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async put(alert: Alert224): Promise<void> {
    await reqToPromise((await this.store('readwrite')).put(alert));
  }

  async delete(id: string): Promise<void> {
    await reqToPromise((await this.store('readwrite')).delete(id));
  }

  async all(): Promise<Alert224[]> {
    return (await reqToPromise((await this.store('readonly')).getAll())) as Alert224[];
  }
}

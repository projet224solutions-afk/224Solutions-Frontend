/**
 * GESTIONNAIRE DE SYNCHRONISATION OFFLINE
 * Module unifié pour la synchronisation des données hors ligne
 * 224SOLUTIONS - Interface Vendeur & Bureau Syndicat
 */

import localforage from 'localforage';
import { supabase } from '@/lib/supabaseClient';
import { encryptData, decryptData } from './encryption';
import _offlineDB from './offlineDB';
import dualSyncManager from './dualSyncManager';

// Configuration des stores locaux
const vendorStore = localforage.createInstance({
  name: '224Solutions',
  storeName: 'vendor_offline_data'
});

const bureauStore = localforage.createInstance({
  name: '224Solutions',
  storeName: 'bureau_offline_data'
});

export interface OfflineData {
  id: string;
  collection: string;
  data: any;
  sync: boolean;
  timestamp: number;
  retryCount: number;
  encrypted: boolean;
}

/**
 * Sauvegarde des données hors ligne avec cryptage
 */
export async function saveOffline(
  collection: string,
  data: any,
  storeType: 'vendor' | 'bureau' = 'vendor',
  encrypt: boolean = true
): Promise<void> {
  const store = storeType === 'vendor' ? vendorStore : bureauStore;
  const id = data.id || crypto.randomUUID();

  const offlineData: OfflineData = {
    id,
    collection,
    data: encrypt ? encryptData(data) : data,
    sync: false,
    timestamp: Date.now(),
    retryCount: 0,
    encrypted: encrypt
  };

  await store.setItem(`${collection}_${id}`, offlineData);

  // Tentative de synchronisation immédiate si en ligne
  if (navigator.onLine) {
    await syncSingleData(collection, id, storeType);
  }
}

/**
 * Synchronise une donnée unique
 */
async function syncSingleData(
  collection: string,
  id: string,
  storeType: 'vendor' | 'bureau'
): Promise<boolean> {
  const store = storeType === 'vendor' ? vendorStore : bureauStore;
  const key = `${collection}_${id}`;
  const offlineData = await store.getItem<OfflineData>(key);

  if (!offlineData || offlineData.sync) return true;

  try {
    const actualData = offlineData.encrypted
      ? decryptData(offlineData.data)
      : offlineData.data;

    // Synchronisation vers Supabase
    const { error } = await (supabase as any)
      .from(collection)
      .upsert(actualData, { onConflict: 'id' });

    if (error) throw error;

    // Synchronisation vers Firestore (si configuré)
    try {
      await dualSyncManager.syncSupabaseToFirestore(collection, actualData);
    } catch (firestoreError) {
      console.warn('Synchronisation Firestore échouée (non bloquant):', firestoreError);
    }

    // Marquer comme synchronisé
    offlineData.sync = true;
    await store.setItem(key, offlineData);

    console.log(`✅ Synchronisé: ${collection}/${id}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Erreur sync ${collection}/${id}:`, error);

    // Incrémenter le compteur de retry
    offlineData.retryCount++;
    await store.setItem(key, offlineData);

    return false;
  }
}

/**
 * Synchronise toutes les données en attente
 */
export async function syncAllData(
  storeType: 'vendor' | 'bureau' = 'vendor'
): Promise<{ success: number; failed: number }> {
  if (!navigator.onLine) {
    console.log('🔌 Mode hors ligne - synchronisation impossible');
    return { success: 0, failed: 0 };
  }

  const store = storeType === 'vendor' ? vendorStore : bureauStore;
  const keys = await store.keys();

  let success = 0;
  let failed = 0;

  for (const key of keys) {
    const offlineData = await store.getItem<OfflineData>(key);
    if (!offlineData || offlineData.sync) continue;

    const result = await syncSingleData(
      offlineData.collection,
      offlineData.id,
      storeType
    );

    if (result) {
      success++;
    } else {
      failed++;
    }

    // Pause pour éviter de surcharger le serveur
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✅ Synchronisation complète: ${success} réussies, ${failed} échouées`);
  return { success, failed };
}

/**
 * Récupère les statistiques de synchronisation
 */
export async function getSyncStats(
  storeType: 'vendor' | 'bureau' = 'vendor'
): Promise<{
  total: number;
  synced: number;
  pending: number;
  failed: number;
}> {
  const store = storeType === 'vendor' ? vendorStore : bureauStore;
  const keys = await store.keys();

  let synced = 0;
  let pending = 0;
  let failed = 0;

  for (const key of keys) {
    const offlineData = await store.getItem<OfflineData>(key);
    if (!offlineData) continue;

    if (offlineData.sync) {
      synced++;
    } else if (offlineData.retryCount > 3) {
      failed++;
    } else {
      pending++;
    }
  }

  return {
    total: keys.length,
    synced,
    pending,
    failed
  };
}

/**
 * Nettoie les données synchronisées anciennes (> 7 jours)
 */
export async function cleanupSyncedData(
  storeType: 'vendor' | 'bureau' = 'vendor'
): Promise<number> {
  const store = storeType === 'vendor' ? vendorStore : bureauStore;
  const keys = await store.keys();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  let cleaned = 0;

  for (const key of keys) {
    const offlineData = await store.getItem<OfflineData>(key);
    if (!offlineData) continue;

    if (offlineData.sync && offlineData.timestamp < sevenDaysAgo) {
      await store.removeItem(key);
      cleaned++;
    }
  }

  console.log(`🧹 Nettoyage: ${cleaned} entrées supprimées`);
  return cleaned;
}

/**
 * Vérifie les doublons avant synchronisation
 */
export async function checkDuplicate(
  collection: string,
  uniqueField: string,
  value: any
): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any)
      .from(collection)
      .select('id')
      .eq(uniqueField, value)
      .limit(1);

    if (error) throw error;
    return (data && data.length > 0);
  } catch (error) {
    console.error('Erreur vérification doublon:', error);
    return false;
  }
}

// Écouter les événements de connexion
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('🌐 Connexion rétablie - synchronisation en cours...');
    await syncAllData('vendor');
    await syncAllData('bureau');
  });

  window.addEventListener('offline', () => {
    console.log('🔌 Mode hors ligne activé - données stockées localement');
  });
}

export default {
  saveOffline,
  syncAllData,
  getSyncStats,
  cleanupSyncedData,
  checkDuplicate
};

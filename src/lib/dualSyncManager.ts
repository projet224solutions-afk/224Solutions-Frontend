/**
 * GESTIONNAIRE DE SYNCHRONISATION DUAL
 * Synchronisation bidirectionnelle Firestore ↔ Supabase
 * 224SOLUTIONS - Architecture hybride
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { firestore } from './firebaseClient';
import { supabase } from './supabaseClient';
import { encryptData, decryptData } from './encryption';
import { toast } from 'sonner';

export interface SyncConfig {
  collection: string;
  supabaseTable: string;
  uniqueField: string;
  encrypted: boolean;
  syncDirection: 'both' | 'firestore-to-supabase' | 'supabase-to-firestore';
}

/**
 * Configurations de synchronisation par type de données
 */
export const SYNC_CONFIGS: Record<string, SyncConfig> = {
  motos: {
    // CENTRALISÉ: Utilise la table vehicles au lieu de registered_motos
    collection: 'vehicles',
    supabaseTable: 'vehicles',
    uniqueField: 'serial_number',
    encrypted: true,
    syncDirection: 'both'
  },
  sales: {
    collection: 'sales',
    supabaseTable: 'sales',
    uniqueField: 'id',
    encrypted: true,
    syncDirection: 'both'
  },
  members: {
    // CENTRALISÉ: Utilise syndicate_workers au lieu de members
    collection: 'syndicate_workers',
    supabaseTable: 'syndicate_workers',
    uniqueField: 'telephone',
    encrypted: false,
    syncDirection: 'both'
  },
  security_alerts: {
    // CENTRALISÉ: Utilise vehicle_security_log au lieu de moto_security_alerts
    collection: 'vehicle_security_log',
    supabaseTable: 'vehicle_security_log',
    uniqueField: 'id',
    encrypted: false,
    syncDirection: 'both'
  }
};

/**
 * Synchronise une donnée de Firestore vers Supabase
 */
export async function syncFirestoreToSupabase(
  configKey: string,
  data: any
): Promise<{ success: boolean; error?: string }> {
  const config = SYNC_CONFIGS[configKey];
  if (!config) {
    return { success: false, error: 'Configuration invalide' };
  }

  try {
    // Décrypter si nécessaire
    const actualData = config.encrypted ? decryptData(data) : data;

    // Vérifier si l'entrée existe déjà dans Supabase
    const { data: _existing, error: checkError } = await (supabase as any)
      .from(config.supabaseTable)
      .select('id')
      .eq(config.uniqueField, actualData[config.uniqueField])
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    // Préparer les données pour Supabase
    const supabaseData = {
      ...actualData,
      synced_from_firestore: true,
      last_firestore_sync: new Date().toISOString()
    };

    // Upsert dans Supabase
    const { error: upsertError } = await (supabase as any)
      .from(config.supabaseTable)
      .upsert(supabaseData, { onConflict: config.uniqueField });

    if (upsertError) throw upsertError;

    console.log(`✅ Sync Firestore → Supabase: ${configKey}`, actualData.id);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Erreur sync Firestore → Supabase:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Synchronise une donnée de Supabase vers Firestore
 */
export async function syncSupabaseToFirestore(
  configKey: string,
  data: any
): Promise<{ success: boolean; error?: string }> {
  const config = SYNC_CONFIGS[configKey];
  if (!config) {
    return { success: false, error: 'Configuration invalide' };
  }

  try {
    // Crypter si nécessaire
    const firestoreData = config.encrypted ? {
      ...data,
      encrypted: true,
      data: encryptData(data)
    } : data;

    // Créer la référence Firestore
    const docRef = doc(firestore, config.collection, data.id);

    // Ajouter les métadonnées de sync
    const finalData = {
      ...firestoreData,
      synced_from_supabase: true,
      last_supabase_sync: Timestamp.now()
    };

    // Sauvegarder dans Firestore
    await setDoc(docRef, finalData, { merge: true });

    console.log(`✅ Sync Supabase → Firestore: ${configKey}`, data.id);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Erreur sync Supabase → Firestore:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Synchronisation bidirectionnelle complète
 */
export async function syncBidirectional(
  configKey: string,
  data: any,
  source: 'firestore' | 'supabase'
): Promise<{ success: boolean; error?: string }> {
  const config = SYNC_CONFIGS[configKey];

  if (config.syncDirection === 'both') {
    if (source === 'firestore') {
      return await syncFirestoreToSupabase(configKey, data);
    } else {
      return await syncSupabaseToFirestore(configKey, data);
    }
  } else if (config.syncDirection === 'firestore-to-supabase' && source === 'firestore') {
    return await syncFirestoreToSupabase(configKey, data);
  } else if (config.syncDirection === 'supabase-to-firestore' && source === 'supabase') {
    return await syncSupabaseToFirestore(configKey, data);
  }

  return { success: false, error: 'Direction de sync non autorisée' };
}

/**
 * Écoute les changements Firestore en temps réel et synchronise vers Supabase
 */
export function listenFirestoreChanges(
  configKey: string,
  callback?: (data: any) => void
): () => void {
  const config = SYNC_CONFIGS[configKey];
  if (!config || !firestore) return () => {};

  const collectionRef = collection(firestore, config.collection);

  const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      const data: any = { id: change.doc.id, ...change.doc.data() };

      if (change.type === 'added' || change.type === 'modified') {
        // Éviter les boucles infinies
        if (!data.synced_from_supabase) {
          await syncFirestoreToSupabase(configKey, data);
          callback?.(data);
        }
      }
    });
  });

  return unsubscribe;
}

/**
 * Écoute les changements Supabase en temps réel et synchronise vers Firestore
 */
export function listenSupabaseChanges(
  configKey: string,
  callback?: (data: any) => void
): () => void {
  const config = SYNC_CONFIGS[configKey];
  if (!config) return () => {};

  const channel = (supabase as any)
    .channel(`${config.supabaseTable}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: config.supabaseTable
      },
      async (payload: any) => {
        const data = payload.new || payload.old;

        // Éviter les boucles infinies
        if (!data.synced_from_firestore) {
          if (payload.eventType === 'DELETE') {
            // Supprimer de Firestore
            const docRef = doc(firestore, config.collection, data.id);
            await deleteDoc(docRef);
          } else {
            await syncSupabaseToFirestore(configKey, data);
          }
          callback?.(data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Initialise la synchronisation bidirectionnelle pour toutes les collections
 */
export function initializeDualSync() {
  const unsubscribers: Array<() => void> = [];

  Object.keys(SYNC_CONFIGS).forEach((configKey) => {
    // Écouter Firestore → Supabase
    const unsubFirestore = listenFirestoreChanges(configKey, (data) => {
      console.log(`🔄 Changement Firestore détecté: ${configKey}`, data.id);
    });

    // Écouter Supabase → Firestore
    const unsubSupabase = listenSupabaseChanges(configKey, (data) => {
      console.log(`🔄 Changement Supabase détecté: ${configKey}`, data.id);
    });

    unsubscribers.push(unsubFirestore, unsubSupabase);
  });

  toast.success('🔄 Synchronisation bidirectionnelle activée', {
    description: 'Firestore ↔ Supabase'
  });

  // Retourner une fonction pour nettoyer tous les listeners
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

/**
 * Vérifie si une donnée existe dans Firestore
 */
export async function checkFirestoreExists(
  configKey: string,
  uniqueValue: any
): Promise<boolean> {
  const config = SYNC_CONFIGS[configKey];
  if (!config || !firestore) return false;

  try {
    const q = query(
      collection(firestore, config.collection),
      where(config.uniqueField, '==', uniqueValue)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Erreur vérification Firestore:', error);
    return false;
  }
}

/**
 * Synchronisation manuelle complète (toutes les données)
 */
export async function fullSync(
  direction: 'firestore-to-supabase' | 'supabase-to-firestore'
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const [configKey, config] of Object.entries(SYNC_CONFIGS)) {
    try {
      if (direction === 'firestore-to-supabase') {
        // Récupérer toutes les données de Firestore
        const snapshot = await getDocs(collection(firestore, config.collection));

        for (const doc of snapshot.docs) {
          const data = { id: doc.id, ...doc.data() };
          const result = await syncFirestoreToSupabase(configKey, data);

          if (result.success) success++;
          else failed++;

          // Pause pour éviter de surcharger
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        // Récupérer toutes les données de Supabase
        const { data, error } = await (supabase as any)
          .from(config.supabaseTable)
          .select('*');

        if (error) throw error;

        for (const item of data || []) {
          const result = await syncSupabaseToFirestore(configKey, item);

          if (result.success) success++;
          else failed++;

          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error(`Erreur sync complète ${configKey}:`, error);
      failed++;
    }
  }

  toast.success(`✅ Synchronisation complète: ${success} réussies, ${failed} échouées`);
  return { success, failed };
}

export default {
  syncFirestoreToSupabase,
  syncSupabaseToFirestore,
  syncBidirectional,
  listenFirestoreChanges,
  listenSupabaseChanges,
  initializeDualSync,
  checkFirestoreExists,
  fullSync
};

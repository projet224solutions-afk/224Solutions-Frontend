/**
 * HOOK DE SYNCHRONISATION OFFLINE
 * Gestion automatique de la synchronisation des données hors-ligne avec Supabase
 * 224SOLUTIONS - Interface Vendeur
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import offlineDB from '@/lib/offlineDB';

const SYNC_INTERVAL = 30000; // 30 secondes
const _MAX_BATCH_SIZE = 10;
const MAX_RETRY_COUNT = 5;

export interface SyncStats {
  total: number;
  pending: number;
  synced: number;
  failed: number;
}

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats>({
    total: 0,
    pending: 0,
    synced: 0,
    failed: 0
  });
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);

  /**
   * Met à jour les statistiques de synchronisation
   */
  const updateSyncStats = useCallback(async () => {
    try {
      const stats = await offlineDB.getEventStats();
      setSyncStats(stats);
    } catch (error) {
      console.error('Erreur mise à jour stats sync:', error);
    }
  }, []);

  /**
   * Synchronise un événement avec Supabase
   */
  const syncEventToSupabase = useCallback(async (event: any): Promise<boolean> => {
    try {
      const { type, data, vendor_id } = event;

      switch (type) {
        case 'sale': {
          // Utiliser la nouvelle table sales
          const { error } = await supabase
            .from('sales')
            .insert({
              vendor_id,
              product_name: data.product_name,
              product_id: data.product_id || null,
              quantity: data.quantity || 1,
              unit_price: data.unit_price,
              total_amount: data.amount,
              customer_name: data.customer_name,
              customer_phone: data.customer_phone,
              payment_method: data.payment_method || 'cash',
              payment_status: 'paid',
              status: 'completed',
              offline_sync: true,
              metadata: { original_date: data.sale_date },
              created_at: data.sale_date || new Date().toISOString()
            });

          if (error) {
            console.error('Erreur sync sale:', error);
            return false;
          }
          console.log('✅ Vente synchronisée vers sales');
          return true;
        }

        case 'payment': {
          // Utiliser la nouvelle table vendor_transactions
          const { error } = await supabase
            .from('vendor_transactions')
            .insert({
              vendor_id,
              type: 'payment',
              amount: data.amount,
              currency: 'XOF',
              status: 'completed',
              payment_method: data.payment_method,
              description: `Paiement ${data.payment_method}`,
              offline_sync: true,
              metadata: {
                sale_id: data.sale_id,
                original_date: data.payment_date
              },
              created_at: data.payment_date || new Date().toISOString()
            });

          if (error) {
            console.error('Erreur sync payment:', error);
            return false;
          }
          console.log('✅ Paiement synchronisé vers vendor_transactions');
          return true;
        }

        case 'invoice': {
          // Utiliser la bonne structure pour invoices
          const invoiceRef = data.invoice_number || `INV-${Date.now().toString(36).toUpperCase()}`;
          const { error } = await supabase
            .from('invoices')
            .insert({
              ref: invoiceRef,
              vendor_id,
              client_name: data.customer_name,
              client_email: data.customer_email,
              client_phone: data.customer_phone,
              items: data.items || [],
              subtotal: data.subtotal || data.total_amount,
              tax: data.tax_amount || 0,
              discount: 0,
              total: data.total_amount,
              status: 'pending',
              due_date: data.due_date,
              notes: data.notes || 'Créée en mode hors-ligne'
            });

          if (error) {
            console.error('Erreur sync invoice:', error);
            return false;
          }
          console.log('✅ Facture synchronisée vers invoices');
          return true;
        }

        case 'receipt':
        case 'upload':
          // Ces types sont gérés séparément ou stockés localement
          console.log(`📄 ${type} stocké localement:`, data);
          return true;

        default:
          console.warn('Type d\'événement non géré:', type);
          return true;
      }

    } catch (error) {
      console.error('Erreur sync événement:', error);
      return false;
    }
  }, []);

  /**
   * Synchronise tous les événements en attente
   */
  const syncAllPendingEvents = useCallback(async () => {
    if (!isOnline || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncErrors([]);

    try {
      // Récupérer les événements en attente
      const pendingEvents = await offlineDB.getPendingEvents();

      if (pendingEvents.length === 0) {
        setIsSyncing(false);
        return;
      }

      console.log(`🔄 Synchronisation de ${pendingEvents.length} événements...`);

      let syncedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Traiter les événements un par un
      for (const event of pendingEvents) {
        try {
          const success = await syncEventToSupabase(event);

          if (success) {
            await offlineDB.markEventAsSynced(event.client_event_id);
            syncedCount++;
          } else {
            if (event.retry_count >= MAX_RETRY_COUNT) {
              await offlineDB.markEventAsFailed(event.client_event_id, 'Max retries atteint');
              failedCount++;
              errors.push(`Événement ${event.type}: Max retries atteint`);
            } else {
              await offlineDB.markEventAsFailed(event.client_event_id, 'Erreur de synchronisation');
            }
          }
        } catch (error: any) {
          console.error('Erreur sync événement:', error);
          await offlineDB.markEventAsFailed(event.client_event_id, error.message);
          failedCount++;
          errors.push(`${event.type}: ${error.message}`);
        }

        // Pause pour éviter de surcharger
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Synchroniser les fichiers
      try {
        const storedFiles = await offlineDB.getAllStoredFiles();
        for (const fileData of storedFiles) {
          try {
            // Convertir base64 en blob et uploader vers Supabase Storage
            const base64Response = await fetch(fileData.data);
            const blob = await base64Response.blob();

            const filePath = `offline/${fileData.event_id}/${fileData.name}`;
            const { error } = await supabase.storage
              .from('uploads')
              .upload(filePath, blob, { upsert: true });

            if (!error) {
              await offlineDB.deleteStoredFile(fileData.id);
              syncedCount++;
            } else {
              console.error('Erreur upload fichier:', error);
            }
          } catch (fileError: any) {
            console.error('Erreur sync fichier:', fileError);
            errors.push(`Fichier ${fileData.name}: ${fileError.message}`);
          }
        }
      } catch (error) {
        console.error('Erreur sync fichiers:', error);
      }

      // Mettre à jour les statistiques
      await updateSyncStats();
      setLastSyncTime(new Date().toISOString());

      // Afficher les résultats
      if (syncedCount > 0) {
        toast.success(`✅ Synchronisation réussie`, {
          description: `${syncedCount} éléments synchronisés`
        });
      }

      if (failedCount > 0) {
        setSyncErrors(errors);
        toast.error(`⚠️ ${failedCount} éléments non synchronisés`, {
          description: 'Vérifiez votre connexion et réessayez'
        });
      }

      // Nettoyer les anciens événements synchronisés
      await offlineDB.cleanupSyncedEvents();

    } catch (error: any) {
      console.error('Erreur synchronisation générale:', error);
      toast.error('❌ Erreur de synchronisation', {
        description: error.message
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, syncEventToSupabase, updateSyncStats]);

  /**
   * Force la synchronisation manuelle
   */
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      toast.error('❌ Pas de connexion Internet', {
        description: 'Vérifiez votre connexion et réessayez'
      });
      return;
    }

    await syncAllPendingEvents();
  }, [isOnline, syncAllPendingEvents]);

  /**
   * Stocke un événement hors-ligne
   */
  const storeOfflineEvent = useCallback(async (eventData: any): Promise<string> => {
    try {
      const eventId = await offlineDB.storeEvent({
        type: eventData.type,
        data: eventData.data,
        vendor_id: eventData.vendor_id,
        created_at: new Date().toISOString()
      }, true); // Toujours crypter

      await updateSyncStats();

      // Si en ligne, essayer de synchroniser immédiatement
      if (isOnline) {
        setTimeout(() => syncAllPendingEvents(), 1000);
      }

      return eventId;
    } catch (error) {
      console.error('Erreur stockage événement offline:', error);
      throw error;
    }
  }, [isOnline, updateSyncStats, syncAllPendingEvents]);

  /**
   * Stocke un fichier hors-ligne
   */
  const storeOfflineFile = useCallback(async (file: File, eventId: string): Promise<string> => {
    try {
      const fileId = await offlineDB.storeFile(file, eventId);
      return fileId;
    } catch (error) {
      console.error('Erreur stockage fichier offline:', error);
      throw error;
    }
  }, []);

  /**
   * Écoute les changements de statut de connexion
   */
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Connexion rétablie');
      toast.success('🌐 Connexion rétablie', {
        description: 'Synchronisation automatique en cours...'
      });
      // Délai pour laisser le temps à la connexion de se stabiliser
      setTimeout(() => syncAllPendingEvents(), 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📡 Mode hors-ligne activé');
      toast.info('📡 Mode hors-ligne', {
        description: 'Vos données seront synchronisées à la reconnexion'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncAllPendingEvents]);

  /**
   * Initialise la synchronisation automatique
   */
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;

      // Initialiser la base de données
      offlineDB.initDB().then(() => {
        updateSyncStats();
        console.log('✅ Système offline initialisé');
      });

      // Synchronisation automatique périodique
      if (isOnline) {
        syncIntervalRef.current = setInterval(() => {
          if (isOnline && !isSyncing) {
            syncAllPendingEvents();
          }
        }, SYNC_INTERVAL);
      }
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, isSyncing, updateSyncStats, syncAllPendingEvents]);

  /**
   * Nettoie les erreurs de synchronisation
   */
  const clearSyncErrors = useCallback(() => {
    setSyncErrors([]);
  }, []);

  /**
   * Récupère l'historique de synchronisation
   */
  const getSyncHistory = useCallback(async () => {
    try {
      const pendingEvents = await offlineDB.getPendingEvents();
      const failedEvents = await offlineDB.getFailedEvents();
      return [...pendingEvents, ...failedEvents].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('Erreur récupération historique:', error);
      return [];
    }
  }, []);

  /**
   * Réessaye les événements échoués
   */
  const retryFailedEvents = useCallback(async () => {
    try {
      const failedEvents = await offlineDB.getFailedEvents();
      for (const event of failedEvents) {
        if (event.retry_count < MAX_RETRY_COUNT) {
          await offlineDB.retryEvent(event.client_event_id);
        }
      }
      await updateSyncStats();

      if (isOnline) {
        await syncAllPendingEvents();
      }
    } catch (error) {
      console.error('Erreur retry événements:', error);
    }
  }, [isOnline, updateSyncStats, syncAllPendingEvents]);

  return {
    // État de la connexion
    isOnline,
    isSyncing,

    // Statistiques
    syncStats,
    lastSyncTime,
    syncErrors,

    // Actions
    forceSync,
    storeOfflineEvent,
    storeOfflineFile,
    clearSyncErrors,
    getSyncHistory,
    updateSyncStats,
    retryFailedEvents,

    // Utilitaires
    hasPendingEvents: syncStats.pending > 0,
    hasFailedEvents: syncStats.failed > 0
  };
};

export default useOfflineSync;

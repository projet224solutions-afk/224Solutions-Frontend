/**
 * Sync Scheduler - Planificateur de synchronisation automatique
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Gère la planification intelligente des synchronisations en fonction de:
 * - La connectivité réseau
 * - La priorité des données
 * - L'activité de l'utilisateur
 * - La batterie (pour mobile)
 */

import { SyncableEntity } from '@/lib/offlineSyncService';
import { globalSyncQueue, SyncPriority } from './advancedSyncEngine';

/**
 * Configuration du planificateur
 */
export interface SchedulerConfig {
  enabled: boolean;
  minInterval: number;         // Interval minimum entre syncs (ms)
  maxInterval: number;         // Interval maximum si pas d'activité (ms)
  adaptiveInterval: boolean;   // Ajuster l'interval selon l'activité
  syncOnReconnect: boolean;    // Sync immédiat au retour en ligne
  syncOnVisibilityChange: boolean; // Sync quand l'onglet redevient visible
  respectBattery: boolean;     // Pause sync si batterie faible
  batteryThreshold: number;    // Seuil batterie (%)
}

const DEFAULT_CONFIG: SchedulerConfig = {
  enabled: true,
  minInterval: 10000,          // 10 secondes minimum
  maxInterval: 300000,         // 5 minutes maximum
  adaptiveInterval: true,
  syncOnReconnect: true,
  syncOnVisibilityChange: true,
  respectBattery: true,
  batteryThreshold: 15         // 15% batterie
};

/**
 * Priorités de sync par entité avec fréquence recommandée
 */
const SYNC_FREQUENCIES: Record<SyncableEntity, number> = {
  pos_sales: 5000,        // 5 secondes - critique
  orders: 30000,          // 30 secondes
  vendor_products: 60000, // 1 minute
  products: 300000,       // 5 minutes
  cart_items: 60000,      // 1 minute
  user_addresses: 600000, // 10 minutes
  favorites: 600000,      // 10 minutes
  messages: 30000,        // 30 secondes
  notifications: 60000,   // 1 minute
  reviews: 300000,        // 5 minutes
  settings: 600000        // 10 minutes
};

/**
 * Classe du planificateur de sync
 */
export class SyncScheduler {
  private config: SchedulerConfig;
  private timers: Map<SyncableEntity, NodeJS.Timeout> = new Map();
  private lastSync: Map<SyncableEntity, Date> = new Map();
  private isOnline: boolean = navigator.onLine;
  private isPaused: boolean = false;
  private masterTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupListeners();
  }

  /**
   * Configurer les listeners d'événements
   */
  private setupListeners(): void {
    // Écouter les changements de connectivité
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Écouter les changements de visibilité
    if (this.config.syncOnVisibilityChange) {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.handleVisibilityChange();
        }
      });
    }

    // Écouter l'état de la batterie (si disponible)
    if (this.config.respectBattery && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        battery.addEventListener('levelchange', () => {
          this.handleBatteryChange(battery.level * 100);
        });
      });
    }
  }

  /**
   * Gérer le retour en ligne
   */
  private handleOnline(): void {
    console.log('[SyncScheduler] Connexion rétablie');
    this.isOnline = true;

    if (this.config.syncOnReconnect) {
      console.log('[SyncScheduler] Sync immédiat après reconnexion');
      this.syncAll(SyncPriority.CRITICAL); // Sync immédiat des données critiques
    }

    this.resume();
  }

  /**
   * Gérer le passage hors ligne
   */
  private handleOffline(): void {
    console.log('[SyncScheduler] Connexion perdue');
    this.isOnline = false;
    this.pause();
  }

  /**
   * Gérer le retour de visibilité de l'onglet
   */
  private handleVisibilityChange(): void {
    if (!this.isOnline) return;

    console.log('[SyncScheduler] Onglet redevenu visible, sync...');

    // Sync les entités qui n'ont pas été sync depuis > 1 minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    this.lastSync.forEach((lastSyncDate, entity) => {
      if (lastSyncDate < oneMinuteAgo) {
        this.scheduleEntitySync(entity);
      }
    });
  }

  /**
   * Gérer les changements de batterie
   */
  private handleBatteryChange(level: number): void {
    console.log(`[SyncScheduler] Batterie: ${level}%`);

    if (level < this.config.batteryThreshold) {
      console.log('[SyncScheduler] Batterie faible, pause sync');
      this.pause();
    } else if (this.isPaused && level > this.config.batteryThreshold + 5) {
      console.log('[SyncScheduler] Batterie OK, reprise sync');
      this.resume();
    }
  }

  /**
   * Démarrer le planificateur
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('[SyncScheduler] Désactivé');
      return;
    }

    console.log('[SyncScheduler] Démarrage');

    // Planifier chaque entité selon sa fréquence
    Object.entries(SYNC_FREQUENCIES).forEach(([entity, frequency]) => {
      this.scheduleEntitySync(entity as SyncableEntity, frequency);
    });

    // Timer maître pour vérifier l'état global
    this.masterTimer = setInterval(() => {
      this.checkAndSync();
    }, this.config.minInterval);
  }

  /**
   * Arrêter le planificateur
   */
  stop(): void {
    console.log('[SyncScheduler] Arrêt');

    // Arrêter tous les timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();

    if (this.masterTimer) {
      clearInterval(this.masterTimer);
      this.masterTimer = null;
    }
  }

  /**
   * Mettre en pause (garde les timers mais ne sync pas)
   */
  pause(): void {
    console.log('[SyncScheduler] Pause');
    this.isPaused = true;
  }

  /**
   * Reprendre après pause
   */
  resume(): void {
    console.log('[SyncScheduler] Reprise');
    this.isPaused = false;
  }

  /**
   * Planifier la sync d'une entité spécifique
   */
  private scheduleEntitySync(entity: SyncableEntity, frequency?: number): void {
    // Annuler le timer existant si présent
    const existingTimer = this.timers.get(entity);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const freq = frequency || SYNC_FREQUENCIES[entity] || this.config.minInterval;

    const timer = setInterval(() => {
      if (!this.isPaused && this.isOnline) {
        this.syncEntity(entity);
      }
    }, freq);

    this.timers.set(entity, timer);
    console.log(`[SyncScheduler] ${entity} planifié (freq: ${freq}ms)`);
  }

  /**
   * Synchroniser une entité spécifique
   */
  private async syncEntity(entity: SyncableEntity): Promise<void> {
    // Marquer comme synchronisé
    this.lastSync.set(entity, new Date());

    // Pour les ventes POS, appeler les vrais moteurs de sync (vendeur ET caisse restaurant).
    // Les deux puisent dans IndexedDB local (même appareil = même propriétaire) ; chacun ne
    // traite que SES événements (type 'sale'/'credit_sale' vs 'restaurant_pos_sale').
    if (entity === 'pos_sales') {
      try {
        const { syncOfflinePosSales } = await import('@/lib/offlinePosSync');
        const result = await syncOfflinePosSales();
        if (result.total > 0) {
          console.log(`[SyncScheduler] ✅ pos_sales sync: ${result.synced}/${result.total} synchronisées`);
        }
      } catch (err) {
        console.warn(`[SyncScheduler] ⚠️ Erreur sync pos_sales:`, err);
      }
      try {
        const { syncOfflineRestaurantSales } = await import('@/lib/offlineRestaurantSync');
        const rResult = await syncOfflineRestaurantSales();
        if (rResult.total > 0) {
          console.log(`[SyncScheduler] ✅ restaurant POS sync: ${rResult.synced}/${rResult.total} synchronisées`);
        }
      } catch (err) {
        console.warn(`[SyncScheduler] ⚠️ Erreur sync restaurant POS:`, err);
      }
      try {
        const { syncOfflinePharmacySales } = await import('@/lib/offlinePharmacySync');
        const pResult = await syncOfflinePharmacySales();
        if (pResult.total > 0) {
          console.log(`[SyncScheduler] ✅ pharmacy POS sync: ${pResult.synced}/${pResult.total} synchronisées`);
        }
      } catch (err) {
        console.warn(`[SyncScheduler] ⚠️ Erreur sync pharmacie POS:`, err);
      }
      return;
    }

    // Pour les autres entités, déqueuer si disponible
    if (globalSyncQueue.length > 0) {
      const item = globalSyncQueue.dequeue();
      if (item && item.entity === entity) {
        console.log(`[SyncScheduler] Processing queued ${entity}`);
      }
    }
  }

  /**
   * Vérifier et synchroniser si nécessaire
   */
  private checkAndSync(): void {
    if (this.isPaused || !this.isOnline) return;

    // Vérifier la queue et traiter les items prioritaires
    if (globalSyncQueue.length > 0) {
      const item = globalSyncQueue.dequeue();
      if (item) {
        console.log(`[SyncScheduler] Processing queued item: ${item.entity}`);
        // TODO: Sync l'item via offlineSyncService
      }
    }
  }

  /**
   * Synchroniser toutes les entités d'une priorité donnée
   */
  private syncAll(_priority: SyncPriority): void {
    Object.entries(SYNC_FREQUENCIES).forEach(([entity]) => {
      this.syncEntity(entity as SyncableEntity);
    });
  }

  /**
   * Obtenir les statistiques du planificateur
   */
  getStats() {
    return {
      isOnline: this.isOnline,
      isPaused: this.isPaused,
      activeTimers: this.timers.size,
      lastSyncs: Object.fromEntries(this.lastSync),
      queueLength: globalSyncQueue.length,
      queueStats: globalSyncQueue.getStats()
    };
  }

  /**
   * Forcer une sync immédiate de toutes les entités
   */
  forceSyncAll(): void {
    console.log('[SyncScheduler] Force sync ALL');
    this.syncAll(SyncPriority.CRITICAL);
  }

  /**
   * Forcer une sync immédiate d'une entité
   */
  forceSyncEntity(entity: SyncableEntity): void {
    console.log(`[SyncScheduler] Force sync ${entity}`);
    this.syncEntity(entity);
  }
}

// Instance globale du planificateur
let globalScheduler: SyncScheduler | null = null;

/**
 * Obtenir ou créer l'instance globale du planificateur
 */
export function getScheduler(config?: Partial<SchedulerConfig>): SyncScheduler {
  if (!globalScheduler) {
    globalScheduler = new SyncScheduler(config);
  }
  return globalScheduler;
}

/**
 * Démarrer la synchronisation automatique
 */
export function startScheduledSync(config?: Partial<SchedulerConfig>): SyncScheduler {
  const scheduler = getScheduler(config);
  scheduler.start();
  return scheduler;
}

/**
 * Arrêter la synchronisation automatique
 */
export function stopScheduledSync(): void {
  if (globalScheduler) {
    globalScheduler.stop();
  }
}

export default {
  SyncScheduler,
  getScheduler,
  startScheduledSync,
  stopScheduledSync
};

/**
 * Conflict Resolver - Résolution intelligente de conflits de synchronisation
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Stratégies avancées de résolution de conflits pour différents types de données
 */

import { calculateChecksum } from './advancedSyncEngine';

export type ConflictStrategy = 'server-wins' | 'client-wins' | 'merge' | 'manual' | 'smart-merge';

/**
 * Résultat de la résolution de conflit
 */
export interface ConflictResolution<T = any> {
  resolved: boolean;
  data: T;
  strategy: ConflictStrategy;
  requiresManualReview: boolean;
  changes: string[];
  metadata: {
    localVersion: string;
    serverVersion: string;
    resolvedAt: Date;
  };
}

/**
 * Contexte pour la résolution de conflit
 */
export interface ConflictContext<T = any> {
  localData: T;
  serverData: T;
  baseData?: T;  // Version de base si disponible (pour 3-way merge)
  localModified: Date;
  serverModified: Date;
  entity: string;
}

/**
 * Résolveur de conflits pour ventes POS
 * Stratégie: Client-wins car la vente est finale une fois enregistrée localement
 */
export async function resolvePOSSaleConflict<T = any>(
  context: ConflictContext<T>
): Promise<ConflictResolution<T>> {
  const { localData, serverData, localModified, serverModified } = context;

  // Pour les ventes POS, la version locale prime TOUJOURS
  // Car elle représente une transaction physique déjà effectuée
  return {
    resolved: true,
    data: localData,
    strategy: 'client-wins',
    requiresManualReview: false,
    changes: ['Vente POS: version locale conservée (transaction finale)'],
    metadata: {
      localVersion: await calculateChecksum(localData),
      serverVersion: await calculateChecksum(serverData),
      resolvedAt: new Date()
    }
  };
}

/**
 * Résolveur de conflits pour stock
 * Stratégie: Smart merge - déduire les ventes locales du stock serveur
 */
export async function resolveStockConflict<T extends { quantity?: number; product_id?: string }>(
  context: ConflictContext<T>,
  localSalesCount: number = 0
): Promise<ConflictResolution<T>> {
  const { localData, serverData } = context;

  // Le serveur a la source de vérité pour le stock total
  // MAIS on doit déduire les ventes effectuées localement
  const adjustedQuantity = (serverData.quantity || 0) - localSalesCount;

  const mergedData: T = {
    ...serverData,
    quantity: Math.max(0, adjustedQuantity), // Ne jamais descendre en dessous de 0
    last_sync: new Date().toISOString(),
    sync_source: 'smart-merge'
  } as T;

  return {
    resolved: true,
    data: mergedData,
    strategy: 'smart-merge',
    requiresManualReview: adjustedQuantity < 0, // Review si stock négatif
    changes: [
      `Stock serveur: ${serverData.quantity}`,
      `Ventes locales: ${localSalesCount}`,
      `Stock ajusté: ${adjustedQuantity}`
    ],
    metadata: {
      localVersion: await calculateChecksum(localData),
      serverVersion: await calculateChecksum(serverData),
      resolvedAt: new Date()
    }
  };
}

/**
 * Résolveur de conflits pour produits
 * Stratégie: Server-wins pour données générales, client-wins pour stock local
 */
export async function resolveProductConflict<T extends {
  stock?: number;
  price?: number;
  name?: string;
  description?: string;
}>(
  context: ConflictContext<T>
): Promise<ConflictResolution<T>> {
  const { localData, serverData, localModified, serverModified } = context;

  // Merge intelligent: info produit du serveur, mais stock local si plus récent
  const mergedData: T = {
    ...serverData,  // Info produit (nom, description, prix) du serveur
    stock: localModified > serverModified
      ? localData.stock
      : serverData.stock,  // Stock le plus récent
    last_local_update: localModified.toISOString()
  } as T;

  return {
    resolved: true,
    data: mergedData,
    strategy: 'smart-merge',
    requiresManualReview: false,
    changes: [
      'Informations produit: serveur',
      `Stock: ${localModified > serverModified ? 'local' : 'serveur'}`
    ],
    metadata: {
      localVersion: await calculateChecksum(localData),
      serverVersion: await calculateChecksum(serverData),
      resolvedAt: new Date()
    }
  };
}

/**
 * Résolveur de conflits pour paramètres
 * Stratégie: Client-wins car ce sont les préférences utilisateur
 */
export async function resolveSettingsConflict<T = any>(
  context: ConflictContext<T>
): Promise<ConflictResolution<T>> {
  const { localData, serverData, localModified, serverModified } = context;

  // Les paramètres locaux priment car ce sont les préférences de l'utilisateur
  // SAUF si le serveur est beaucoup plus récent (> 1 heure)
  const hoursDiff = (serverModified.getTime() - localModified.getTime()) / (1000 * 60 * 60);

  const useServer = hoursDiff > 1;

  return {
    resolved: true,
    data: useServer ? serverData : localData,
    strategy: useServer ? 'server-wins' : 'client-wins',
    requiresManualReview: false,
    changes: [
      useServer
        ? 'Paramètres serveur plus récents (>1h)'
        : 'Paramètres locaux conservés'
    ],
    metadata: {
      localVersion: await calculateChecksum(localData),
      serverVersion: await calculateChecksum(serverData),
      resolvedAt: new Date()
    }
  };
}

/**
 * Résolveur de conflits pour commandes
 * Stratégie: Server-wins car le serveur gère le workflow
 */
export async function resolveOrderConflict<T extends { status?: string }>(
  context: ConflictContext<T>
): Promise<ConflictResolution<T>> {
  const { localData, serverData } = context;

  // Le serveur a toujours la vérité pour le statut des commandes
  // Car il gère les paiements, livraisons, etc.
  return {
    resolved: true,
    data: serverData,
    strategy: 'server-wins',
    requiresManualReview: localData.status !== serverData.status,
    changes: [
      localData.status !== serverData.status
        ? `Statut changé: ${localData.status} → ${serverData.status}`
        : 'Aucun changement de statut'
    ],
    metadata: {
      localVersion: await calculateChecksum(localData),
      serverVersion: await calculateChecksum(serverData),
      resolvedAt: new Date()
    }
  };
}

/**
 * Résolveur de conflits générique avec 3-way merge
 * Utilisé quand on a une version de base (ancêtre commun)
 */
export async function resolve3WayMerge<T extends Record<string, any>>(
  context: ConflictContext<T>
): Promise<ConflictResolution<T>> {
  const { localData, serverData, baseData } = context;

  if (!baseData) {
    // Pas de version de base, fallback sur merge simple
    return resolveSimpleMerge(context);
  }

  const mergedData: T = { ...baseData };
  const changes: string[] = [];

  // Pour chaque champ, déterminer quelle version garder
  Object.keys({ ...localData, ...serverData }).forEach(key => {
    const localValue = (localData as Record<string, unknown>)[key];
    const serverValue = (serverData as Record<string, unknown>)[key];
    const baseValue = (baseData as Record<string, unknown>)[key];

    // Si les deux ont changé différemment par rapport à la base: conflit
    const localChanged = JSON.stringify(localValue) !== JSON.stringify(baseValue);
    const serverChanged = JSON.stringify(serverValue) !== JSON.stringify(baseValue);

    if (localChanged && serverChanged && JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
      // Conflit réel: prendre la valeur serveur par défaut
      (mergedData as Record<string, unknown>)[key] = serverValue;
      changes.push(`${key}: conflit résolu (serveur)`);
    } else if (localChanged) {
      (mergedData as Record<string, unknown>)[key] = localValue;
      changes.push(`${key}: changement local`);
    } else if (serverChanged) {
      (mergedData as Record<string, unknown>)[key] = serverValue;
      changes.push(`${key}: changement serveur`);
    } else {
      (mergedData as Record<string, unknown>)[key] = baseValue;
    }
  });

  return {
    resolved: true,
    data: mergedData,
    strategy: 'smart-merge',
    requiresManualReview: changes.some(c => c.includes('conflit')),
    changes,
    metadata: {
      localVersion: await calculateChecksum(localData),
      serverVersion: await calculateChecksum(serverData),
      resolvedAt: new Date()
    }
  };
}

/**
 * Résolveur de conflits simple (sans version de base)
 * Merge les objets en favorisant les valeurs les plus récentes
 */
export async function resolveSimpleMerge<T extends Record<string, any>>(
  context: ConflictContext<T>
): Promise<ConflictResolution<T>> {
  const { localData, serverData, localModified, serverModified } = context;

  // Merge simple: garder la valeur la plus récente pour chaque champ
  const mergedData: T = {} as T;
  const changes: string[] = [];

  const allKeys = new Set([...Object.keys(localData), ...Object.keys(serverData)]);

  allKeys.forEach(key => {
    const localValue = (localData as Record<string, unknown>)[key];
    const serverValue = (serverData as Record<string, unknown>)[key];

    if (JSON.stringify(localValue) === JSON.stringify(serverValue)) {
      (mergedData as Record<string, unknown>)[key] = localValue;
    } else {
      // Conflit: prendre la version la plus récente
      const useLocal = localModified > serverModified;
      (mergedData as Record<string, unknown>)[key] = useLocal ? localValue : serverValue;
      changes.push(`${key}: ${useLocal ? 'local' : 'serveur'} (plus récent)`);
    }
  });

  return {
    resolved: true,
    data: mergedData,
    strategy: 'merge',
    requiresManualReview: changes.length > 3, // Review si beaucoup de conflits
    changes,
    metadata: {
      localVersion: await calculateChecksum(localData),
      serverVersion: await calculateChecksum(serverData),
      resolvedAt: new Date()
    }
  };
}

/**
 * Résolveur principal qui choisit la bonne stratégie selon le type d'entité
 */
export async function resolveConflict<T = any>(
  entity: string,
  context: ConflictContext<T>,
  customResolver?: (ctx: ConflictContext<T>) => Promise<ConflictResolution<T>>
): Promise<ConflictResolution<T>> {
  // Si un résolveur personnalisé est fourni, l'utiliser
  if (customResolver) {
    return customResolver(context);
  }

  // Sinon, choisir selon le type d'entité
  switch (entity) {
    case 'pos_sales':
      return resolvePOSSaleConflict(context);

    case 'vendor_products':
      return resolveProductConflict(context as ConflictContext<any>);

    case 'orders':
      return resolveOrderConflict(context as ConflictContext<any>);

    case 'settings':
    case 'user_settings':
      return resolveSettingsConflict(context);

    case 'products':
      return resolveProductConflict(context as ConflictContext<any>);

    default:
      // Par défaut: 3-way merge si possible, sinon simple merge
      return (context.baseData
        ? resolve3WayMerge(context as ConflictContext<Record<string, any>>)
        : resolveSimpleMerge(context as ConflictContext<Record<string, any>>)) as Promise<ConflictResolution<T>>;
  }
}

export default {
  resolveConflict,
  resolvePOSSaleConflict,
  resolveStockConflict,
  resolveProductConflict,
  resolveSettingsConflict,
  resolveOrderConflict,
  resolve3WayMerge,
  resolveSimpleMerge
};

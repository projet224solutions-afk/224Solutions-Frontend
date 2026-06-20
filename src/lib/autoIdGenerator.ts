/**
 * Système de génération d'ID automatique pour tous les rôles
 * S'intègre au système existant sans modifier le code actuel
 */

import { supabase } from "@/integrations/supabase/client";

export type RoleType =
  | 'agent'
  | 'vendor'
  | 'bureau'
  | 'driver'
  | 'taxi'
  | 'livreur'
  | 'client'
  | 'pdg'
  | 'transitaire'
  | 'worker';

interface IdConfig {
  prefix: string;
  table: string;
  column: string;
  length: number;
}

// IDs are limited to 7 characters total (prefix 3 + 4 digits = 7 chars max)
const ID_CONFIGS: Record<RoleType, IdConfig> = {
  agent: {
    prefix: 'AGT',
    table: 'agents_management',
    column: 'agent_code',
    length: 4 // AGT0001 = 7 chars max
  },
  vendor: {
    prefix: 'VND',
    table: 'vendors',
    column: 'vendor_code',
    length: 4 // VND0001 = 7 chars max
  },
  bureau: {
    prefix: 'BST',
    table: 'bureau_syndicat',
    column: 'bureau_code',
    length: 4 // BST0001 = 7 chars max
  },
  driver: {
    prefix: 'DRV',
    table: 'taxi_moto_drivers',
    column: 'driver_code',
    length: 4 // DRV0001 = 7 chars max
  },
  taxi: {
    prefix: 'TAX',
    table: 'taxi_moto_drivers',
    column: 'driver_code',
    length: 4 // TAX0001 = 7 chars max
  },
  livreur: {
    prefix: 'LIV',
    table: 'taxi_moto_drivers',
    column: 'driver_code',
    length: 4 // LIV0001 = 7 chars max
  },
  client: {
    prefix: 'CLT',
    table: 'profiles',
    column: 'public_id',
    length: 4 // CLT0001 = 7 chars max
  },
  pdg: {
    prefix: 'PDG',
    table: 'pdg_accounts',
    column: 'pdg_code',
    length: 4 // PDG0001 = 7 chars max
  },
  transitaire: {
    prefix: 'TRS',
    table: 'transitaires',
    column: 'transitaire_code',
    length: 4 // TRS0001 = 7 chars max
  },
  worker: {
    prefix: 'WRK',
    table: 'workers',
    column: 'worker_code',
    length: 4 // WRK0001 = 7 chars max
  }
};

/**
 * Génère un ID unique pour un rôle donné
 * Format: PREFIX + NUMERO (ex: AGT0001, VND0042)
 * NOUVEAU: Comble les gaps en priorité (si VND0003 manque, il est réutilisé)
 */
export async function generateAutoId(roleType: RoleType): Promise<string> {
  const config = ID_CONFIGS[roleType];

  try {
    // Récupérer tous les IDs existants pour ce préfixe
    const { data: userIdsData, error: userIdsError } = await supabase
      .from('user_ids')
      .select('custom_id')
      .like('custom_id', `${config.prefix}%`)
      .order('custom_id', { ascending: true });

    if (userIdsError) {
      console.error('Erreur récupération IDs:', userIdsError);
    }

    // Si aucun ID n'existe, commencer à 1
    if (!userIdsData || userIdsData.length === 0) {
      const newId = `${config.prefix}${'1'.padStart(config.length, '0')}`;
      console.log(`✅ Premier ID généré pour ${roleType}: ${newId}`);
      return newId;
    }

    // Extraire tous les numéros utilisés
    const usedNumbers = new Set<number>();
    for (const row of userIdsData) {
      if (row.custom_id) {
        const numericPart = row.custom_id.replace(config.prefix, '');
        const num = parseInt(numericPart, 10);
        if (!isNaN(num)) {
          usedNumbers.add(num);
        }
      }
    }

    // Trouver le premier numéro disponible (comble les gaps)
    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }

    const newId = `${config.prefix}${nextNumber.toString().padStart(config.length, '0')}`;

    // Vérifier aussi dans la table de rôle (double sécurité)
    const { data: roleData } = await supabase
      .from(config.table as any)
      .select(config.column)
      .eq(config.column, newId)
      .maybeSingle();

    if (roleData) {
      // L'ID existe dans la table de rôle mais pas dans user_ids
      // Chercher le prochain disponible
      while (usedNumbers.has(nextNumber)) {
        nextNumber++;
      }
      const altId = `${config.prefix}${nextNumber.toString().padStart(config.length, '0')}`;
      console.log(`⚠️ ID ${newId} existe dans ${config.table}, utilise ${altId}`);
      return altId;
    }

    console.log(`✅ ID généré pour ${roleType}: ${newId} (premier gap ou suivant)`);
    return newId;

  } catch (error) {
    console.error(`Erreur génération ID ${roleType}:`, error);
    // Fallback: timestamp pour garantir l'unicité
    const timestamp = Date.now().toString().slice(-4);
    return `${config.prefix}${timestamp}`;
  }
}

/**
 * Vérifie si un ID existe déjà dans user_ids (contrainte d'unicité principale)
 */
export async function checkIdExists(roleType: RoleType, id: string): Promise<boolean> {
  try {
    // Vérifier dans user_ids qui a la contrainte d'unicité sur custom_id
    const { data: userIdData, error: userIdError } = await supabase
      .from('user_ids')
      .select('custom_id')
      .eq('custom_id', id)
      .maybeSingle();

    if (userIdError) {
      console.error(`Erreur vérification ID dans user_ids:`, userIdError);
    }

    if (userIdData) {
      console.log(`⚠️ ID ${id} déjà existant dans user_ids`);
      return true;
    }

    // Vérification supplémentaire dans la table de rôle
    const config = ID_CONFIGS[roleType];
    const { data, error } = await supabase
      .from(config.table as any)
      .select(config.column)
      .eq(config.column, id)
      .maybeSingle();

    if (error) {
      console.error(`Erreur vérification ID ${roleType}:`, error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error(`Erreur checkIdExists ${roleType}:`, error);
    return false;
  }
}

/**
 * Génère un ID unique avec vérification anti-doublon
 */
export async function generateUniqueId(roleType: RoleType): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const newId = await generateAutoId(roleType);
    const exists = await checkIdExists(roleType, newId);

    if (!exists) {
      return newId;
    }

    attempts++;
    console.warn(`ID ${newId} existe déjà, tentative ${attempts}/${maxAttempts}`);
  }

  // Fallback: ajouter timestamp
  const config = ID_CONFIGS[roleType];
  const timestamp = Date.now().toString().slice(-6);
  return `${config.prefix}${timestamp}`;
}

/**
 * Formatte un ID pour l'affichage
 */
export function formatIdForDisplay(id: string | null | undefined, roleType?: RoleType): string {
  if (!id) {
    return roleType ? `${ID_CONFIGS[roleType].prefix}-----` : '-----';
  }
  return id;
}

/**
 * Valide le format d'un ID
 */
export function validateIdFormat(id: string, roleType: RoleType): boolean {
  const config = ID_CONFIGS[roleType];
  const regex = new RegExp(`^${config.prefix}\\d{${config.length}}$`);
  return regex.test(id);
}

/**
 * Obtient la configuration pour un rôle
 */
export function getIdConfig(roleType: RoleType): IdConfig {
  return ID_CONFIGS[roleType];
}

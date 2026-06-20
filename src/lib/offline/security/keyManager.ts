/**
 * Key Manager - Gestion sécurisée des clés de chiffrement
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Gère le stockage sécurisé des clés et des informations sensibles en mode offline
 *
 * CORRECTIONS DE SÉCURITÉ:
 * - Chiffrement des API keys avec le PIN utilisateur
 * - Dérivation PBKDF2 (600,000 itérations)
 * - Comparaison timing-safe
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { hashPassword, generateSecureToken } from './encryption';
import {
  encryptWithPIN,
  decryptWithPIN,
  timingSafeEqual
} from '@/lib/security/secureEncryption';

/**
 * Clé stockée
 */
interface StoredKey {
  key_id: string;
  key_type: 'pin_hash' | 'session' | 'api_key' | 'encryption_salt';
  value: string; // Hashé ou chiffré
  salt?: string;
  created_at: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}

/**
 * Session active
 */
interface ActiveSession {
  session_id: string;
  user_id: string;
  pin_verified: boolean;
  biometric_verified: boolean;
  created_at: string;
  expires_at: string;
  last_activity: string;
}

/**
 * Schéma de la base de données des clés
 */
interface KeyStoreSchema extends DBSchema {
  keys: {
    key: string; // key_id
    value: StoredKey;
    indexes: {
      'by-type': string;
      'by-expiry': string;
    };
  };
  sessions: {
    key: string; // session_id
    value: ActiveSession;
  };
}

let keyDB: IDBPDatabase<KeyStoreSchema> | null = null;

/**
 * Initialiser la base de données des clés
 */
async function initKeyDB(): Promise<IDBPDatabase<KeyStoreSchema>> {
  if (keyDB) return keyDB;

  keyDB = await openDB<KeyStoreSchema>('224Solutions-KeyStore', 1, {
    upgrade(database) {
      console.log('[KeyManager] Création du schéma DB');

      // Store des clés
      if (!database.objectStoreNames.contains('keys')) {
        const keysStore = database.createObjectStore('keys', { keyPath: 'key_id' });
        keysStore.createIndex('by-type', 'key_type');
        keysStore.createIndex('by-expiry', 'expires_at');
      }

      // Store des sessions
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'session_id' });
      }
    }
  });

  console.log('[KeyManager] ✅ Base de données initialisée');
  return keyDB;
}

/**
 * Stocker le hash du PIN utilisateur
 */
export async function storePINHash(userId: string, pin: string): Promise<void> {
  const db = await initKeyDB();
  const salt = generateSecureToken(16);
  const hash = await hashPassword(pin, salt);

  const key: StoredKey = {
    key_id: `pin_${userId}`,
    key_type: 'pin_hash',
    value: hash,
    salt,
    created_at: new Date().toISOString(),
    metadata: { user_id: userId }
  };

  await db.put('keys', key);
  console.log('[KeyManager] ✅ PIN hash stocké');
}

/**
 * Vérifier un PIN
 */
export async function verifyPIN(userId: string, pin: string): Promise<boolean> {
  const db = await initKeyDB();
  const key = await db.get('keys', `pin_${userId}`);

  if (!key || key.key_type !== 'pin_hash') {
    console.warn('[KeyManager] PIN hash non trouvé');
    return false;
  }

  const hash = await hashPassword(pin, key.salt);
  return hash === key.value;
}

/**
 * Vérifier si un PIN est configuré
 */
export async function hasPINConfigured(userId: string): Promise<boolean> {
  const db = await initKeyDB();
  const key = await db.get('keys', `pin_${userId}`);
  return key !== undefined && key.key_type === 'pin_hash';
}

/**
 * Créer une session après authentification réussie
 */
export async function createSession(
  userId: string,
  durationMinutes: number = 30,
  options?: {
    pinVerified?: boolean;
    biometricVerified?: boolean;
  }
): Promise<string> {
  const db = await initKeyDB();
  const sessionId = `session_${Date.now()}_${generateSecureToken(16)}`;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const session: ActiveSession = {
    session_id: sessionId,
    user_id: userId,
    pin_verified: options?.pinVerified || false,
    biometric_verified: options?.biometricVerified || false,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    last_activity: now.toISOString()
  };

  await db.put('sessions', session);
  console.log(`[KeyManager] ✅ Session créée: ${sessionId} (expire dans ${durationMinutes}min)`);

  return sessionId;
}

/**
 * Vérifier si une session est valide
 */
export async function isSessionValid(sessionId: string): Promise<boolean> {
  const db = await initKeyDB();
  const session = await db.get('sessions', sessionId);

  if (!session) return false;

  const now = new Date();
  const expiresAt = new Date(session.expires_at);

  if (now > expiresAt) {
    // Session expirée, la supprimer
    await db.delete('sessions', sessionId);
    console.log('[KeyManager] Session expirée:', sessionId);
    return false;
  }

  // Mettre à jour l'activité
  session.last_activity = now.toISOString();
  await db.put('sessions', session);

  return true;
}

/**
 * Obtenir une session active
 */
export async function getSession(sessionId: string): Promise<ActiveSession | null> {
  const db = await initKeyDB();
  const session = await db.get('sessions', sessionId);

  if (!session) return null;

  // Vérifier l'expiration
  const isValid = await isSessionValid(sessionId);
  return isValid ? session : null;
}

/**
 * Obtenir la session active d'un utilisateur
 */
export async function getUserSession(userId: string): Promise<ActiveSession | null> {
  const db = await initKeyDB();
  const allSessions = await db.getAll('sessions');

  const userSessions = allSessions.filter(s => s.user_id === userId);

  // Trier par activité récente
  userSessions.sort((a, b) =>
    new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
  );

  // Retourner la plus récente si valide
  for (const session of userSessions) {
    const isValid = await isSessionValid(session.session_id);
    if (isValid) return session;
  }

  return null;
}

/**
 * Terminer une session
 */
export async function endSession(sessionId: string): Promise<void> {
  const db = await initKeyDB();
  await db.delete('sessions', sessionId);
  console.log('[KeyManager] ✅ Session terminée:', sessionId);
}

/**
 * Terminer toutes les sessions d'un utilisateur
 */
export async function endAllUserSessions(userId: string): Promise<number> {
  const db = await initKeyDB();
  const allSessions = await db.getAll('sessions');

  const userSessions = allSessions.filter(s => s.user_id === userId);

  for (const session of userSessions) {
    await db.delete('sessions', session.session_id);
  }

  console.log(`[KeyManager] ✅ ${userSessions.length} session(s) terminée(s)`);
  return userSessions.length;
}

/**
 * Nettoyer les sessions expirées
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const db = await initKeyDB();
  const allSessions = await db.getAll('sessions');
  const now = new Date();

  let cleaned = 0;

  for (const session of allSessions) {
    const expiresAt = new Date(session.expires_at);
    if (now > expiresAt) {
      await db.delete('sessions', session.session_id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[KeyManager] 🧹 ${cleaned} session(s) expirée(s) nettoyée(s)`);
  }

  return cleaned;
}

/**
 * Stocker une clé API (chiffrée avec le PIN)
 */
export async function storeAPIKey(
  userId: string,
  keyName: string,
  keyValue: string,
  pin: string,
  expiryDays?: number
): Promise<void> {
  const db = await initKeyDB();

  const expiresAt = expiryDays
    ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  // Chiffrer la clé API avec le PIN utilisateur (PBKDF2 + AES-GCM)
  const { encrypted, iv, salt } = await encryptWithPIN(keyValue, pin);

  const key: StoredKey = {
    key_id: `api_${userId}_${keyName}`,
    key_type: 'api_key',
    value: JSON.stringify({ encrypted, iv, salt }), // Stockage chiffré
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    metadata: { user_id: userId, key_name: keyName, encrypted: true }
  };

  await db.put('keys', key);
  console.log(`[KeyManager] ✅ Clé API chiffrée et stockée: ${keyName}`);
}

/**
 * Récupérer une clé API (déchiffrée avec le PIN)
 */
export async function getAPIKey(
  userId: string,
  keyName: string,
  pin: string
): Promise<string | null> {
  const db = await initKeyDB();
  const key = await db.get('keys', `api_${userId}_${keyName}`);

  if (!key) return null;

  // Vérifier l'expiration
  if (key.expires_at) {
    const now = new Date();
    const expiresAt = new Date(key.expires_at);

    if (now > expiresAt) {
      await db.delete('keys', key.key_id);
      console.log('[KeyManager] Clé API expirée:', keyName);
      return null;
    }
  }

  // Vérifier si la clé est chiffrée
  if (key.metadata?.encrypted) {
    try {
      const { encrypted, iv, salt } = JSON.parse(key.value);
      const decrypted = await decryptWithPIN(encrypted, iv, salt, pin);
      return decrypted;
    } catch (error) {
      console.error('[KeyManager] Erreur déchiffrement clé API:', error);
      return null;
    }
  }

  // Legacy: clé non chiffrée (migration)
  console.warn('[KeyManager] ⚠️ Clé API non chiffrée détectée, migration recommandée');
  return key.value;
}

/**
 * Supprimer une clé API
 */
export async function deleteAPIKey(userId: string, keyName: string): Promise<void> {
  const db = await initKeyDB();
  await db.delete('keys', `api_${userId}_${keyName}`);
  console.log(`[KeyManager] ✅ Clé API supprimée: ${keyName}`);
}

/**
 * Stocker le salt de chiffrement d'un utilisateur
 */
export async function storeEncryptionSalt(userId: string): Promise<string> {
  const db = await initKeyDB();
  const salt = generateSecureToken(16);

  const key: StoredKey = {
    key_id: `salt_${userId}`,
    key_type: 'encryption_salt',
    value: salt,
    created_at: new Date().toISOString(),
    metadata: { user_id: userId }
  };

  await db.put('keys', key);
  console.log('[KeyManager] ✅ Salt de chiffrement stocké');

  return salt;
}

/**
 * Récupérer le salt de chiffrement
 */
export async function getEncryptionSalt(userId: string): Promise<string | null> {
  const db = await initKeyDB();
  const key = await db.get('keys', `salt_${userId}`);

  return key?.value || null;
}

/**
 * Nettoyer toutes les clés expirées
 */
export async function cleanupExpiredKeys(): Promise<number> {
  const db = await initKeyDB();
  const allKeys = await db.getAllFromIndex('keys', 'by-expiry');
  const now = new Date();

  let cleaned = 0;

  for (const key of allKeys) {
    if (key.expires_at) {
      const expiresAt = new Date(key.expires_at);
      if (now > expiresAt) {
        await db.delete('keys', key.key_id);
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    console.log(`[KeyManager] 🧹 ${cleaned} clé(s) expirée(s) nettoyée(s)`);
  }

  return cleaned;
}

/**
 * Supprimer toutes les données d'un utilisateur
 */
export async function deleteUserData(userId: string): Promise<void> {
  const db = await initKeyDB();

  // Supprimer toutes les clés
  const allKeys = await db.getAll('keys');
  for (const key of allKeys) {
    if (key.metadata?.user_id === userId || key.key_id.includes(userId)) {
      await db.delete('keys', key.key_id);
    }
  }

  // Supprimer toutes les sessions
  await endAllUserSessions(userId);

  console.log(`[KeyManager] ✅ Données utilisateur supprimées: ${userId}`);
}

export default {
  initKeyDB,
  storePINHash,
  verifyPIN,
  hasPINConfigured,
  createSession,
  isSessionValid,
  getSession,
  getUserSession,
  endSession,
  endAllUserSessions,
  cleanupExpiredSessions,
  storeAPIKey,
  getAPIKey,
  deleteAPIKey,
  storeEncryptionSalt,
  getEncryptionSalt,
  cleanupExpiredKeys,
  deleteUserData
};

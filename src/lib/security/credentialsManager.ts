/**
 * CREDENTIALS MANAGER
 * Gestion sécurisée des credentials et tokens
 * 224SOLUTIONS - Sécurité avancée
 *
 * FONCTIONNALITÉS:
 * - Stockage chiffré des credentials
 * - Rotation automatique des tokens
 * - Détection de compromission
 * - Audit des accès
 */

import { SecureStorage } from '@/lib/secureStorage';
import {
  encryptWithPIN,
  decryptWithPIN,
  generateSecureToken,
  timingSafeEqual,
  secureHash
} from './secureEncryption';

// Clés de stockage
const KEYS = {
  SESSION: 'secure_session',
  API_KEYS: 'encrypted_api_keys',
  REFRESH_TOKEN: 'refresh_token',
  ACCESS_LOG: 'credential_access_log'
} as const;

// Durées de vie
const TOKEN_LIFETIME = {
  ACCESS: 15 * 60 * 1000,      // 15 minutes
  REFRESH: 7 * 24 * 60 * 60 * 1000, // 7 jours
  SESSION: 30 * 60 * 1000      // 30 minutes
} as const;

interface StoredCredential {
  value: string;
  encrypted: string;
  iv: string;
  salt: string;
  createdAt: number;
  expiresAt: number;
  hash: string; // Pour vérification d'intégrité
}

interface AccessLogEntry {
  action: 'read' | 'write' | 'delete' | 'rotate';
  key: string;
  timestamp: number;
  success: boolean;
  userAgent?: string;
}

// Journal des accès en mémoire
const accessLog: AccessLogEntry[] = [];
const MAX_LOG_ENTRIES = 100;

/**
 * Logger un accès aux credentials
 */
function logAccess(
  action: AccessLogEntry['action'],
  key: string,
  success: boolean
): void {
  const entry: AccessLogEntry = {
    action,
    key,
    timestamp: Date.now(),
    success,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
  };

  accessLog.push(entry);

  // Garder seulement les dernières entrées
  if (accessLog.length > MAX_LOG_ENTRIES) {
    accessLog.shift();
  }

  // Alerte si trop d'échecs
  const recentFailures = accessLog.filter(
    e => !e.success && Date.now() - e.timestamp < 60000
  );

  if (recentFailures.length >= 5) {
    console.error('🚨 [CredentialsManager] Trop de tentatives échouées!');
    // Potentiellement bloquer ou alerter
  }
}

/**
 * Stocker un credential de manière sécurisée
 */
export async function storeCredential(
  key: string,
  value: string,
  pin: string,
  expiresInMs: number = TOKEN_LIFETIME.SESSION
): Promise<boolean> {
  try {
    // Chiffrer avec le PIN
    const { encrypted, iv, salt } = await encryptWithPIN(value, pin);

    // Créer le hash d'intégrité
    const hash = await secureHash(value);

    const credential: StoredCredential = {
      value: '', // Ne pas stocker en clair
      encrypted,
      iv,
      salt,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresInMs,
      hash
    };

    await SecureStorage.setItem(key, credential);
    logAccess('write', key, true);

    console.log(`[CredentialsManager] ✅ Credential stocké: ${key}`);
    return true;
  } catch (error) {
    console.error('[CredentialsManager] Erreur stockage:', error);
    logAccess('write', key, false);
    return false;
  }
}

/**
 * Récupérer un credential sécurisé
 */
export async function getCredential(
  key: string,
  pin: string
): Promise<string | null> {
  try {
    const credential = await SecureStorage.getItem<StoredCredential>(key);

    if (!credential) {
      logAccess('read', key, false);
      return null;
    }

    // Vérifier l'expiration
    if (Date.now() > credential.expiresAt) {
      console.warn(`[CredentialsManager] Credential expiré: ${key}`);
      await SecureStorage.removeItem(key);
      logAccess('read', key, false);
      return null;
    }

    // Déchiffrer
    const decrypted = await decryptWithPIN(
      credential.encrypted,
      credential.iv,
      credential.salt,
      pin
    );

    // Vérifier l'intégrité
    const currentHash = await secureHash(decrypted);
    if (!timingSafeEqual(currentHash, credential.hash)) {
      console.error(`[CredentialsManager] 🚨 Intégrité compromise: ${key}`);
      await SecureStorage.removeItem(key);
      logAccess('read', key, false);
      return null;
    }

    logAccess('read', key, true);
    return decrypted;
  } catch (error) {
    console.error('[CredentialsManager] Erreur lecture:', error);
    logAccess('read', key, false);
    return null;
  }
}

/**
 * Supprimer un credential
 */
export async function deleteCredential(key: string): Promise<boolean> {
  try {
    SecureStorage.removeItem(key);
    logAccess('delete', key, true);
    console.log(`[CredentialsManager] ✅ Credential supprimé: ${key}`);
    return true;
  } catch (error) {
    console.error('[CredentialsManager] Erreur suppression:', error);
    logAccess('delete', key, false);
    return false;
  }
}

/**
 * Rotation d'un credential (génère une nouvelle valeur)
 */
export async function rotateCredential(
  key: string,
  pin: string,
  newValue?: string,
  expiresInMs?: number
): Promise<string | null> {
  try {
    // Supprimer l'ancien
    await deleteCredential(key);

    // Générer ou utiliser la nouvelle valeur
    const value = newValue || generateSecureToken(32);

    // Stocker le nouveau
    const success = await storeCredential(key, value, pin, expiresInMs);

    if (success) {
      logAccess('rotate', key, true);
      console.log(`[CredentialsManager] ✅ Credential roté: ${key}`);
      return value;
    }

    logAccess('rotate', key, false);
    return null;
  } catch (error) {
    console.error('[CredentialsManager] Erreur rotation:', error);
    logAccess('rotate', key, false);
    return null;
  }
}

/**
 * Stocker une session utilisateur
 */
export async function storeSession(
  userId: string,
  sessionData: Record<string, unknown>,
  pin: string
): Promise<boolean> {
  const key = `${KEYS.SESSION}_${userId}`;
  const value = JSON.stringify({
    ...sessionData,
    storedAt: Date.now()
  });

  return storeCredential(key, value, pin, TOKEN_LIFETIME.SESSION);
}

/**
 * Récupérer une session utilisateur
 */
export async function getSession(
  userId: string,
  pin: string
): Promise<Record<string, unknown> | null> {
  const key = `${KEYS.SESSION}_${userId}`;
  const value = await getCredential(key, pin);

  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Stocker une clé API de manière sécurisée
 */
export async function storeAPIKey(
  userId: string,
  keyName: string,
  keyValue: string,
  pin: string,
  expiresInDays: number = 30
): Promise<boolean> {
  const key = `${KEYS.API_KEYS}_${userId}_${keyName}`;
  const expiresInMs = expiresInDays * 24 * 60 * 60 * 1000;

  return storeCredential(key, keyValue, pin, expiresInMs);
}

/**
 * Récupérer une clé API
 */
export async function getAPIKey(
  userId: string,
  keyName: string,
  pin: string
): Promise<string | null> {
  const key = `${KEYS.API_KEYS}_${userId}_${keyName}`;
  return getCredential(key, pin);
}

/**
 * Nettoyer les credentials expirés
 */
export async function cleanupExpiredCredentials(): Promise<number> {
  // Cette fonction nécessiterait un accès à toutes les clés
  // Pour l'instant, on log juste l'appel
  console.log('[CredentialsManager] Nettoyage des credentials expirés...');
  return 0;
}

/**
 * Obtenir le journal des accès
 */
export function getAccessLog(): readonly AccessLogEntry[] {
  return [...accessLog];
}

/**
 * Vérifier si un credential existe et n'est pas expiré
 */
export async function credentialExists(key: string): Promise<boolean> {
  try {
    const credential = await SecureStorage.getItem<StoredCredential>(key);
    if (!credential) return false;
    return Date.now() < credential.expiresAt;
  } catch {
    return false;
  }
}

export default {
  storeCredential,
  getCredential,
  deleteCredential,
  rotateCredential,
  storeSession,
  getSession,
  storeAPIKey,
  getAPIKey,
  cleanupExpiredCredentials,
  getAccessLog,
  credentialExists,
  KEYS,
  TOKEN_LIFETIME
};

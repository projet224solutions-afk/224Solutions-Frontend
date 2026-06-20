/**
 * MODULE DE CRYPTAGE LOCAL
 * Cryptage AES-256 pour les données stockées localement
 * 224SOLUTIONS - Système de sécurité
 */

import CryptoJS from 'crypto-js';

// Clé de cryptage - générée de manière déterministe pour le stockage local
// Note: Pour la production, utiliser une clé stockée de manière sécurisée
function getEncryptionKey(): string {
  // Utiliser une clé basée sur un hash fixe pour le stockage local
  // Cette approche permet le cryptage local sans dépendre d'une variable d'environnement
  const baseKey = '224Solutions-LocalStorage-Key-2024';
  return CryptoJS.SHA256(baseKey).toString();
}

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Crypte des données avec AES-256
 */
export function encryptData(data: any): string {
  try {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Erreur de cryptage:', error);
    // En cas d'erreur, retourner les données non cryptées
    return JSON.stringify(data);
  }
}

/**
 * Décrypte des données AES-256
 */
export function decryptData<T = any>(encryptedData: string): T {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);

    if (!jsonString) {
      // Si le décryptage échoue, tenter de parser comme JSON non crypté
      return JSON.parse(encryptedData);
    }

    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Erreur de décryptage:', error);
    // Tenter de retourner les données non cryptées
    try {
      return JSON.parse(encryptedData);
    } catch {
      return encryptedData as T;
    }
  }
}

/**
 * Hash une valeur (pour les identifiants uniques)
 */
export function hashValue(value: string): string {
  return CryptoJS.SHA256(value).toString();
}

/**
 * Génère un token sécurisé
 */
export function generateSecureToken(): string {
  return CryptoJS.lib.WordArray.random(32).toString();
}

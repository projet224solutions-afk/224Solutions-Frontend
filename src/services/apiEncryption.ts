/**
 * 🔐 SERVICE DE CHIFFREMENT AES-256 - 224SOLUTIONS
 * Gestion sécurisée du chiffrement/déchiffrement des clés API
 */

import CryptoJS from 'crypto-js';

function getLocalEncryptionKey(): string | null {
  if (typeof window === 'undefined') return null;

  const storageKey = 'vf_local_encryption_key';
  let key = window.localStorage.getItem(storageKey);
  if (!key) {
    key = crypto.randomUUID().replace(/-/g, '');
    window.localStorage.setItem(storageKey, key);
  }
  return key;
}

const ENCRYPTION_KEY = getLocalEncryptionKey();

// Avertissement si la clé est manquante (ne pas bloquer le chargement)
if (!ENCRYPTION_KEY) {
  console.warn('⚠️ Clé de chiffrement locale indisponible - Le chiffrement API sera désactivé');
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
}

/**
 * Chiffre une clé API avec AES-256-CBC
 */
export function encryptApiKey(apiKey: string): EncryptedData {
  if (!ENCRYPTION_KEY) {
    console.warn('⚠️ Chiffrement désactivé - Clé manquante');
    // Retourner des données "non chiffrées" mais dans le même format
    return {
      encrypted: apiKey,
      iv: ''
    };
  }
  try {
    // Générer un IV aléatoire
    const iv = CryptoJS.lib.WordArray.random(16);

    // Chiffrer avec AES-256-CBC
    const encrypted = CryptoJS.AES.encrypt(apiKey, ENCRYPTION_KEY, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      encrypted: encrypted.toString(),
      iv: iv.toString(CryptoJS.enc.Base64)
    };
  } catch (error) {
    console.error('❌ Erreur chiffrement:', error);
    throw new Error('Échec du chiffrement de la clé API');
  }
}

/**
 * Déchiffre une clé API
 */
export function decryptApiKey(encryptedData: string, iv: string): string {
  if (!ENCRYPTION_KEY) {
    console.warn('⚠️ Déchiffrement désactivé - Clé manquante');
    // Retourner les données telles quelles si non chiffrées
    return encryptedData;
  }
  try {
    // Convertir l'IV en WordArray
    const ivWordArray = CryptoJS.enc.Base64.parse(iv);

    // Déchiffrer
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      throw new Error('Déchiffrement invalide');
    }

    return plaintext;
  } catch (error) {
    console.error('❌ Erreur déchiffrement:', error);
    throw new Error('Échec du déchiffrement de la clé API');
  }
}

/**
 * Valide le format d'une clé API
 */
export function validateApiKey(apiKey: string): boolean {
  // Vérifier longueur minimale
  if (apiKey.length < 20) return false;

  // Vérifier que ce n'est pas vide ou seulement des espaces
  if (!apiKey.trim()) return false;

  return true;
}

/**
 * Masque une clé API pour l'affichage (montre seulement les 4 premiers et 4 derniers caractères)
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '****';
  }

  const start = apiKey.substring(0, 4);
  const end = apiKey.substring(apiKey.length - 4);
  const middle = '*'.repeat(Math.min(apiKey.length - 8, 12));

  return `${start}${middle}${end}`;
}

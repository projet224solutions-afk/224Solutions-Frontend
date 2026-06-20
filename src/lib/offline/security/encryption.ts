/**
 * Enhanced Encryption - Chiffrement renforcé avec PBKDF2 + AES-GCM
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * AMÉLIORATION par rapport à encryption.ts existant:
 * - Utilise PBKDF2 pour dériver la clé du PIN utilisateur
 * - AES-GCM pour authenticated encryption
 * - Salt unique par chiffrement
 * - IV (Initialization Vector) aléatoire
 *
 * IMPORTANT: Ce fichier ne remplace PAS encryption.ts existant,
 * il fournit des fonctions de chiffrement plus sécurisées pour les données offline.
 */

/**
 * Configuration de chiffrement
 */
export interface EncryptionConfig {
  algorithm: 'AES-GCM';
  keyLength: 256;
  iterations: 100000; // PBKDF2 iterations
  saltLength: 16; // bytes
  ivLength: 12; // bytes pour AES-GCM
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  iterations: 100000,
  saltLength: 16,
  ivLength: 12
};

/**
 * Données chiffrées avec métadonnées
 */
export interface EncryptedData {
  ciphertext: string; // Base64
  salt: string; // Base64
  iv: string; // Base64
  algorithm: string;
  iterations: number;
  timestamp: string;
}

/**
 * Générer un salt aléatoire
 */
function generateSalt(length: number = DEFAULT_CONFIG.saltLength): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Générer un IV aléatoire
 */
function generateIV(length: number = DEFAULT_CONFIG.ivLength): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Convertir Uint8Array en Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convertir Base64 en Uint8Array
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Dériver une clé de chiffrement depuis un PIN/mot de passe avec PBKDF2
 *
 * @param password - PIN ou mot de passe utilisateur
 * @param salt - Salt unique (généré aléatoirement)
 * @param iterations - Nombre d'itérations PBKDF2 (par défaut 100000)
 * @returns Clé de chiffrement AES-GCM
 */
export async function deriveEncryptionKey(
  password: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_CONFIG.iterations
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Importer le mot de passe comme clé de base
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Dériver la clé AES-GCM avec PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: DEFAULT_CONFIG.keyLength
    },
    false, // Non extractible pour plus de sécurité
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Chiffrer des données avec AES-GCM
 *
 * @param data - Données à chiffrer (objet, string, number, etc.)
 * @param password - PIN ou mot de passe
 * @returns Données chiffrées avec métadonnées
 *
 * @example
 * const encrypted = await encryptWithPassword({ secret: 'data' }, '1234');
 * // Plus tard...
 * const decrypted = await decryptWithPassword(encrypted, '1234');
 */
export async function encryptWithPassword(
  data: any,
  password: string
): Promise<EncryptedData> {
  try {
    // Sérialiser les données
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);

    // Générer salt et IV aléatoires
    const salt = generateSalt();
    const iv = generateIV();

    // Dériver la clé
    const key = await deriveEncryptionKey(password, salt);

    // Chiffrer
    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer
      },
      key,
      dataBuffer
    );

    // Construire le résultat
    const encrypted: EncryptedData = {
      ciphertext: arrayBufferToBase64(ciphertextBuffer),
      salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
      iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
      algorithm: DEFAULT_CONFIG.algorithm,
      iterations: DEFAULT_CONFIG.iterations,
      timestamp: new Date().toISOString()
    };

    return encrypted;
  } catch (error) {
    console.error('[Encryption] Erreur chiffrement:', error);
    throw new Error('Échec du chiffrement des données');
  }
}

/**
 * Déchiffrer des données avec AES-GCM
 *
 * @param encrypted - Données chiffrées
 * @param password - PIN ou mot de passe
 * @returns Données déchiffrées
 *
 * @throws Error si le mot de passe est incorrect ou les données corrompues
 */
export async function decryptWithPassword<T = any>(
  encrypted: EncryptedData,
  password: string
): Promise<T> {
  try {
    // Reconstruire les buffers depuis Base64
    const ciphertextBuffer = base64ToArrayBuffer(encrypted.ciphertext);
    const salt = base64ToArrayBuffer(encrypted.salt);
    const iv = base64ToArrayBuffer(encrypted.iv);

    // Dériver la clé (même salt que lors du chiffrement)
    const key = await deriveEncryptionKey(password, salt, encrypted.iterations);

    // Déchiffrer
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer
      },
      key,
      ciphertextBuffer.buffer as ArrayBuffer
    );

    // Désérialiser
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    const data = JSON.parse(jsonString);

    return data as T;
  } catch (error) {
    console.error('[Encryption] Erreur déchiffrement:', error);
    throw new Error('Échec du déchiffrement: mot de passe incorrect ou données corrompues');
  }
}

/**
 * Hasher un mot de passe avec SHA-256
 * Utile pour vérifier un PIN sans le stocker en clair
 *
 * @param password - Mot de passe à hasher
 * @param salt - Salt optionnel (recommandé)
 * @returns Hash en hexadécimal
 */
export async function hashPassword(password: string, salt?: string): Promise<string> {
  const saltValue = salt || '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltValue);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Vérifier un mot de passe contre son hash
 *
 * @param password - Mot de passe à vérifier
 * @param hash - Hash de référence
 * @param salt - Salt utilisé lors du hashage
 * @returns true si le mot de passe correspond
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt?: string
): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}

/**
 * Générer un token sécurisé aléatoire
 *
 * @param length - Longueur en bytes (défaut: 32)
 * @returns Token en hexadécimal
 */
export function generateSecureToken(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Chiffrer un fichier (pour stockage offline)
 *
 * @param file - Fichier à chiffrer
 * @param password - Mot de passe
 * @returns Données chiffrées du fichier
 */
export async function encryptFile(
  file: File,
  password: string
): Promise<EncryptedData> {
  // Lire le fichier en Base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Chiffrer les données Base64
  return encryptWithPassword({
    name: file.name,
    type: file.type,
    size: file.size,
    data: base64
  }, password);
}

/**
 * Déchiffrer un fichier
 *
 * @param encrypted - Données chiffrées
 * @param password - Mot de passe
 * @returns Informations du fichier déchiffré
 */
export async function decryptFile(
  encrypted: EncryptedData,
  password: string
): Promise<{ name: string; type: string; size: number; data: string }> {
  return decryptWithPassword(encrypted, password);
}

/**
 * Tester si le chiffrement est disponible
 */
export function isEncryptionAvailable(): boolean {
  return typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.encrypt === 'function';
}

export default {
  encryptWithPassword,
  decryptWithPassword,
  deriveEncryptionKey,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  encryptFile,
  decryptFile,
  isEncryptionAvailable
};

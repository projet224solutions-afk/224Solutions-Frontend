/**
 * MODULE DE CRYPTAGE SÉCURISÉ
 * Dérivation de clés avec PBKDF2 - Web Crypto API
 * 224SOLUTIONS - Système de sécurité avancé
 *
 * CORRECTIONS DE SÉCURITÉ:
 * - Clés dérivées du PIN utilisateur (pas hardcodées)
 * - PBKDF2 avec 600,000 itérations (OWASP 2023)
 * - Comparaison timing-safe pour tokens
 * - Chiffrement AES-GCM authentifié
 */

// Configuration PBKDF2 selon recommandations OWASP 2023
const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 32;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Génère un salt cryptographiquement sécurisé
 */
export function generateSecureSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Génère un IV (Initialization Vector) sécurisé
 */
export function generateSecureIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Dérive une clé de chiffrement à partir du PIN utilisateur
 * Utilise PBKDF2 avec 600,000 itérations (OWASP 2023)
 */
export async function deriveKeyFromPIN(
  pin: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Encoder le PIN en bytes
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);

  // Importer le PIN comme clé de base
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Dériver la clé finale avec PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false, // Non extractable pour plus de sécurité
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Chiffre des données avec AES-GCM (authentifié)
 */
export async function encryptWithKey(
  data: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const iv = generateSecureIV();
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    dataBytes
  );

  return {
    encrypted: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv)
  };
}

/**
 * Déchiffre des données avec AES-GCM
 */
export async function decryptWithKey(
  encrypted: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const encryptedBuffer = base64ToArrayBuffer(encrypted);
  const ivBuffer = base64ToArrayBuffer(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    key,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Chiffre des données avec un PIN (dérivation + chiffrement)
 */
export async function encryptWithPIN(
  data: string,
  pin: string
): Promise<{ encrypted: string; iv: string; salt: string }> {
  const salt = generateSecureSalt();
  const key = await deriveKeyFromPIN(pin, salt);
  const { encrypted, iv } = await encryptWithKey(data, key);

  return {
    encrypted,
    iv,
    salt: arrayBufferToBase64(salt)
  };
}

/**
 * Déchiffre des données avec un PIN
 */
export async function decryptWithPIN(
  encrypted: string,
  iv: string,
  salt: string,
  pin: string
): Promise<string> {
  const saltBuffer = base64ToArrayBuffer(salt);
  const key = await deriveKeyFromPIN(pin, new Uint8Array(saltBuffer));
  return decryptWithKey(encrypted, iv, key);
}

/**
 * Comparaison timing-safe de deux chaînes
 * Empêche les attaques par timing
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Toujours faire la comparaison même si longueurs différentes
    // pour éviter les fuites d'information sur la longueur
    let _result = 0;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      _result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Génère un token sécurisé
 */
export function generateSecureToken(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return arrayBufferToBase64(bytes);
}

/**
 * Hash sécurisé avec SHA-256
 */
export async function secureHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Hash de mot de passe avec PBKDF2
 */
export async function hashPassword(
  password: string,
  salt?: Uint8Array
): Promise<{ hash: string; salt: string }> {
  const usedSalt = salt || generateSecureSalt();
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: usedSalt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  return {
    hash: arrayBufferToBase64(hashBuffer),
    salt: arrayBufferToBase64(usedSalt)
  };
}

/**
 * Vérifie un mot de passe contre un hash
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const saltBuffer = base64ToArrayBuffer(salt);
  const { hash } = await hashPassword(password, new Uint8Array(saltBuffer));
  return timingSafeEqual(hash, storedHash);
}

// Utilitaires de conversion
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export default {
  generateSecureSalt,
  generateSecureIV,
  deriveKeyFromPIN,
  encryptWithKey,
  decryptWithKey,
  encryptWithPIN,
  decryptWithPIN,
  timingSafeEqual,
  generateSecureToken,
  secureHash,
  hashPassword,
  verifyPassword
};

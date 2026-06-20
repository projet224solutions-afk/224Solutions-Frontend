/**
 * 🔐 MODULE DE SÉCURITÉ 224SOLUTIONS
 * Export centralisé de tous les services de sécurité
 *
 * MODULES INCLUS:
 * - secureEncryption: Chiffrement PBKDF2 + AES-GCM
 * - csrf: Protection CSRF avec timing-safe comparison
 * - serverRateLimiter: Rate limiting côté serveur
 * - credentialsManager: Gestion sécurisée des credentials
 * - securityHeaders: Headers HTTP de sécurité
 * - inputSanitizer: Validation et sanitization des entrées
 * - antiDebug: Protection contre le débogage et l'inspection
 * - watermark: Traçabilité des builds et détection de copies
 * - envValidator: Validation des variables d'environnement
 */

// Chiffrement sécurisé (PBKDF2 + AES-GCM)
export {
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
} from './secureEncryption';

// Protection CSRF
export {
  generateCSRFToken,
  getCSRFToken,
  validateCSRFToken,
  invalidateCSRFToken,
  validateOrigin,
  csrfMiddleware,
  useCSRF
} from './csrf';

// Rate Limiting
export {
  checkRateLimit,
  resetRateLimit,
  rateLimitMiddleware,
  getRateLimitHeaders,
  configureRedis,
  RATE_LIMIT_CONFIGS
} from './serverRateLimiter';

export type { RateLimitType } from './serverRateLimiter';

// Gestion des Credentials
export {
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
  credentialExists
} from './credentialsManager';

// Headers de Sécurité
export {
  SECURITY_HEADERS,
  generateCSPNonce,
  buildCSPHeader,
  getEdgeFunctionSecurityHeaders,
  applySecurityHeaders
} from './securityHeaders';

// Protection Anti-Débogage
export {
  startAntiDebugProtection,
  stopAntiDebugProtection,
  setDebugCallback,
  defaultDebugAction
} from './antiDebug';

// Watermarking et Traçabilité
export {
  APP_WATERMARK,
  embedWatermarkInDOM,
  getWatermarkHeaders,
  verifyWatermark,
  getWatermarkInfo,
  getAppFingerprint,
  INVISIBLE_WATERMARK
} from './watermark';

// Validation des Variables d'Environnement
export {
  validateEnvVars,
  logValidationResult,
  secureConfig,
  maskSensitiveValue,
  initEnvValidation
} from './envValidator';

/**
 * Configuration de sécurité recommandée
 */
export const SECURITY_CONFIG = {
  // Chiffrement
  PBKDF2_ITERATIONS: 600000,
  KEY_LENGTH: 256,
  SALT_LENGTH: 32,
  IV_LENGTH: 12,

  // Sessions
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  REFRESH_TOKEN_LIFETIME_MS: 7 * 24 * 60 * 60 * 1000, // 7 jours

  // Rate Limiting
  AUTH_MAX_ATTEMPTS: 5,
  AUTH_BLOCK_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  OTP_MAX_ATTEMPTS: 3,
  OTP_BLOCK_DURATION_MS: 60 * 60 * 1000, // 1 heure

  // CSRF
  CSRF_TOKEN_EXPIRY_MS: 60 * 60 * 1000, // 1 heure

  // Validation
  MAX_INPUT_LENGTH: 10000,
  MAX_REQUEST_SIZE: 1024 * 1024, // 1MB

  // Origines autorisées
  ALLOWED_ORIGINS: [
    'https://224solution.net',
    'https://www.224solution.net',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
} as const;

/**
 * Initialiser la sécurité de l'application
 */
export async function initializeSecurity(): Promise<void> {
  console.log('🔐 [Security] Initialisation des services de sécurité...');

  // Valider les variables d'environnement
  const { initEnvValidation } = await import('./envValidator');
  initEnvValidation();

  // Générer le token CSRF initial
  const { generateCSRFToken } = await import('./csrf');
  generateCSRFToken();

  // Intégrer le watermark dans le DOM
  const { embedWatermarkInDOM, getWatermarkInfo } = await import('./watermark');
  embedWatermarkInDOM();
  console.log('🔐 [Security] Watermark:', getWatermarkInfo());

  // Activer la protection anti-débogage en production
  if (import.meta.env.PROD) {
    const { startAntiDebugProtection, setDebugCallback, defaultDebugAction } = await import('./antiDebug');
    setDebugCallback(defaultDebugAction);
    startAntiDebugProtection();
    console.log('🔐 [Security] Protection anti-débogage activée');
  }

  console.log('🔐 [Security] ✅ Services de sécurité initialisés');
}

export default {
  SECURITY_CONFIG,
  initializeSecurity
};

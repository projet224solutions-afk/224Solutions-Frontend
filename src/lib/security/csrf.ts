/**
 * Système de protection CSRF (Cross-Site Request Forgery)
 * Génère et valide des tokens uniques par session
 *
 * CORRECTIONS DE SÉCURITÉ:
 * - Comparaison timing-safe pour éviter les timing attacks
 * - Validation double (client + serveur)
 * - Origin/Referer validation
 */

import { timingSafeEqual } from './secureEncryption';

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_EXPIRY_MS = 3600000; // 1 heure

// Origines autorisées pour la validation
const ALLOWED_ORIGINS = [
  'https://224solution.net',
  'https://www.224solution.net',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000'
];

interface CSRFTokenData {
  token: string;
  expiresAt: string;
  createdAt: string;
  fingerprint: string; // Empreinte du navigateur
}

/**
 * Génère une empreinte du navigateur pour lier le token à la session
 */
const generateFingerprint = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || '0'
  ];

  // Hash simple de l'empreinte
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

/**
 * Générer un token CSRF unique et sécurisé
 */
export const generateCSRFToken = (): string => {
  // Générer token aléatoire avec Web Crypto API (plus sécurisé que CryptoJS)
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Ajouter timestamp pour traçabilité
  const timestamp = Date.now().toString(36);
  const finalToken = `${token}.${timestamp}`;

  // Stocker avec expiration et empreinte
  const tokenData: CSRFTokenData = {
    token: finalToken,
    expiresAt: new Date(Date.now() + CSRF_TOKEN_EXPIRY_MS).toISOString(),
    createdAt: new Date().toISOString(),
    fingerprint: generateFingerprint()
  };

  sessionStorage.setItem(CSRF_TOKEN_KEY, JSON.stringify(tokenData));

  return finalToken;
};

/**
 * Récupérer le token CSRF actuel
 */
export const getCSRFToken = (): string | null => {
  try {
    const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (!stored) {
      return generateCSRFToken();
    }

    const tokenData: CSRFTokenData = JSON.parse(stored);

    // Vérifier expiration
    if (new Date(tokenData.expiresAt) < new Date()) {
      sessionStorage.removeItem(CSRF_TOKEN_KEY);
      return generateCSRFToken();
    }

    return tokenData.token;
  } catch {
    return generateCSRFToken();
  }
};

/**
 * Valider un token CSRF avec comparaison timing-safe
 */
export const validateCSRFToken = (token: string): boolean => {
  try {
    const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (!stored) {
      console.error('🔴 CSRF: Aucun token stocké');
      return false;
    }

    const tokenData: CSRFTokenData = JSON.parse(stored);

    // Vérifier expiration
    if (new Date(tokenData.expiresAt) < new Date()) {
      console.error('🔴 CSRF: Token expiré');
      sessionStorage.removeItem(CSRF_TOKEN_KEY);
      return false;
    }

    // Vérifier l'empreinte du navigateur
    const currentFingerprint = generateFingerprint();
    if (!timingSafeEqual(tokenData.fingerprint, currentFingerprint)) {
      console.error('🔴 CSRF: Empreinte navigateur invalide');
      return false;
    }

    // Comparaison timing-safe pour éviter les timing attacks
    const isValid = timingSafeEqual(tokenData.token, token);

    if (!isValid) {
      console.error('🔴 CSRF: Token invalide');
    }

    return isValid;
  } catch (error) {
    console.error('🔴 CSRF: Erreur validation', error);
    return false;
  }
};

/**
 * Valider l'origine de la requête (protection supplémentaire)
 */
export const validateOrigin = (origin: string | null, referer: string | null): boolean => {
  if (!origin && !referer) {
    // Requêtes same-origin sans Origin ni Referer sont OK
    return true;
  }

  const toCheck = origin || referer || '';

  // Vérifier si l'origine est autorisée
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    try {
      const allowedUrl = new URL(allowed);
      const checkUrl = new URL(toCheck);
      return allowedUrl.origin === checkUrl.origin;
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    console.error('🔴 CSRF: Origine non autorisée:', toCheck);
  }

  return isAllowed;
};

/**
 * Middleware de validation CSRF pour les requêtes
 */
export const csrfMiddleware = (request: Request): { valid: boolean; error?: string } => {
  // Vérifier l'origine
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (!validateOrigin(origin, referer)) {
    return { valid: false, error: 'Origine non autorisée' };
  }

  // Vérifier le token CSRF dans le header
  const csrfToken = request.headers.get('x-csrf-token');
  if (!csrfToken) {
    return { valid: false, error: 'Token CSRF manquant' };
  }

  if (!validateCSRFToken(csrfToken)) {
    return { valid: false, error: 'Token CSRF invalide' };
  }

  return { valid: true };
};

/**
 * Invalider le token CSRF actuel (logout, etc.)
 */
export const invalidateCSRFToken = (): void => {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
};

/**
 * Hook React pour gérer les tokens CSRF
 */
export const useCSRF = () => {
  const getToken = () => getCSRFToken();
  const validate = (token: string) => validateCSRFToken(token);
  const invalidate = () => invalidateCSRFToken();
  const regenerate = () => {
    invalidateCSRFToken();
    return generateCSRFToken();
  };

  return {
    getToken,
    validate,
    invalidate,
    regenerate
  };
};

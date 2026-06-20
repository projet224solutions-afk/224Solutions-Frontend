/**
 * Headers de sécurité HTTP complets
 * Protection contre diverses attaques web
 *
 * CORRECTIONS DE SÉCURITÉ:
 * - Suppression de 'unsafe-inline' et 'unsafe-eval'
 * - Utilisation de nonces pour les scripts inline
 * - CSP stricte pour prévenir XSS
 */

/**
 * Génère un nonce cryptographiquement sécurisé
 */
export function generateCSPNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Construit les headers CSP avec un nonce
 */
export function buildCSPHeader(nonce?: string): string {
  const nonceDirective = nonce ? `'nonce-${nonce}'` : '';

  return [
    "default-src 'self'",
    // Scripts: self + nonce pour inline + domaines de confiance
    `script-src 'self' ${nonceDirective} 'strict-dynamic' https://cdn.jsdelivr.net https://unpkg.com https://js.stripe.com`,
    // Styles: self + nonce pour inline + Google Fonts
    `style-src 'self' ${nonceDirective} https://fonts.googleapis.com`,
    // Fonts
    "font-src 'self' https://fonts.gstatic.com data:",
    // Images
    "img-src 'self' data: https: blob:",
    // Connexions API
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.mapbox.com",
    // Frames
    "frame-src 'self' https://js.stripe.com",
    // Empêcher l'affichage dans une iframe
    "frame-ancestors 'none'",
    // Restrictions supplémentaires
    "base-uri 'self'",
    "form-action 'self'",
    // Bloquer les plugins
    "object-src 'none'",
    // Upgrade des requêtes HTTP vers HTTPS
    "upgrade-insecure-requests"
  ].join('; ');
}

// Headers CSP par défaut (sans nonce - pour les cas où on ne peut pas injecter de nonce)
export const SECURITY_HEADERS = {
  // Content Security Policy - Mode strict
  'Content-Security-Policy': buildCSPHeader(),

  // Empêcher le navigateur de deviner le MIME type
  'X-Content-Type-Options': 'nosniff',

  // Protection XSS intégrée du navigateur
  'X-XSS-Protection': '1; mode=block',

  // Empêcher l'affichage dans une iframe (clickjacking)
  'X-Frame-Options': 'DENY',

  // Force HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Contrôle ce que le navigateur envoie comme referrer
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Politique de permissions
  'Permissions-Policy': [
    'geolocation=(self)',
    'microphone=()',
    'camera=()',
    'payment=(self)',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', ')
};

/**
 * Headers pour Edge Functions Supabase
 */
export const getEdgeFunctionSecurityHeaders = (origin?: string) => {
  const ALLOWED_ORIGINS = [
    'https://224solution.net',
    'https://www.224solution.net',
    'http://localhost:8080',
    'http://localhost:5173'
  ];

  const corsOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    ...SECURITY_HEADERS,
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24h cache preflight
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
};

/**
 * Appliquer headers de sécurité à une réponse
 */
export const applySecurityHeaders = (response: Response, origin?: string): Response => {
  const headers = getEdgeFunctionSecurityHeaders(origin);

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
};

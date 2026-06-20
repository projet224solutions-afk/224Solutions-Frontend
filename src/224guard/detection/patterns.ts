/**
 * 224Guard — motifs de détection.
 *
 * ⚠️ INVIOLABILITÉ DES RÈGLES CŒUR (cf. LOGIC_AUDIT attaque #6) : ces motifs sont des
 * CONSTANTES du bundle, figées (`Object.freeze`), JAMAIS chargées depuis une base de
 * données. La DB ne peut servir qu'à une allowlist ADDITIVE (tuning), jamais à affaiblir
 * un motif critique.
 *
 * Anti-ReDoS : tous les regex utilisent des classes bornées et des quantificateurs
 * non imbriqués (pas de backtracking catastrophique).
 */

import type { AlertType, Severity } from '../core/types';

export interface KeyPattern {
  key: string;
  label: string;
  type: AlertType;
  severity: Severity;
  re: RegExp;
  /** publique par conception → ne PAS alerter en CRITIQUE (score bas, contexte requis). */
  publicByDesign: boolean;
}

/** Motifs INTERDITS au frontend → CRITIQUE/HIGH s'ils apparaissent. */
export const CRITICAL_PATTERNS: readonly KeyPattern[] = Object.freeze([
  {
    key: 'crypto.private_key',
    label: 'Clé privée (PEM)',
    type: 'SECRET_EXPOSED',
    severity: 'CRITICAL',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/,
    publicByDesign: false,
  },
  {
    key: 'stripe.secret',
    label: 'Clé secrète Stripe',
    type: 'SECRET_EXPOSED',
    severity: 'CRITICAL',
    re: /\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{16,64}\b/,
    publicByDesign: false,
  },
  {
    key: 'aws.access_key',
    label: "Clé d'accès AWS",
    type: 'SECRET_EXPOSED',
    severity: 'CRITICAL',
    re: /\bAKIA[0-9A-Z]{16}\b/,
    publicByDesign: false,
  },
  {
    key: 'github.token',
    label: 'Token GitHub',
    type: 'SECRET_EXPOSED',
    severity: 'CRITICAL',
    re: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36}\b|\bgithub_pat_[0-9A-Za-z_]{22,82}\b/,
    publicByDesign: false,
  },
  {
    key: 'slack.token',
    label: 'Token Slack',
    type: 'SECRET_EXPOSED',
    severity: 'CRITICAL',
    re: /\bxox[baprs]-[0-9A-Za-z-]{10,72}\b/,
    publicByDesign: false,
  },
  {
    key: 'redis.url',
    label: 'URL Redis avec mot de passe',
    type: 'SECRET_EXPOSED',
    severity: 'CRITICAL',
    re: /\brediss?:\/\/[^:@\s]*:[^@\s]{4,}@[^\s"'`]+/,
    publicByDesign: false,
  },
  {
    key: 'gcp.service_account',
    label: 'Compte de service GCP (JSON)',
    type: 'SECRET_EXPOSED',
    severity: 'CRITICAL',
    re: /"type"\s*:\s*"service_account"/,
    publicByDesign: false,
  },
  {
    key: 'server.secret_assignment',
    label: 'Secret serveur en dur',
    type: 'SECRET_EXPOSED',
    severity: 'CRITICAL',
    // nom de secret serveur = valeur (>=12 chars). Borné, pas de backtracking imbriqué.
    re: /(?:SERVICE_ROLE_KEY|JWT_SECRET|SECRET_ACCESS_KEY|DB_PASSWORD|TRANSACTION_SECRET_KEY|CCP_ENCRYPTION_KEY|MFA_ENCRYPTION_KEY|INTERNAL_API_KEY|TWILIO_AUTH_TOKEN|RESEND_API_KEY|OPENAI_API_KEY|STRIPE_WEBHOOK_SECRET|PRIVATE_SUPPLIER_API_KEY|ALIEXPRESS_API_SECRET|ALIBABA_API_SECRET)["'`]?\s*[:=]\s*["'`][^"'`\s]{12,200}/,
    publicByDesign: false,
  },
  {
    key: 'twilio.account_sid',
    label: 'Twilio Account SID',
    type: 'SECRET_EXPOSED',
    severity: 'HIGH',
    re: /\bAC[0-9a-f]{32}\b/,
    publicByDesign: false,
  },
]);

/**
 * Motifs PUBLICS par conception → NE PAS alerter en CRITIQUE. Servent à (1) reconnaître
 * et CLASSER une valeur publique, (2) suppression de faux positifs JWT (anon).
 */
export const PUBLIC_PATTERNS: readonly KeyPattern[] = Object.freeze([
  {
    key: 'firebase.api_key',
    label: 'Firebase API Key (publique)',
    type: 'PROVIDER_KEY_PUBLIC',
    severity: 'LOW',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/,
    publicByDesign: true,
  },
  {
    key: 'stripe.publishable',
    label: 'Clé publishable Stripe (publique)',
    type: 'PROVIDER_KEY_PUBLIC',
    severity: 'LOW',
    re: /\bpk_(?:live|test)_[0-9a-zA-Z]{16,64}\b/,
    publicByDesign: true,
  },
  {
    key: 'mapbox.public',
    label: 'Token Mapbox public',
    type: 'PROVIDER_KEY_PUBLIC',
    severity: 'LOW',
    re: /\bpk\.eyJ[0-9A-Za-z._-]{20,400}/,
    publicByDesign: true,
  },
]);

/** Structure d'un JWT (3 segments base64url). Le RÔLE est décodé par PatternMatcher. */
export const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

/** Ensemble des clés de motifs CRITIQUES (pour interdire l'allowlist dessus). */
export const CRITICAL_PATTERN_KEYS: ReadonlySet<string> = new Set([
  ...CRITICAL_PATTERNS.map((p) => p.key),
  'supabase.service_role', // motif JWT spécial (décodage du claim)
]);

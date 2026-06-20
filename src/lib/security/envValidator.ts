/**
 * Validation et Protection des Variables d'Environnement
 * 224Solutions - Vista-Flows
 *
 * Ce module:
 * - Valide les variables d'environnement au démarrage
 * - Protège contre l'exposition accidentelle de secrets
 * - Fournit un accès sécurisé aux configurations
 */

/**
 * Liste des variables d'environnement requises
 */
const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
] as const;

/**
 * Variables optionnelles mais recommandées
 */
const OPTIONAL_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_AGORA_APP_ID',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'VITE_GOOGLE_CLOUD_API_KEY'
] as const;

/**
 * Variables qui ne doivent JAMAIS être exposées côté client
 */
const FORBIDDEN_CLIENT_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'INTERNAL_API_KEY',
  'DATABASE_URL',
  'PRIVATE_KEY'
] as const;

/**
 * Résultat de la validation
 */
interface ValidationResult {
  isValid: boolean;
  missingRequired: string[];
  missingOptional: string[];
  exposedSecrets: string[];
  warnings: string[];
}

/**
 * Valide les variables d'environnement
 */
export function validateEnvVars(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    missingRequired: [],
    missingOptional: [],
    exposedSecrets: [],
    warnings: []
  };

  // Vérifier les variables requises
  for (const varName of REQUIRED_ENV_VARS) {
    if (!import.meta.env[varName]) {
      result.missingRequired.push(varName);
      result.isValid = false;
    }
  }

  // Vérifier les variables optionnelles
  for (const varName of OPTIONAL_ENV_VARS) {
    if (!import.meta.env[varName]) {
      result.missingOptional.push(varName);
      result.warnings.push(`Variable optionnelle manquante: ${varName}`);
    }
  }

  // Vérifier qu'aucun secret n'est exposé côté client
  for (const varName of FORBIDDEN_CLIENT_VARS) {
    // En Vite, seules les vars VITE_* sont exposées, mais vérifions quand même
    if ((import.meta.env as Record<string, string>)[varName]) {
      result.exposedSecrets.push(varName);
      result.isValid = false;
    }
  }

  // Vérifier la présence de patterns de secrets dans les valeurs VITE_*
  const envEntries = Object.entries(import.meta.env);
  for (const [key, value] of envEntries) {
    if (key.startsWith('VITE_') && typeof value === 'string') {
      // Détecter les patterns de secrets potentiellement mal placés
      if (value.includes('service_role') || value.includes('secret') || value.includes('private')) {
        result.warnings.push(`Valeur suspecte dans ${key} - vérifiez que ce n'est pas un secret`);
      }
    }
  }

  return result;
}

/**
 * Affiche le résultat de la validation dans la console (dev uniquement)
 */
export function logValidationResult(result: ValidationResult): void {
  if (import.meta.env.PROD) return;

  console.group('[EnvValidator] Validation des variables d\'environnement');

  if (result.isValid) {
    console.log('%c✓ Toutes les variables requises sont présentes', 'color: green');
  } else {
    console.error('%c✗ Validation échouée', 'color: red');
  }

  if (result.missingRequired.length > 0) {
    console.error('Variables requises manquantes:', result.missingRequired);
  }

  if (result.missingOptional.length > 0) {
    console.warn('Variables optionnelles manquantes:', result.missingOptional);
  }

  if (result.exposedSecrets.length > 0) {
    console.error('%c⚠️ SECRETS EXPOSÉS CÔTÉ CLIENT!', 'color: red; font-weight: bold');
    console.error('Variables dangereuses détectées:', result.exposedSecrets);
  }

  if (result.warnings.length > 0) {
    console.warn('Avertissements:', result.warnings);
  }

  console.groupEnd();
}

/**
 * Configuration sécurisée de l'application
 * Centralise l'accès aux variables d'environnement avec des valeurs par défaut
 */
export const secureConfig = {
  // Supabase
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL as string,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string
  },

  // Firebase
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined
  },

  // Agora
  agora: {
    appId: import.meta.env.VITE_AGORA_APP_ID as string | undefined
  },

  // Stripe
  stripe: {
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
  },

  // Google Cloud
  googleCloud: {
    apiKey: import.meta.env.VITE_GOOGLE_CLOUD_API_KEY as string | undefined
  },

  // Application
  app: {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    mode: import.meta.env.MODE
  }
} as const;

/**
 * Masque partiellement une valeur sensible pour le logging
 */
export function maskSensitiveValue(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars * 2) {
    return '*'.repeat(8);
  }
  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  return `${start}${'*'.repeat(8)}${end}`;
}

/**
 * Initialise la validation au démarrage de l'application
 */
export function initEnvValidation(): void {
  const result = validateEnvVars();
  logValidationResult(result);

  if (!result.isValid && import.meta.env.PROD) {
    // En production, on peut choisir de bloquer le démarrage
    // throw new Error('Configuration invalide - vérifiez les variables d\'environnement');
    console.error('[CRITICAL] Configuration invalide détectée en production');
  }

  if (result.exposedSecrets.length > 0) {
    // Toujours bloquer si des secrets sont exposés
    throw new Error('SÉCURITÉ: Secrets exposés côté client détectés!');
  }
}

export default {
  validateEnvVars,
  logValidationResult,
  secureConfig,
  maskSensitiveValue,
  initEnvValidation
};

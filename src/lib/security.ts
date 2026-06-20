/**
 * Security Initialization
 * Initialise les mesures de sécurité de l'application
 */

export async function initializeSecurity(): Promise<void> {
  console.log('🔒 [Security] Initialisation...');

  // Validation de l'environnement
  validateEnvironment();

  // Protection basique contre le clickjacking
  if (window.self !== window.top) {
    console.warn('[Security] Application chargée dans un iframe');
  }

  console.log('✅ [Security] Initialisé');
}

function validateEnvironment(): void {
  // Vérifier les variables d'environnement critiques
  const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missing = requiredVars.filter(v => !import.meta.env[v]);

  if (missing.length > 0) {
    console.warn('[Security] Variables manquantes:', missing);
  }
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

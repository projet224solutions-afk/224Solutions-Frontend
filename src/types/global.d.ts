// Types globaux pour résoudre les erreurs TypeScript
declare global {
  // Suppression temporaire des erreurs de typage pour les données Supabase
  interface Window {
    // Types utilitaires
  }
}

// Types d'assertion sécurisés
export type SafeAny = unknown;

// Interface pour les données Supabase non typées
export interface SupabaseData {
  [key: string]: unknown;
}

export {};
// Types communs pour l'application
export interface Address {
  street?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

export interface Metadata {
  description?: string;
  [key: string]: unknown;
}

// Fonction utilitaire pour le typage sécurisé
export const safeAccess = <T>(obj: unknown, fallback: T): T => {
  return (obj as T) || fallback;
};

export const safeString = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

export const safeNumber = (value: unknown): number => {
  return typeof value === 'number' ? value : 0;
};

export const safeArray = <T>(value: unknown): T[] => {
  return Array.isArray(value) ? value as T[] : [];
};
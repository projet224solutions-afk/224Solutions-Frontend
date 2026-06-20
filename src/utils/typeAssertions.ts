// Utilitaires pour les assertions de type sécurisées
export const safeGet = (obj: Record<string, unknown>, key: string, fallback: unknown = null) => {
  return obj && typeof obj === 'object' && key in obj ? obj[key] : fallback;
};

export const safeArray = <T>(value: unknown, fallback: T[] = []): T[] => {
  return Array.isArray(value) ? value as T[] : fallback;
};

export const safeString = (value: unknown, fallback: string = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

export const safeNumber = (value: unknown, fallback: number = 0): number => {
  return typeof value === 'number' ? value : fallback;
};

export const safeBoolean = (value: unknown, fallback: boolean = false): boolean => {
  return typeof value === 'boolean' ? value : fallback;
};

// Fonction pour mapper les données Supabase de manière sécurisée
export const mapSupabaseData = <T>(data: unknown[], mapper: (item: unknown) => T): T[] => {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map(mapper);
};
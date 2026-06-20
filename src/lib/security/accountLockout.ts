/**
 * Système de verrouillage de compte après échecs de connexion
 * Empêche les attaques par force brute
 */

interface LockoutRecord {
  attempts: number;
  lockedUntil: string | null;
  lastAttempt: string;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Récupérer l'enregistrement de tentatives pour un identifiant
 */
export const getLockoutRecord = (identifier: string): LockoutRecord => {
  const key = `lockout_${identifier}`;
  const stored = localStorage.getItem(key);

  if (!stored) {
    return {
      attempts: 0,
      lockedUntil: null,
      lastAttempt: new Date().toISOString()
    };
  }

  try {
    return JSON.parse(stored);
  } catch {
    return {
      attempts: 0,
      lockedUntil: null,
      lastAttempt: new Date().toISOString()
    };
  }
};

/**
 * Sauvegarder l'enregistrement de tentatives
 */
const saveLockoutRecord = (identifier: string, record: LockoutRecord): void => {
  const key = `lockout_${identifier}`;
  localStorage.setItem(key, JSON.stringify(record));
};

/**
 * Vérifier si un compte est verrouillé
 */
export const isAccountLocked = (identifier: string): { locked: boolean; remainingTime?: number } => {
  const record = getLockoutRecord(identifier);

  if (!record.lockedUntil) {
    return { locked: false };
  }

  const lockedUntil = new Date(record.lockedUntil);
  const now = new Date();

  if (now < lockedUntil) {
    const remainingMs = lockedUntil.getTime() - now.getTime();
    return {
      locked: true,
      remainingTime: Math.ceil(remainingMs / 1000) // secondes
    };
  }

  // Le verrouillage a expiré, réinitialiser
  saveLockoutRecord(identifier, {
    attempts: 0,
    lockedUntil: null,
    lastAttempt: now.toISOString()
  });

  return { locked: false };
};

/**
 * Enregistrer une tentative de connexion échouée
 */
export const recordFailedAttempt = (identifier: string): {
  locked: boolean;
  remainingAttempts?: number;
  lockoutDuration?: number;
} => {
  const record = getLockoutRecord(identifier);
  const now = new Date();
  const lastAttempt = new Date(record.lastAttempt);

  // Si la dernière tentative est trop ancienne, réinitialiser
  if (now.getTime() - lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
    record.attempts = 1;
    record.lockedUntil = null;
  } else {
    record.attempts += 1;
  }

  record.lastAttempt = now.toISOString();

  // Verrouiller si trop de tentatives
  if (record.attempts >= MAX_ATTEMPTS) {
    const lockUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
    record.lockedUntil = lockUntil.toISOString();

    saveLockoutRecord(identifier, record);

    return {
      locked: true,
      lockoutDuration: LOCKOUT_DURATION_MS / 1000 // secondes
    };
  }

  saveLockoutRecord(identifier, record);

  return {
    locked: false,
    remainingAttempts: MAX_ATTEMPTS - record.attempts
  };
};

/**
 * Réinitialiser les tentatives après connexion réussie
 */
export const resetFailedAttempts = (identifier: string): void => {
  const key = `lockout_${identifier}`;
  localStorage.removeItem(key);
};

/**
 * Formater le temps de verrouillage restant
 */
export const formatRemainingTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ${secs} seconde${secs > 1 ? 's' : ''}`;
  }

  return `${secs} seconde${secs > 1 ? 's' : ''}`;
};

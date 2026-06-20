/**
 * Offline Authentication - Authentification hors ligne avec PIN et biométrie
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Gère l'authentification locale quand l'utilisateur est hors ligne
 */

import {
  storePINHash,
  verifyPIN,
  hasPINConfigured,
  createSession,
  isSessionValid,
  getUserSession,
  endSession,
  endAllUserSessions
} from '../security/keyManager';

/**
 * Configuration de l'authentification offline
 */
export interface OfflineAuthConfig {
  pinRequired: boolean;          // Code PIN obligatoire
  pinLength: number;              // Longueur du PIN (4 ou 6 chiffres)
  biometricEnabled: boolean;      // Empreinte/Face ID
  sessionTimeout: number;         // Timeout session (minutes)
  maxFailedAttempts: number;      // Max tentatives échouées
  lockoutDuration: number;        // Durée de verrouillage (minutes)
}

const DEFAULT_CONFIG: OfflineAuthConfig = {
  pinRequired: true,
  pinLength: 4,
  biometricEnabled: true,
  sessionTimeout: 30,
  maxFailedAttempts: 3,
  lockoutDuration: 15
};

/**
 * Tentatives de connexion échouées (en mémoire)
 */
const failedAttempts: Map<string, {
  count: number;
  lastAttempt: Date;
  lockedUntil: Date | null;
}> = new Map();

/**
 * Résultat de l'authentification
 */
export interface AuthResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  attemptsRemaining?: number;
  lockedUntil?: Date;
}

/**
 * Vérifier si un utilisateur est verrouillé
 */
function isUserLocked(userId: string, _config: OfflineAuthConfig = DEFAULT_CONFIG): {
  locked: boolean;
  lockedUntil?: Date;
} {
  const attempts = failedAttempts.get(userId);

  if (!attempts || !attempts.lockedUntil) {
    return { locked: false };
  }

  const now = new Date();

  if (now < attempts.lockedUntil) {
    return { locked: true, lockedUntil: attempts.lockedUntil };
  }

  // Verrouillage expiré, réinitialiser
  attempts.count = 0;
  attempts.lockedUntil = null;
  failedAttempts.set(userId, attempts);

  return { locked: false };
}

/**
 * Enregistrer une tentative échouée
 */
function recordFailedAttempt(userId: string, config: OfflineAuthConfig = DEFAULT_CONFIG): number {
  const attempts = failedAttempts.get(userId) || {
    count: 0,
    lastAttempt: new Date(),
    lockedUntil: null
  };

  attempts.count++;
  attempts.lastAttempt = new Date();

  // Verrouiller si max atteint
  if (attempts.count >= config.maxFailedAttempts) {
    const lockoutMs = config.lockoutDuration * 60 * 1000;
    attempts.lockedUntil = new Date(Date.now() + lockoutMs);
    console.warn(`[OfflineAuth] Utilisateur verrouillé: ${userId} (${config.lockoutDuration}min)`);
  }

  failedAttempts.set(userId, attempts);

  const remaining = Math.max(0, config.maxFailedAttempts - attempts.count);
  return remaining;
}

/**
 * Réinitialiser les tentatives échouées
 */
function resetFailedAttempts(userId: string): void {
  failedAttempts.delete(userId);
}

/**
 * Configurer le PIN pour un utilisateur
 */
export async function setupPIN(
  userId: string,
  pin: string,
  config: OfflineAuthConfig = DEFAULT_CONFIG
): Promise<{ success: boolean; error?: string }> {
  // Valider le PIN
  if (pin.length !== config.pinLength) {
    return {
      success: false,
      error: `Le PIN doit contenir ${config.pinLength} chiffres`
    };
  }

  if (!/^\d+$/.test(pin)) {
    return {
      success: false,
      error: 'Le PIN ne doit contenir que des chiffres'
    };
  }

  try {
    await storePINHash(userId, pin);
    console.log('[OfflineAuth] ✅ PIN configuré');

    return { success: true };
  } catch (error: any) {
    console.error('[OfflineAuth] Erreur configuration PIN:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la configuration du PIN'
    };
  }
}

/**
 * Authentifier avec un PIN
 */
export async function authenticateWithPIN(
  userId: string,
  pin: string,
  config: OfflineAuthConfig = DEFAULT_CONFIG
): Promise<AuthResult> {
  // Vérifier le verrouillage
  const lockStatus = isUserLocked(userId, config);
  if (lockStatus.locked) {
    return {
      success: false,
      error: 'Compte temporairement verrouillé',
      lockedUntil: lockStatus.lockedUntil
    };
  }

  try {
    // Vérifier le PIN
    const isValid = await verifyPIN(userId, pin);

    if (!isValid) {
      const remaining = recordFailedAttempt(userId, config);

      if (remaining === 0) {
        const lockStatus = isUserLocked(userId, config);
        return {
          success: false,
          error: `PIN incorrect. Compte verrouillé pendant ${config.lockoutDuration} minutes.`,
          attemptsRemaining: 0,
          lockedUntil: lockStatus.lockedUntil
        };
      }

      return {
        success: false,
        error: `PIN incorrect. ${remaining} tentative(s) restante(s)`,
        attemptsRemaining: remaining
      };
    }

    // PIN correct, réinitialiser les tentatives
    resetFailedAttempts(userId);

    // Créer une session
    const sessionId = await createSession(userId, config.sessionTimeout, {
      pinVerified: true
    });

    console.log('[OfflineAuth] ✅ Authentification PIN réussie');

    return {
      success: true,
      sessionId
    };
  } catch (error: any) {
    console.error('[OfflineAuth] Erreur authentification:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de l\'authentification'
    };
  }
}

/**
 * Vérifier si une session est active
 */
export async function checkSession(sessionId: string): Promise<boolean> {
  return await isSessionValid(sessionId);
}

/**
 * Obtenir la session active d'un utilisateur
 */
export async function getActiveSession(userId: string): Promise<string | null> {
  const session = await getUserSession(userId);
  return session?.session_id || null;
}

/**
 * Déconnexion (terminer la session)
 */
export async function logout(sessionId: string): Promise<void> {
  await endSession(sessionId);
  console.log('[OfflineAuth] ✅ Déconnexion réussie');
}

/**
 * Déconnexion complète (toutes les sessions)
 */
export async function logoutAll(userId: string): Promise<void> {
  const count = await endAllUserSessions(userId);
  console.log(`[OfflineAuth] ✅ ${count} session(s) terminée(s)`);
}

/**
 * Vérifier si un PIN est configuré
 */
export async function isPINConfigured(userId: string): Promise<boolean> {
  return await hasPINConfigured(userId);
}

/**
 * Changer le PIN
 */
export async function changePIN(
  userId: string,
  currentPIN: string,
  newPIN: string,
  config: OfflineAuthConfig = DEFAULT_CONFIG
): Promise<{ success: boolean; error?: string }> {
  // Vérifier le PIN actuel
  const isValid = await verifyPIN(userId, currentPIN);

  if (!isValid) {
    return {
      success: false,
      error: 'PIN actuel incorrect'
    };
  }

  // Configurer le nouveau PIN
  return await setupPIN(userId, newPIN, config);
}

/**
 * Obtenir le nombre de tentatives échouées restantes
 */
export function getRemainingAttempts(
  userId: string,
  config: OfflineAuthConfig = DEFAULT_CONFIG
): number {
  const attempts = failedAttempts.get(userId);

  if (!attempts) {
    return config.maxFailedAttempts;
  }

  return Math.max(0, config.maxFailedAttempts - attempts.count);
}

/**
 * Vérifier si l'utilisateur peut s'authentifier
 */
export function canAuthenticate(
  userId: string,
  config: OfflineAuthConfig = DEFAULT_CONFIG
): {
  allowed: boolean;
  reason?: string;
  lockedUntil?: Date;
} {
  const lockStatus = isUserLocked(userId, config);

  if (lockStatus.locked) {
    return {
      allowed: false,
      reason: `Verrouillé jusqu'à ${lockStatus.lockedUntil?.toLocaleTimeString()}`,
      lockedUntil: lockStatus.lockedUntil
    };
  }

  return { allowed: true };
}

/**
 * Réinitialiser le verrouillage (admin uniquement)
 */
export function unlockUser(userId: string): void {
  failedAttempts.delete(userId);
  console.log(`[OfflineAuth] ✅ Utilisateur déverrouillé: ${userId}`);
}

/**
 * Obtenir les statistiques d'authentification
 */
export function getAuthStats(userId: string): {
  failedAttempts: number;
  lastAttempt: Date | null;
  isLocked: boolean;
  lockedUntil: Date | null;
} {
  const attempts = failedAttempts.get(userId);

  return {
    failedAttempts: attempts?.count || 0,
    lastAttempt: attempts?.lastAttempt || null,
    isLocked: isUserLocked(userId).locked,
    lockedUntil: attempts?.lockedUntil || null
  };
}

export default {
  setupPIN,
  authenticateWithPIN,
  checkSession,
  getActiveSession,
  logout,
  logoutAll,
  isPINConfigured,
  changePIN,
  getRemainingAttempts,
  canAuthenticate,
  unlockUser,
  getAuthStats
};

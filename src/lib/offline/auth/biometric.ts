/**
 * Biometric Authentication - Support de l'authentification biométrique
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Utilise Web Authentication API (WebAuthn) pour Touch ID, Face ID, etc.
 */

import { createSession } from '../security/keyManager';

/**
 * Vérifier si l'authentification biométrique est disponible
 */
export async function isBiometricAvailable(): Promise<{
  available: boolean;
  types: string[];
}> {
  // Vérifier le support de WebAuthn
  if (!window.PublicKeyCredential) {
    return { available: false, types: [] };
  }

  try {
    // Vérifier les authenticators disponibles
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

    if (!available) {
      return { available: false, types: [] };
    }

    // Types possibles (dépend du device)
    const types: string[] = [];

    // Touch ID / Face ID sur iOS/macOS
    if (/(iPhone|iPad|iPod|Mac)/i.test(navigator.userAgent)) {
      types.push('Touch ID / Face ID');
    }

    // Windows Hello
    if (/Windows/i.test(navigator.userAgent)) {
      types.push('Windows Hello');
    }

    // Fingerprint sur Android
    if (/Android/i.test(navigator.userAgent)) {
      types.push('Fingerprint');
    }

    return {
      available: true,
      types: types.length > 0 ? types : ['Biométrie']
    };
  } catch (error) {
    console.error('[Biometric] Erreur détection:', error);
    return { available: false, types: [] };
  }
}

/**
 * Enregistrer les credentials biométriques
 */
export async function registerBiometric(
  userId: string,
  userName: string
): Promise<{ success: boolean; error?: string; credentialId?: string }> {
  try {
    // Vérifier la disponibilité
    const { available } = await isBiometricAvailable();
    if (!available) {
      return {
        success: false,
        error: 'Authentification biométrique non disponible sur cet appareil'
      };
    }

    // Générer un challenge aléatoire
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // Convertir userId en buffer
    const userIdBuffer = new TextEncoder().encode(userId);

    // Options de création de credential
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: '224Solutions Vista Flows',
        id: window.location.hostname
      },
      user: {
        id: userIdBuffer,
        name: userName,
        displayName: userName
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Biométrie intégrée (pas USB key)
        requireResidentKey: false,
        userVerification: 'required' // Vérification biométrique obligatoire
      },
      timeout: 60000,
      attestation: 'none'
    };

    // Créer le credential
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    }) as PublicKeyCredential;

    if (!credential) {
      return {
        success: false,
        error: 'Échec de l\'enregistrement biométrique'
      };
    }

    // Stocker le credential ID dans localStorage (en prod, utiliser IndexedDB chiffré)
    const credentialId = arrayBufferToBase64(credential.rawId);
    localStorage.setItem(`biometric_${userId}`, credentialId);

    console.log('[Biometric] ✅ Credential enregistré');

    return {
      success: true,
      credentialId
    };
  } catch (error: any) {
    console.error('[Biometric] Erreur enregistrement:', error);

    let errorMessage = 'Erreur lors de l\'enregistrement biométrique';

    if (error.name === 'NotAllowedError') {
      errorMessage = 'Permission refusée. Veuillez autoriser l\'authentification biométrique.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'Authentification biométrique non supportée';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Authentifier avec biométrie
 */
export async function authenticateWithBiometric(
  userId: string,
  sessionTimeoutMinutes: number = 30
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    // Vérifier la disponibilité
    const { available } = await isBiometricAvailable();
    if (!available) {
      return {
        success: false,
        error: 'Authentification biométrique non disponible'
      };
    }

    // Récupérer le credential ID
    const credentialId = localStorage.getItem(`biometric_${userId}`);
    if (!credentialId) {
      return {
        success: false,
        error: 'Aucun credential biométrique enregistré. Veuillez d\'abord configurer l\'authentification biométrique.'
      };
    }

    // Générer un challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // Options d'authentification
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [{
        id: base64ToArrayBuffer(credentialId),
        type: 'public-key',
        transports: ['internal'] // Authenticator intégré
      }],
      timeout: 60000,
      userVerification: 'required'
    };

    // Demander l'authentification
    const credential = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    }) as PublicKeyCredential;

    if (!credential) {
      return {
        success: false,
        error: 'Authentification échouée'
      };
    }

    // Créer une session
    const sessionId = await createSession(userId, sessionTimeoutMinutes, {
      biometricVerified: true
    });

    console.log('[Biometric] ✅ Authentification réussie');

    return {
      success: true,
      sessionId
    };
  } catch (error: any) {
    console.error('[Biometric] Erreur authentification:', error);

    let errorMessage = 'Erreur lors de l\'authentification biométrique';

    if (error.name === 'NotAllowedError') {
      errorMessage = 'Authentification annulée ou refusée';
    } else if (error.name === 'InvalidStateError') {
      errorMessage = 'Credential invalide. Veuillez reconfigurer l\'authentification biométrique.';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Vérifier si la biométrie est configurée
 */
export function isBiometricConfigured(userId: string): boolean {
  return localStorage.getItem(`biometric_${userId}`) !== null;
}

/**
 * Supprimer les credentials biométriques
 */
export function removeBiometric(userId: string): void {
  localStorage.removeItem(`biometric_${userId}`);
  console.log('[Biometric] ✅ Credential supprimé');
}

/**
 * Obtenir le type de biométrie disponible (pour l'affichage)
 */
export async function getBiometricType(): Promise<string> {
  const { available, types } = await isBiometricAvailable();

  if (!available) {
    return 'Non disponible';
  }

  return types[0] || 'Biométrie';
}

/**
 * Convertir ArrayBuffer en Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convertir Base64 en ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Tester l'authentification biométrique (prompt utilisateur)
 */
export async function testBiometric(): Promise<boolean> {
  try {
    const { available } = await isBiometricAvailable();
    if (!available) return false;

    // Créer un challenge simple pour tester
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Test',
          id: window.location.hostname
        },
        user: {
          id: new Uint8Array(16),
          name: 'Test',
          displayName: 'Test'
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        },
        timeout: 60000
      }
    });

    return credential !== null;
  } catch (error) {
    console.error('[Biometric] Test échoué:', error);
    return false;
  }
}

export default {
  isBiometricAvailable,
  registerBiometric,
  authenticateWithBiometric,
  isBiometricConfigured,
  removeBiometric,
  getBiometricType,
  testBiometric
};

/**
 * 🔐 AWS COGNITO AUTH SERVICE (v3 - Proxy sécurisé)
 * Utilise une Edge Function proxy pour gérer le SECRET_HASH côté serveur
 * Fallback sur le SDK client si pas de secret configuré
 */

import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { cognitoConfig, isCognitoConfigured } from '@/config/cognito';
import { supabase } from '@/integrations/supabase/client';

// Singleton User Pool (pour les opérations SDK directes)
let userPoolInstance: CognitoUserPool | null = null;

const getUserPool = (): CognitoUserPool | null => {
  if (!isCognitoConfigured()) {
    console.warn('⚠️ [Cognito] Configuration manquante');
    return null;
  }
  if (!userPoolInstance) {
    userPoolInstance = new CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.clientId,
    });
  }
  return userPoolInstance;
};

export interface CognitoAuthResult {
  success: boolean;
  session?: CognitoUserSession;
  user?: CognitoUser;
  error?: string;
  needsConfirmation?: boolean;
  challengeName?: string;
  tokens?: {
    idToken: string;
    accessToken: string;
    refreshToken: string;
  };
}

export interface CognitoTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Appel au proxy Edge Function pour les opérations Cognito
 */
async function callCognitoProxy(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('cognito-auth-proxy', { body });
  if (error) {
    console.error('❌ [Cognito Proxy] Erreur appel:', error);
    throw new Error(error.message || 'Erreur proxy Cognito');
  }
  return data;
}

/**
 * Inscription via Cognito (proxy sécurisé)
 */
export const cognitoSignUp = async (
  email: string,
  password: string,
  attributes: Record<string, string> = {}
): Promise<CognitoAuthResult> => {
  if (!isCognitoConfigured()) {
    return { success: false, error: 'Cognito non configuré' };
  }

  try {
    const result = await callCognitoProxy({
      action: 'signUp',
      email,
      password,
      attributes,
    });

    if (result.error) {
      console.error('❌ [Cognito] Erreur inscription:', result.error);
      return { success: false, error: mapProxyError(result.code, result.error) };
    }

    console.log('✅ [Cognito] Inscription réussie via proxy');
    return {
      success: true,
      needsConfirmation: !result.userConfirmed,
    };
  } catch (err: any) {
    console.error('❌ [Cognito] Erreur inscription:', err.message);
    return { success: false, error: mapProxyError('', err.message) };
  }
};

/**
 * Confirmation du code de vérification (email)
 */
export const cognitoConfirmSignUp = async (
  email: string,
  code: string
): Promise<CognitoAuthResult> => {
  if (!isCognitoConfigured()) {
    return { success: false, error: 'Cognito non configuré' };
  }

  try {
    const result = await callCognitoProxy({
      action: 'confirmSignUp',
      email,
      code,
    });

    if (result.error) {
      return { success: false, error: mapProxyError(result.code, result.error) };
    }

    console.log('✅ [Cognito] Email confirmé via proxy');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: mapProxyError('', err.message) };
  }
};

/**
 * Connexion via Cognito (proxy sécurisé)
 */
export const cognitoSignIn = async (
  email: string,
  password: string
): Promise<CognitoAuthResult> => {
  if (!isCognitoConfigured()) {
    return { success: false, error: 'Cognito non configuré' };
  }

  try {
    const result = await callCognitoProxy({
      action: 'signIn',
      email,
      password,
    });

    if (result.error) {
      console.error('❌ [Cognito] Erreur connexion:', result.error);
      return {
        success: false,
        error: mapProxyError(result.code, result.error),
        challengeName: result.challengeName,
      };
    }

    if (result.challengeName === 'NEW_PASSWORD_REQUIRED') {
      return {
        success: false,
        challengeName: 'NEW_PASSWORD_REQUIRED',
        error: 'Nouveau mot de passe requis',
      };
    }

    if (result.authResult) {
      console.log('✅ [Cognito] Connexion réussie via proxy');
      return {
        success: true,
        tokens: {
          idToken: result.authResult.IdToken,
          accessToken: result.authResult.AccessToken,
          refreshToken: result.authResult.RefreshToken,
        },
      };
    }

    return { success: false, error: 'Réponse inattendue du serveur' };
  } catch (err: any) {
    console.error('❌ [Cognito] Erreur connexion:', err.message);
    return { success: false, error: mapProxyError('', err.message) };
  }
};

/**
 * Déconnexion
 */
export const cognitoSignOut = (): void => {
  const userPool = getUserPool();
  if (!userPool) return;

  const currentUser = userPool.getCurrentUser();
  if (currentUser) {
    currentUser.signOut();
    console.log('✅ [Cognito] Déconnexion réussie');
  }
};

/**
 * Récupérer la session courante (SDK local)
 */
export const cognitoGetCurrentSession = (): Promise<CognitoUserSession | null> => {
  return new Promise((resolve) => {
    const userPool = getUserPool();
    if (!userPool) { resolve(null); return; }

    const currentUser = userPool.getCurrentUser();
    if (!currentUser) { resolve(null); return; }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) { resolve(null); return; }
      resolve(session);
    });
  });
};

/**
 * Récupérer l'utilisateur courant
 */
export const cognitoGetCurrentUser = (): CognitoUser | null => {
  const userPool = getUserPool();
  if (!userPool) return null;
  return userPool.getCurrentUser();
};

/**
 * Extraire les tokens de la session
 */
export const getTokensFromSession = (session: CognitoUserSession): CognitoTokens => {
  return {
    idToken: session.getIdToken().getJwtToken(),
    accessToken: session.getAccessToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
  };
};

/**
 * Réinitialisation du mot de passe - Étape 1 : Envoyer le code (proxy)
 */
export const cognitoForgotPassword = async (email: string): Promise<CognitoAuthResult> => {
  if (!isCognitoConfigured()) {
    return { success: false, error: 'Cognito non configuré' };
  }

  try {
    const result = await callCognitoProxy({
      action: 'forgotPassword',
      email,
    });

    if (result.error) {
      return { success: false, error: mapProxyError(result.code, result.error) };
    }

    console.log('✅ [Cognito] Code de réinitialisation envoyé via proxy');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: mapProxyError('', err.message) };
  }
};

/**
 * Réinitialisation du mot de passe - Étape 2 : Confirmer avec le code (proxy)
 */
export const cognitoConfirmPassword = async (
  email: string,
  code: string,
  newPassword: string
): Promise<CognitoAuthResult> => {
  if (!isCognitoConfigured()) {
    return { success: false, error: 'Cognito non configuré' };
  }

  try {
    const result = await callCognitoProxy({
      action: 'confirmPassword',
      email,
      code,
      newPassword,
    });

    if (result.error) {
      return { success: false, error: mapProxyError(result.code, result.error) };
    }

    console.log('✅ [Cognito] Mot de passe réinitialisé via proxy');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: mapProxyError('', err.message) };
  }
};

/**
 * Rafraîchir la session (token refresh) - SDK local
 */
export const cognitoRefreshSession = (): Promise<CognitoUserSession | null> => {
  return new Promise((resolve) => {
    const userPool = getUserPool();
    if (!userPool) { resolve(null); return; }

    const currentUser = userPool.getCurrentUser();
    if (!currentUser) { resolve(null); return; }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) { resolve(null); return; }

      if (session.isValid()) {
        resolve(session);
      } else {
        const refreshToken = session.getRefreshToken();
        currentUser.refreshSession(refreshToken, (refreshErr, newSession) => {
          if (refreshErr) {
            console.error('❌ [Cognito] Erreur refresh:', refreshErr.message);
            resolve(null);
            return;
          }
          resolve(newSession);
        });
      }
    });
  });
};

/**
 * Mapper les erreurs Cognito en messages lisibles (FR)
 */
function mapProxyError(code: string, message: string): string {
  const normalizedMessage = (message || '').toLowerCase();

  // Cas critique: App Client configuré avec un secret
  if (normalizedMessage.includes('secret_hash') || normalizedMessage.includes('configured with secret')) {
    return 'Configuration Cognito invalide: contactez le support technique.';
  }

  switch (code) {
    case 'UserNotFoundException':
      return 'Aucun compte trouvé avec cet email';
    case 'NotAuthorizedException':
      return 'Email ou mot de passe incorrect';
    case 'UsernameExistsException':
      return 'Un compte existe déjà avec cet email';
    case 'InvalidPasswordException':
      return 'Le mot de passe ne respecte pas les critères de sécurité';
    case 'CodeMismatchException':
      return 'Code de vérification incorrect';
    case 'ExpiredCodeException':
      return 'Le code de vérification a expiré';
    case 'LimitExceededException':
      return 'Trop de tentatives. Réessayez plus tard';
    case 'UserNotConfirmedException':
      return 'Veuillez confirmer votre email avant de vous connecter';
    case 'InvalidParameterException':
      return 'Paramètres invalides. Vérifiez vos informations';
    default:
      return message || 'Une erreur est survenue';
  }
}

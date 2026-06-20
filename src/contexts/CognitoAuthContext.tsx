/**
 * 🔐 COGNITO AUTH CONTEXT
 * Contexte d'authentification utilisant AWS Cognito
 * Coexiste avec Supabase Auth pendant la transition
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { CognitoUserSession } from 'amazon-cognito-identity-js';
import {
  cognitoSignIn,
  cognitoSignUp,
  cognitoSignOut,
  cognitoGetCurrentSession,
  cognitoGetCurrentUser,
  cognitoConfirmSignUp,
  cognitoForgotPassword,
  cognitoConfirmPassword,
  cognitoRefreshSession,
  getTokensFromSession,
  type CognitoAuthResult,
  type CognitoTokens,
} from '@/services/cognitoAuthService';
import { isCognitoConfigured } from '@/config/cognito';
import { syncCognitoProfile } from '@/services/cognitoSyncService';

export interface CognitoProfile {
  cognitoUserId: string;
  email: string;
  role?: string;
  fullName?: string;
  phone?: string;
  emailVerified?: boolean;
}

interface CognitoAuthContextType {
  // État
  isAuthenticated: boolean;
  isLoading: boolean;
  session: CognitoUserSession | null;
  tokens: CognitoTokens | null;
  cognitoProfile: CognitoProfile | null;
  isCognitoEnabled: boolean;

  // Actions
  signIn: (email: string, password: string) => Promise<CognitoAuthResult>;
  signUp: (email: string, password: string, attributes?: Record<string, string>) => Promise<CognitoAuthResult>;
  confirmSignUp: (email: string, code: string) => Promise<CognitoAuthResult>;
  signOut: () => void;
  forgotPassword: (email: string) => Promise<CognitoAuthResult>;
  confirmPassword: (email: string, code: string, newPassword: string) => Promise<CognitoAuthResult>;
  refreshSession: () => Promise<void>;
}

const CognitoAuthContext = createContext<CognitoAuthContextType | undefined>(undefined);

export const CognitoAuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<CognitoUserSession | null>(null);
  const [tokens, setTokens] = useState<CognitoTokens | null>(null);
  const [cognitoProfile, setCognitoProfile] = useState<CognitoProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCognitoEnabled = isCognitoConfigured();

  // Extraire le profil depuis le token ID
  const extractProfileFromSession = useCallback((sess: CognitoUserSession): CognitoProfile => {
    const idToken = sess.getIdToken();
    const payload = idToken.decodePayload();

    return {
      cognitoUserId: payload.sub,
      email: payload.email || '',
      role: payload['custom:role'] || payload['cognito:groups']?.[0] || 'client',
      fullName: payload.name || payload['custom:full_name'] || '',
      phone: payload.phone_number || '',
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    };
  }, []);

  // Mettre à jour l'état depuis une session
  const updateAuthState = useCallback((sess: CognitoUserSession | null) => {
    if (sess && sess.isValid()) {
      setSession(sess);
      setTokens(getTokensFromSession(sess));
      setCognitoProfile(extractProfileFromSession(sess));
    } else {
      setSession(null);
      setTokens(null);
      setCognitoProfile(null);
    }
  }, [extractProfileFromSession]);

  // Initialisation: vérifier session existante
  useEffect(() => {
    if (!isCognitoEnabled) {
      setIsLoading(false);
      return;
    }

    const initSession = async () => {
      try {
        const existingSession = await cognitoGetCurrentSession();
        updateAuthState(existingSession);

        // Sync silencieuse au démarrage si session existante
        if (existingSession && existingSession.isValid()) {
          const idToken = existingSession.getIdToken().getJwtToken();
          syncCognitoProfile(idToken).catch(() => {});
        }
      } catch (_err) {
        console.warn('⚠️ [CognitoAuth] Pas de session existante');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [isCognitoEnabled, updateAuthState]);

  // Auto-refresh token toutes les 50 minutes
  useEffect(() => {
    if (!session) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    refreshIntervalRef.current = setInterval(async () => {
      try {
        const newSession = await cognitoRefreshSession();
        if (newSession) {
          updateAuthState(newSession);
        } else {
          console.warn('⚠️ [CognitoAuth] Session refresh failed, signing out');
          updateAuthState(null);
        }
      } catch (err) {
        console.error('❌ [CognitoAuth] Refresh error, signing out:', err);
        updateAuthState(null);
      }
    }, 50 * 60 * 1000); // 50 min

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [session, updateAuthState]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await cognitoSignIn(email, password);
    if (result.success) {
      // Proxy retourne des tokens directement, SDK retourne une session
      if (result.session) {
        updateAuthState(result.session);
        const idToken = result.session.getIdToken().getJwtToken();
        syncCognitoProfile(idToken).catch(err => {
          console.warn('⚠️ [CognitoAuth] Sync backend échouée (non bloquant):', err);
        });
      } else if (result.tokens) {
        // Proxy mode: on a les tokens mais pas de session SDK locale
        // On met à jour le profil depuis le token ID décodé
        try {
          const payload = JSON.parse(atob(result.tokens.idToken.split('.')[1]));
          setCognitoProfile({
            cognitoUserId: payload.sub,
            email: payload.email || email,
            role: payload['custom:role'] || 'client',
            fullName: payload.name || '',
            phone: payload.phone_number || '',
            emailVerified: payload.email_verified === true,
          });
          setTokens(result.tokens);
        } catch (_e) {
          console.warn('⚠️ [CognitoAuth] Impossible de décoder le token ID');
        }

        if (result.tokens.idToken) {
          syncCognitoProfile(result.tokens.idToken).catch(err => {
            console.warn('⚠️ [CognitoAuth] Sync backend échouée (non bloquant):', err);
          });
        }
      }
    }
    return result;
  }, [updateAuthState]);

  const signUp = useCallback(async (email: string, password: string, attributes?: Record<string, string>) => {
    return cognitoSignUp(email, password, attributes);
  }, []);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    return cognitoConfirmSignUp(email, code);
  }, []);

  const signOutHandler = useCallback(() => {
    cognitoSignOut();
    setSession(null);
    setTokens(null);
    setCognitoProfile(null);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    return cognitoForgotPassword(email);
  }, []);

  const confirmPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    return cognitoConfirmPassword(email, code, newPassword);
  }, []);

  const refreshSessionHandler = useCallback(async () => {
    const newSession = await cognitoRefreshSession();
    updateAuthState(newSession);
  }, [updateAuthState]);

  const value: CognitoAuthContextType = {
    isAuthenticated: !!session && session.isValid(),
    isLoading,
    session,
    tokens,
    cognitoProfile,
    isCognitoEnabled,
    signIn,
    signUp,
    confirmSignUp,
    signOut: signOutHandler,
    forgotPassword,
    confirmPassword,
    refreshSession: refreshSessionHandler,
  };

  return (
    <CognitoAuthContext.Provider value={value}>
      {children}
    </CognitoAuthContext.Provider>
  );
};

export const useCognitoAuth = () => {
  const context = useContext(CognitoAuthContext);
  if (!context) {
    throw new Error('useCognitoAuth must be used within a CognitoAuthProvider');
  }
  return context;
};

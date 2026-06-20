/**
 * Offline Auth Context - Provider d'authentification offline
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Gère l'authentification PIN/biométrique en mode offline
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PINPrompt } from '@/components/vendor/OfflineAuth/PINPrompt';
import {
  checkSession,
  getActiveSession,
  isPINConfigured,
  logout as logoutOffline
} from '@/lib/offline/auth/offlineAuth';
import { useAuth } from '@/hooks/useAuth';

interface OfflineAuthContextType {
  /** Demander l'authentification (affiche le prompt PIN) */
  requireAuth: () => Promise<string | null>;
  /** Session ID active */
  sessionId: string | null;
  /** Vérifier si une session est valide */
  isSessionValid: () => Promise<boolean>;
  /** Déconnexion */
  logout: () => Promise<void>;
  /** PIN est configuré */
  hasPIN: boolean;
}

const OfflineAuthContext = createContext<OfflineAuthContextType | null>(null);

export function OfflineAuthProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [showPIN, setShowPIN] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasPIN, setHasPIN] = useState(false);
  const [resolveAuth, setResolveAuth] = useState<((id: string | null) => void) | null>(null);

  // Vérifier au montage si un PIN est configuré et si une session existe
  useEffect(() => {
    if (user?.id) {
      checkExistingSession();
      checkPINStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const checkExistingSession = async () => {
    if (!user?.id) return;

    try {
      const sessionId = await getActiveSession(user.id);
      if (sessionId) {
        const isValid = await checkSession(sessionId);
        if (isValid) {
          setSessionId(sessionId);
          console.log('[OfflineAuth] Session existante restaurée');
        }
      }
    } catch (error) {
      console.error('[OfflineAuth] Erreur vérification session:', error);
    }
  };

  const checkPINStatus = async () => {
    if (!user?.id) return;

    try {
      const configured = await isPINConfigured(user.id);
      setHasPIN(configured);
    } catch (error) {
      console.error('[OfflineAuth] Erreur vérification PIN:', error);
    }
  };

  /**
   * Demander l'authentification
   * Retourne le session ID ou null si annulé
   */
  const requireAuth = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      // Vérifier si une session valide existe déjà
      if (sessionId) {
        checkSession(sessionId).then(isValid => {
          if (isValid) {
            resolve(sessionId);
            return;
          }

          // Session invalide, en demander une nouvelle
          setResolveAuth(() => resolve);
          setShowPIN(true);
        });
      } else {
        // Pas de session, demander le PIN
        setResolveAuth(() => resolve);
        setShowPIN(true);
      }
    });
  }, [sessionId]);

  /**
   * Vérifier si la session actuelle est valide
   */
  const isSessionValid = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false;
    return await checkSession(sessionId);
  }, [sessionId]);

  /**
   * Déconnexion
   */
  const logout = useCallback(async () => {
    if (sessionId) {
      await logoutOffline(sessionId);
      setSessionId(null);
      console.log('[OfflineAuth] Déconnexion effectuée');
    }
  }, [sessionId]);

  /**
   * Callback quand l'authentification réussit
   */
  const handleAuthSuccess = useCallback((newSessionId: string) => {
    setSessionId(newSessionId);
    setShowPIN(false);
    resolveAuth?.(newSessionId);
    setResolveAuth(null);
  }, [resolveAuth]);

  /**
   * Callback quand l'authentification est annulée
   */
  const handleAuthCancel = useCallback(() => {
    setShowPIN(false);
    resolveAuth?.(null);
    setResolveAuth(null);
  }, [resolveAuth]);

  const contextValue: OfflineAuthContextType = {
    requireAuth,
    sessionId,
    isSessionValid,
    logout,
    hasPIN
  };

  return (
    <OfflineAuthContext.Provider value={contextValue}>
      {children}

      {/* Prompt PIN */}
      {user?.id && (
        <PINPrompt
          isOpen={showPIN}
          onClose={handleAuthCancel}
          onSuccess={handleAuthSuccess}
          userId={user.id}
          title="Authentification Offline"
          description="Entrez votre code PIN pour accéder au mode hors ligne"
          allowBiometric={true}
        />
      )}
    </OfflineAuthContext.Provider>
  );
}

/**
 * Hook pour utiliser l'authentification offline
 */
export function useOfflineAuth(): OfflineAuthContextType {
  const context = useContext(OfflineAuthContext);

  if (!context) {
    throw new Error('useOfflineAuth doit être utilisé dans un OfflineAuthProvider');
  }

  return context;
}

export default OfflineAuthContext;

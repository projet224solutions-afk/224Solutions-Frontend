/**
 * 🛡️ HOOK ROBUSTE - GESTION ERREURS VENDEUR ENTERPRISE
 * Version renforcée avec récupération automatique et monitoring
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export type VendorErrorType =
  | 'product'        // Erreurs gestion produits
  | 'order'          // Erreurs commandes
  | 'payment'        // Erreurs paiement
  | 'network'        // Erreurs réseau/API
  | 'upload'         // Erreurs upload fichiers
  | 'inventory'      // Erreurs stock/inventaire
  | 'kyc'            // Vérification KYC bloquée
  | 'subscription'   // Abonnement expiré/insuffisant
  | 'permission'     // Permissions refusées
  | 'validation'     // Erreurs validation formulaire
  | 'timeout'        // Timeout réseau
  | 'rate_limit'     // Limite de requêtes atteinte
  | 'database'       // Erreur base de données
  | 'unknown';       // Autres erreurs

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface VendorError {
  id: string;
  type: VendorErrorType;
  message: string;
  severity: ErrorSeverity;
  timestamp: Date;
  retryCount: number;
  originalError?: any;
  context?: Record<string, any>;
  recoverable: boolean;
}

interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<VendorErrorType, number>;
  lastErrorTime: Date | null;
  recoveryRate: number;
}

interface RecoveryAction {
  type: VendorErrorType;
  action: () => Promise<void>;
  maxRetries: number;
}

const ERROR_SEVERITY_MAP: Record<VendorErrorType, ErrorSeverity> = {
  product: 'medium',
  order: 'high',
  payment: 'critical',
  network: 'medium',
  upload: 'low',
  inventory: 'medium',
  kyc: 'high',
  subscription: 'high',
  permission: 'high',
  validation: 'low',
  timeout: 'medium',
  rate_limit: 'medium',
  database: 'high',
  unknown: 'medium'
};

const ERROR_MESSAGES: Record<VendorErrorType, string> = {
  product: 'Erreur lors de la gestion du produit',
  order: 'Erreur lors du traitement de la commande',
  payment: 'Erreur de paiement - veuillez réessayer',
  network: 'Problème de connexion réseau',
  upload: 'Erreur lors du téléchargement du fichier',
  inventory: 'Erreur de gestion de stock',
  kyc: 'Vérification KYC requise',
  subscription: 'Abonnement requis ou expiré',
  permission: 'Permissions insuffisantes',
  validation: 'Données invalides',
  timeout: 'La requête a expiré',
  rate_limit: 'Trop de requêtes, veuillez patienter',
  database: 'Erreur de base de données',
  unknown: 'Une erreur inattendue est survenue'
};

const MAX_ERROR_HISTORY = 50;
const AUTO_CLEAR_DELAY = 10000; // 10 secondes

export function useVendorErrorBoundary() {
  const [currentError, setCurrentError] = useState<VendorError | null>(null);
  const [errorHistory, setErrorHistory] = useState<VendorError[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);

  const recoveryActionsRef = useRef<Map<VendorErrorType, RecoveryAction>>(new Map());
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const errorStatsRef = useRef<ErrorStats>({
    totalErrors: 0,
    errorsByType: {} as Record<VendorErrorType, number>,
    lastErrorTime: null,
    recoveryRate: 100
  });

  // Générer un ID unique pour chaque erreur
  const generateErrorId = useCallback(() => {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Déterminer si une erreur est récupérable
  const isRecoverable = useCallback((type: VendorErrorType): boolean => {
    const nonRecoverable: VendorErrorType[] = ['kyc', 'subscription', 'permission'];
    return !nonRecoverable.includes(type);
  }, []);

  // Classifier une erreur à partir d'un objet Error
  const classifyError = useCallback((error: any): VendorErrorType => {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code?.toLowerCase() || '';

    if (message.includes('timeout') || code.includes('timeout')) return 'timeout';
    if (message.includes('rate limit') || code === '429') return 'rate_limit';
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('permission') || code === '403') return 'permission';
    if (message.includes('payment') || message.includes('stripe')) return 'payment';
    if (message.includes('product')) return 'product';
    if (message.includes('order')) return 'order';
    if (message.includes('stock') || message.includes('inventory')) return 'inventory';
    if (message.includes('kyc') || message.includes('verification')) return 'kyc';
    if (message.includes('subscription')) return 'subscription';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('database') || message.includes('postgres')) return 'database';
    if (message.includes('upload') || message.includes('file')) return 'upload';

    return 'unknown';
  }, []);

  // Capturer une erreur
  const captureError = useCallback((
    type: VendorErrorType,
    message: string,
    originalError?: any,
    context?: Record<string, any>
  ) => {
    const errorId = generateErrorId();
    const severity = ERROR_SEVERITY_MAP[type];
    const retryKey = `${type}_${message}`;
    const currentRetry = retryCountRef.current.get(retryKey) || 0;

    const vendorError: VendorError = {
      id: errorId,
      type,
      message: message || ERROR_MESSAGES[type],
      severity,
      timestamp: new Date(),
      retryCount: currentRetry,
      originalError,
      context,
      recoverable: isRecoverable(type)
    };

    // Log structuré
    console.error(`[VendorError] ${severity.toUpperCase()} - ${type}:`, {
      id: errorId,
      message,
      context,
      originalError
    });

    // Mettre à jour les stats
    errorStatsRef.current.totalErrors++;
    errorStatsRef.current.errorsByType[type] =
      (errorStatsRef.current.errorsByType[type] || 0) + 1;
    errorStatsRef.current.lastErrorTime = new Date();

    // Ajouter à l'historique
    setErrorHistory(prev => {
      const newHistory = [vendorError, ...prev].slice(0, MAX_ERROR_HISTORY);
      return newHistory;
    });

    // Définir l'erreur courante
    setCurrentError(vendorError);

    // Afficher un toast selon la sévérité
    switch (severity) {
      case 'critical':
        toast.error(message, { duration: 10000 });
        break;
      case 'high':
        toast.error(message, { duration: 7000 });
        break;
      case 'medium':
        toast.warning(message, { duration: 5000 });
        break;
      case 'low':
        toast.info(message, { duration: 3000 });
        break;
    }

    // Incrémenter le compteur de retry
    retryCountRef.current.set(retryKey, currentRetry + 1);

    return vendorError;
  }, [generateErrorId, isRecoverable]);

  // Capturer automatiquement depuis une exception
  const captureException = useCallback((
    error: any,
    context?: Record<string, any>
  ) => {
    const type = classifyError(error);
    const message = error?.message || ERROR_MESSAGES[type];
    return captureError(type, message, error, context);
  }, [classifyError, captureError]);

  // Effacer l'erreur courante
  const clearError = useCallback(() => {
    setCurrentError(null);
  }, []);

  // Effacer toutes les erreurs
  const clearAllErrors = useCallback(() => {
    setCurrentError(null);
    setErrorHistory([]);
    retryCountRef.current.clear();
  }, []);

  // Enregistrer une action de récupération
  const registerRecoveryAction = useCallback((
    type: VendorErrorType,
    action: () => Promise<void>,
    maxRetries: number = 3
  ) => {
    recoveryActionsRef.current.set(type, { type, action, maxRetries });
  }, []);

  // Tenter la récupération
  const attemptRecovery = useCallback(async (error?: VendorError) => {
    const targetError = error || currentError;
    if (!targetError || !targetError.recoverable) return false;

    const recoveryAction = recoveryActionsRef.current.get(targetError.type);
    if (!recoveryAction) return false;

    if (targetError.retryCount >= recoveryAction.maxRetries) {
      console.warn(`[VendorError] Max retries reached for ${targetError.type}`);
      return false;
    }

    setIsRecovering(true);

    try {
      await recoveryAction.action();

      // Succès de la récupération
      clearError();
      toast.success('Récupération réussie');

      // Mettre à jour le taux de récupération
      const stats = errorStatsRef.current;
      stats.recoveryRate = Math.round(
        ((stats.totalErrors - errorHistory.length) / stats.totalErrors) * 100
      );

      return true;
    } catch (recoveryError) {
      console.error('[VendorError] Recovery failed:', recoveryError);
      captureError(
        targetError.type,
        `Échec de la récupération: ${targetError.message}`,
        recoveryError
      );
      return false;
    } finally {
      setIsRecovering(false);
    }
  }, [currentError, errorHistory.length, clearError, captureError]);

  // Wrapper pour exécuter des opérations avec gestion d'erreurs
  const withErrorHandling = useCallback(<T>(
    type: VendorErrorType,
    operation: () => Promise<T>,
    options?: {
      onError?: (error: VendorError) => void;
      context?: Record<string, any>;
      silent?: boolean;
    }
  ): Promise<T | null> => {
    return operation().catch((error) => {
      const vendorError = captureError(
        type,
        error?.message || ERROR_MESSAGES[type],
        error,
        options?.context
      );
      options?.onError?.(vendorError);
      return null;
    });
  }, [captureError]);

  // Obtenir les statistiques
  const getStats = useCallback((): ErrorStats => {
    return { ...errorStatsRef.current };
  }, []);

  // Auto-clear des erreurs non-critiques après un délai
  useEffect(() => {
    if (!currentError) return;

    if (currentError.severity === 'low' || currentError.severity === 'medium') {
      const timer = setTimeout(() => {
        clearError();
      }, AUTO_CLEAR_DELAY);

      return () => clearTimeout(timer);
    }
  }, [currentError, clearError]);

  // Nettoyer les compteurs de retry périodiquement
  useEffect(() => {
    const interval = setInterval(() => {
      const _now = Date.now();
      retryCountRef.current.forEach((count, key) => {
        // Reset après 5 minutes
        if (count > 0) {
          retryCountRef.current.set(key, Math.max(0, count - 1));
        }
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    // État
    error: currentError,
    errorHistory,
    isRecovering,
    hasError: currentError !== null,

    // Actions principales
    captureError,
    captureException,
    clearError,
    clearAllErrors,

    // Récupération
    registerRecoveryAction,
    attemptRecovery,

    // Utilitaires
    withErrorHandling,
    getStats,
    classifyError,

    // Helpers
    isRecoverable,
    errorCount: errorHistory.length,
    lastError: errorHistory[0] || null
  };
}

export default useVendorErrorBoundary;

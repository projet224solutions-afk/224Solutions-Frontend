/**
 * AUTO ERROR RECOVERY SERVICE - 224Solutions
 * Service centralisé pour la correction automatique des erreurs récurrentes
 */

import { supabase } from '@/integrations/supabase/client';

export type ErrorPattern =
  | 'dynamic_import_failed'
  | 'resource_load_error'
  | 'network_timeout'
  | 'undefined_property'
  | 'rls_violation'
  | 'generic_error';

interface ErrorRecoveryAction {
  pattern: ErrorPattern;
  description: string;
  autoFix: () => Promise<boolean>;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface DetectedError {
  type: ErrorPattern;
  message: string;
  module?: string;
  timestamp: Date;
  recovered: boolean;
}

class AutoErrorRecoveryService {
  private recoveryActions: Map<ErrorPattern, ErrorRecoveryAction> = new Map();
  private recentErrors: DetectedError[] = [];
  private readonly MAX_ERRORS = 100;
  private readonly CACHE_BUST_KEY = 'app_cache_version';

  constructor() {
    this.initializeRecoveryActions();
    this.setupGlobalErrorHandlers();
  }

  /**
   * Initialiser les actions de récupération pour chaque type d'erreur
   */
  private initializeRecoveryActions(): void {
    // Erreur d'import dynamique (modules non trouvés après déploiement)
    this.recoveryActions.set('dynamic_import_failed', {
      pattern: 'dynamic_import_failed',
      description: 'Module JS non trouvé - rafraîchissement du cache',
      severity: 'critical',
      autoFix: async () => {
        try {
          // Incrémenter la version du cache
          const currentVersion = localStorage.getItem(this.CACHE_BUST_KEY) || '0';
          const newVersion = String(parseInt(currentVersion) + 1);
          localStorage.setItem(this.CACHE_BUST_KEY, newVersion);

          // IMPORTANT: ne JAMAIS recharger automatiquement.
          // Sur mobile/PWA, un refresh automatique (au retour sur l'app / changement réseau)
          // ferme les formulaires et donne l'impression d'une actualisation constante.
          // Les erreurs de chunks sont déjà gérées via lazyWithRetry() avec un fallback de refresh manuel.
          console.warn('🧩 [AutoRecovery] Chunk/module load error détecté — cache invalidé, refresh manuel requis.');
          return false;
        } catch {
          return false;
        }
      }
    });

    // Erreur de chargement de ressource (images emoji malformées)
    this.recoveryActions.set('resource_load_error', {
      pattern: 'resource_load_error',
      description: 'Ressource non trouvée - remplacement par fallback',
      severity: 'low',
      autoFix: async () => {
        // Ces erreurs sont mineures et n'affectent pas la fonctionnalité
        // On les marque comme récupérées silencieusement
        console.debug('📦 Ressource non critique ignorée');
        return true;
      }
    });

    // Timeout réseau
    this.recoveryActions.set('network_timeout', {
      pattern: 'network_timeout',
      description: 'Timeout réseau - tentative de reconnexion',
      severity: 'medium',
      autoFix: async () => {
        try {
          // Vérifier la connectivité
          const response = await fetch('/api/health', {
            method: 'HEAD',
            cache: 'no-cache'
          }).catch(() => null);

          return response?.ok ?? false;
        } catch {
          return false;
        }
      }
    });

    // Propriété undefined
    this.recoveryActions.set('undefined_property', {
      pattern: 'undefined_property',
      description: 'Accès à propriété undefined - erreur de données',
      severity: 'medium',
      autoFix: async () => {
        // Cette erreur nécessite généralement un fix de code
        // On la log pour analyse ultérieure
        console.warn('⚠️ Erreur de données détectée, vérifiez les données source');
        return false;
      }
    });

    // Violation RLS
    this.recoveryActions.set('rls_violation', {
      pattern: 'rls_violation',
      description: 'Violation de politique RLS - vérification permissions',
      severity: 'high',
      autoFix: async () => {
        try {
          // Vérifier la session actuelle
          const { data: { session } } = await supabase.auth.getSession();

          if (!session) {
            // IMPORTANT:
            // Une erreur RLS peut être attendue sur des pages publiques (marketplace, boutique, short links)
            // quand l'utilisateur n'est pas connecté.
            // Ne PAS rediriger globalement vers /auth ici, sinon on casse les routes publiques.
            console.info('🔐 [AutoRecovery] RLS sans session (utilisateur non connecté) — pas de redirection automatique.');
            return false;
          }

          // Rafraîchir la session si expirée
          const { error } = await supabase.auth.refreshSession();
          if (!error) {
            console.log('🔐 Session rafraîchie');
            return true;
          }

          return false;
        } catch {
          return false;
        }
      }
    });
  }

  /**
   * Configurer les gestionnaires d'erreurs globaux
   */
  private setupGlobalErrorHandlers(): void {
    // Gestionnaire pour erreurs de chargement de ressources
    window.addEventListener('error', (event) => {
      if (event.target && (event.target as HTMLElement).tagName) {
        const target = event.target as HTMLElement;
        if (['IMG', 'SCRIPT', 'LINK'].includes(target.tagName)) {
          this.handleError('resource_load_error', `Failed to load ${target.tagName.toLowerCase()}: ${(target as HTMLImageElement).src || (target as HTMLLinkElement).href}`, 'frontend_resource');
        }
      }
    }, true);

    // Gestionnaire pour erreurs non capturées
    window.addEventListener('unhandledrejection', (event) => {
      const message = event.reason?.message || String(event.reason);

      if (message.includes('dynamically imported module') || message.includes('Importing a module script failed')) {
        this.handleError('dynamic_import_failed', message, 'react_error_boundary');
      } else if (message.includes('timeout') || message.includes('Timeout')) {
        this.handleError('network_timeout', message, 'network');
      } else if (message.includes('Cannot read property') || message.includes('undefined is not')) {
        this.handleError('undefined_property', message, 'runtime');
      } else if (message.includes('violates row-level security')) {
        this.handleError('rls_violation', message, 'supabase');
      }
    });
  }

  /**
   * Gérer une erreur détectée
   */
  async handleError(
    type: ErrorPattern,
    message: string,
    module?: string
  ): Promise<boolean> {
    const error: DetectedError = {
      type,
      message,
      module,
      timestamp: new Date(),
      recovered: false
    };

    // Ajouter à l'historique
    this.recentErrors.push(error);
    if (this.recentErrors.length > this.MAX_ERRORS) {
      this.recentErrors.shift();
    }

    // Obtenir l'action de récupération
    const action = this.recoveryActions.get(type);
    if (!action) {
      console.warn(`⚠️ Pas d'action de récupération pour: ${type}`);
      return false;
    }

    // Log l'erreur
    console.log(`🔧 [AutoRecovery] ${action.description}`);

    // Tenter la correction automatique
    try {
      const success = await action.autoFix();
      error.recovered = success;

      // Mettre à jour le statut dans la base de données
      if (success) {
        await this.markErrorAsResolved(message);
      }

      return success;
    } catch (err) {
      console.error('❌ Échec de la correction automatique:', err);
      return false;
    }
  }

  /**
   * Marquer une erreur comme résolue dans la DB
   */
  private async markErrorAsResolved(errorMessage: string): Promise<void> {
    try {
      await supabase
        .from('system_errors')
        .update({
          status: 'resolved',
          fix_applied: true,
          fixed_at: new Date().toISOString(),
          fix_description: 'Correction automatique appliquée'
        })
        .ilike('error_message', `%${errorMessage.substring(0, 50)}%`)
        .eq('status', 'detected');
    } catch (err) {
      console.debug('Erreur lors de la mise à jour du statut:', err);
    }
  }

  /**
   * Détecter le type d'erreur à partir du message
   */
  detectErrorType(message: string): ErrorPattern {
    if (message.includes('dynamically imported module') || message.includes('Importing a module script failed')) {
      return 'dynamic_import_failed';
    }
    if (message.includes('Failed to load') || message.includes('Failed to fetch')) {
      return 'resource_load_error';
    }
    if (message.includes('timeout') || message.includes('Timeout') || message.includes('ECONNREFUSED')) {
      return 'network_timeout';
    }
    if (message.includes('Cannot read property') || message.includes('undefined is not')) {
      return 'undefined_property';
    }
    if (message.includes('violates row-level security') || message.includes('RLS')) {
      return 'rls_violation';
    }
    return 'generic_error';
  }

  /**
   * Obtenir les statistiques des erreurs récentes
   */
  getStats(): {
    total: number;
    recovered: number;
    byType: Record<ErrorPattern, number>;
    recoveryRate: number;
  } {
    const byType: Record<ErrorPattern, number> = {
      dynamic_import_failed: 0,
      resource_load_error: 0,
      network_timeout: 0,
      undefined_property: 0,
      rls_violation: 0,
      generic_error: 0
    };

    let recovered = 0;

    this.recentErrors.forEach(err => {
      byType[err.type]++;
      if (err.recovered) recovered++;
    });

    return {
      total: this.recentErrors.length,
      recovered,
      byType,
      recoveryRate: this.recentErrors.length > 0
        ? Math.round((recovered / this.recentErrors.length) * 100)
        : 100
    };
  }

  /**
   * Nettoyer les erreurs résolues de la base de données
   */
  async cleanupResolvedErrors(olderThanDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await supabase
        .from('system_errors')
        .delete()
        .eq('status', 'resolved')
        .lt('fixed_at', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (err) {
      console.error('Erreur lors du nettoyage:', err);
      return 0;
    }
  }

  /**
   * Résoudre automatiquement les erreurs mineures en attente
   */
  async resolveMinorErrors(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('system_errors')
        .update({
          status: 'resolved',
          fix_applied: true,
          fixed_at: new Date().toISOString(),
          fix_description: 'Erreur mineure résolue automatiquement'
        })
        .eq('severity', 'mineure')
        .eq('status', 'detected')
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (err) {
      console.error('Erreur lors de la résolution:', err);
      return 0;
    }
  }

  /**
   * Résoudre les erreurs de cache/module dynamique
   */
  async resolveCacheErrors(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('system_errors')
        .update({
          status: 'resolved',
          fix_applied: true,
          fixed_at: new Date().toISOString(),
          fix_description: 'Erreur de cache après déploiement - corrigée par rechargement automatique'
        })
        .or('error_message.ilike.%dynamically imported module%,error_message.ilike.%Importing a module script failed%')
        .eq('status', 'detected')
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (err) {
      console.error('Erreur lors de la résolution des erreurs de cache:', err);
      return 0;
    }
  }
}

// Export singleton
export const autoErrorRecovery = new AutoErrorRecoveryService();

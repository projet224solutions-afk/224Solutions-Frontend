/**
 * 🔍 SYSTÈME D'AUDIT ET DE MONITORING SÉCURITÉ
 * Surveillance complète de toutes les activités du système
 */

import { supabase } from '@/integrations/supabase/client';
import { SecurityLogger } from './SecurityLayer';

/**
 * Types d'événements de sécurité
 */
export enum SecurityEventType {
  // Authentification
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',

  // Accès aux ressources
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PERMISSION_DENIED = 'permission_denied',
  RESOURCE_ACCESS = 'resource_access',

  // Transactions financières
  WALLET_TRANSACTION = 'wallet_transaction',
  PAYMENT_CREATED = 'payment_created',
  PAYMENT_FAILED = 'payment_failed',
  WITHDRAWAL_ATTEMPT = 'withdrawal_attempt',

  // Modifications de données
  DATA_CREATED = 'data_created',
  DATA_UPDATED = 'data_updated',
  DATA_DELETED = 'data_deleted',

  // Sécurité
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  CSRF_VIOLATION = 'csrf_violation',
  XSS_ATTEMPT = 'xss_attempt',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',

  // Système
  SESSION_EXPIRED = 'session_expired',
  API_ERROR = 'api_error',
  CONFIGURATION_CHANGE = 'configuration_change'
}

/**
 * Interface pour un événement de sécurité
 */
export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  ip?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  success: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Classe principale du système d'audit
 */
export class SecurityAuditSystem {
  private static instance: SecurityAuditSystem;
  private eventQueue: SecurityEvent[] = [];
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 30000; // 30 secondes
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.startAutoFlush();
  }

  /**
   * Singleton
   */
  public static getInstance(): SecurityAuditSystem {
    if (!SecurityAuditSystem.instance) {
      SecurityAuditSystem.instance = new SecurityAuditSystem();
    }
    return SecurityAuditSystem.instance;
  }

  /**
   * Enregistrer un événement de sécurité
   */
  public logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    };

    // Ajouter à la queue
    this.eventQueue.push(fullEvent);

    // Logger dans la console en dev
    if (import.meta.env.DEV) {
      console.log(`🔐 [AUDIT] ${event.type}`, event);
    }

    // Logger dans SecurityLogger
    SecurityLogger.log(`Security event: ${event.type}`, event);

    // Flush si la queue est pleine
    if (this.eventQueue.length >= this.BATCH_SIZE) {
      this.flush();
    }

    // Alerte immédiate pour événements critiques
    if (event.severity === 'critical') {
      this.handleCriticalEvent(fullEvent);
    }
  }

  /**
   * Envoyer les événements vers la base de données
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Insérer dans la table audit_logs avec le bon format
      // @ts-ignore - typage temporaire
      const { error } = await supabase
        .from('audit_logs')
        .insert(
          events.map(event => ({
            action: event.action,
            actor_id: event.userId || '',
            actor_type: 'user',
            target_type: event.resourceType || null,
            target_id: event.resourceId || null,
            ip_address: event.ip || null,
            user_agent: event.userAgent || null,
            data_json: {
              ...event.details,
              event_type: event.type,
              success: event.success,
              severity: event.severity
            },
            created_at: new Date().toISOString()
          }))
        );

      if (error) {
        console.error('❌ Erreur lors du flush des événements de sécurité:', error);
        // Remettre les événements dans la queue
        this.eventQueue.unshift(...events);
      } else {
        console.log(`✅ ${events.length} événements de sécurité enregistrés`);
      }
    } catch (error) {
      console.error('❌ Exception lors du flush:', error);
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Démarrer le flush automatique
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Arrêter le flush automatique
   */
  public stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }

  /**
   * Gérer un événement critique
   */
  private async handleCriticalEvent(event: SecurityEvent): Promise<void> {
    console.error('🚨 ÉVÉNEMENT CRITIQUE DÉTECTÉ:', event);

    // Envoyer une notification immédiate (email, SMS, webhook)
    try {
      await supabase.functions.invoke('send-security-alert', {
        body: {
          event,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Erreur envoi alerte critique:', error);
    }
  }

  /**
   * Forcer l'envoi de tous les événements en attente
   */
  public async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * Récupérer les événements récents pour un utilisateur
   */
  public async getUserEvents(
    userId: string,
    limit: number = 100
  ): Promise<SecurityEvent[]> {
    const { data, error } = await supabase
      .from('security_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erreur récupération événements:', error);
      return [];
    }

    return (data || []).map(row => ({
      type: row.event_type as SecurityEventType,
      userId: row.user_id,
      ip: row.ip_address,
      userAgent: row.user_agent,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      action: row.action,
      success: row.success,
      severity: row.severity,
      details: row.details,
      timestamp: new Date(row.created_at)
    }));
  }

  /**
   * Détecter des patterns suspects
   */
  public async detectSuspiciousPatterns(userId: string): Promise<{
    suspicious: boolean;
    reasons: string[];
  }> {
    const events = await this.getUserEvents(userId, 1000);
    const reasons: string[] = [];

    // 1. Trop de tentatives de connexion échouées
    const failedLogins = events.filter(
      e => e.type === SecurityEventType.LOGIN_FAILED
    ).length;
    if (failedLogins > 5) {
      reasons.push(`${failedLogins} tentatives de connexion échouées`);
    }

    // 2. Accès non autorisés répétés
    const unauthorizedAccess = events.filter(
      e => e.type === SecurityEventType.UNAUTHORIZED_ACCESS
    ).length;
    if (unauthorizedAccess > 3) {
      reasons.push(`${unauthorizedAccess} tentatives d'accès non autorisé`);
    }

    // 3. Transactions suspectes
    const failedPayments = events.filter(
      e => e.type === SecurityEventType.PAYMENT_FAILED
    ).length;
    if (failedPayments > 10) {
      reasons.push(`${failedPayments} paiements échoués`);
    }

    // 4. Changements de configuration fréquents
    const configChanges = events.filter(
      e => e.type === SecurityEventType.CONFIGURATION_CHANGE
    ).length;
    if (configChanges > 20) {
      reasons.push(`${configChanges} modifications de configuration`);
    }

    // 5. Violations de sécurité
    const securityViolations = events.filter(
      e => [
        SecurityEventType.XSS_ATTEMPT,
        SecurityEventType.SQL_INJECTION_ATTEMPT,
        SecurityEventType.CSRF_VIOLATION
      ].includes(e.type)
    ).length;
    if (securityViolations > 0) {
      reasons.push(`${securityViolations} violations de sécurité détectées`);
    }

    return {
      suspicious: reasons.length > 0,
      reasons
    };
  }

  /**
   * Générer un rapport de sécurité
   */
  public async generateSecurityReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    topUsers: Array<{ userId: string; count: number }>;
    suspiciousActivities: number;
  }> {
    const { data, error } = await supabase
      .from('security_audit_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error || !data) {
      console.error('Erreur génération rapport:', error);
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySeverity: {},
        topUsers: [],
        suspiciousActivities: 0
      };
    }

    // Statistiques par type
    const eventsByType: Record<string, number> = {};
    data.forEach(event => {
      eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
    });

    // Statistiques par sévérité
    const eventsBySeverity: Record<string, number> = {};
    data.forEach(event => {
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    });

    // Top utilisateurs
    const userCounts: Record<string, number> = {};
    data.forEach(event => {
      if (event.user_id) {
        userCounts[event.user_id] = (userCounts[event.user_id] || 0) + 1;
      }
    });
    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    // Activités suspectes
    const suspiciousActivities = data.filter(event =>
      event.severity === 'critical' || event.severity === 'high'
    ).length;

    return {
      totalEvents: data.length,
      eventsByType,
      eventsBySeverity,
      topUsers,
      suspiciousActivities
    };
  }
}

/**
 * Hook React pour l'audit de sécurité
 */
export const useSecurityAudit = () => {
  const audit = SecurityAuditSystem.getInstance();

  const logEvent = (event: Omit<SecurityEvent, 'timestamp'>) => {
    audit.logEvent(event);
  };

  const getUserEvents = async (userId: string, limit?: number) => {
    return await audit.getUserEvents(userId, limit);
  };

  const detectSuspiciousActivity = async (userId: string) => {
    return await audit.detectSuspiciousPatterns(userId);
  };

  return {
    logEvent,
    getUserEvents,
    detectSuspiciousActivity
  };
};

/**
 * Wrapper pour tracer automatiquement les appels de fonction
 */
export function AuditedFunction(
  eventType: SecurityEventType,
  severity: SecurityEvent['severity'] = 'low'
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const audit = SecurityAuditSystem.getInstance();
      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);

        // Logger le succès
        audit.logEvent({
          type: eventType,
          success: true,
          severity,
          action: propertyKey,
          details: {
            duration: Date.now() - startTime,
            args: args.map(String)
          }
        });

        return result;
      } catch (error) {
        // Logger l'échec
        audit.logEvent({
          type: SecurityEventType.API_ERROR,
          success: false,
          severity: 'high',
          action: propertyKey,
          details: {
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime
          }
        });

        throw error;
      }
    };

    return descriptor;
  };
}

// Export singleton
export const securityAudit = SecurityAuditSystem.getInstance();

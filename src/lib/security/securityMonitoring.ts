/**
 * Système de monitoring de sécurité en temps réel
 * Détection d'anomalies et alertes automatiques
 */

import { supabase } from '@/lib/supabaseClient';

export interface SecurityEvent {
  type: 'login_failed' | 'account_locked' | 'suspicious_activity' | 'csrf_violation' | 'rate_limit_exceeded' | 'unauthorized_access' | 'sql_injection_attempt' | 'xss_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  identifier?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: string;
}

/**
 * Logger un événement de sécurité
 */
export const logSecurityEvent = async (event: Omit<SecurityEvent, 'timestamp'>): Promise<void> => {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date().toISOString()
  };

  // Logger en console pour debugging
  const emoji = getSeverityEmoji(event.severity);
  console.warn(`${emoji} Security Event [${event.severity.toUpperCase()}]: ${event.type}`, event.details);

  try {
    // Enregistrer dans Supabase (using any to bypass type checking for untyped table)
    const { error } = await (supabase as any)
      .from('security_events')
      .insert({
        event_type: event.type,
        severity: event.severity,
        user_id: event.userId,
        identifier: event.identifier,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        details: event.details,
        created_at: fullEvent.timestamp
      });

    if (error) {
      console.error('❌ Erreur enregistrement security event:', error);
    }

    // Alertes automatiques pour événements critiques
    if (event.severity === 'critical') {
      await triggerSecurityAlert(fullEvent);
    }
  } catch (error) {
    console.error('❌ Erreur logging security event:', error);
  }
};

/**
 * Déclencher une alerte de sécurité
 */
const triggerSecurityAlert = async (event: SecurityEvent): Promise<void> => {
  try {
    // Invoquer Edge Function d'alerte
    await supabase.functions.invoke('send-security-alert', {
      body: {
        event_type: event.type,
        severity: event.severity,
        details: event.details,
        timestamp: event.timestamp,
        user_info: {
          userId: event.userId,
          identifier: event.identifier,
          ipAddress: event.ipAddress
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur envoi alerte sécurité:', error);
  }
};

/**
 * Détecter tentative d'injection SQL
 */
export const detectSQLInjection = (input: string): boolean => {
  const sqlPatterns = [
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bSELECT\b.*\bFROM\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(\bDELETE\b.*\bFROM\b)/i,
    /(\bDROP\b.*\bTABLE\b)/i,
    /(\bUPDATE\b.*\bSET\b)/i,
    /(--|\#|\/\*|\*\/)/,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i,
    /(';|";)/
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
};

/**
 * Détecter tentative XSS
 */
export const detectXSS = (input: string): boolean => {
  const xssPatterns = [
    /<script[^>]*>.*<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onerror, etc.
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /eval\s*\(/i,
    /expression\s*\(/i
  ];

  return xssPatterns.some(pattern => pattern.test(input));
};

/**
 * Monitorer tentative d'accès non autorisé
 */
export const monitorUnauthorizedAccess = async (
  resource: string,
  userId?: string,
  requiredRole?: string
): Promise<void> => {
  await logSecurityEvent({
    type: 'unauthorized_access',
    severity: 'high',
    userId,
    details: {
      resource,
      requiredRole,
      attemptedAt: new Date().toISOString()
    }
  });
};

/**
 * Monitorer violations CSRF
 */
export const monitorCSRFViolation = async (
  endpoint: string,
  userId?: string
): Promise<void> => {
  await logSecurityEvent({
    type: 'csrf_violation',
    severity: 'critical',
    userId,
    details: {
      endpoint,
      message: 'Token CSRF manquant ou invalide'
    }
  });
};

/**
 * Monitorer dépassements de rate limit
 */
export const monitorRateLimitExceeded = async (
  identifier: string,
  endpoint: string,
  attempts: number
): Promise<void> => {
  await logSecurityEvent({
    type: 'rate_limit_exceeded',
    severity: 'medium',
    identifier,
    details: {
      endpoint,
      attempts,
      message: 'Trop de requêtes en peu de temps'
    }
  });
};

/**
 * Monitorer activité suspecte
 */
export const monitorSuspiciousActivity = async (
  activityType: string,
  details: Record<string, any>,
  userId?: string
): Promise<void> => {
  await logSecurityEvent({
    type: 'suspicious_activity',
    severity: 'high',
    userId,
    details: {
      activityType,
      ...details
    }
  });
};

/**
 * Obtenir emoji selon sévérité
 */
const getSeverityEmoji = (severity: SecurityEvent['severity']): string => {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
};

/**
 * Statistiques de sécurité
 */
export const getSecurityStats = async (timeframe: 'hour' | 'day' | 'week'): Promise<{
  totalEvents: number;
  criticalEvents: number;
  eventsByType: Record<string, number>;
}> => {
  try {
    const now = new Date();
    let since: Date;

    switch (timeframe) {
      case 'hour':
        since = new Date(now.getTime() - 3600000);
        break;
      case 'day':
        since = new Date(now.getTime() - 86400000);
        break;
      case 'week':
        since = new Date(now.getTime() - 604800000);
        break;
    }

    const { data, error } = await (supabase as any)
      .from('security_events')
      .select('event_type, severity')
      .gte('created_at', since.toISOString());

    if (error || !data) {
      throw error;
    }

    const stats = {
      totalEvents: (data as any[]).length,
      criticalEvents: (data as any[]).filter((e: any) => e.severity === 'critical').length,
      eventsByType: (data as any[]).reduce((acc: any, event: any) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return stats;
  } catch (error) {
    console.error('❌ Erreur récupération stats sécurité:', error);
    return {
      totalEvents: 0,
      criticalEvents: 0,
      eventsByType: {}
    };
  }
};

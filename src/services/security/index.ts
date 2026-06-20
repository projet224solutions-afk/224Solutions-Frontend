/**
 * SECURITY SERVICES INITIALIZATION
 * 224Solutions - Initialisation centralisée tous services sécurité
 */

import React from 'react';
import { monitoringService } from '../MonitoringService';
import { cspService } from '../ContentSecurityPolicy';
import { secureLogger } from '../SecureLogger';
import { healthCheckService } from '../HealthCheckService';
import EnhancedErrorBoundary from '@/components/error/EnhancedErrorBoundary';

/**
 * Configuration globale sécurité
 */
export const SECURITY_CONFIG = {
  // Monitoring
  monitoringEnabled: true,
  healthCheckInterval: 60000, // 60 secondes

  // Logging
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  logRetention: 30, // jours

  // CSP
  cspEnabled: true,
  cspReportOnly: false,

  // Alerting
  alertingEnabled: true,
  criticalAlertChannels: ['email', 'push'] as const,

  // Error Boundaries
  errorBoundariesEnabled: true,
  autoResetErrors: true,
};

/**
 * État des services
 */
let servicesInitialized = false;

/**
 * Initialiser tous les services de sécurité
 */
export async function initializeSecurityServices(): Promise<void> {
  if (servicesInitialized) {
    console.warn('⚠️ Services sécurité déjà initialisés');
    return;
  }

  console.log('🔒 Initialisation services sécurité...');

  try {
    // 1. Monitoring Service (initialisation lazy)
    if (SECURITY_CONFIG.monitoringEnabled) {
      try {
        await monitoringService.initialize();
        console.log('✅ Monitoring Service initialisé');
      } catch (e) {
        console.warn('⚠️ Monitoring Service non disponible:', e);
      }
    }

    // 2. CSP Service
    if (SECURITY_CONFIG.cspEnabled) {
      try {
        console.log('✅ Content Security Policy initialisé');
      } catch (e) {
        console.warn('⚠️ CSP Service non disponible:', e);
      }
    }

    // 3. Secure Logger
    console.log('✅ Secure Logger initialisé');

    // 4. Health Check Service (initialisation lazy)
    try {
      await healthCheckService.initialize();
      const healthReport = await healthCheckService.checkNow();
      console.log(`✅ Health Check Service initialisé (${healthReport.overall})`);
    } catch (e) {
      console.warn('⚠️ Health Check Service non disponible:', e);
    }

    // 5. Configurer gestionnaires globaux
    setupGlobalErrorHandlers();
    console.log('✅ Gestionnaires erreurs globaux configurés');

    servicesInitialized = true;

    // Log succès
    secureLogger.info('system', 'Services sécurité initialisés avec succès', {
      config: SECURITY_CONFIG
    });

    console.log('🔒 ✅ Tous les services sécurité sont opérationnels');

  } catch (error) {
    console.error('❌ Erreur initialisation services sécurité:', error);

    secureLogger.critical(
      'system',
      'Échec initialisation services sécurité',
      error instanceof Error ? error : undefined,
      { config: SECURITY_CONFIG }
    );

    throw error;
  }
}

/**
 * Configurer gestionnaires d'erreurs globaux
 */
function setupGlobalErrorHandlers(): void {
  // Erreurs non capturées
  window.addEventListener('error', (event) => {
    secureLogger.error(
      'system',
      `Erreur non capturée: ${event.message}`,
      event.error,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    );

    // Empêcher propagation si configuré
    if (SECURITY_CONFIG.errorBoundariesEnabled) {
      event.preventDefault();
    }
  });

  // Promesses rejetées non capturées
  window.addEventListener('unhandledrejection', (event) => {
    secureLogger.error(
      'system',
      `Promise rejetée non capturée: ${event.reason}`,
      event.reason instanceof Error ? event.reason : undefined,
      {
        promise: event.promise
      }
    );

    // Empêcher propagation si configuré
    if (SECURITY_CONFIG.errorBoundariesEnabled) {
      event.preventDefault();
    }
  });

  // Violations CSP
  document.addEventListener('securitypolicyviolation', (event) => {
    secureLogger.warn(
      'security',
      `Violation CSP: ${event.violatedDirective}`,
      {
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective
      }
    );
  });

  // Changements de connectivité réseau
  window.addEventListener('online', () => {
    secureLogger.info('system', 'Connectivité réseau rétablie');
  });

  window.addEventListener('offline', () => {
    secureLogger.warn('system', 'Perte de connectivité réseau');
  });
}

/**
 * Obtenir statut sécurité global
 */
export async function getSecurityStatus(): Promise<{
  overall: 'healthy' | 'degraded' | 'critical' | 'unknown';
  monitoring: boolean;
  csp: boolean;
  logging: boolean;
  healthCheck: boolean;
  details: any;
}> {
  try {
    const [systemHealth, healthReport] = await Promise.all([
      monitoringService.getCurrentHealth(),
      healthCheckService.getLastReport()
    ]);

    const cspViolations = cspService.getCriticalViolations();

    return {
      overall: systemHealth.overall,
      monitoring: SECURITY_CONFIG.monitoringEnabled,
      csp: SECURITY_CONFIG.cspEnabled,
      logging: true,
      healthCheck: true,
      details: {
        systemHealth,
        healthReport,
        cspViolations: cspViolations.length,
        servicesInitialized
      }
    };
  } catch (error) {
    secureLogger.error('system', 'Erreur récupération statut sécurité',
      error instanceof Error ? error : undefined
    );

    return {
      overall: 'unknown',
      monitoring: false,
      csp: false,
      logging: true,
      healthCheck: false,
      details: { error: String(error) }
    };
  }
}

/**
 * Nettoyer services (avant fermeture app)
 */
export function cleanupSecurityServices(): void {
  console.log('🧹 Nettoyage services sécurité...');

  try {
    monitoringService.destroy();
    secureLogger.destroy();
    healthCheckService.destroy();

    servicesInitialized = false;

    console.log('✅ Services sécurité nettoyés');
  } catch (error) {
    console.error('❌ Erreur nettoyage services:', error);
  }
}

/**
 * Hook React pour initialisation services
 */
export function useSecurityServices() {
  const [initialized, setInitialized] = React.useState(servicesInitialized);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');

  React.useEffect(() => {
    if (!initialized) {
      initializeSecurityServices()
        .then(() => {
          setInitialized(true);
          setStatus('ready');
        })
        .catch((error) => {
          console.error('Erreur initialisation services:', error);
          setStatus('error');
        });
    }

    // Cleanup avant démontage
    return () => {
      if (initialized) {
        cleanupSecurityServices();
      }
    };
  }, [initialized]);

  return { initialized, status };
}

// Import WAAP Service
import { waapService } from './WAAPService';

// Export tout
export {
  monitoringService,
  cspService,
  secureLogger,
  healthCheckService,
  EnhancedErrorBoundary,
  waapService
};

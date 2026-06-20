/**
 * LOGGER CENTRALISÉ - 224Solutions
 * Remplace console.error/warn avec logging conditionnel production-safe
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

interface LogMetadata {
  [key: string]: any;
}

/**
 * Logger avec fallback vers console en développement
 * et intégration monitoring en production
 */
export const logger = {
  /**
   * Log d'erreur critique
   */
  error: (message: string, error?: unknown, metadata?: LogMetadata) => {
    if (isDevelopment) {
      console.error(`❌ ${message}`, error, metadata);
    }

    if (isProduction) {
      // TODO: Envoyer à Sentry/LogRocket/DataDog
      // sendToMonitoringService('error', message, error, metadata);
    }
  },

  /**
   * Log d'avertissement
   */
  warn: (message: string, metadata?: LogMetadata) => {
    if (isDevelopment) {
      console.warn(`⚠️  ${message}`, metadata);
    }

    if (isProduction) {
      // TODO: Envoyer aux services de monitoring
    }
  },

  /**
   * Log d'information
   */
  info: (message: string, metadata?: LogMetadata) => {
    if (isDevelopment) {
      console.info(`ℹ️  ${message}`, metadata);
    }
  },

  /**
   * Log de debug (développement seulement)
   */
  debug: (message: string, metadata?: LogMetadata) => {
    if (isDevelopment) {
      console.debug(`🔍 ${message}`, metadata);
    }
  },

  /**
   * Log de succès
   */
  success: (message: string, metadata?: LogMetadata) => {
    if (isDevelopment) {
      console.log(`✅ ${message}`, metadata);
    }
  },

  /**
   * Timer pour mesurer performance
   */
  time: (label: string) => {
    if (isDevelopment) {
      console.time(label);
    }
  },

  timeEnd: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  },

  /**
   * Groupement de logs
   */
  group: (label: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  }
};

/**
 * Logger pour erreurs API/Supabase
 */
export const apiLogger = {
  error: (endpoint: string, error: unknown, metadata?: LogMetadata) => {
    logger.error(`API Error: ${endpoint}`, error, metadata);
  },

  success: (endpoint: string, data?: any) => {
    logger.debug(`API Success: ${endpoint}`, { data });
  },

  timeout: (endpoint: string, timeout: number) => {
    logger.warn(`API Timeout: ${endpoint} (${timeout}ms)`);
  }
};

/**
 * Logger pour erreurs de base de données
 */
export const dbLogger = {
  error: (operation: string, table: string, error: unknown) => {
    logger.error(`Database Error: ${operation} on ${table}`, error);
  },

  query: (table: string, operation: string, duration: number) => {
    if (duration > 1000) {
      logger.warn(`Slow query: ${operation} on ${table} took ${duration}ms`);
    } else {
      logger.debug(`Query: ${operation} on ${table} (${duration}ms)`);
    }
  }
};

/**
 * Logger pour erreurs de sécurité
 */
export const securityLogger = {
  warning: (event: string, metadata?: LogMetadata) => {
    logger.warn(`🔒 Security: ${event}`, metadata);

    if (isProduction) {
      // Envoyer alerte sécurité immédiate
    }
  },

  critical: (event: string, metadata?: LogMetadata) => {
    logger.error(`🚨 Security CRITICAL: ${event}`, undefined, metadata);

    if (isProduction) {
      // Alerte sécurité critique - notification PDG
    }
  }
};

/**
 * Logger pour performance
 */
export const perfLogger = {
  measure: (name: string, duration: number) => {
    const threshold = 100; // ms

    if (duration > threshold) {
      logger.warn(`⏱️  Performance: ${name} took ${duration}ms (> ${threshold}ms)`);
    } else {
      logger.debug(`Performance: ${name} took ${duration}ms`);
    }
  },

  componentRender: (componentName: string, renderTime: number) => {
    if (renderTime > 16) { // 60fps = 16ms per frame
      logger.warn(`React render slow: ${componentName} took ${renderTime}ms`);
    }
  }
};

/**
 * Hook pour intégration React
 */
export const useLogger = () => {
  return logger;
};

export default logger;

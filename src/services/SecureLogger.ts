/**
 * SECURE LOGGER SERVICE
 * 224Solutions - Logging centralisé et sécurisé avec masquage données sensibles
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Types
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogCategory =
  | 'auth'
  | 'payment'
  | 'security'
  | 'api'
  | 'database'
  | 'emergency'
  | 'performance'
  | 'user_action'
  | 'system'
  | 'other';

export interface LogEntry {
  id?: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  stack?: string;
  environment: 'development' | 'staging' | 'production';
  masked?: boolean;
}

export interface SensitivePattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Patterns de données sensibles à masquer
 */
const SENSITIVE_PATTERNS: SensitivePattern[] = [
  // Emails
  {
    name: 'email',
    pattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    replacement: '***@$2'
  },
  // Téléphones (format international)
  {
    name: 'phone',
    pattern: /(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
    replacement: '***-***-****'
  },
  // Tokens JWT
  {
    name: 'jwt',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: 'eyJ***MASKED***'
  },
  // Clés API
  {
    name: 'api_key',
    pattern: /(api[_-]?key|apikey|access[_-]?token)["\s:=]+([a-zA-Z0-9_-]{20,})/gi,
    replacement: '$1: ***MASKED***'
  },
  // Mots de passe
  {
    name: 'password',
    pattern: /(password|pwd|pass)["\s:=]+([^\s,"'}]+)/gi,
    replacement: '$1: ***MASKED***'
  },
  // Numéros de carte bancaire
  {
    name: 'credit_card',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '****-****-****-****'
  },
  // IBANs
  {
    name: 'iban',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,
    replacement: '********************'
  },
  // Adresses IP
  {
    name: 'ip',
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    replacement: '***.***.***.***'
  }
];

/**
 * Service de logging sécurisé
 */
class SecureLogger {
  private static instance: SecureLogger;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL = 5000; // 5 secondes
  private environment: 'development' | 'staging' | 'production';

  private constructor() {
    this.environment = this.detectEnvironment();
    this.initializeLogger();
  }

  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }

  /**
   * Détecter environnement
   */
  private detectEnvironment(): 'development' | 'staging' | 'production' {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'development';
      }
      if (window.location.hostname.includes('staging')) {
        return 'staging';
      }
    }
    return 'production';
  }

  /**
   * Initialiser logger
   */
  private initializeLogger(): void {
    // Flush automatique du buffer
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, this.FLUSH_INTERVAL);

    // Flush avant fermeture page
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushLogs();
      });
    }

    console.log('✅ Secure Logger initialisé');
  }

  /**
   * Masquer données sensibles
   */
  private maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      let masked = data;
      SENSITIVE_PATTERNS.forEach(pattern => {
        masked = masked.replace(pattern.pattern, pattern.replacement);
      });
      return masked;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    if (typeof data === 'object' && data !== null) {
      const masked: Record<string, any> = {};
      Object.keys(data).forEach(key => {
        // Masquer complètement certains champs
        if (['password', 'token', 'apiKey', 'secret', 'creditCard'].includes(key)) {
          masked[key] = '***MASKED***';
        } else {
          masked[key] = this.maskSensitiveData(data[key]);
        }
      });
      return masked;
    }

    return data;
  }

  /**
   * Créer log entry
   */
  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      level,
      category,
      message: this.maskSensitiveData(message),
      context: context ? this.maskSensitiveData(context) : undefined,
      timestamp: new Date().toISOString(),
      environment: this.environment,
      masked: true
    };

    // Ajouter userId si disponible
    try {
      const session = JSON.parse(localStorage.getItem('supabase.auth.token') || '{}');
      if (session?.user?.id) {
        entry.userId = session.user.id;
      }
    } catch {
      // Ignorer si erreur parsing session
    }

    // Ajouter stack trace si erreur
    if (error) {
      entry.stack = error.stack;
    }

    return entry;
  }

  /**
   * Ajouter log au buffer
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Console log en développement
    if (this.environment === 'development') {
      this.consoleLog(entry);
    }

    // Flush si buffer plein
    if (this.logBuffer.length >= this.BUFFER_SIZE) {
      this.flushLogs();
    }
  }

  /**
   * Console log (développement uniquement)
   */
  private consoleLog(entry: LogEntry): void {
    const emoji = entry.level === 'debug' ? '🔍'
                : entry.level === 'info' ? 'ℹ️'
                : entry.level === 'warn' ? '⚠️'
                : entry.level === 'error' ? '❌'
                : '🚨';

    const style = entry.level === 'debug' ? 'color: gray'
                : entry.level === 'info' ? 'color: blue'
                : entry.level === 'warn' ? 'color: orange'
                : entry.level === 'error' ? 'color: red'
                : 'color: red; font-weight: bold';

    console.log(
      `%c${emoji} [${entry.category.toUpperCase()}] ${entry.message}`,
      style,
      entry.context || ''
    );

    if (entry.stack) {
      console.log('%cStack trace:', 'color: gray', entry.stack);
    }
  }

  /**
   * Flush logs vers base de données
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Envoyer à Supabase
      const { error } = await (supabase.from as any)('secure_logs').insert(
        logsToFlush.map(log => ({
          level: log.level,
          category: log.category,
          message: log.message,
          context: log.context,
          user_id: log.userId,
          session_id: log.sessionId,
          timestamp: log.timestamp,
          stack: log.stack,
          environment: log.environment,
          masked: log.masked
        }))
      );

      if (error) {
        // Si erreur DB, garder en mémoire pour retry
        console.warn('Erreur flush logs:', error);
        this.logBuffer = [...logsToFlush, ...this.logBuffer];
      }
    } catch (error) {
      console.error('Erreur critique flush logs:', error);
    }
  }

  /**
   * Log debug
   */
  debug(category: LogCategory, message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry('debug', category, message, context);
    this.addToBuffer(entry);
  }

  /**
   * Log info
   */
  info(category: LogCategory, message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry('info', category, message, context);
    this.addToBuffer(entry);
  }

  /**
   * Log warning
   */
  warn(category: LogCategory, message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry('warn', category, message, context);
    this.addToBuffer(entry);
  }

  /**
   * Log error
   */
  error(category: LogCategory, message: string, error?: Error, context?: Record<string, any>): void {
    const entry = this.createLogEntry('error', category, message, context, error);
    this.addToBuffer(entry);

    // Envoyer à monitoring service si disponible
    this.notifyMonitoring(entry);
  }

  /**
   * Log critical
   */
  critical(category: LogCategory, message: string, error?: Error, context?: Record<string, any>): void {
    const entry = this.createLogEntry('critical', category, message, context, error);
    this.addToBuffer(entry);

    // Flush immédiatement pour erreurs critiques
    this.flushLogs();

    // Notifier monitoring
    this.notifyMonitoring(entry);
  }

  /**
   * Notifier monitoring service
   */
  private async notifyMonitoring(entry: LogEntry): Promise<void> {
    if (entry.level === 'error' || entry.level === 'critical') {
      try {
        const { monitoringService } = await import('./MonitoringService');
        await monitoringService.logError(
          entry.level,
          entry.category,
          entry.message,
          entry.context
        );
      } catch (_error) {
        // Ignorer si monitoring service indisponible
      }
    }
  }

  /**
   * Remplacer console.error existants
   */
  replaceConsoleError(): void {
    const originalError = console.error;
    console.error = (...args: any[]) => {
      // Logger de manière sécurisée
      this.error('system', args[0]?.toString() || 'Console error', undefined, {
        args: args.slice(1)
      });

      // Appeler console.error original en dev
      if (this.environment === 'development') {
        originalError.apply(console, args);
      }
    };
  }

  /**
   * Obtenir logs récents (développement uniquement)
   */
  getRecentLogs(limit: number = 50): LogEntry[] {
    if (this.environment !== 'development') {
      return [];
    }
    return this.logBuffer.slice(-limit);
  }

  /**
   * Nettoyer et arrêter logger
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushLogs();
  }
}

// Instance singleton
export const secureLogger = SecureLogger.getInstance();

// Export pour utilisation externe
export default secureLogger;

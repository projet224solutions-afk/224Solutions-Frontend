/**
 * MONITORING EVENT BUS - Pipeline centralisé d'événements monitoring
 * 224Solutions - Production-grade event collection with batching & deduplication
 */

import { supabase } from '@/integrations/supabase/client';

export type MonitoringSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface MonitoringEvent {
  event_type: string;
  source: string;
  severity: MonitoringSeverity;
  message: string;
  metadata?: Record<string, any>;
  user_id?: string;
  response_time_ms?: number;
  status_code?: number;
  service_name?: string;
}

interface AlertRule {
  event_type: string;
  threshold: number;
  window_ms: number;
  severity: MonitoringSeverity;
  title: string;
  dedupe_key: string;
  cooldown_ms: number;
}

const ALERT_RULES: AlertRule[] = [
  {
    event_type: 'auth_failed',
    threshold: 5,
    window_ms: 60_000,
    severity: 'high',
    title: 'Échecs auth répétés',
    dedupe_key: 'auth_brute_force',
    cooldown_ms: 300_000,
  },
  {
    event_type: 'payment_failed',
    threshold: 3,
    window_ms: 120_000,
    severity: 'critical',
    title: 'Échecs paiement multiples',
    dedupe_key: 'payment_failures',
    cooldown_ms: 600_000,
  },
  {
    event_type: 'api_timeout',
    threshold: 5,
    window_ms: 60_000,
    severity: 'high',
    title: 'Timeouts API excessifs',
    dedupe_key: 'api_timeouts',
    cooldown_ms: 300_000,
  },
  {
    event_type: 'db_error',
    threshold: 3,
    window_ms: 60_000,
    severity: 'critical',
    title: 'Erreurs base de données',
    dedupe_key: 'db_errors',
    cooldown_ms: 300_000,
  },
  {
    event_type: 'pwa_data_load_failed',
    threshold: 3,
    window_ms: 120_000,
    severity: 'medium',
    title: 'Échecs chargement PWA',
    dedupe_key: 'pwa_failures',
    cooldown_ms: 600_000,
  },
];

class MonitoringEventBus {
  private static instance: MonitoringEventBus;
  private eventBuffer: MonitoringEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private recentEvents: Map<string, number[]> = new Map();
  private alertCooldowns: Map<string, number> = new Map();
  private readonly BUFFER_SIZE = 20;
  private readonly FLUSH_INTERVAL = 5000;

  private constructor() {}

  static getInstance(): MonitoringEventBus {
    if (!MonitoringEventBus.instance) {
      MonitoringEventBus.instance = new MonitoringEventBus();
    }
    return MonitoringEventBus.instance;
  }

  /**
   * Publier un événement monitoring
   */
  emit(event: MonitoringEvent): void {
    console.debug(`[Monitor] ${event.severity.toUpperCase()} ${event.event_type}: ${event.message}`);

    this.eventBuffer.push(event);
    this.trackForAlerts(event);

    if (this.eventBuffer.length >= this.BUFFER_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
    }
  }

  /**
   * Raccourcis par catégorie
   */
  authSuccess(userId: string, metadata?: Record<string, any>) {
    this.emit({ event_type: 'auth_success', source: 'auth', severity: 'info', message: 'Auth réussie', service_name: 'auth', user_id: userId, metadata });
  }

  authFailed(identifier: string, metadata?: Record<string, any>) {
    this.emit({ event_type: 'auth_failed', source: 'auth', severity: 'medium', message: `Auth échouée: ${identifier}`, service_name: 'auth', metadata: { identifier, ...metadata } });
  }

  paymentSuccess(amount: number, metadata?: Record<string, any>) {
    this.emit({ event_type: 'payment_success', source: 'payments', severity: 'info', message: `Paiement réussi: ${amount}`, service_name: 'payments', metadata: { amount, ...metadata } });
  }

  paymentFailed(reason: string, metadata?: Record<string, any>) {
    this.emit({ event_type: 'payment_failed', source: 'payments', severity: 'high', message: `Paiement échoué: ${reason}`, service_name: 'payments', metadata: { reason, ...metadata } });
  }

  apiError(endpoint: string, statusCode: number, responseTime?: number) {
    this.emit({ event_type: 'api_error', source: 'api', severity: statusCode >= 500 ? 'high' : 'medium', message: `API error ${statusCode}: ${endpoint}`, service_name: 'edge_functions', status_code: statusCode, response_time_ms: responseTime });
  }

  apiTimeout(endpoint: string, timeoutMs: number) {
    this.emit({ event_type: 'api_timeout', source: 'api', severity: 'high', message: `API timeout ${timeoutMs}ms: ${endpoint}`, service_name: 'edge_functions', response_time_ms: timeoutMs });
  }

  dbError(operation: string, error: string) {
    this.emit({ event_type: 'db_error', source: 'database', severity: 'high', message: `DB error: ${operation} - ${error}`, service_name: 'database' });
  }

  frontendError(error: string, metadata?: Record<string, any>) {
    this.emit({ event_type: 'frontend_error', source: 'frontend', severity: 'medium', message: error, service_name: 'pwa', metadata });
  }

  pwaDataLoadFailed(page: string, reason: string) {
    this.emit({ event_type: 'pwa_data_load_failed', source: 'pwa', severity: 'medium', message: `PWA data load failed: ${page} - ${reason}`, service_name: 'pwa', metadata: { page, reason } });
  }

  securityAnomaly(type: string, details: Record<string, any>) {
    this.emit({ event_type: 'anomaly_detected', source: 'security', severity: 'high', message: `Security anomaly: ${type}`, service_name: 'security', metadata: { anomaly_type: type, ...details } });
  }

  orderCreated(orderId: string, metadata?: Record<string, any>) {
    this.emit({ event_type: 'order_created', source: 'orders', severity: 'info', message: `Commande créée: ${orderId}`, service_name: 'orders', metadata: { order_id: orderId, ...metadata } });
  }

  orderFailed(reason: string, metadata?: Record<string, any>) {
    this.emit({ event_type: 'order_failed', source: 'orders', severity: 'high', message: `Commande échouée: ${reason}`, service_name: 'orders', metadata });
  }

  walletError(operation: string, error: string) {
    this.emit({ event_type: 'wallet_error', source: 'wallet', severity: 'high', message: `Wallet error: ${operation} - ${error}`, service_name: 'wallet' });
  }

  /**
   * Suivi pour alertes intelligentes
   */
  private trackForAlerts(event: MonitoringEvent): void {
    const now = Date.now();
    const key = event.event_type;

    if (!this.recentEvents.has(key)) {
      this.recentEvents.set(key, []);
    }

    const timestamps = this.recentEvents.get(key)!;
    timestamps.push(now);

    // Évaluer les règles d'alerte
    for (const rule of ALERT_RULES) {
      if (rule.event_type !== key) continue;

      // Vérifier cooldown
      const lastAlert = this.alertCooldowns.get(rule.dedupe_key) || 0;
      if (now - lastAlert < rule.cooldown_ms) continue;

      // Compter les événements dans la fenêtre
      const windowStart = now - rule.window_ms;
      const recentCount = timestamps.filter(t => t > windowStart).length;

      if (recentCount >= rule.threshold) {
        this.triggerAlert(rule, recentCount);
        this.alertCooldowns.set(rule.dedupe_key, now);
        // Clean old timestamps
        this.recentEvents.set(key, timestamps.filter(t => t > windowStart));
      }
    }
  }

  /**
   * Déclencher une alerte
   */
  private async triggerAlert(rule: AlertRule, count: number): Promise<void> {
    console.warn(`[Monitor] 🚨 ALERT: ${rule.title} (${count} events in window)`);

    try {
      await supabase.from('monitoring_alerts' as any).upsert({
        alert_type: rule.event_type,
        severity: rule.severity,
        source: 'event_bus',
        title: rule.title,
        message: `${count} événements ${rule.event_type} détectés dans la fenêtre de temps`,
        dedupe_key: rule.dedupe_key,
        occurrence_count: count,
        last_seen_at: new Date().toISOString(),
        status: 'open',
        metadata: { threshold: rule.threshold, window_ms: rule.window_ms, count },
      }, { onConflict: 'dedupe_key' });
    } catch (e) {
      console.error('[Monitor] Failed to create alert:', e);
    }
  }

  /**
   * Flush events to database
   */
  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      // Éviter le spam 401/RLS pour les visiteurs non connectés
      if (sessionError || !session) {
        return;
      }

      const { error } = await supabase.from('monitoring_events' as any).insert(
        events.map(e => ({
          event_type: e.event_type,
          source: e.source,
          severity: e.severity,
          message: e.message,
          metadata: e.metadata || {},
          user_id: e.user_id,
          response_time_ms: e.response_time_ms,
          status_code: e.status_code,
          service_name: e.service_name,
        }))
      );

      if (error) {
        const isRlsError = error.message?.toLowerCase().includes('row-level security') || error.code === '42501';
        if (isRlsError) {
          console.warn('[Monitor] monitoring_events insert bloqué par RLS — events ignorés pour cette session.');
          return;
        }
        throw error;
      }
    } catch (e) {
      console.error('[Monitor] Failed to flush events:', e);
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flush();
  }
}

export const monitoringBus = MonitoringEventBus.getInstance();

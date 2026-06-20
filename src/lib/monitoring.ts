/**
 * Monitoring & Error Tracking Avancé
 * Centralise Sentry, métriques de performance et alertes
 */

import * as Sentry from '@sentry/react';

let isInitialized = false;

export async function initMonitoring(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  console.log('📊 [Monitoring] Initialisation avancée...');

  // Initialiser Sentry si DSN disponible
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE || 'development',
      release: `224solutions@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
      ],
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event) {
        // Filtrer les erreurs réseau en mode offline
        if (!navigator.onLine && event.exception) return null;
        // Filtrer les erreurs de chargement de chunks (reload résout)
        if (event.message?.includes('Loading chunk')) return null;
        return event;
      },
    });
    console.log('✅ [Sentry] Initialisé avec tracing et replay');
  }

  // Capturer les erreurs non gérées
  window.addEventListener('error', (event) => {
    const errorData = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    };
    console.error('[Monitoring] Erreur globale:', errorData);

    if (sentryDsn && event.error) {
      Sentry.captureException(event.error, {
        extra: errorData,
        tags: { type: 'uncaught_error' }
      });
    }

    // Enregistrer dans les métriques locales
    performanceTracker.recordError(event.message, event.filename);
  });

  // Capturer les rejections de promesses
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Monitoring] Promise rejetée:', event.reason);

    if (sentryDsn) {
      Sentry.captureException(event.reason, {
        tags: { type: 'unhandled_rejection' }
      });
    }

    performanceTracker.recordError(
      event.reason?.message || String(event.reason),
      'promise_rejection'
    );
  });

  // Performance monitoring
  if (typeof window !== 'undefined' && 'performance' in window) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (timing) {
          const metrics = {
            domContentLoaded: Math.round(timing.domContentLoadedEventEnd - timing.startTime),
            loadComplete: Math.round(timing.loadEventEnd - timing.startTime),
            ttfb: Math.round(timing.responseStart - timing.startTime),
            fcp: 0,
          };

          // First Contentful Paint
          const paintEntries = performance.getEntriesByType('paint');
          const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
          if (fcp) metrics.fcp = Math.round(fcp.startTime);

          console.log('📊 [Performance]', metrics);
          performanceTracker.recordPageLoad(metrics);

          if (sentryDsn) {
            Sentry.setMeasurement('ttfb', metrics.ttfb, 'millisecond');
            Sentry.setMeasurement('fcp', metrics.fcp, 'millisecond');
          }
        }
      }, 0);
    });
  }

  console.log('✅ [Monitoring] Initialisé avec suivi avancé');
}

// ==================== PERFORMANCE TRACKER ====================

interface ErrorEntry {
  message: string;
  source: string;
  timestamp: number;
  count: number;
}

interface PageLoadMetrics {
  domContentLoaded: number;
  loadComplete: number;
  ttfb: number;
  fcp: number;
}

class PerformanceTracker {
  private errors: Map<string, ErrorEntry> = new Map();
  private apiCalls: { endpoint: string; duration: number; status: number; timestamp: number }[] = [];
  private pageLoads: PageLoadMetrics[] = [];
  private readonly MAX_ENTRIES = 100;

  recordError(message: string, source: string) {
    const key = `${message}::${source}`;
    const existing = this.errors.get(key);
    if (existing) {
      existing.count++;
      existing.timestamp = Date.now();
    } else {
      this.errors.set(key, { message, source, timestamp: Date.now(), count: 1 });
    }
    // Limiter
    if (this.errors.size > this.MAX_ENTRIES) {
      const firstKey = this.errors.keys().next().value;
      if (firstKey) this.errors.delete(firstKey);
    }
  }

  recordApiCall(endpoint: string, duration: number, status: number) {
    this.apiCalls.push({ endpoint, duration, status, timestamp: Date.now() });
    if (this.apiCalls.length > this.MAX_ENTRIES) this.apiCalls.shift();
  }

  recordPageLoad(metrics: PageLoadMetrics) {
    this.pageLoads.push(metrics);
    if (this.pageLoads.length > 10) this.pageLoads.shift();
  }

  getStats() {
    const errorsList = Array.from(this.errors.values());
    const totalErrors = errorsList.reduce((s, e) => s + e.count, 0);
    const avgApiTime = this.apiCalls.length > 0
      ? Math.round(this.apiCalls.reduce((s, c) => s + c.duration, 0) / this.apiCalls.length)
      : 0;
    const failedApis = this.apiCalls.filter(c => c.status >= 400).length;

    return {
      totalErrors,
      uniqueErrors: errorsList.length,
      topErrors: errorsList.sort((a, b) => b.count - a.count).slice(0, 5),
      apiCalls: {
        total: this.apiCalls.length,
        avgResponseTime: avgApiTime,
        failureRate: this.apiCalls.length > 0 ? Math.round((failedApis / this.apiCalls.length) * 100) : 0,
      },
      lastPageLoad: this.pageLoads[this.pageLoads.length - 1] || null,
    };
  }
}

export const performanceTracker = new PerformanceTracker();

export function logError(error: Error, context?: Record<string, unknown>): void {
  console.error('[Monitoring] Error:', error.message, { error, context });

  if (Sentry.isInitialized()) {
    Sentry.captureException(error, { extra: context });
  }

  performanceTracker.recordError(error.message, context?.source as string || 'unknown');
}

export function logEvent(name: string, data?: Record<string, unknown>): void {
  console.log(`[Monitoring] Event: ${name}`, data);

  if (Sentry.isInitialized()) {
    Sentry.addBreadcrumb({
      category: 'app.event',
      message: name,
      data,
      level: 'info',
    });
  }
}

export function trackApiCall(endpoint: string, duration: number, status: number): void {
  performanceTracker.recordApiCall(endpoint, duration, status);
}

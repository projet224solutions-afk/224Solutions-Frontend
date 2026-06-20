/**
 * Frontend Error Observer - Captures JS errors, unhandled rejections,
 * chunk load failures and routes them to the monitoring event bus
 */

import { monitoringBus } from '@/services/monitoring/MonitoringEventBus';

let initialized = false;

export function initFrontendObserver(): void {
  if (initialized) return;
  initialized = true;

  // Global JS errors
  window.addEventListener('error', (event) => {
    const isChunkError = event.message?.includes('Loading chunk') ||
                         event.message?.includes('Failed to fetch dynamically');

    monitoringBus.frontendError(
      event.message || 'Unknown error',
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        is_chunk_error: isChunkError,
        is_pwa: window.matchMedia('(display-mode: standalone)').matches,
      }
    );
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason?.toString() || 'Unknown rejection';
    monitoringBus.frontendError(reason, {
      type: 'unhandled_rejection',
      stack: event.reason?.stack?.substring(0, 500),
      is_pwa: window.matchMedia('(display-mode: standalone)').matches,
    });
  });

  // Performance observer for long tasks
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 200) {
            monitoringBus.emit({
              event_type: 'long_task',
              source: 'frontend',
              severity: entry.duration > 1000 ? 'medium' : 'low',
              message: `Long task: ${Math.round(entry.duration)}ms`,
              service_name: 'pwa',
              response_time_ms: Math.round(entry.duration),
              metadata: { name: entry.name },
            });
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (_e) {
      // longtask not supported in all browsers
    }
  }

  console.log('✅ [FrontendObserver] Initialized');
}

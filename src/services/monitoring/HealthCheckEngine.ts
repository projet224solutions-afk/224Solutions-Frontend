/**
 * HEALTH CHECK ENGINE - Delegates to MultiCloudHealthService
 * Kept for backward compatibility with MonitoringDashboard
 * The actual checks are now unified in MultiCloudHealthService
 */

import { multiCloudHealth } from '@/services/MultiCloudHealthService';

export type ServiceStatus = 'healthy' | 'degraded' | 'critical' | 'unknown' | 'maintenance';

export interface HealthCheckResult {
  service_name: string;
  status: ServiceStatus;
  response_time_ms: number;
  message?: string;
}

class HealthCheckEngine {
  private static instance: HealthCheckEngine;
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly CHECK_INTERVAL = 30_000;

  private constructor() {}

  static getInstance(): HealthCheckEngine {
    if (!HealthCheckEngine.instance) {
      HealthCheckEngine.instance = new HealthCheckEngine();
    }
    return HealthCheckEngine.instance;
  }

  start(): void {
    if (this.interval) return;
    console.log('[HealthCheck] Engine started (delegates to MultiCloudHealth)');
    // Don't start a separate check loop - MultiCloudHealth handles it
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async runAllChecks(): Promise<HealthCheckResult[]> {
    // Delegate to MultiCloudHealth and convert results
    const report = await multiCloudHealth.checkAll();
    const results: HealthCheckResult[] = [];

    for (const provider of Object.values(report.providers)) {
      for (const svc of provider.services) {
        const statusMap: Record<string, ServiceStatus> = {
          operational: 'healthy',
          degraded: 'degraded',
          outage: 'critical',
          unknown: 'unknown',
        };
        results.push({
          service_name: svc.serviceName,
          status: statusMap[svc.status] || 'unknown',
          response_time_ms: svc.responseTime,
          message: svc.message,
        });
      }
    }

    return results;
  }

  getLastResults(): Map<string, HealthCheckResult> {
    const map = new Map<string, HealthCheckResult>();
    const report = multiCloudHealth.getLastReport();
    if (!report) return map;

    for (const provider of Object.values(report.providers)) {
      for (const svc of provider.services) {
        const statusMap: Record<string, ServiceStatus> = {
          operational: 'healthy',
          degraded: 'degraded',
          outage: 'critical',
          unknown: 'unknown',
        };
        map.set(svc.serviceName, {
          service_name: svc.serviceName,
          status: statusMap[svc.status] || 'unknown',
          response_time_ms: svc.responseTime,
          message: svc.message,
        });
      }
    }
    return map;
  }
}

export const healthCheckEngine = HealthCheckEngine.getInstance();

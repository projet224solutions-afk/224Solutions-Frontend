/**
 * 🏥 GlobalHealthService - Monitoring multi-région
 * Surveillance de la santé de toutes les régions
 */

import {
  REGIONS,
  RegionConfig,
  RegionHealth,
  getEnabledRegions,
  GLOBAL_CONFIG,
} from '@/config/regions';
import { hybridEventService, KAFKA_TOPICS } from '@/services/kafka';

export interface HealthMetrics {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  regionsStatus: RegionHealth[];
  globalMetrics: {
    totalRequests: number;
    averageLatency: number;
    errorRate: number;
    activeUsers: number;
    peakLoad: number;
  };
  alerts: HealthAlert[];
}

export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  regionId?: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface RegionMetrics {
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  activeConnections: number;
}

class GlobalHealthService {
  private static instance: GlobalHealthService;
  private metrics: Map<string, RegionMetrics> = new Map();
  private alerts: HealthAlert[] = [];
  private healthHistory: HealthMetrics[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeService();
  }

  static getInstance(): GlobalHealthService {
    if (!GlobalHealthService.instance) {
      GlobalHealthService.instance = new GlobalHealthService();
    }
    return GlobalHealthService.instance;
  }

  // ==================== INITIALIZATION ====================

  private initializeService(): void {
    if (typeof window === 'undefined') return;

    // Initialiser les métriques pour chaque région
    getEnabledRegions().forEach(region => {
      this.metrics.set(region.id, {
        requestCount: 0,
        errorCount: 0,
        totalLatency: 0,
        activeConnections: 0,
      });
    });

    // Démarrer le monitoring
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Health checks toutes les 30 secondes
    this.checkInterval = setInterval(
      () => this.performHealthCheck(),
      GLOBAL_CONFIG.loadBalancing.healthCheckInterval
    );

    // Collecte des métriques toutes les minutes
    this.metricsInterval = setInterval(
      () => this.collectMetrics(),
      60000
    );

    // Premier check
    this.performHealthCheck();
  }

  // ==================== HEALTH CHECKS ====================

  async performHealthCheck(): Promise<HealthMetrics> {
    const regions = getEnabledRegions();
    const regionsStatus: RegionHealth[] = [];

    for (const region of regions) {
      const health = await this.checkRegionHealth(region);
      regionsStatus.push(health);

      // Vérifier les seuils d'alerte
      this.checkAlertThresholds(region, health);
    }

    const overallStatus = this.calculateOverallStatus(regionsStatus);
    const globalMetrics = this.calculateGlobalMetrics();

    const healthMetrics: HealthMetrics = {
      timestamp: new Date().toISOString(),
      overallStatus,
      regionsStatus,
      globalMetrics,
      alerts: this.alerts.filter(a => !a.acknowledged),
    };

    // Sauvegarder dans l'historique
    this.healthHistory.push(healthMetrics);
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }

    // Publier sur Kafka si statut critique
    if (overallStatus === 'critical') {
      await hybridEventService.publishEvent(
        KAFKA_TOPICS.SYSTEM_HEALTH,
        healthMetrics,
        { broadcastRealtime: true }
      );
    }

    return healthMetrics;
  }

  private async checkRegionHealth(region: RegionConfig): Promise<RegionHealth> {
    const _startTime = performance.now();
    const metrics = this.metrics.get(region.id);

    try {
      // Simuler un health check
      const latency = await this.measureLatency(region);
      const errorRate = metrics ? (metrics.errorCount / Math.max(1, metrics.requestCount)) * 100 : 0;

      let status: RegionHealth['status'] = 'healthy';
      if (latency > region.latency.threshold) {
        status = 'degraded';
      }
      if (errorRate > 5 || latency > region.latency.threshold * 2) {
        status = 'unhealthy';
      }

      return {
        regionId: region.id,
        status,
        latency,
        lastCheck: new Date().toISOString(),
        uptime: this.calculateUptime(region.id),
        errorRate,
        load: metrics?.activeConnections ? Math.min(100, metrics.activeConnections / 10) : 0,
      };
    } catch (_error) {
      return {
        regionId: region.id,
        status: 'unhealthy',
        latency: -1,
        lastCheck: new Date().toISOString(),
        uptime: 0,
        errorRate: 100,
        load: 0,
      };
    }
  }

  private async measureLatency(region: RegionConfig): Promise<number> {
    // Simulation de latence basée sur la région
    const baseLatency: Record<string, number> = {
      'africa-west': 25 + Math.random() * 20,
      'africa-central': 50 + Math.random() * 30,
      'europe-west': 80 + Math.random() * 40,
      'europe-central': 100 + Math.random() * 40,
      'us-east': 150 + Math.random() * 50,
      'us-west': 180 + Math.random() * 50,
      'asia-east': 250 + Math.random() * 50,
    };

    return baseLatency[region.id] || 100 + Math.random() * 50;
  }

  private calculateUptime(regionId: string): number {
    // Calculer l'uptime basé sur l'historique
    const recentHistory = this.healthHistory.slice(-10);
    if (recentHistory.length === 0) return 100;

    const healthyCount = recentHistory.filter(h => {
      const regionStatus = h.regionsStatus.find(r => r.regionId === regionId);
      return regionStatus?.status === 'healthy';
    }).length;

    return (healthyCount / recentHistory.length) * 100;
  }

  // ==================== ALERTS ====================

  private checkAlertThresholds(region: RegionConfig, health: RegionHealth): void {
    // Alert: High latency
    if (health.latency > region.latency.threshold) {
      this.createAlert({
        severity: health.latency > region.latency.threshold * 2 ? 'critical' : 'warning',
        regionId: region.id,
        message: `High latency detected in ${region.displayName}: ${health.latency.toFixed(0)}ms (threshold: ${region.latency.threshold}ms)`,
      });
    }

    // Alert: High error rate
    if (health.errorRate > 5) {
      this.createAlert({
        severity: health.errorRate > 10 ? 'critical' : 'warning',
        regionId: region.id,
        message: `High error rate in ${region.displayName}: ${health.errorRate.toFixed(2)}%`,
      });
    }

    // Alert: High load
    if (health.load > 80) {
      this.createAlert({
        severity: health.load > 95 ? 'critical' : 'warning',
        regionId: region.id,
        message: `High load in ${region.displayName}: ${health.load.toFixed(0)}%`,
      });
    }

    // Alert: Region unhealthy
    if (health.status === 'unhealthy') {
      this.createAlert({
        severity: 'critical',
        regionId: region.id,
        message: `Region ${region.displayName} is unhealthy`,
      });
    }
  }

  private createAlert(alert: Omit<HealthAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    // Éviter les alertes dupliquées
    const exists = this.alerts.find(
      a => a.regionId === alert.regionId &&
           a.message === alert.message &&
           !a.acknowledged &&
           Date.now() - new Date(a.timestamp).getTime() < 300000 // 5 minutes
    );

    if (exists) return;

    const newAlert: HealthAlert = {
      id: crypto.randomUUID(),
      ...alert,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.alerts.push(newAlert);

    // Garder seulement les 100 dernières alertes
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.log(`🚨 Alert: ${alert.message}`);
  }

  // ==================== METRICS ====================

  private calculateOverallStatus(regionsStatus: RegionHealth[]): 'healthy' | 'degraded' | 'critical' {
    const unhealthyCount = regionsStatus.filter(r => r.status === 'unhealthy').length;
    const degradedCount = regionsStatus.filter(r => r.status === 'degraded').length;
    const total = regionsStatus.length;

    if (unhealthyCount > total / 2) return 'critical';
    if (unhealthyCount > 0 || degradedCount > total / 3) return 'degraded';
    return 'healthy';
  }

  private calculateGlobalMetrics(): HealthMetrics['globalMetrics'] {
    let totalRequests = 0;
    let totalLatency = 0;
    let totalErrors = 0;
    let activeConnections = 0;

    this.metrics.forEach(m => {
      totalRequests += m.requestCount;
      totalLatency += m.totalLatency;
      totalErrors += m.errorCount;
      activeConnections += m.activeConnections;
    });

    return {
      totalRequests,
      averageLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      activeUsers: activeConnections,
      peakLoad: Math.max(...Array.from(this.metrics.values()).map(m => m.activeConnections)),
    };
  }

  private collectMetrics(): void {
    // Reset les compteurs périodiquement pour les métriques de courte durée
    this.metrics.forEach((m, regionId) => {
      // Garder les connexions actives, reset les compteurs
      this.metrics.set(regionId, {
        requestCount: 0,
        errorCount: 0,
        totalLatency: 0,
        activeConnections: m.activeConnections,
      });
    });
  }

  // ==================== PUBLIC API ====================

  recordRequest(regionId: string, latency: number, success: boolean): void {
    const metrics = this.metrics.get(regionId);
    if (metrics) {
      metrics.requestCount++;
      metrics.totalLatency += latency;
      if (!success) metrics.errorCount++;
      this.metrics.set(regionId, metrics);
    }
  }

  updateActiveConnections(regionId: string, count: number): void {
    const metrics = this.metrics.get(regionId);
    if (metrics) {
      metrics.activeConnections = count;
      this.metrics.set(regionId, metrics);
    }
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  getLatestHealth(): HealthMetrics | null {
    return this.healthHistory[this.healthHistory.length - 1] || null;
  }

  getHealthHistory(count: number = 10): HealthMetrics[] {
    return this.healthHistory.slice(-count);
  }

  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  getAllAlerts(): HealthAlert[] {
    return [...this.alerts];
  }

  cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}

export const globalHealthService = GlobalHealthService.getInstance();
export default globalHealthService;

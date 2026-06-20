/**
 * ENTERPRISE SERVICE INITIALIZER - 224Solutions
 * Initialisation centralisée de tous les services robustes
 */

import { circuitBreaker } from '@/lib/circuitBreaker';
import { requestQueue } from '@/lib/requestQueue';
import { autoErrorRecovery } from '@/services/AutoErrorRecoveryService';

interface ServiceStatus {
  name: string;
  initialized: boolean;
  healthy: boolean;
  lastCheck: number | null;
  error?: string;
}

interface InitializationReport {
  success: boolean;
  duration: number;
  services: ServiceStatus[];
  failedCount: number;
}

class EnterpriseServiceInitializer {
  private static instance: EnterpriseServiceInitializer;
  private initialized = false;
  private services: Map<string, ServiceStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): EnterpriseServiceInitializer {
    if (!EnterpriseServiceInitializer.instance) {
      EnterpriseServiceInitializer.instance = new EnterpriseServiceInitializer();
    }
    return EnterpriseServiceInitializer.instance;
  }

  /**
   * Initialiser tous les services Enterprise
   */
  async initialize(): Promise<InitializationReport> {
    if (this.initialized) {
      console.log('✅ Services already initialized');
      return this.getReport(0);
    }

    const startTime = Date.now();
    console.log('🚀 Initializing Enterprise Services...');

    // Initialiser les services de base
    await this.initializeService('CircuitBreaker', async () => {
      // Le circuit breaker est déjà initialisé en tant que singleton
      return true;
    });

    await this.initializeService('RequestQueue', async () => {
      // La request queue est déjà initialisée
      return true;
    });

    await this.initializeService('AutoErrorRecovery', async () => {
      // Le service est déjà actif
      return true;
    });

    await this.initializeService('HealthCheck', async () => {
      const { healthCheckService } = await import('@/services/HealthCheckService');
      await healthCheckService.initialize();
      return true;
    });

    await this.initializeService('Monitoring', async () => {
      const { monitoringService } = await import('@/services/MonitoringService');
      await monitoringService.initialize();
      return true;
    });

    // Démarrer le health check périodique
    this.startHealthChecks();

    this.initialized = true;
    const duration = Date.now() - startTime;

    console.log(`✅ Enterprise Services initialized in ${duration}ms`);

    return this.getReport(duration);
  }

  /**
   * Initialiser un service individuel
   */
  private async initializeService(
    name: string,
    initFn: () => Promise<boolean>
  ): Promise<void> {
    const status: ServiceStatus = {
      name,
      initialized: false,
      healthy: false,
      lastCheck: null
    };

    try {
      const success = await initFn();
      status.initialized = success;
      status.healthy = success;
      status.lastCheck = Date.now();
      console.log(`  ✓ ${name} initialized`);
    } catch (error: any) {
      status.error = error.message;
      console.error(`  ✗ ${name} failed:`, error.message);
    }

    this.services.set(name, status);
  }

  /**
   * Démarrer les health checks périodiques
   */
  private startHealthChecks(): void {
    if (typeof window === 'undefined') return;

    // Health check toutes les 60 secondes
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 60000);
  }

  /**
   * Effectuer un health check de tous les services
   */
  async performHealthCheck(): Promise<void> {
    const now = Date.now();

    // Vérifier Circuit Breaker
    const cbStats = circuitBreaker.getGlobalStats();
    const cbStatus = this.services.get('CircuitBreaker');
    if (cbStatus) {
      cbStatus.healthy = cbStats.overallHealthScore > 80;
      cbStatus.lastCheck = now;
    }

    // Vérifier Request Queue
    const queueStats = requestQueue.getStats();
    const queueStatus = this.services.get('RequestQueue');
    if (queueStatus) {
      queueStatus.healthy = queueStats.failed < queueStats.completed * 0.1; // Moins de 10% d'échecs
      queueStatus.lastCheck = now;
    }

    // Vérifier Auto Error Recovery
    const recoveryStats = autoErrorRecovery.getStats();
    const recoveryStatus = this.services.get('AutoErrorRecovery');
    if (recoveryStatus) {
      recoveryStatus.healthy = recoveryStats.recoveryRate > 70;
      recoveryStatus.lastCheck = now;
    }
  }

  /**
   * Obtenir le rapport d'initialisation
   */
  private getReport(duration: number): InitializationReport {
    const services = Array.from(this.services.values());
    const failedCount = services.filter(s => !s.initialized).length;

    return {
      success: failedCount === 0,
      duration,
      services,
      failedCount
    };
  }

  /**
   * Obtenir le statut d'un service
   */
  getServiceStatus(name: string): ServiceStatus | undefined {
    return this.services.get(name);
  }

  /**
   * Obtenir tous les statuts
   */
  getAllStatuses(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  /**
   * Vérifier si tous les services sont sains
   */
  isHealthy(): boolean {
    return Array.from(this.services.values()).every(s => s.healthy);
  }

  /**
   * Obtenir les métriques globales
   */
  getGlobalMetrics(): {
    circuitBreaker: ReturnType<typeof circuitBreaker.getGlobalStats>;
    requestQueue: ReturnType<typeof requestQueue.getStats>;
    errorRecovery: ReturnType<typeof autoErrorRecovery.getStats>;
    overall: {
      healthy: boolean;
      servicesUp: number;
      servicesTotal: number;
    };
  } {
    const services = Array.from(this.services.values());

    return {
      circuitBreaker: circuitBreaker.getGlobalStats(),
      requestQueue: requestQueue.getStats(),
      errorRecovery: autoErrorRecovery.getStats(),
      overall: {
        healthy: this.isHealthy(),
        servicesUp: services.filter(s => s.healthy).length,
        servicesTotal: services.length
      }
    };
  }

  /**
   * Arrêter tous les services
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    circuitBreaker.destroy();
    requestQueue.destroy();

    this.initialized = false;
    this.services.clear();

    console.log('🛑 Enterprise Services stopped');
  }
}

// Export singleton
export const enterpriseServices = EnterpriseServiceInitializer.getInstance();

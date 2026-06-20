/**
 * CIRCUIT BREAKER PATTERN - 224Solutions Enterprise
 * Protection contre les cascades d'échecs avec récupération automatique
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;      // Nombre d'échecs avant ouverture
  successThreshold: number;      // Nombre de succès pour fermer
  timeout: number;               // Temps avant tentative de fermeture (ms)
  monitorInterval: number;       // Intervalle de vérification (ms)
}

interface CircuitMetrics {
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

interface CircuitBreakerInstance {
  name: string;
  state: CircuitState;
  config: CircuitBreakerConfig;
  metrics: CircuitMetrics;
  stateChangedAt: number;
  lastHealthCheck: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,      // 30 secondes
  monitorInterval: 5000 // 5 secondes
};

export class CircuitBreakerManager {
  private circuits: Map<string, CircuitBreakerInstance> = new Map();
  private listeners: Map<string, Set<(state: CircuitState) => void>> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Obtenir ou créer un circuit breaker
   */
  getCircuit(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreakerInstance {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        name,
        state: 'CLOSED',
        config: { ...DEFAULT_CONFIG, ...config },
        metrics: {
          failures: 0,
          successes: 0,
          lastFailureTime: null,
          lastSuccessTime: null,
          totalRequests: 0,
          totalFailures: 0,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0
        },
        stateChangedAt: Date.now(),
        lastHealthCheck: Date.now()
      });
    }
    return this.circuits.get(name)!;
  }

  /**
   * Exécuter une fonction avec protection circuit breaker
   */
  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuit = this.getCircuit(name, config);

    // Vérifier si le circuit est ouvert
    if (circuit.state === 'OPEN') {
      // Vérifier si le timeout est passé
      if (Date.now() - circuit.stateChangedAt >= circuit.config.timeout) {
        this.transitionTo(circuit, 'HALF_OPEN');
      } else {
        // Circuit ouvert, utiliser fallback ou rejeter
        if (fallback) {
          console.warn(`🔴 [CircuitBreaker:${name}] OPEN - Using fallback`);
          return fallback();
        }
        throw new CircuitBreakerError(name, 'Circuit is OPEN');
      }
    }

    // Exécuter la fonction
    circuit.metrics.totalRequests++;

    try {
      const result = await fn();
      this.recordSuccess(circuit);
      return result;
    } catch (error) {
      this.recordFailure(circuit, error);

      // Utiliser fallback si disponible
      if (fallback) {
        console.warn(`⚠️ [CircuitBreaker:${name}] Failed - Using fallback`);
        return fallback();
      }
      throw error;
    }
  }

  /**
   * Enregistrer un succès
   */
  private recordSuccess(circuit: CircuitBreakerInstance): void {
    circuit.metrics.successes++;
    circuit.metrics.lastSuccessTime = Date.now();
    circuit.metrics.consecutiveSuccesses++;
    circuit.metrics.consecutiveFailures = 0;

    if (circuit.state === 'HALF_OPEN') {
      if (circuit.metrics.consecutiveSuccesses >= circuit.config.successThreshold) {
        this.transitionTo(circuit, 'CLOSED');
      }
    }
  }

  /**
   * Enregistrer un échec
   */
  private recordFailure(circuit: CircuitBreakerInstance, error: any): void {
    circuit.metrics.failures++;
    circuit.metrics.totalFailures++;
    circuit.metrics.lastFailureTime = Date.now();
    circuit.metrics.consecutiveFailures++;
    circuit.metrics.consecutiveSuccesses = 0;

    console.error(`❌ [CircuitBreaker:${circuit.name}] Failure #${circuit.metrics.consecutiveFailures}:`, error);

    if (circuit.state === 'HALF_OPEN') {
      // Un seul échec en HALF_OPEN réouvre le circuit
      this.transitionTo(circuit, 'OPEN');
    } else if (circuit.state === 'CLOSED') {
      if (circuit.metrics.consecutiveFailures >= circuit.config.failureThreshold) {
        this.transitionTo(circuit, 'OPEN');
      }
    }
  }

  /**
   * Transition d'état
   */
  private transitionTo(circuit: CircuitBreakerInstance, newState: CircuitState): void {
    const oldState = circuit.state;
    circuit.state = newState;
    circuit.stateChangedAt = Date.now();

    console.log(`🔄 [CircuitBreaker:${circuit.name}] ${oldState} → ${newState}`);

    // Notifier les listeners
    this.listeners.get(circuit.name)?.forEach(listener => listener(newState));

    // Reset des compteurs selon l'état
    if (newState === 'CLOSED') {
      circuit.metrics.consecutiveFailures = 0;
      circuit.metrics.failures = 0;
    } else if (newState === 'HALF_OPEN') {
      circuit.metrics.consecutiveSuccesses = 0;
    }
  }

  /**
   * Souscrire aux changements d'état
   */
  subscribe(name: string, callback: (state: CircuitState) => void): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    this.listeners.get(name)!.add(callback);

    return () => {
      this.listeners.get(name)?.delete(callback);
    };
  }

  /**
   * Obtenir l'état d'un circuit
   */
  getState(name: string): CircuitState {
    return this.circuits.get(name)?.state || 'CLOSED';
  }

  /**
   * Obtenir les métriques d'un circuit
   */
  getMetrics(name: string): CircuitMetrics | null {
    return this.circuits.get(name)?.metrics || null;
  }

  /**
   * Obtenir tous les circuits
   */
  getAllCircuits(): CircuitBreakerInstance[] {
    return Array.from(this.circuits.values());
  }

  /**
   * Forcer la fermeture d'un circuit (manual recovery)
   */
  forceClose(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      this.transitionTo(circuit, 'CLOSED');
    }
  }

  /**
   * Réinitialiser un circuit
   */
  reset(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.metrics = {
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        totalRequests: 0,
        totalFailures: 0,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0
      };
      this.transitionTo(circuit, 'CLOSED');
    }
  }

  /**
   * Monitoring automatique
   */
  private startMonitoring(): void {
    if (typeof window === 'undefined') return;

    this.monitorInterval = setInterval(() => {
      const now = Date.now();

      this.circuits.forEach(circuit => {
        // Vérifier si le circuit OPEN peut passer en HALF_OPEN
        if (circuit.state === 'OPEN') {
          if (now - circuit.stateChangedAt >= circuit.config.timeout) {
            this.transitionTo(circuit, 'HALF_OPEN');
          }
        }

        circuit.lastHealthCheck = now;
      });
    }, 5000);
  }

  /**
   * Arrêter le monitoring
   */
  destroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Statistiques globales
   */
  getGlobalStats(): {
    totalCircuits: number;
    openCircuits: number;
    closedCircuits: number;
    halfOpenCircuits: number;
    totalRequests: number;
    totalFailures: number;
    overallHealthScore: number;
  } {
    const circuits = Array.from(this.circuits.values());
    const totalRequests = circuits.reduce((sum, c) => sum + c.metrics.totalRequests, 0);
    const totalFailures = circuits.reduce((sum, c) => sum + c.metrics.totalFailures, 0);

    return {
      totalCircuits: circuits.length,
      openCircuits: circuits.filter(c => c.state === 'OPEN').length,
      closedCircuits: circuits.filter(c => c.state === 'CLOSED').length,
      halfOpenCircuits: circuits.filter(c => c.state === 'HALF_OPEN').length,
      totalRequests,
      totalFailures,
      overallHealthScore: totalRequests > 0
        ? Math.round(((totalRequests - totalFailures) / totalRequests) * 100)
        : 100
    };
  }
}

/**
 * Erreur spécifique Circuit Breaker
 */
export class CircuitBreakerError extends Error {
  constructor(public circuitName: string, message: string) {
    super(`[CircuitBreaker:${circuitName}] ${message}`);
    this.name = 'CircuitBreakerError';
  }
}

// Export singleton
export const circuitBreaker = new CircuitBreakerManager();

// Backward-compatible aliases (some legacy code imports these)
export { CircuitBreakerManager as CircuitBreaker };

// Provide both a value and a type for CircuitBreakerState
export const CircuitBreakerState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
} as const;
export type CircuitBreakerState = CircuitState;

// Export types
export type { CircuitBreakerConfig, CircuitMetrics, CircuitBreakerInstance };

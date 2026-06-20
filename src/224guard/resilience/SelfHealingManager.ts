/**
 * 224Guard — auto-guérison (cf. cahier des charges §3.4, LOGIC_AUDIT matrice §2.2).
 * Chaque composant déclare un `check` (sain ?) et un `heal` (réparer). Toutes les N s,
 * on répare les composants défaillants ; après 3 échecs de réparation → alerte
 * `SYSTEM_DEGRADED` (le monitoring continue en mode dégradé).
 */

import type { AlertManager } from '../pipeline/AlertManager';
import type { DisposableRegistry } from '../core/DisposableRegistry';

interface HealthCheck {
  check: () => boolean;
  heal: () => void | Promise<void>;
  failures: number;
}

export class SelfHealingManager {
  private components = new Map<string, HealthCheck>();

  constructor(
    private alerts: AlertManager,
    private registry: DisposableRegistry,
    private intervalMs = 10_000,
  ) {}

  register(name: string, check: () => boolean, heal: () => void | Promise<void>): void {
    this.components.set(name, { check, heal, failures: 0 });
  }

  start(): void {
    this.registry.setInterval(() => void this.runOnce(), this.intervalMs);
  }

  /** Un cycle de healthcheck (public pour les tests). */
  async runOnce(): Promise<void> {
    for (const [name, c] of this.components) {
      try {
        if (c.check()) {
          c.failures = 0;
          continue;
        }
        c.failures++;
        if (c.failures <= 3) {
          await c.heal();
          c.failures = 0;
        } else {
          await this.alerts.emitSystem(
            'SYSTEM_DEGRADED',
            'CRITICAL',
            `Composant 224Guard en échec persistant : ${name}`,
            `health.${name}`,
            'runtime',
          );
        }
      } catch {
        /* une erreur de healthcheck ne doit jamais casser le cycle */
      }
    }
  }
}

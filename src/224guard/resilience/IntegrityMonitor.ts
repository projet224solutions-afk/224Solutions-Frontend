/**
 * 224Guard — moniteur d'intégrité (anti-tamper, cf. LOGIC_AUDIT attaque #2/#4).
 * Vérifie à intervalle JITTERÉ (imprévisible → résiste au timing attack) que notre
 * proxy `fetch` est toujours actif. S'il a été remplacé → alerte CRITIQUE `TAMPER`
 * et réinstallation NON destructive.
 */

import type { AlertManager } from '../pipeline/AlertManager';
import type { DisposableRegistry } from '../core/DisposableRegistry';

interface IntegrityTarget {
  isIntact(): boolean;
  reinstall(): void;
}

export class IntegrityMonitor {
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private net: IntegrityTarget,
    private alerts: AlertManager,
    private registry: DisposableRegistry,
    private baseMs = 1000,
    private jitterMs = 1500,
  ) {}

  start(): void {
    this.registry.add(() => {
      this.stopped = true;
      if (this.timer) clearTimeout(this.timer);
    });
    this.schedule();
  }

  private schedule(): void {
    if (this.stopped) return;
    const delay = this.baseMs + Math.floor(Math.random() * this.jitterMs);
    this.timer = setTimeout(() => {
      this.tick();
      this.schedule();
    }, delay);
  }

  /** Vérifie l'intégrité (public pour les tests). */
  tick(): void {
    if (!this.net.isIntact()) {
      void this.alerts.emitSystem(
        'TAMPER_ATTEMPT',
        'CRITICAL',
        'Contournement détecté : le fetch de 224Guard a été remplacé',
        'network.tamper',
        'tamper',
      );
      this.net.reinstall(); // réinstallation non destructive
    }
  }
}

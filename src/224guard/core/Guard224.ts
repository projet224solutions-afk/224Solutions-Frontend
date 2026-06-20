/**
 * 224Guard — orchestrateur. Câble le moteur de détection (Lot A) aux moniteurs runtime
 * (Lot B) et à la file résiliente. Ordre d'installation : RÉSEAU EN PREMIER (cf. §1.1 Q2),
 * puis WS, storage, DOM, intégrité, auto-guérison. `dispose()` nettoie TOUT (anti-leak).
 */

import { ENV_CAPS } from '../config';
import type { Alert224, AlertSink } from './types';
import { DisposableRegistry } from './DisposableRegistry';
import { AdaptiveAllowlist } from '../detection/AdaptiveAllowlist';
import { ConfidenceScorer } from '../detection/ConfidenceScorer';
import { Deduplicator } from '../pipeline/Deduplicator';
import { AlertManager } from '../pipeline/AlertManager';
import { ResilientAlertQueue, MemoryStore, type PersistentStore } from '../pipeline/ResilientAlertQueue';
import { IndexedDBStore } from '../pipeline/IndexedDBStore';
import { LocalSink } from '../pipeline/sinks/LocalSink';
import { NetworkInterceptor } from '../monitors/NetworkInterceptor';
import { WebSocketMonitor } from '../monitors/WebSocketMonitor';
import { StorageMonitor } from '../monitors/StorageMonitor';
import { DomMonitor } from '../monitors/DomMonitor';
import { IntegrityMonitor } from '../resilience/IntegrityMonitor';
import { SelfHealingManager } from '../resilience/SelfHealingManager';

export interface Guard224Options {
  /** cible des hooks (défaut globalThis) — injectable pour les tests. */
  target?: any;
  /** sinks de livraison (défaut : LocalSink ; Ably/Supabase ajoutés en Lot C). */
  sinks?: AlertSink[];
  /** store de persistance (défaut : IndexedDB si dispo, sinon mémoire). */
  store?: PersistentStore;
}

export class Guard224 {
  readonly registry = new DisposableRegistry();
  readonly allowlist = new AdaptiveAllowlist();
  readonly localSink: LocalSink;
  readonly alerts: AlertManager;

  private readonly queue: ResilientAlertQueue;
  private readonly net: NetworkInterceptor;
  private readonly ws: WebSocketMonitor;
  private readonly dom: DomMonitor;
  private readonly integrity: IntegrityMonitor;
  private readonly healing: SelfHealingManager;
  private readonly target: any;
  private started = false;

  constructor(opts: Guard224Options = {}) {
    this.target = opts.target ?? globalThis;
    this.localSink = new LocalSink();
    // LocalSink TOUJOURS présent (zéro dépendance) + sinks additionnels (BackendSink en prod).
    const sinks = [this.localSink, ...(opts.sinks ?? [])];
    const store = opts.store ?? (ENV_CAPS.hasIndexedDB ? new IndexedDBStore() : new MemoryStore());

    this.queue = new ResilientAlertQueue(store, sinks);
    const scorer = new ConfidenceScorer(this.allowlist);
    this.alerts = new AlertManager(scorer, new Deduplicator(), (a) => this.queue.enqueue(a));

    this.net = new NetworkInterceptor(this.alerts, this.registry, this.target);
    this.ws = new WebSocketMonitor(this.alerts, this.registry, this.target);
    this.dom = new DomMonitor(this.alerts, this.registry, this.target.document);
    this.integrity = new IntegrityMonitor(this.net, this.alerts, this.registry);
    this.healing = new SelfHealingManager(this.alerts, this.registry);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // 1) RÉSEAU EN PREMIER — toute requête émise avant échappe au monitoring.
    this.net.install();
    this.ws.install();

    // 2) Storage (local + session) si disponibles.
    if (this.target.localStorage) {
      new StorageMonitor(this.alerts, this.registry, this.target.localStorage, 'local_storage').install();
    }
    if (this.target.sessionStorage) {
      new StorageMonitor(this.alerts, this.registry, this.target.sessionStorage, 'session_storage').install();
    }

    // 3) DOM.
    this.dom.install();

    // 4) Intégrité (anti-tamper) + auto-guérison.
    this.integrity.start();
    this.healing.register('network_interceptor', () => this.net.isIntact(), () => this.net.reinstall());
    this.healing.start();

    // 5) Récupère les alertes persistées non livrées (survie aux rechargements).
    try { await this.queue.recoverPending(); } catch { /* dégradation */ }
  }

  /** Alertes récentes (pour le dashboard, Lot D). */
  get recentAlerts(): Alert224[] {
    return this.localSink.recent;
  }

  /** Nettoie tous les hooks/observers/intervalles (anti-leak). Idempotent. */
  dispose(): void {
    this.registry.dispose();
    this.started = false;
  }
}

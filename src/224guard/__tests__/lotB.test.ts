/**
 * 224Guard — Lot B : tests des moniteurs runtime (Vitest/jsdom + injection de deps).
 */

import { describe, it, expect, vi } from 'vitest';
import { DisposableRegistry } from '../core/DisposableRegistry';
import { AdaptiveAllowlist } from '../detection/AdaptiveAllowlist';
import { ConfidenceScorer } from '../detection/ConfidenceScorer';
import { Deduplicator } from '../pipeline/Deduplicator';
import { AlertManager } from '../pipeline/AlertManager';
import { MemoryStore } from '../pipeline/ResilientAlertQueue';
import { NetworkInterceptor } from '../monitors/NetworkInterceptor';
import { WebSocketMonitor } from '../monitors/WebSocketMonitor';
import { StorageMonitor } from '../monitors/StorageMonitor';
import { IntegrityMonitor } from '../resilience/IntegrityMonitor';
import { Guard224 } from '../core/Guard224';
import type { Alert224 } from '../core/types';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.c2lnbmF0dXJlX3Rlc3Q`;
}
const SERVICE_ROLE_JWT = jwt({ role: 'service_role', iss: 'supabase' });
const USER_JWT = jwt({ role: 'authenticated', sub: 'u1' });

const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

function makeStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  } as unknown as Storage;
}

function makeManager() {
  const emitted: Alert224[] = [];
  const alerts = new AlertManager(new ConfidenceScorer(new AdaptiveAllowlist()), new Deduplicator(), (a) => { emitted.push(a); });
  return { emitted, alerts, registry: new DisposableRegistry() };
}

describe('DisposableRegistry', () => {
  it('nettoie tout et est idempotent', () => {
    const r = new DisposableRegistry();
    let n = 0;
    r.add(() => n++);
    r.add(() => n++);
    r.dispose();
    expect(n).toBe(2);
    r.dispose();
    expect(n).toBe(2);
    expect(r.isDisposed).toBe(true);
  });
});

describe('NetworkInterceptor', () => {
  it('analyse les headers SANS bloquer la requête', async () => {
    const { emitted, alerts, registry } = makeManager();
    const fakeFetch = vi.fn(async () => 'RESPONSE');
    const target: any = { fetch: fakeFetch };
    const net = new NetworkInterceptor(alerts, registry, target);
    net.install();

    const res = await target.fetch('https://api.example.com/x', { headers: { Authorization: 'Bearer ' + SERVICE_ROLE_JWT } });
    expect(res).toBe('RESPONSE'); // requête non altérée
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    await flush();
    expect(emitted.some((a) => a.type === 'SERVICE_ROLE_KEY')).toBe(true);
    expect(net.isIntact()).toBe(true);
    registry.dispose();
    expect(target.fetch).toBe(fakeFetch); // restauré après dispose
  });

  it('ne flague pas un token utilisateur dans un header', async () => {
    const { emitted, alerts, registry } = makeManager();
    const target: any = { fetch: vi.fn(async () => 'ok') };
    new NetworkInterceptor(alerts, registry, target).install();
    await target.fetch('https://api/x', { headers: { Authorization: 'Bearer ' + USER_JWT } });
    await flush();
    expect(emitted).toHaveLength(0);
  });
});

describe('WebSocketMonitor', () => {
  it('analyse les messages envoyés', async () => {
    const { emitted, alerts, registry } = makeManager();
    class FakeWS { url: string; sent: any[] = []; constructor(url: string) { this.url = url; } send(d: any) { this.sent.push(d); } }
    const target: any = { WebSocket: FakeWS };
    new WebSocketMonitor(alerts, registry, target).install();

    const sock: any = new target.WebSocket('wss://realtime.ably.io/');
    sock.send(SERVICE_ROLE_JWT);
    await flush();
    expect(sock.sent).toContain(SERVICE_ROLE_JWT); // message bien transmis
    expect(emitted.some((a) => a.type === 'SERVICE_ROLE_KEY')).toBe(true);
  });
});

describe('StorageMonitor', () => {
  it('scanne les entrées existantes (service_role en storage = CRITIQUE)', async () => {
    const { emitted, alerts, registry } = makeManager();
    const storage = makeStorage({ 'supabase.auth': SERVICE_ROLE_JWT, 'theme': 'dark' });
    new StorageMonitor(alerts, registry, storage, 'local_storage').install();
    await flush();
    expect(emitted.some((a) => a.severity === 'CRITICAL')).toBe(true);
  });

  it('intercepte setItem', async () => {
    const { emitted, alerts, registry } = makeManager();
    const storage = makeStorage();
    new StorageMonitor(alerts, registry, storage, 'local_storage').install();
    storage.setItem('k', SERVICE_ROLE_JWT);
    await flush();
    expect(storage.getItem('k')).toBe(SERVICE_ROLE_JWT); // écriture préservée
    expect(emitted.some((a) => a.type === 'SERVICE_ROLE_KEY')).toBe(true);
  });
});

describe('IntegrityMonitor (anti-tamper)', () => {
  it('alerte et réinstalle si le fetch a été remplacé', async () => {
    const { emitted, alerts, registry } = makeManager();
    const net = { intact: true, reinstalled: 0, isIntact() { return this.intact; }, reinstall() { this.reinstalled++; this.intact = true; } };
    const im = new IntegrityMonitor(net as any, alerts, registry);
    net.intact = false;
    im.tick();
    await flush();
    expect(emitted.some((a) => a.type === 'TAMPER_ATTEMPT' && a.severity === 'CRITICAL')).toBe(true);
    expect(net.reinstalled).toBe(1);
    registry.dispose();
  });
});

describe('Guard224 — orchestrateur (intégration)', () => {
  it('démarre, détecte un service_role en storage, et nettoie', async () => {
    const target: any = {
      fetch: vi.fn(async () => 'ok'),
      localStorage: makeStorage({ 'sb': SERVICE_ROLE_JWT }),
    };
    const g = new Guard224({ target, store: new MemoryStore() });
    await g.start();
    await flush();
    expect(g.recentAlerts.some((a) => a.type === 'SERVICE_ROLE_KEY')).toBe(true);

    g.dispose();
    expect(g.registry.isDisposed).toBe(true);
    expect(target.fetch).toBe(target.fetch); // fetch restauré (pas de proxy résiduel)
  });
});

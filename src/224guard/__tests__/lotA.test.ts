/**
 * 224Guard — Lot A : tests unitaires & intégration (Vitest).
 * Couvre les scénarios de détection validés dans GUARD224_LOGIC_AUDIT.md §1.2.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntropyAnalyzer } from '../detection/EntropyAnalyzer';
import { PatternMatcher, jwtRole } from '../detection/PatternMatcher';
import { ConfidenceScorer } from '../detection/ConfidenceScorer';
import { AdaptiveAllowlist } from '../detection/AdaptiveAllowlist';
import { Deduplicator } from '../pipeline/Deduplicator';
import { ResilientAlertQueue, MemoryStore } from '../pipeline/ResilientAlertQueue';
import { AlertManager } from '../pipeline/AlertManager';
import { maskSecret, hashSecret } from '../masking';
import type { Alert224, AlertSink, DetectionContext } from '../core/types';

// Construit un JWT de test {alg}.{payload}.{sig} (base64url).
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.c2lnbmF0dXJlX3Rlc3Q`;
}

const SERVICE_ROLE_JWT = jwt({ role: 'service_role', iss: 'supabase', ref: 'proj' });
const ANON_JWT = jwt({ role: 'anon', iss: 'supabase' });
const USER_JWT = jwt({ role: 'authenticated', sub: 'user-123' });

describe('EntropyAnalyzer', () => {
  const e = new EntropyAnalyzer();
  it('détecte une vraie clé à haute entropie', () => {
    expect(e.isLikelySecret('sk_live_' + '4eC39HqLyjWDarjtT1zdp7dcXYZ12345')).toBe(true);
  });
  it('ignore un UUID standard', () => {
    expect(e.isLikelySecret('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });
  it('ignore un hash MD5/SHA', () => {
    expect(e.isLikelySecret('d41d8cd98f00b204e9800998ecf8427e')).toBe(false);
  });
  it('ignore du texte normal', () => {
    expect(e.isLikelySecret('bonjour ceci est une phrase normale de test')).toBe(false);
  });
  // ── Non-régression faux positifs (audit 2026-06-15) ──────────────────────
  it('ignore un blob JSON entier', () => {
    expect(e.isLikelySecret('{"data":{"id":42,"name":"boutique","ville":"Conakry"}}')).toBe(false);
  });
  it('ignore un mot/identifiant tout en minuscules', () => {
    expect(e.isLikelySecret('taxiservicesproximiteconakryroutesdispo')).toBe(false);
  });
  it('ignore un content-type', () => {
    expect(e.isLikelySecret('application/json; charset=utf-8')).toBe(false);
  });
  it('extractSecretTokens : aucun jeton dans un JSON benin', () => {
    expect(e.extractSecretTokens('{"state":{"theme":"dark","lang":"fr","open":true}}')).toHaveLength(0);
  });
  it('extractSecretTokens : remonte une clé embarquée dans du JSON', () => {
    const toks = e.extractSecretTokens('{"token":"Zx9Qw3Vb7Nm2Kp5Lr8Td1Hy6Gf4Js0Ae"}');
    expect(toks).toContain('Zx9Qw3Vb7Nm2Kp5Lr8Td1Hy6Gf4Js0Ae');
  });
});

describe('PatternMatcher — JWT role-aware', () => {
  const m = new PatternMatcher();
  it('décode le rôle d\'un JWT', () => {
    expect(jwtRole(SERVICE_ROLE_JWT)).toBe('service_role');
    expect(jwtRole(ANON_JWT)).toBe('anon');
  });
  it('N\'ALERTE PAS un JWT utilisateur (anon/authenticated)', () => {
    expect(m.match(`token=${ANON_JWT}`).length).toBe(0);
    expect(m.match(`Authorization: Bearer ${USER_JWT}`).length).toBe(0);
  });
  it('ALERTE un JWT service_role (CRITIQUE)', () => {
    const r = m.match(`const k="${SERVICE_ROLE_JWT}"`);
    expect(r).toHaveLength(1);
    expect(r[0].patternKey).toBe('supabase.service_role');
    expect(r[0].severity).toBe('CRITICAL');
  });
  it('détecte Stripe secret, Redis URL, clé privée (CRITIQUE)', () => {
    expect(m.match('sk_live_' + '4eC39HqLyjWDarjtT1zdp7dcABCDEF')[0]?.patternKey).toBe('stripe.secret');
    expect(m.match('rediss://default:' + 'SuperP@ssw0rd' + '@host.upstash.io:6379')[0]?.patternKey).toBe('redis.url');
    expect(m.match('-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIE...')[0]?.patternKey).toBe('crypto.private_key');
  });
  it('classe Firebase apiKey comme PUBLIQUE (pas critique)', () => {
    const r = m.match('apiKey: "AIza' + 'SyA1234567890abcdefghijklmnopqrstuv"');
    expect(r[0]?.publicByDesign).toBe(true);
    expect(r[0]?.type).toBe('PROVIDER_KEY_PUBLIC');
  });
});

describe('masking — jamais en clair', () => {
  it('ne révèle jamais la valeur complète', () => {
    const secret = 'sk_live_' + '4eC39HqLyjWDarjtT1zdp7dcSECRETMIDDLE99';
    const masked = maskSecret(secret);
    expect(masked).not.toContain(secret);
    expect(masked).not.toContain(secret.slice(4, -2)); // le milieu n'apparaît jamais
    expect(masked.length).toBeLessThan(secret.length);
  });
  it('hashSecret est déterministe', async () => {
    const a = await hashSecret('valeur-test');
    const b = await hashSecret('valeur-test');
    expect(a).toBe(b);
    expect(a).not.toContain('valeur-test');
  });
});

describe('Deduplicator — multi-dimensionnel', () => {
  let now = 1_000_000;
  let d: Deduplicator;
  beforeEach(() => {
    now = 1_000_000;
    d = new Deduplicator(() => now);
  });
  it('émet une fois puis coalesce dans la fenêtre', () => {
    expect(d.decide('h1', 'HIGH', 'local_storage').emit).toBe(true);
    expect(d.decide('h1', 'HIGH', 'local_storage').emit).toBe(false);
  });
  it('coalesce une nouvelle source', () => {
    d.decide('h1', 'HIGH', 'local_storage');
    const r = d.decide('h1', 'HIGH', 'network_request');
    expect(r.emit).toBe(false);
    expect(r.newSource).toBe(true);
  });
  it('ré-émet sur escalade de sévérité', () => {
    d.decide('h1', 'MEDIUM', 'dom');
    const r = d.decide('h1', 'CRITICAL', 'dom');
    expect(r.emit).toBe(true);
    expect(r.escalated).toBe(true);
  });
  it('ré-émet après expiration de la fenêtre', () => {
    d.decide('h1', 'HIGH', 'dom');
    now += 6 * 60_000;
    expect(d.decide('h1', 'HIGH', 'dom').emit).toBe(true);
  });
});

describe('ResilientAlertQueue — livraison & retry', () => {
  const fakeAlert = (id: string, severity: Alert224['severity'] = 'CRITICAL'): Alert224 => ({
    id, type: 'SECRET_EXPOSED', severity, patternKey: 'x', label: 'l', keyHash: 'h',
    masked: 'm', sources: ['bundle'], locations: [], count: 1, createdAt: 0, updatedAt: 0,
    score: { regexMatch: 1, entropyScore: 1, contextScore: 1, behaviorScore: 0, historicalScore: 1, finalScore: 1, confidence: 'CERTAIN' },
  });

  it('livre puis purge le store', async () => {
    const store = new MemoryStore();
    const delivered: string[] = [];
    const sink: AlertSink = { name: 's', deliver: async (a) => { delivered.push(a.id); return { ok: true, retryable: false }; } };
    const q = new ResilientAlertQueue(store, [sink], async () => {});
    await q.enqueue(fakeAlert('a1'));
    expect(delivered).toContain('a1');
    expect((await store.all()).length).toBe(0);
    expect(q.size).toBe(0);
  });

  it('retry un sink défaillant puis réussit', async () => {
    const store = new MemoryStore();
    let attempts = 0;
    const sink: AlertSink = {
      name: 'flaky',
      deliver: async () => { attempts++; return attempts < 3 ? { ok: false, retryable: true } : { ok: true, retryable: false }; },
    };
    const q = new ResilientAlertQueue(store, [sink], async () => {}); // sleep immédiat
    await q.enqueue(fakeAlert('a2'));
    expect(attempts).toBeGreaterThanOrEqual(3);
    expect(q.size).toBe(0);
  });

  it('récupère les alertes persistées au démarrage', async () => {
    const store = new MemoryStore();
    await store.put(fakeAlert('pending1'));
    const delivered: string[] = [];
    const sink: AlertSink = { name: 's', deliver: async (a) => { delivered.push(a.id); return { ok: true, retryable: false }; } };
    const q = new ResilientAlertQueue(store, [sink], async () => {});
    await q.recoverPending();
    expect(delivered).toContain('pending1');
  });
});

describe('AlertManager — intégration', () => {
  let emitted: Alert224[];
  let mgr: AlertManager;
  beforeEach(() => {
    emitted = [];
    const scorer = new ConfidenceScorer(new AdaptiveAllowlist());
    mgr = new AlertManager(scorer, new Deduplicator(), (a) => { emitted.push(a); });
  });

  const ctx = (over: Partial<DetectionContext> = {}): DetectionContext => ({ source: 'local_storage', ...over });

  it('émet 1 alerte CRITIQUE masquée pour un service_role en localStorage', async () => {
    await mgr.analyzeValue(SERVICE_ROLE_JWT, ctx());
    expect(emitted).toHaveLength(1);
    expect(emitted[0].severity).toBe('CRITICAL');
    expect(emitted[0].type).toBe('SERVICE_ROLE_KEY');
    expect(emitted[0].masked).not.toContain(SERVICE_ROLE_JWT); // jamais en clair
    expect((emitted[0] as any).rawValue).toBeUndefined();
  });

  it('N\'émet RIEN pour un JWT utilisateur', async () => {
    await mgr.analyzeValue(USER_JWT, ctx());
    expect(emitted).toHaveLength(0);
  });

  it('déduplique la même valeur', async () => {
    await mgr.analyzeValue(SERVICE_ROLE_JWT, ctx());
    await mgr.analyzeValue(SERVICE_ROLE_JWT, ctx());
    expect(emitted).toHaveLength(1);
  });

  it('détecte une chaîne à haute entropie sans format connu', async () => {
    await mgr.analyzeValue('Zx9Qw3Vb7Nm2Kp5Lr8Td1Hy6Gf4Js0Ae', ctx({ source: 'network_request', direction: 'outbound' }));
    expect(emitted.some((a) => a.type === 'HIGH_ENTROPY_STRING')).toBe(true);
  });
});

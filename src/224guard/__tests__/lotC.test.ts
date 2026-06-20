/**
 * 224Guard — Lot C : sink backend (ingestion).
 */

import { describe, it, expect, vi } from 'vitest';
import { BackendSink } from '../pipeline/sinks/BackendSink';
import type { Alert224 } from '../core/types';

const alert: Alert224 = {
  id: 'a1', type: 'SERVICE_ROLE_KEY', severity: 'CRITICAL', patternKey: 'supabase.service_role',
  label: 'l', keyHash: 'sha256:abc', masked: 'eyJh****…(len=400)', sources: ['network_request'],
  locations: ['https://x'], count: 1, createdAt: 0, updatedAt: 0,
  score: { regexMatch: 1, entropyScore: 1, contextScore: 1, behaviorScore: 0, historicalScore: 1, finalScore: 1, confidence: 'CERTAIN' },
};

describe('BackendSink', () => {
  it('livre quand le backend répond success', async () => {
    const post = vi.fn(async (_a: Alert224) => ({ success: true }));
    const sink = new BackendSink(post);
    const r = await sink.deliver(alert);
    expect(r.ok).toBe(true);
    // Le payload posté ne contient JAMAIS de valeur en clair (que keyHash + masked).
    const sent = post.mock.calls[0][0] as Alert224;
    expect((sent as any).rawValue).toBeUndefined();
    expect(sent.keyHash).toBe('sha256:abc');
  });

  it('ne réessaie pas si non authentifié', async () => {
    const sink = new BackendSink(async () => ({ success: false, notAuthenticated: true }));
    const r = await sink.deliver(alert);
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
  });

  it('est retryable sur échec serveur', async () => {
    const sink = new BackendSink(async () => ({ success: false }));
    const r = await sink.deliver(alert);
    expect(r).toEqual({ ok: false, retryable: true });
  });

  it('est retryable si le post lève une exception', async () => {
    const sink = new BackendSink(async () => { throw new Error('réseau'); });
    const r = await sink.deliver(alert);
    expect(r.retryable).toBe(true);
  });
});

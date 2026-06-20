/**
 * 224Guard — sink BACKEND : remonte l'alerte (DÉJÀ masquée) à l'endpoint d'ingestion
 * `/api/v2/guard224/alert`. Le backend persiste (service_role) + publie sur Ably.
 * Aucune valeur de clé en clair n'est transmise (seulement keyHash + masque).
 */

import type { Alert224, AlertSink, SinkResult } from '../../core/types';
import { backendFetch } from '@/services/backendApi';

export interface PostResult { success: boolean; notAuthenticated?: boolean }

async function defaultPost(alert: Alert224): Promise<PostResult> {
  const res = await backendFetch('/api/v2/guard224/alert', {
    method: 'POST',
    body: {
      client_id: alert.id,
      type: alert.type,
      severity: alert.severity,
      pattern_key: alert.patternKey,
      label: alert.label,
      key_hash: alert.keyHash,
      masked: alert.masked,
      sources: alert.sources,
      locations: alert.locations,
      score: alert.score,
      count: alert.count,
    },
  });
  return { success: res.success, notAuthenticated: !res.success && res.error === 'Non authentifié' };
}

export class BackendSink implements AlertSink {
  readonly name = 'backend';
  constructor(private post: (a: Alert224) => Promise<PostResult> = defaultPost) {}

  async deliver(alert: Alert224): Promise<SinkResult> {
    try {
      const r = await this.post(alert);
      if (r.success) return { ok: true, retryable: false };
      // Session non authentifiée → inutile de réessayer (l'alerte reste en LocalSink).
      if (r.notAuthenticated) return { ok: false, retryable: false };
      return { ok: false, retryable: true };
    } catch {
      return { ok: false, retryable: true };
    }
  }
}

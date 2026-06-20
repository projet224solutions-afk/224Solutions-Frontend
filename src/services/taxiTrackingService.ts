/**
 * 🚕 TAXI TRACKING SERVICE
 * Résolution d'une cible de suivi via le backend Node.js.
 * Un compte supprimé/inexistant renvoie status 'not_found' → le chauffeur ne le retrouve pas.
 */

import { backendFetch } from './backendApi';
import type { SharedProfile } from '@/lib/liveLocation';

export interface ResolveTargetResult {
  status: 'active' | 'not_found';
  userId?: string;
  customId?: string | null;
  /** Clé du canal de suivi (custom_id du client, repli user_id). */
  trackingKey?: string;
  profile?: SharedProfile;
}

/**
 * Résout un identifiant (ID, UUID, custom_id, téléphone, email, lien) vers une cible active.
 * Retourne null en cas d'échec réseau (le frontend applique alors son repli).
 */
export async function resolveTrackingTarget(q: string): Promise<ResolveTargetResult | null> {
  const res = await backendFetch<ResolveTargetResult>(
    `/api/v2/taxi/resolve-target?q=${encodeURIComponent(q.trim())}`,
    { method: 'GET' }
  );

  if (!res.success) {
    // Échec métier explicite (400/500) → on laisse le frontend décider (repli)
    return null;
  }

  const payload = (res.data as any) ?? res;
  if (!payload?.status) return null;

  return {
    status: payload.status,
    userId: payload.userId,
    customId: payload.customId,
    trackingKey: payload.trackingKey,
    profile: payload.profile,
  };
}

/**
 * Enregistre l'avis d'un client sur une course (backend service role → moyenne chauffeur mise à jour).
 */
export async function rateRide(rideId: string, stars: number, comment?: string) {
  return backendFetch<{ average?: number; total_ratings?: number }>('/api/v2/taxi/rate', {
    method: 'POST',
    body: { ride_id: rideId, stars, comment },
  });
}

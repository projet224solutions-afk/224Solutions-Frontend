/**
 * 🚚 DELIVERY BACKEND SERVICE
 * Client centralisé pour les opérations critiques de livraison via le backend Node.js.
 * Les gains et les mouvements wallet ne sont plus calculés/déclenchés côté frontend.
 *
 * Endpoints : /api/v2/delivery/{stats,complete,payment}
 */

import { backendFetch } from './backendApi';

export interface DeliveryStats {
  todayEarnings: number;
  todayDeliveries: number;
  weekEarnings: number;
  weekDeliveries: number;
  monthEarnings: number;
  monthDeliveries: number;
  totalEarnings: number;
  totalDeliveries: number;
}

export interface DeliveryCompleteResult {
  success: boolean;
  driver_earning?: number;
  credited?: boolean;
  already_completed?: boolean;
  error?: string;
}

export interface DeliveryPaymentResult {
  success: boolean;
  amount?: number;
  credited?: boolean;
  method?: string;
  already_paid?: boolean;
  error?: string;
}

/**
 * Récupère les statistiques de gains du livreur connecté (calculées côté backend).
 */
export async function getDeliveryStats(signal?: AbortSignal): Promise<DeliveryStats | null> {
  const res = await backendFetch<DeliveryStats>('/api/v2/delivery/stats', { method: 'GET', signal });
  if (!res.success) return null;
  // Le backend renvoie { success, data }
  return (res.data as DeliveryStats) || null;
}

/**
 * Finalise une livraison côté backend (écrit driver_earning + totaux driver).
 */
export async function completeDelivery(
  deliveryId: string,
  proofPhotoUrl?: string,
  signature?: string
): Promise<DeliveryCompleteResult> {
  const res = await backendFetch<DeliveryCompleteResult>('/api/v2/delivery/complete', {
    method: 'POST',
    body: { delivery_id: deliveryId, proof_photo_url: proofPhotoUrl, signature },
  });

  if (!res.success) {
    return { success: false, error: res.error || 'Erreur lors de la finalisation' };
  }
  const payload = (res.data as any) ?? res;
  return {
    success: true,
    driver_earning: payload?.driver_earning,
    credited: payload?.credited,
    already_completed: payload?.already_completed,
  };
}

export interface DeliveryActionResult {
  success: boolean;
  data?: any;
  already_assigned?: boolean;
  already_started?: boolean;
  already_cancelled?: boolean;
  error?: string;
}

/** Réclame une livraison disponible (claim atomique côté backend). */
export async function acceptDeliveryBackend(deliveryId: string): Promise<DeliveryActionResult> {
  const res = await backendFetch<DeliveryActionResult>('/api/v2/delivery/accept', {
    method: 'POST',
    body: { delivery_id: deliveryId },
  });
  if (!res.success) return { success: false, error: res.error || 'Livraison indisponible' };
  // Le backend renvoie { success, data, already_assigned } À PLAT.
  const r = res as any;
  return { success: true, data: r.data, already_assigned: r.already_assigned };
}

/** Démarre une livraison assignée (colis récupéré). */
export async function startDeliveryBackend(deliveryId: string): Promise<DeliveryActionResult> {
  const res = await backendFetch<DeliveryActionResult>('/api/v2/delivery/start', {
    method: 'POST',
    body: { delivery_id: deliveryId },
  });
  if (!res.success) return { success: false, error: res.error || 'Démarrage impossible' };
  const r = res as any;
  return { success: true, data: r.data, already_started: r.already_started };
}

/** Annule une livraison assignée. */
export async function cancelDeliveryBackend(deliveryId: string, reason: string): Promise<DeliveryActionResult> {
  const res = await backendFetch<DeliveryActionResult>('/api/v2/delivery/cancel', {
    method: 'POST',
    body: { delivery_id: deliveryId, reason },
  });
  if (!res.success) return { success: false, error: res.error || 'Annulation impossible' };
  return { success: true };
}

/** Enregistre un point GPS (écriture sécurisée en base ; le broadcast reste côté client). */
export async function trackDeliveryPositionBackend(
  deliveryId: string,
  latitude: number,
  longitude: number,
  speed?: number,
  heading?: number,
  accuracy?: number
): Promise<boolean> {
  const res = await backendFetch('/api/v2/delivery/track', {
    method: 'POST',
    body: { delivery_id: deliveryId, latitude, longitude, speed, heading, accuracy },
  });
  return !!res.success;
}

/**
 * Encaisse une livraison : crédite le wallet du livreur (méthodes électroniques) côté backend.
 */
export async function processDeliveryPayment(
  deliveryId: string,
  paymentMethod: string
): Promise<DeliveryPaymentResult> {
  const res = await backendFetch<DeliveryPaymentResult>('/api/v2/delivery/payment', {
    method: 'POST',
    body: { delivery_id: deliveryId, payment_method: paymentMethod },
  });

  if (!res.success) {
    return { success: false, error: res.error || 'Erreur lors de l\'encaissement' };
  }
  const payload = (res.data as any) ?? res;
  return {
    success: true,
    amount: payload?.amount,
    credited: payload?.credited,
    method: payload?.method,
    already_paid: payload?.already_paid,
  };
}

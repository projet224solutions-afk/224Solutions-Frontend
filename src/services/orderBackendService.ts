/**
 * 📦 ORDER BACKEND SERVICE — Phase 5
 * Aligné 1:1 avec backend/src/routes/orders.routes.ts
 */

import { backendFetch, generateIdempotencyKey } from './backendApi';

// ==================== TYPES (alignés backend Zod schemas) ====================

export interface CreateOrderItem {
  product_id: string;
  quantity: number;
  variant_id?: string | null;
}

export interface CreateOrderPayload {
  vendor_id: string;
  items: CreateOrderItem[];
  payment_method: 'card' | 'mobile_money' | 'wallet' | 'cash';
  shipping_address: {
    full_name: string;
    phone: string;
    address_line: string;
    city: string;
    country: string;
    postal_code?: string | null;
    notes?: string | null;
  };
  payment_intent_id?: string | null;
  payment_confirmed?: boolean | null;
  charged_amount?: number | null;
  order_metadata?: Record<string, unknown> | null;
  coupon_code?: string | null;
}

export interface CreateDigitalOrderPayload {
  vendor_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  payment_method: 'card' | 'mobile_money' | 'wallet' | 'cash';
  payment_intent_id?: string | null;
  purchase_record_id?: string | null;
  pricing_type?: 'one_time' | 'subscription' | 'pay_what_you_want' | null;
  subscription_interval?: 'monthly' | 'yearly' | 'lifetime' | null;
}

export interface OrderItemDetail {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant_id?: string | null;
  products?: {
    name: string;
  } | null;
}

export interface OrderVendorSummary {
  business_name: string;
}

export interface OrderEscrowSummary {
  id: string;
  status: string;
  amount?: number;
  currency?: string;
  auto_release_at?: string | null;
  released_at?: string | null;
  seller_confirmed_at?: string | null;
}

export interface OrderSummary {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  total_amount: number;
  currency: string;
  shipping_address: Record<string, any>;
  tracking_number?: string;
  cancellation_reason?: string;
  seller_confirmed_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
  vendor_id: string;
  payment_intent_id?: string | null;
  vendors?: OrderVendorSummary | null;
  escrow?: OrderEscrowSummary | null;
  order_items?: OrderItemDetail[];
}

export interface CreateOrderResponse {
  order: OrderSummary;
  items: OrderItemDetail[];
  escrow_status: string;
}

export type OrderStatusTransition = 'confirmed' | 'preparing' | 'ready' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled';

// ==================== API CALLS ====================

/**
 * Créer une commande avec escrow systématique
 */
export async function createOrder(payload: CreateOrderPayload, signal?: AbortSignal) {
  return backendFetch<CreateOrderResponse>('/api/orders', {
    method: 'POST',
    body: payload,
    idempotencyKey: generateIdempotencyKey(),
    signal,
  });
}

export async function createDigitalOrder(payload: CreateDigitalOrderPayload, signal?: AbortSignal) {
  return backendFetch<OrderSummary>('/api/orders/digital', {
    method: 'POST',
    body: payload,
    idempotencyKey: generateIdempotencyKey(),
    signal,
  });
}

/**
 * Lister les commandes de l'utilisateur connecté (acheteur)
 */
export async function listMyOrders(
  params: { limit?: number; offset?: number; status?: string } = {},
  signal?: AbortSignal
) {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  if (params.status) query.set('status', params.status);

  const qs = query.toString();
  return backendFetch<OrderSummary[]>(`/api/orders/mine${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    signal,
  });
}

/**
 * Lister les commandes reçues par le vendeur
 */
export async function listVendorOrders(
  params: { limit?: number; offset?: number; status?: string } = {},
  signal?: AbortSignal
) {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  if (params.status) query.set('status', params.status);

  const qs = query.toString();
  return backendFetch<OrderSummary[]>(`/api/orders/vendor${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    signal,
  });
}

/**
 * Détails d'une commande (GET /api/orders/:orderId)
 */
export async function getOrder(orderId: string, signal?: AbortSignal) {
  return backendFetch<OrderSummary>(`/api/orders/${orderId}`, {
    method: 'GET',
    signal,
  });
}

/**
 * Annuler une commande (POST /api/orders/:orderId/cancel)
 */
export async function cancelOrder(orderId: string, reason: string, signal?: AbortSignal) {
  return backendFetch<OrderSummary>(`/api/orders/${orderId}/cancel`, {
    method: 'POST',
    body: { reason },
    idempotencyKey: generateIdempotencyKey(),
    signal,
  });
}

/**
 * Confirmer la réception d'une commande payée à la livraison (COD) — côté acheteur.
 * Marque la commande livrée et clôture l'escrow virtuel COD (paiement en espèces).
 */
export async function confirmCashOnDeliveryOrder(orderId: string, signal?: AbortSignal) {
  return backendFetch<OrderSummary>(`/api/orders/${orderId}/confirm-cod-delivery`, {
    method: 'POST',
    idempotencyKey: generateIdempotencyKey(),
    signal,
  });
}

/**
 * Confirmer la réception d'une commande payée au WALLET/escrow — côté acheteur.
 * Libère atomiquement l'escrow vers le vendeur (net + commission plateforme) via le backend Node.js
 * (remplace l'Edge Function 'confirm-delivery'). Idempotent si déjà libéré.
 */
export async function confirmEscrowDelivery(orderId: string, signal?: AbortSignal) {
  return backendFetch<OrderSummary>(`/api/orders/${orderId}/confirm-delivery`, {
    method: 'POST',
    idempotencyKey: generateIdempotencyKey(),
    signal,
  });
}

/**
 * Ouvrir une demande de remboursement (litige) — côté acheteur, via le backend Node.js
 * (remplace l'Edge Function 'request-refund'). Aucun mouvement d'argent ici : crée le litige
 * et notifie le vendeur. L'argent ne bouge qu'à l'annulation/résolution (refund_order_escrow).
 */
export async function requestOrderRefund(
  orderId: string,
  body: { reason: string; requested_amount?: number; evidence_text?: string },
  signal?: AbortSignal,
) {
  return backendFetch<{ dispute_id: string }>(`/api/orders/${orderId}/request-refund`, {
    method: 'POST',
    body,
    idempotencyKey: generateIdempotencyKey(),
    signal,
  });
}

/**
 * Mettre à jour le statut d'une commande (vendeur)
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatusTransition,
  options: { tracking_number?: string; cancellation_reason?: string } = {},
  signal?: AbortSignal
) {
  return backendFetch<OrderSummary>(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status, ...options },
    idempotencyKey: generateIdempotencyKey(),   // ✅ cohérence anti-rejeu (comme cancel/confirm)
    signal,
  });
}

export interface DeliveryProof {
  success: boolean;
  purged: boolean;
  photo_url: string | null;
  video_url: string | null;
}

/** Preuve de livraison (URLs signées 1h) — accessible au client ET au vendeur de la commande. */
export async function getDeliveryProof(orderId: string, signal?: AbortSignal) {
  return backendFetch<DeliveryProof>(`/api/orders/${orderId}/delivery-proof`, {
    method: 'GET',
    signal,
  });
}

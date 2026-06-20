/**
 * 🏪 POS BACKEND SERVICE — Phase 5
 * Aligné 1:1 avec backend/src/routes/pos.routes.ts
 */

import { backendFetch } from './backendApi';

// ==================== TYPES (alignés backend Zod schemas) ====================

export interface PosSaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface PosSalePayload {
  local_sale_id: string;
  items: PosSaleItem[];
  payment_method: 'cash' | 'mobile_money' | 'card' | 'credit';
  total_amount: number;
  discount_total: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  marketing_contact?: string | null;
  notes?: string | null;
  sold_at: string; // ISO 8601
}

export interface PosMarketingContactPayload {
  contact: string;
  customer_name?: string | null;
  order_total?: number | null;
  sold_at?: string | null;
}

export interface SyncResult {
  local_sale_id: string;
  status: 'created' | 'duplicate' | 'error';
  sale_id?: string;
  stock_synced?: boolean;
  error?: string;
}

export interface SyncSummary {
  total: number;
  created: number;
  duplicates: number;
  errors: number;
  stock_pending: number;
}

export interface PosReconciliationEntry {
  id: string;
  vendor_id: string;
  pos_sale_id: string;
  product_id: string;
  expected_decrement: number;
  status: string;
  error_message: string;
  retry_count: number;
  max_retries: number;
  created_at: string;
  product?: { id: string; name: string; sku: string | null };
}

// ==================== API CALLS ====================

/**
 * Synchroniser un lot de ventes POS offline (max 50)
 */
export async function syncPosSales(
  sales: PosSalePayload[],
  vendorId?: string,
  signal?: AbortSignal
) {
  const headers: Record<string, string> = {};
  if (vendorId) headers['x-vendor-id'] = vendorId;

  return backendFetch<{ results: SyncResult[]; summary: SyncSummary }>(
    '/api/pos/sync',
    {
      method: 'POST',
      body: { sales },
      headers,
      signal,
    }
  );
}

export interface PosOrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export interface PosOrderPayload {
  order_number: string;
  customer_id?: string | null;
  items: PosOrderItem[];
  payment_method: 'mobile_money' | 'card' | 'credit' | 'cash';
  payment_status?: 'pending' | 'paid' | 'failed' | 'refunded';
  status?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  discount_total?: number;
  notes?: string | null;
  currency?: string;
  shipping_address?: Record<string, any> | null;
  // Vente à crédit (utilisé uniquement si payment_method = 'credit')
  credit_customer_name?: string | null;
  credit_customer_phone?: string | null;
  credit_due_date?: string | null; // ISO 8601
  credit_notes?: string | null;
  credit_items?: Record<string, any>[] | null;
}

export interface PosOrderResult {
  order_id: string;
  order_number: string;
  subtotal: number;
  tax_amount: number;
  total: number;
}

/**
 * Création ATOMIQUE d'une commande POS en ligne (mobile money / crédit / carte).
 * Le backend calcule la taxe (TVA configurable) et le total côté serveur, crée
 * orders(source='pos') + order_items + décrément stock dans une seule transaction.
 */
export async function createPosOrder(
  order: PosOrderPayload,
  vendorId?: string,
  signal?: AbortSignal
) {
  const headers: Record<string, string> = {};
  if (vendorId) headers['x-vendor-id'] = vendorId;

  return backendFetch<PosOrderResult>('/api/pos/order', {
    method: 'POST',
    body: order,
    headers,
    signal,
  });
}

/**
 * Lister les ventes POS synchronisées
 */
export async function listPosSales(
  params: { limit?: number; offset?: number } = {},
  vendorId?: string,
  signal?: AbortSignal
) {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));

  const qs = query.toString();
  const headers: Record<string, string> = {};
  if (vendorId) headers['x-vendor-id'] = vendorId;

  return backendFetch(`/api/pos/sales${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers,
    signal,
  });
}

/**
 * Lister les écarts de stock en attente de réconciliation
 */
export async function getReconciliationPending(vendorId?: string, signal?: AbortSignal) {
  const headers: Record<string, string> = {};
  if (vendorId) headers['x-vendor-id'] = vendorId;

  return backendFetch<PosReconciliationEntry[]>('/api/pos/reconciliation', {
    method: 'GET',
    headers,
    signal,
  });
}

/**
 * Collecter un contact marketing POS (email ou téléphone)
 */
export async function collectPosMarketingContact(
  payload: PosMarketingContactPayload,
  vendorId?: string,
  signal?: AbortSignal,
) {
  const headers: Record<string, string> = {};
  if (vendorId) headers['x-vendor-id'] = vendorId;

  return backendFetch<{ id: string; status: 'created' | 'updated' }>('/api/pos/marketing-contact', {
    method: 'POST',
    body: payload,
    headers,
    signal,
  });
}

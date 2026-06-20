/**
 * 📦 INVENTORY BACKEND SERVICE — Phase 5
 * Aligné 1:1 avec backend/src/routes/inventory.routes.ts
 */

import { backendFetch } from './backendApi';

// ==================== TYPES (alignés backend Zod schemas) ====================

export type StockAdjustmentReason =
  | 'restock'
  | 'manual_correction'
  | 'damaged'
  | 'lost'
  | 'returned'
  | 'count_adjustment'
  | 'other';

export interface StockLevel {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
  is_active: boolean;
  images: string[] | null;
}

export interface StockSummary {
  total_products: number;
  out_of_stock: number;
  low_stock: number;
  healthy: number;
}

export interface StockAdjustment {
  product_id: string;
  adjustment: number;
  reason: StockAdjustmentReason;
  notes?: string | null;
}

export interface AdjustmentResult {
  product_id: string;
  status: 'success' | 'error';
  old_stock?: number;
  new_stock?: number;
  error?: string;
}

export interface InventoryHistoryEntry {
  id: string;
  product_id: string;
  vendor_id: string;
  change_type: string;
  quantity_change: number;
  old_quantity: number;
  new_quantity: number;
  reason: string;
  notes: string | null;
  performed_by: string;
  created_at: string;
  product?: { id: string; name: string; sku: string | null };
}

// ==================== API CALLS ====================

/**
 * Récupérer les niveaux de stock du vendeur
 */
export async function getStockLevels(
  params: { low_stock_only?: boolean } = {},
  signal?: AbortSignal
) {
  const query = new URLSearchParams();
  if (params.low_stock_only) query.set('low_stock', 'true');

  const qs = query.toString();
  return backendFetch<StockLevel[]>(
    `/api/inventory/stock${qs ? `?${qs}` : ''}`,
    { method: 'GET', signal }
  );
}

/**
 * Ajuster le stock (backend attend un tableau `adjustments`)
 */
export async function adjustStock(
  adjustments: StockAdjustment | StockAdjustment[],
  signal?: AbortSignal
) {
  const arr = Array.isArray(adjustments) ? adjustments : [adjustments];
  return backendFetch<{
    results: AdjustmentResult[];
    summary: { total: number; successes: number; errors: number };
  }>('/api/inventory/adjust', {
    method: 'POST',
    body: { adjustments: arr },
    signal,
  });
}

/**
 * Historique des ajustements de stock
 */
export async function getInventoryHistory(
  params: { product_id?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal
) {
  const query = new URLSearchParams();
  if (params.product_id) query.set('product_id', params.product_id);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));

  const qs = query.toString();
  return backendFetch<InventoryHistoryEntry[]>(
    `/api/inventory/history${qs ? `?${qs}` : ''}`,
    { method: 'GET', signal }
  );
}

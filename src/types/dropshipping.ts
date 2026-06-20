/**
 * Types pour le Module Dropshipping
 * Extension indépendante e-commerce
 */

// ==================== FOURNISSEURS ====================
export interface DropshipSupplier {
  id: string;
  name: string;
  country: string;
  currency: string;
  supplier_type: 'local' | 'international';
  reliability_score: number;
  total_deliveries: number;
  successful_deliveries: number;
  average_delivery_days: number;
  api_endpoint?: string;
  api_key_encrypted?: string;
  webhook_url?: string;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  logo_url?: string;
  description?: string;
  commission_rate: number;
  min_order_value: number;
  supported_countries: string[];
  payment_methods: string[];
  is_verified: boolean;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ==================== PRODUITS ====================
export type ProductAvailabilityStatus =
  | 'available'
  | 'low_stock'
  | 'out_of_stock'
  | 'temporarily_unavailable'
  | 'discontinued';

export interface DropshipProduct {
  id: string;
  vendor_id: string;
  supplier_id: string;
  original_product_id?: string;
  supplier_product_id?: string;
  supplier_product_url?: string;
  supplier_price: number;
  supplier_currency: string;
  product_name: string;
  product_description?: string;
  selling_price: number;
  selling_currency: string;
  margin_percent?: number;
  supplier_stock: number;
  is_available: boolean;
  availability_status: ProductAvailabilityStatus;
  estimated_delivery_min: number;
  estimated_delivery_max: number;
  shipping_cost: number;
  auto_sync_enabled: boolean;
  last_sync_at?: string;
  sync_errors?: string[];
  category?: string;
  tags?: string[];
  images?: string[];
  variants?: ProductVariant[];
  total_orders: number;
  total_sold: number;
  rating: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  supplier?: DropshipSupplier;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price_adjustment?: number;
  stock?: number;
  attributes?: Record<string, string>;
}

// ==================== COMMANDES ====================
export type DropshipOrderStatus =
  | 'pending'
  | 'awaiting_supplier'
  | 'ordered_from_supplier'
  | 'supplier_confirmed'
  | 'supplier_processing'
  | 'shipped_by_supplier'
  | 'in_transit'
  | 'delivered_to_customer'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed';

export type SupplierPaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
export type VendorPaymentStatus = 'held' | 'released' | 'paid' | 'refunded';

export interface DropshipOrder {
  id: string;
  customer_order_id: string;
  vendor_id: string;
  supplier_id: string;
  dropship_product_id?: string;
  order_reference: string;
  supplier_order_reference?: string;
  items: DropshipOrderItem[];
  quantity: number;
  supplier_total: number;
  supplier_currency: string;
  customer_total: number;
  customer_currency: string;
  profit_amount?: number;
  status: DropshipOrderStatus;
  shipping_address?: ShippingAddress;
  tracking_number?: string;
  tracking_url?: string;
  shipped_at?: string;
  delivered_at?: string;
  estimated_delivery_date?: string;
  supplier_payment_status: SupplierPaymentStatus;
  supplier_paid_at?: string;
  vendor_payment_status: VendorPaymentStatus;
  vendor_paid_at?: string;
  customer_notes?: string;
  vendor_notes?: string;
  supplier_notes?: string;
  has_issue: boolean;
  issue_type?: string;
  issue_description?: string;
  issue_resolved_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Relations
  supplier?: DropshipSupplier;
  product?: DropshipProduct;
}

export interface DropshipOrderItem {
  product_id: string;
  product_name: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  supplier_price: number;
  selling_price: number;
}

export interface ShippingAddress {
  name: string;
  phone: string;
  email?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  country: string;
  postal_code?: string;
}

// ==================== INCIDENTS ====================
export type IncidentType =
  | 'late_delivery'
  | 'wrong_product'
  | 'damaged_product'
  | 'missing_product'
  | 'quality_issue'
  | 'price_discrepancy'
  | 'communication_failure'
  | 'refund_issue'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'escalated' | 'closed';

export interface DropshipIncident {
  id: string;
  supplier_id: string;
  order_id?: string;
  vendor_id?: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  resolution?: string;
  financial_impact: number;
  status: IncidentStatus;
  resolved_at?: string;
  resolved_by?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Relations
  supplier?: DropshipSupplier;
  order?: DropshipOrder;
}

// ==================== PARAMÈTRES ====================
export interface DropshipSettings {
  id: string;
  vendor_id: string;
  is_enabled: boolean;
  default_margin_percent: number;
  min_margin_percent: number;
  auto_sync_enabled: boolean;
  sync_frequency_hours: number;
  last_full_sync_at?: string;
  notify_low_stock: boolean;
  notify_price_changes: boolean;
  notify_supplier_issues: boolean;
  low_stock_threshold: number;
  hold_payment_days: number;
  auto_release_on_delivery: boolean;
  show_supplier_name: boolean;
  show_estimated_delivery: boolean;
  created_at: string;
  updated_at: string;
}

// ==================== SYNCHRONISATION ====================
export type SyncType = 'manual' | 'automatic' | 'webhook' | 'cron';
export type SyncScope = 'product' | 'stock' | 'price' | 'all' | 'supplier';
export type SyncStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

export interface DropshipSyncLog {
  id: string;
  supplier_id?: string;
  product_id?: string;
  sync_type: SyncType;
  sync_scope: SyncScope;
  status: SyncStatus;
  changes_detected?: Record<string, unknown>;
  products_updated: number;
  prices_updated: number;
  stocks_updated: number;
  errors?: string[];
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

// ==================== RAPPORTS ====================
export interface DropshipReport {
  id: string;
  vendor_id: string;
  report_period: 'daily' | 'weekly' | 'monthly';
  report_date: string;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  disputed_orders: number;
  total_revenue: number;
  total_costs: number;
  total_profit: number;
  average_margin_percent: number;
  average_delivery_days: number;
  on_time_delivery_rate: number;
  top_products: TopProductReport[];
  top_suppliers: TopSupplierReport[];
  created_at: string;
}

export interface TopProductReport {
  product_id: string;
  product_name: string;
  orders: number;
  revenue: number;
  profit: number;
}

export interface TopSupplierReport {
  supplier_id: string;
  supplier_name: string;
  orders: number;
  on_time_rate: number;
}

// ==================== STATISTIQUES ====================
export interface DropshipStats {
  totalProducts: number;
  activeProducts: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalProfit: number;
  averageMargin: number;
  suppliersCount: number;
}

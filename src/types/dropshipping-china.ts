/**
 * Types pour le module Dropshipping Chine
 * Extension du module dropshipping de base
 */

// Types de plateformes chinoises
export type ChinaPlatformType = 'ALIBABA' | 'ALIEXPRESS' | '1688' | 'PRIVATE';
export type SupplierRegion = 'CHINA' | 'OTHER';
export type TransportMethod = 'air' | 'sea' | 'express' | 'economy';
export type Incoterm = 'EXW' | 'FOB' | 'CIF' | 'DDP';
export type TrackingSegmentType = 'china_domestic' | 'international' | 'customs' | 'last_mile';

// Extension fournisseur chinois
export interface ChinaSupplierExtension {
  supplier_region: SupplierRegion;
  platform_type: ChinaPlatformType;
  platform_shop_url?: string;
  moq: number;
  production_time_days?: number;
  domestic_shipping_days?: number;
  international_shipping_days?: number;
  incoterm: Incoterm;
  chinese_language_support: boolean;
  quality_score: number;
  delivery_success_rate: number;
  on_time_rate: number;
  dispute_rate: number;
  total_orders: number;
  successful_orders: number;
  is_verified: boolean;
  verified_at?: string;
  verified_by?: string;
}

// Extension produit chinois
export interface ChinaProductExtension {
  platform_product_id?: string;
  platform_type?: ChinaPlatformType;
  original_images: string[];
  variants: ProductVariant[];
  moq: number;
  production_time_days?: number;
  supplier_region?: SupplierRegion;
  cost_breakdown: CostBreakdown;
  import_source_url?: string;
  imported_at?: string;
  last_price_alert?: string;
  price_change_percent?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
  image_url?: string;
}

export interface CostBreakdown {
  supplier_price: number;
  supplier_currency: string;
  china_domestic_shipping: number;
  international_shipping: number;
  estimated_customs: number;
  platform_fees: number;
  total_cost_usd: number;
  vendor_margin: number;
  vendor_margin_percent: number;
  final_price_local: number;
  local_currency: string;
}

// Import depuis plateformes
export interface ChinaImport {
  id: string;
  vendor_id: string;
  source_url: string;
  platform_type: ChinaPlatformType;
  platform_product_id?: string;
  import_status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_data: ExtractedProductData;
  error_message?: string;
  product_id?: string;
  created_at: string;
  completed_at?: string;
}

export interface ExtractedProductData {
  title?: string;
  description?: string;
  images?: string[];
  price?: number;
  currency?: string;
  variants?: ProductVariant[];
  moq?: number;
  shipping_info?: {
    domestic_days?: number;
    international_days?: number;
  };
  seller_info?: {
    name?: string;
    rating?: number;
    response_time?: string;
  };
}

// Alertes prix
export interface PriceAlert {
  id: string;
  product_id: string;
  vendor_id: string;
  old_price: number;
  new_price: number;
  old_currency: string;
  change_percent: number;
  alert_type: 'increase' | 'decrease' | 'unavailable';
  is_acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  created_at: string;
}

// Suivi multi-segments
export interface ChinaTracking {
  id: string;
  order_id: string;
  segment_type: TrackingSegmentType;
  carrier_name?: string;
  tracking_number?: string;
  status: string;
  status_details?: string;
  location?: string;
  estimated_arrival?: string;
  actual_arrival?: string;
  created_at: string;
  updated_at: string;
}

// Coûts détaillés
export interface ChinaCost {
  id: string;
  product_id: string;
  vendor_id: string;
  supplier_price: number;
  supplier_currency: string;
  china_domestic_shipping: number;
  international_shipping: number;
  estimated_customs: number;
  platform_fees: number;
  exchange_rate?: number;
  exchange_rate_date?: string;
  total_cost_usd?: number;
  vendor_margin?: number;
  vendor_margin_percent?: number;
  final_price_local?: number;
  local_currency?: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

// Reviews fournisseurs
export interface SupplierReview {
  id: string;
  supplier_id: string;
  order_id?: string;
  vendor_id: string;
  rating: number;
  delivery_rating: number;
  quality_rating: number;
  communication_rating: number;
  review_text?: string;
  is_dispute: boolean;
  dispute_reason?: string;
  dispute_resolved: boolean;
  created_at: string;
}

// Logs Chine
export interface ChinaLog {
  id: string;
  log_type: 'import' | 'sync' | 'order' | 'tracking' | 'error' | 'alert';
  severity: 'info' | 'warning' | 'error' | 'critical';
  entity_type?: 'product' | 'order' | 'supplier' | 'tracking';
  entity_id?: string;
  vendor_id?: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

// Settings Chine par vendeur
export interface ChinaSettings {
  id: string;
  vendor_id: string;
  default_transport_method: TransportMethod;
  auto_block_unavailable: boolean;
  unavailable_threshold_days: number;
  price_increase_alert_percent: number;
  auto_update_prices: boolean;
  show_origin_to_customer: boolean;
  default_customs_estimate_percent: number;
  preferred_incoterm: Incoterm;
  min_supplier_score: number;
  auto_disable_low_score: boolean;
  created_at: string;
  updated_at: string;
}

// Rapports Chine
export interface ChinaReport {
  id: string;
  vendor_id?: string;
  report_type: 'margin' | 'delivery' | 'customs' | 'supplier_performance';
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  summary: ReportSummary;
  created_at: string;
}

export interface ReportSummary {
  total_orders?: number;
  total_revenue?: number;
  average_margin?: number;
  average_delivery_days?: number;
  customs_blocked_rate?: number;
  top_suppliers?: string[];
}

// Stats dashboard Chine
export interface ChinaDashboardStats {
  totalChinaProducts: number;
  totalChinaOrders: number;
  averageMargin: number;
  averageDeliveryDays: number;
  pendingAlerts: number;
  topPlatform: ChinaPlatformType;
  customsBlockedRate: number;
  supplierScoreAverage: number;
}

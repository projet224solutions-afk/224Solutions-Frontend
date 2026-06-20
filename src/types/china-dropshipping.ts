/**
 * CHINA DROPSHIPPING MODULE - Types & Interfaces
 * Extension modulaire pour le dropshipping depuis la Chine
 * Compatible avec Alibaba, AliExpress, 1688
 *
 * @module china-dropshipping
 * @version 1.0.0
 * @author 224Solutions
 */

// ==================== ENUMS ====================

export type ChinaPlatformType = 'ALIBABA' | 'ALIEXPRESS' | '1688' | 'PRIVATE';
export type SupplierRegion = 'CHINA' | 'LOCAL' | 'INTERNATIONAL';
export type Incoterm = 'EXW' | 'FOB' | 'CIF' | 'DDP' | 'DAP';
export type TransportMethod = 'AIR' | 'SEA' | 'EXPRESS' | 'RAIL';
export type ChinaOrderStatus =
  | 'pending_supplier_confirm'
  | 'supplier_confirmed'
  | 'in_production'
  | 'quality_check'
  | 'ready_to_ship'
  | 'shipped_domestic_china'
  | 'at_consolidation_warehouse'
  | 'shipped_international'
  | 'customs_clearance'
  | 'last_mile_delivery'
  | 'delivered'
  | 'cancelled'
  | 'disputed';

export type SupplierScoreLevel = 'GOLD' | 'SILVER' | 'BRONZE' | 'UNVERIFIED' | 'BLACKLISTED';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export type PriceAlertType = 'INCREASE' | 'DECREASE' | 'OUT_OF_STOCK' | 'BACK_IN_STOCK';

// ==================== CHINA SUPPLIER EXTENSION ====================

/**
 * Extension des informations fournisseur pour la Chine
 * S'ajoute à l'entité Supplier existante
 */
export interface ChinaSupplierExtension {
  id: string;
  supplier_id: string; // Référence vers dropship_suppliers existant

  // Identification plateforme
  supplier_region: SupplierRegion;
  platform_type: ChinaPlatformType;
  platform_shop_id?: string;
  platform_shop_url?: string;
  platform_rating?: number;
  platform_years_active?: number;
  platform_verified?: boolean;

  // Capacités de commande
  moq: number; // Minimum Order Quantity
  production_time_days: number;
  domestic_shipping_days: number; // Chine interne
  international_shipping_days: number;

  // Termes commerciaux
  incoterm: Incoterm;
  accepts_small_orders: boolean;
  accepts_customization: boolean;
  accepts_sample_orders: boolean;
  sample_cost_usd?: number;

  // Communication
  chinese_language_support: boolean;
  english_language_support: boolean;
  french_language_support: boolean;
  wechat_id?: string;
  whatsapp_number?: string;
  alibaba_trade_assurance?: boolean;

  // Scoring interne 224Solutions
  internal_score: number; // 0-100
  score_level: SupplierScoreLevel;
  successful_deliveries: number;
  total_deliveries: number;
  on_time_rate: number; // Pourcentage
  dispute_rate: number; // Pourcentage
  avg_response_time_hours: number;

  // Métadonnées
  verified_by_admin: boolean;
  verification_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ==================== CHINA PRODUCT IMPORT ====================

/**
 * Données extraites lors de l'import d'un produit depuis une plateforme chinoise
 */
export interface ChinaProductImport {
  id: string;
  vendor_id: string;

  // Source
  source_platform: ChinaPlatformType;
  source_url: string;
  source_product_id: string;

  // Infos produit extraites
  original_title: string;
  translated_title?: string;
  original_description?: string;
  translated_description?: string;
  images: string[];

  // Prix et quantités (en CNY)
  supplier_price_cny: number;
  supplier_price_usd: number;
  moq: number;
  price_tiers?: PriceTier[];

  // Variantes
  variants: ChinaProductVariant[];

  // Délais
  production_time_days: number;
  shipping_time_days: number;

  // Statut import
  import_status: 'pending' | 'imported' | 'failed' | 'archived';
  import_error?: string;

  // Lien avec produit final
  dropship_product_id?: string;

  created_at: string;
  updated_at: string;
}

export interface PriceTier {
  min_quantity: number;
  max_quantity?: number;
  price_cny: number;
  price_usd: number;
}

export interface ChinaProductVariant {
  id: string;
  name: string;
  values: string[];
  images?: string[];
  price_modifier_cny?: number;
  stock_available?: number;
}

// ==================== CHINA LOGISTICS ====================

/**
 * Sous-module logistique Chine → Client Final
 */
export interface ChinaLogistics {
  id: string;
  order_id: string;

  // Méthode de transport
  transport_method: TransportMethod;
  carrier_domestic?: string; // Ex: SF Express, YTO
  carrier_international?: string; // Ex: DHL, FedEx, China Post
  carrier_last_mile?: string; // Transporteur local destination

  // Tracking multi-segments
  tracking_domestic?: string;
  tracking_international?: string;
  tracking_last_mile?: string;

  // Estimations
  estimated_production_days: number;
  estimated_domestic_days: number;
  estimated_customs_days: number;
  estimated_international_days: number;
  estimated_last_mile_days: number;
  estimated_total_days: number;

  // Dates réelles
  actual_ship_date?: string;
  actual_customs_date?: string;
  actual_delivery_date?: string;

  // Douane
  customs_status: 'pending' | 'in_progress' | 'cleared' | 'held' | 'released';
  customs_reference?: string;
  customs_duty_amount?: number;
  customs_duty_currency?: string;

  // Transparence client
  show_origin_to_customer: boolean;
  customer_estimated_min_days: number;
  customer_estimated_max_days: number;

  created_at: string;
  updated_at: string;
}

// ==================== CHINA COST CALCULATION ====================

/**
 * Calcul automatique des coûts réels pour produits Chine
 */
export interface ChinaCostBreakdown {
  id: string;
  product_id: string;

  // Prix fournisseur
  supplier_price_cny: number;
  supplier_price_usd: number;
  exchange_rate_cny_usd: number;

  // Frais Chine interne
  domestic_shipping_cny: number;
  handling_fee_cny: number;
  consolidation_fee_cny?: number;

  // Transport international
  international_shipping_usd: number;
  transport_method: TransportMethod;
  weight_kg: number;
  volume_cbm?: number;

  // Frais douane estimés
  estimated_customs_duty_percent: number;
  estimated_customs_duty_amount: number;
  customs_duty_currency: string;
  hs_code?: string;

  // Autres frais
  payment_processing_fee: number;
  platform_fee: number;
  insurance_fee?: number;

  // Totaux
  total_cost_usd: number;
  total_cost_local: number;
  local_currency: string;
  exchange_rate_usd_local: number;

  // Marge vendeur
  vendor_margin_percent: number;
  vendor_margin_amount: number;

  // Prix final
  final_selling_price: number;
  selling_currency: string;

  // Profit net estimé
  estimated_profit: number;
  estimated_profit_percent: number;

  calculated_at: string;
}

// ==================== CHINA SUPPLIER ORDER ====================

/**
 * Commande structurée vers fournisseur chinois
 */
export interface ChinaSupplierOrder {
  id: string;
  customer_order_id: string;
  vendor_id: string;
  supplier_id: string;

  // Statut
  status: ChinaOrderStatus;
  status_history: OrderStatusHistoryItem[];

  // Produits commandés
  items: ChinaOrderItem[];

  // Adresses
  shipping_address: ShippingAddress;
  billing_address?: ShippingAddress;

  // Instructions multilingues
  instructions_chinese?: string;
  instructions_english?: string;
  notes_internal?: string;

  // Montants
  supplier_total_cny: number;
  supplier_total_usd: number;
  shipping_cost_usd: number;
  total_paid_supplier_usd: number;

  // Paiement fournisseur
  supplier_payment_status: 'pending' | 'partial' | 'paid' | 'refunded';
  supplier_payment_reference?: string;
  supplier_payment_date?: string;

  // Tracking
  logistics?: ChinaLogistics;

  // Délais
  expected_ship_date?: string;
  expected_delivery_date?: string;

  created_at: string;
  updated_at: string;
}

export interface ChinaOrderItem {
  product_id: string;
  product_name: string;
  variant?: string;
  quantity: number;
  unit_price_cny: number;
  unit_price_usd: number;
  total_cny: number;
  total_usd: number;
  platform_product_id?: string;
  sku?: string;
}

export interface OrderStatusHistoryItem {
  status: ChinaOrderStatus;
  timestamp: string;
  note?: string;
  updated_by?: string;
}

export interface ShippingAddress {
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state_province?: string;
  postal_code?: string;
  country: string;
  country_code: string;
}

// ==================== SUPPLIER SCORING ====================

/**
 * Système de scoring anti-arnaque fournisseurs
 */
export interface SupplierScore {
  supplier_id: string;

  // Métriques de performance
  delivery_success_rate: number; // 0-100
  on_time_delivery_rate: number; // 0-100
  quality_rating: number; // 0-5
  response_time_score: number; // 0-100
  dispute_resolution_score: number; // 0-100

  // Historique
  total_orders: number;
  successful_orders: number;
  cancelled_orders: number;
  disputed_orders: number;

  // Score global
  overall_score: number; // 0-100
  score_level: SupplierScoreLevel;

  // Alertes
  is_flagged: boolean;
  flag_reason?: string;
  auto_disabled: boolean;

  // Dernière mise à jour
  last_calculated_at: string;
}

export interface SupplierScoreThresholds {
  gold_min: number;
  silver_min: number;
  bronze_min: number;
  warning_threshold: number;
  auto_disable_threshold: number;
}

// ==================== PRICE SYNC & ALERTS ====================

/**
 * Synchronisation prix et disponibilité
 */
export interface ChinaPriceSync {
  id: string;
  product_id: string;
  supplier_id: string;

  // Prix précédent
  previous_price_cny: number;
  previous_price_usd: number;

  // Nouveau prix
  current_price_cny: number;
  current_price_usd: number;

  // Changement
  price_change_percent: number;
  price_change_direction: 'up' | 'down' | 'stable';

  // Disponibilité
  previous_availability: boolean;
  current_availability: boolean;
  stock_quantity?: number;

  // Alerte générée
  alert_generated: boolean;
  alert_type?: PriceAlertType;

  synced_at: string;
}

export interface ChinaPriceAlert {
  id: string;
  vendor_id: string;
  product_id: string;
  supplier_id: string;

  alert_type: PriceAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';

  // Détails
  message: string;
  old_value?: number;
  new_value?: number;
  change_percent?: number;

  // Actions
  is_read: boolean;
  action_taken?: string;
  auto_action_applied?: boolean;

  created_at: string;
  resolved_at?: string;
}

// ==================== CHINA REPORTS ====================

/**
 * Rapports spécifiques Chine
 */
export interface ChinaDropshipReport {
  id: string;
  vendor_id: string;
  report_period: 'daily' | 'weekly' | 'monthly';
  period_start: string;
  period_end: string;

  // Commandes
  total_china_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  disputed_orders: number;

  // Financier
  total_revenue_local: number;
  total_cost_usd: number;
  total_profit_local: number;
  net_margin_percent: number;

  // Délais
  avg_actual_delivery_days: number;
  avg_estimated_delivery_days: number;
  delivery_variance_days: number;
  on_time_rate: number;

  // Douane
  customs_blocked_orders: number;
  customs_blocked_rate: number;
  avg_customs_delay_days: number;

  // Top performers
  top_suppliers: TopSupplierStat[];
  top_products: TopProductStat[];

  // Problèmes
  price_increase_alerts: number;
  stock_out_alerts: number;
  quality_issues: number;

  generated_at: string;
}

export interface TopSupplierStat {
  supplier_id: string;
  supplier_name: string;
  platform: ChinaPlatformType;
  orders_count: number;
  revenue: number;
  profit: number;
  on_time_rate: number;
  score: number;
}

export interface TopProductStat {
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue: number;
  profit: number;
  margin_percent: number;
}

// ==================== ADMIN CHINA DASHBOARD ====================

/**
 * Données pour le tableau de bord admin Chine
 */
export interface ChinaAdminDashboard {
  // Vue d'ensemble
  total_china_suppliers: number;
  verified_suppliers: number;
  active_suppliers: number;
  flagged_suppliers: number;

  // Commandes en cours
  pending_orders: number;
  in_transit_orders: number;
  customs_held_orders: number;

  // Performance
  avg_delivery_time_days: number;
  customs_clearance_rate: number;
  supplier_avg_score: number;

  // Alertes actives
  active_alerts: number;
  critical_alerts: number;

  // Tendances
  orders_trend: TrendData[];
  revenue_trend: TrendData[];
}

export interface TrendData {
  date: string;
  value: number;
}

// ==================== API RESPONSES ====================

export interface ChinaApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
  retry_after_ms?: number;
}

export interface ChinaProductScrapingResult {
  success: boolean;
  product?: ChinaProductImport;
  errors?: string[];
  warnings?: string[];
  scraping_time_ms: number;
}

// ==================== SETTINGS ====================

export interface ChinaDropshipSettings {
  vendor_id: string;

  // Auto-sync
  auto_sync_prices: boolean;
  sync_frequency_hours: number;

  // Alertes
  price_increase_alert_threshold: number; // Pourcentage
  price_decrease_alert_threshold: number;
  stock_alert_enabled: boolean;

  // Auto-actions
  auto_disable_on_price_spike: boolean;
  auto_disable_threshold_percent: number;
  auto_disable_on_stock_out: boolean;
  auto_disable_stock_out_days: number;

  // Affichage client
  show_origin_country: boolean;
  show_estimated_delivery: boolean;
  add_buffer_days: number;

  // Devise
  preferred_supplier_currency: 'CNY' | 'USD';
  local_selling_currency: string;

  created_at: string;
  updated_at: string;
}

// ==================== LOGS ====================

export interface ChinaDropshipLog {
  id: string;
  vendor_id?: string;
  log_type: 'sync' | 'import' | 'order' | 'alert' | 'error' | 'api';
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  stack_trace?: string;
  created_at: string;
}

// ==================== CONSTANTS ====================

export const CHINA_PLATFORMS: Record<ChinaPlatformType, { name: string; url: string; logo: string }> = {
  ALIBABA: { name: 'Alibaba', url: 'https://www.alibaba.com', logo: '🏭' },
  ALIEXPRESS: { name: 'AliExpress', url: 'https://www.aliexpress.com', logo: '🛒' },
  '1688': { name: '1688', url: 'https://www.1688.com', logo: '🇨🇳' },
  PRIVATE: { name: 'Fournisseur Privé', url: '', logo: '🤝' }
};

export const TRANSPORT_METHODS: Record<TransportMethod, { name: string; avgDays: number; icon: string }> = {
  EXPRESS: { name: 'Express (DHL/FedEx)', avgDays: 7, icon: '✈️' },
  AIR: { name: 'Fret Aérien', avgDays: 14, icon: '🛫' },
  RAIL: { name: 'Train (China-Europe)', avgDays: 21, icon: '🚂' },
  SEA: { name: 'Maritime', avgDays: 35, icon: '🚢' }
};

export const INCOTERMS: Record<Incoterm, { name: string; description: string }> = {
  EXW: { name: 'Ex Works', description: 'Départ usine, acheteur gère tout le transport' },
  FOB: { name: 'Free On Board', description: 'Vendeur livre au port, acheteur gère transport international' },
  CIF: { name: 'Cost Insurance Freight', description: 'Vendeur gère transport et assurance jusqu\'au port destination' },
  DDP: { name: 'Delivered Duty Paid', description: 'Vendeur livre à destination, droits payés' },
  DAP: { name: 'Delivered At Place', description: 'Vendeur livre à destination, droits non payés' }
};

export const SUPPLIER_SCORE_THRESHOLDS: SupplierScoreThresholds = {
  gold_min: 85,
  silver_min: 70,
  bronze_min: 50,
  warning_threshold: 40,
  auto_disable_threshold: 25
};

export const DEFAULT_CHINA_SETTINGS: Partial<ChinaDropshipSettings> = {
  auto_sync_prices: true,
  sync_frequency_hours: 24,
  price_increase_alert_threshold: 15,
  price_decrease_alert_threshold: 10,
  stock_alert_enabled: true,
  auto_disable_on_price_spike: true,
  auto_disable_threshold_percent: 30,
  auto_disable_on_stock_out: false,
  auto_disable_stock_out_days: 7,
  show_origin_country: true,
  show_estimated_delivery: true,
  add_buffer_days: 3,
  preferred_supplier_currency: 'USD'
};

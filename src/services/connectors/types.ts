/**
 * CONNECTOR SYSTEM - Types & Interfaces
 * Architecture modulaire type App Store (Shopify-like)
 *
 * @module connector-types
 * @version 1.0.0
 * @author 224Solutions
 */

// ==================== ENUMS ====================

export type ConnectorType =
  | 'ALIEXPRESS'
  | 'ALIBABA'
  | '1688'
  | 'PRIVATE'
  | 'CUSTOM';

export type ConnectorStatus =
  | 'active'
  | 'inactive'
  | 'error'
  | 'rate_limited'
  | 'authentication_failed'
  | 'maintenance';

export type SyncType =
  | 'price'
  | 'availability'
  | 'product_details'
  | 'tracking'
  | 'full';

export type WebhookEvent =
  | 'order.created'
  | 'order.updated'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'product.updated'
  | 'price.changed'
  | 'stock.changed'
  | 'tracking.updated';

// ==================== BASE CONNECTOR INTERFACE ====================

/**
 * Interface standard obligatoire pour tous les connecteurs
 * Pattern: Strategy + Factory
 */
export interface IExternalConnector {
  // Identification
  readonly connectorType: ConnectorType;
  readonly connectorName: string;
  readonly connectorVersion: string;

  // État
  status: ConnectorStatus;
  lastSync: Date | null;
  errorCount: number;

  // Configuration
  config: ConnectorConfig;

  // ==================== MÉTHODES OBLIGATOIRES ====================

  /**
   * Authentification auprès de la plateforme externe
   */
  authenticate(): Promise<AuthResult>;

  /**
   * Valider la connexion et les credentials
   */
  validateConnection(): Promise<boolean>;

  /**
   * Importer un produit depuis une URL source
   */
  importProduct(sourceUrl: string): Promise<ProductImportResult>;

  /**
   * Synchroniser les prix d'un ou plusieurs produits
   */
  syncPrice(productIds?: string[]): Promise<SyncResult>;

  /**
   * Synchroniser la disponibilité (stock)
   */
  syncAvailability(productIds?: string[]): Promise<SyncResult>;

  /**
   * Déclenché lors de la création d'une commande client
   */
  onOrderCreated(orderData: OrderData): Promise<SupplierOrderResult>;

  /**
   * Pousser les informations de tracking vers le système
   */
  pushTracking(trackingData: TrackingData): Promise<TrackingResult>;

  /**
   * Gestion centralisée des erreurs
   */
  handleError(error: ConnectorError): Promise<ErrorHandlingResult>;

  /**
   * Nettoyage et déconnexion
   */
  disconnect(): Promise<void>;
}

// ==================== CONFIGURATION ====================

export interface ConnectorConfig {
  // Identifiants API
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;

  // Endpoints
  baseUrl: string;
  webhookUrl?: string;

  // Limites
  rateLimit: RateLimitConfig;
  timeout: number; // ms
  retryAttempts: number;
  retryDelayMs: number;

  // Options
  sandbox: boolean;
  autoSync: boolean;
  syncIntervalMinutes: number;

  // Mappings personnalisés
  fieldMappings?: Record<string, string>;
  currencyMapping?: Record<string, string>;

  // Métadonnées
  metadata?: Record<string, unknown>;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  currentMinuteRequests: number;
  currentHourRequests: number;
  currentDayRequests: number;
  lastResetTimestamp: number;
}

// ==================== AUTHENTIFICATION ====================

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string[];
  error?: string;
  errorCode?: string;
}

// ==================== IMPORT PRODUIT ====================

export interface ProductImportResult {
  success: boolean;
  productId?: string;
  normalizedProduct?: NormalizedProduct;
  warnings?: string[];
  errors?: string[];
  scrapingTimeMs?: number;
}

export interface NormalizedProduct {
  // Identifiants
  externalId: string;
  sourceUrl: string;
  sourcePlatform: ConnectorType;

  // Informations produit
  title: string;
  titleTranslated?: string;
  description?: string;
  descriptionTranslated?: string;
  images: string[];

  // Prix
  priceCurrency: string;
  priceOriginal: number;
  priceUsd: number;

  // Quantités
  moq: number; // Minimum Order Quantity
  stockQuantity?: number;
  priceTiers?: PriceTier[];

  // Variantes
  variants?: ProductVariant[];

  // Shipping
  shippingMethods?: ShippingMethod[];
  estimatedDeliveryDays: {
    min: number;
    max: number;
  };

  // Fournisseur
  supplierInfo: SupplierInfo;

  // Métadonnées
  category?: string;
  tags?: string[];
  attributes?: Record<string, string>;

  // Flags internes
  isDropship: true;
  isExternalDropship: true;
  platformVerified?: boolean;
}

export interface PriceTier {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
  currency: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  priceModifier?: number;
  stockQuantity?: number;
  sku?: string;
  image?: string;
}

export interface ShippingMethod {
  name: string;
  carrier?: string;
  estimatedDays: number;
  price: number;
  currency: string;
  trackingAvailable: boolean;
}

export interface SupplierInfo {
  id?: string;
  name: string;
  shopUrl?: string;
  rating?: number;
  yearsActive?: number;
  totalSales?: number;
  responseTime?: string;
  verified?: boolean;
  tradeAssurance?: boolean;
  region: 'CHINA' | 'LOCAL' | 'INTERNATIONAL';
}

// ==================== SYNCHRONISATION ====================

export interface SyncResult {
  success: boolean;
  syncType: SyncType;
  productsUpdated: number;
  pricesUpdated: number;
  stocksUpdated: number;
  errors: SyncError[];
  warnings: string[];
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

export interface SyncError {
  productId: string;
  errorType: string;
  message: string;
  retryable: boolean;
}

// ==================== COMMANDES ====================

export interface OrderData {
  orderId: string;
  customerOrderId: string;
  vendorId: string;

  items: OrderItem[];
  quantity: number;

  shippingAddress: ShippingAddress;

  notes?: string;

  // Montants
  subtotal: number;
  shippingCost: number;
  total: number;
  currency: string;
}

export interface OrderItem {
  productId: string;
  externalProductId?: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ShippingAddress {
  recipientName: string;
  name?: string; // alias for recipientName
  phone: string;
  email?: string;
  address?: string; // alias for addressLine1
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  postalCode?: string;
  country: string;
  countryCode: string;
}

export interface SupplierOrderResult {
  success: boolean;
  supplierOrderId?: string;
  supplierOrderReference?: string;
  estimatedShipDate?: Date;
  estimatedDeliveryDate?: Date;
  totalCost?: number;
  currency?: string;
  error?: string;
  errorCode?: string;
}

// Alias pour compatibilité
export type OrderResult = SupplierOrderResult;

// ==================== TRACKING ====================

export interface TrackingInfo {
  trackingNumber: string;
  carrier: string;
  status: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
  events: TrackingEvent[];
  lastUpdate?: Date;
}

export interface TrackingData {
  orderId: string;
  supplierOrderId?: string;
  trackingNumber: string;
  carrier?: string;
  trackingUrl?: string;
}

export interface TrackingResult {
  success: boolean;
  trackingUpdated: boolean;
  currentStatus?: string;
  estimatedDelivery?: Date;
  trackingEvents?: TrackingEvent[];
  error?: string;
}

export interface TrackingEvent {
  timestamp: Date;
  status: string;
  location?: string;
  description?: string;
}

// ==================== GESTION D'ERREURS ====================

export interface ConnectorError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  originalError?: unknown;
  context?: Record<string, unknown>;
}

export interface ErrorHandlingResult {
  handled: boolean;
  action: 'retry' | 'skip' | 'disable' | 'alert' | 'none';
  retryAfterMs?: number;
  alertSent?: boolean;
  logId?: string;
}

// ==================== CIRCUIT BREAKER ====================

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half_open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextRetryTime?: Date;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms avant passage à half_open
  monitoringPeriod: number; // ms
}

// ==================== LOGS ====================

export interface ConnectorLog {
  id: string;
  connectorType: ConnectorType;
  vendorId?: string;
  logType: 'info' | 'warning' | 'error' | 'debug' | 'sync' | 'order' | 'api' | 'import' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  responseTime?: number;
  createdAt: Date;
}

// ==================== WEBHOOKS ====================

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: Date;
  connectorType: ConnectorType;
  data: Record<string, unknown>;
  signature?: string;
}

export interface WebhookHandler {
  event: WebhookEvent;
  handler: (payload: WebhookPayload) => Promise<void>;
}

// ==================== METRICS ====================

export interface ConnectorMetrics {
  connectorType: ConnectorType;

  // Performance
  avgResponseTimeMs: number;
  successRate: number;
  errorRate: number;

  // Volume
  totalRequests: number;
  totalSyncs: number;
  totalOrders: number;

  // Produits
  productsImported: number;
  productsActive: number;

  // Erreurs
  errorsLast24h: number;
  rateLimitHitsLast24h: number;

  // Dernière activité
  lastSyncAt?: Date;
  lastOrderAt?: Date;
  lastErrorAt?: Date;

  // Période
  periodStart: Date;
  periodEnd: Date;
}

// ==================== FACTORY ====================

export interface ConnectorFactory {
  create(type: ConnectorType, config: Partial<ConnectorConfig>): IExternalConnector;
  getAvailableConnectors(): ConnectorInfo[];
  isSupported(type: ConnectorType): boolean;
}

export interface ConnectorInfo {
  type: ConnectorType;
  name: string;
  description: string;
  logo: string;
  region: 'CHINA' | 'LOCAL' | 'INTERNATIONAL' | 'GLOBAL';
  features: string[];
  requiresApiKey: boolean;
  setupGuideUrl?: string;
  status: 'stable' | 'beta' | 'deprecated';
}

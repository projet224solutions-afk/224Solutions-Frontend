/**
 * 📡 Kafka Topics Configuration
 * Tous les topics pour 224Solutions basés sur le plan d'intégration Kafka
 */

// ==================== COMMERCE TOPICS ====================
export const COMMERCE_TOPICS = {
  // Orders
  ORDERS_CREATED: 'orders-created',
  ORDERS_UPDATED: 'orders-updated',
  ORDERS_CONFIRMED: 'orders-confirmed',
  ORDERS_CANCELLED: 'orders-cancelled',
  ORDERS_PREPARING: 'orders-preparing',
  ORDERS_READY: 'orders-ready',

  // Inventory
  INVENTORY_UPDATED: 'inventory-updated',
  INVENTORY_LOW_STOCK: 'inventory-low-stock',
  INVENTORY_OUT_OF_STOCK: 'inventory-out-of-stock',
  INVENTORY_RESTOCKED: 'inventory-restocked',
} as const;

// ==================== LOGISTICS TOPICS ====================
export const LOGISTICS_TOPICS = {
  // Delivery
  DELIVERY_ASSIGNED: 'delivery-assigned',
  DELIVERY_PICKUP: 'delivery-pickup',
  DELIVERY_IN_TRANSIT: 'delivery-in-transit',
  DELIVERY_DELIVERED: 'delivery-delivered',
  DELIVERY_FAILED: 'delivery-failed',
  DELIVERY_RETURNED: 'delivery-returned',

  // Location
  LOCATION_UPDATED: 'location-updated',
  DELIVERY_ETA_UPDATED: 'delivery-eta-updated',

  // Routes
  ROUTE_OPTIMIZED: 'route-optimized',
  ROUTE_CHANGED: 'route-changed',
} as const;

// ==================== FINANCIAL TOPICS ====================
export const FINANCIAL_TOPICS = {
  // Payments
  PAYMENTS_INITIATED: 'payments-initiated',
  PAYMENTS_COMPLETED: 'payments-completed',
  PAYMENTS_FAILED: 'payments-failed',
  PAYMENTS_REFUNDED: 'payments-refunded',

  // Wallet
  WALLET_CREDITED: 'wallet-credited',
  WALLET_DEBITED: 'wallet-debited',
  WALLET_TRANSFER: 'wallet-transfer',
  WALLET_LOCKED: 'wallet-locked',

  // Commissions
  COMMISSION_CALCULATED: 'commission-calculated',
  COMMISSION_PAID: 'commission-paid',

  // Escrow
  ESCROW_CREATED: 'escrow-created',
  ESCROW_RELEASED: 'escrow-released',
  ESCROW_DISPUTED: 'escrow-disputed',
} as const;

// ==================== ANALYTICS TOPICS ====================
export const ANALYTICS_TOPICS = {
  // User behavior
  USER_LOGIN: 'user-login',
  USER_LOGOUT: 'user-logout',
  USER_PAGE_VIEW: 'user-page-view',
  USER_PURCHASE: 'user-purchase',
  USER_SEARCH: 'user-search',
  USER_CART_ACTION: 'user-cart-action',

  // Business metrics
  METRICS_SALES: 'metrics-sales',
  METRICS_REVENUE: 'metrics-revenue',
  METRICS_USERS: 'metrics-users',

  // Performance
  PERFORMANCE_API: 'performance-api',
  PERFORMANCE_ERROR: 'performance-error',
} as const;

// ==================== SYSTEM TOPICS ====================
export const SYSTEM_TOPICS = {
  // Notifications
  NOTIFICATIONS_EMAIL: 'notifications-email',
  NOTIFICATIONS_SMS: 'notifications-sms',
  NOTIFICATIONS_PUSH: 'notifications-push',
  NOTIFICATIONS_IN_APP: 'notifications-in-app',

  // System events
  SYSTEM_HEALTH: 'system-health',
  SYSTEM_ERROR: 'system-error',
  SYSTEM_MAINTENANCE: 'system-maintenance',

  // Audit
  AUDIT_LOG: 'audit-log',
  SECURITY_ALERT: 'security-alert',
} as const;

// ==================== TAXI/RIDE TOPICS ====================
export const TAXI_TOPICS = {
  RIDE_REQUESTED: 'ride-requested',
  RIDE_ACCEPTED: 'ride-accepted',
  RIDE_STARTED: 'ride-started',
  RIDE_COMPLETED: 'ride-completed',
  RIDE_CANCELLED: 'ride-cancelled',
  DRIVER_AVAILABLE: 'driver-available',
  DRIVER_BUSY: 'driver-busy',
  DRIVER_OFFLINE: 'driver-offline',
} as const;

// ==================== BUREAUX SYNDICAUX TOPICS ====================
export const BUREAU_TOPICS = {
  BUREAU_MEMBER_ADDED: 'bureau-member-added',
  BUREAU_MEMBER_REMOVED: 'bureau-member-removed',
  BUREAU_COTISATION_PAID: 'bureau-cotisation-paid',
  BUREAU_MEETING_SCHEDULED: 'bureau-meeting-scheduled',
  BUREAU_VOTE_STARTED: 'bureau-vote-started',
  BUREAU_VOTE_ENDED: 'bureau-vote-ended',
} as const;

// ==================== AGENT/PDG TOPICS ====================
export const AGENT_TOPICS = {
  AGENT_CREATED: 'agent-created',
  AGENT_ACTIVATED: 'agent-activated',
  AGENT_DEACTIVATED: 'agent-deactivated',
  AGENT_COMMISSION: 'agent-commission',
  PDG_REVENUE: 'pdg-revenue',
  PDG_WITHDRAWAL: 'pdg-withdrawal',
} as const;

// ==================== ALL TOPICS ====================
export const KAFKA_TOPICS = {
  ...COMMERCE_TOPICS,
  ...LOGISTICS_TOPICS,
  ...FINANCIAL_TOPICS,
  ...ANALYTICS_TOPICS,
  ...SYSTEM_TOPICS,
  ...TAXI_TOPICS,
  ...BUREAU_TOPICS,
  ...AGENT_TOPICS,
} as const;

export type KafkaTopicName = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];

// Topic categories for organization
export const TOPIC_CATEGORIES = {
  commerce: Object.values(COMMERCE_TOPICS),
  logistics: Object.values(LOGISTICS_TOPICS),
  financial: Object.values(FINANCIAL_TOPICS),
  analytics: Object.values(ANALYTICS_TOPICS),
  system: Object.values(SYSTEM_TOPICS),
  taxi: Object.values(TAXI_TOPICS),
  bureau: Object.values(BUREAU_TOPICS),
  agent: Object.values(AGENT_TOPICS),
} as const;

export const ALL_TOPIC_NAMES = Object.values(KAFKA_TOPICS);

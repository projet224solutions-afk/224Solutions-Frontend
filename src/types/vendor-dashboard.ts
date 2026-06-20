/**
 * Types pour le Dashboard Vendeur
 * 224Solutions - Types stricts pour éliminer les `any`
 */

import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Types de base pour les données Supabase
// ============================================================================

/**
 * Structure d'une commande récente affichée sur le dashboard
 */
export interface RecentOrder {
  order_number: string;
  customer_label: string;
  status: OrderStatus;
  total_amount: number;
  /** Devise dans laquelle total_amount est libellé (orders.currency = devise vendeur/produit) */
  currency: string;
  created_at: string;
}

/**
 * Statuts possibles d'une commande
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

/**
 * Données brutes d'une commande depuis Supabase
 */
export interface OrderFromSupabase {
  order_number: string;
  total_amount: number | null;
  currency?: string | null;
  status: string | null;
  created_at: string;
  customer: {
    user_id: string;
  } | null;
}

// ============================================================================
// Types pour les statistiques vendeur
// ============================================================================

/**
 * Statistiques vendeur depuis useVendorStats
 */
export interface VendorStats {
  vendorId: string;
  revenue: number;
  orders_count: number;
  customers_count: number;
  products_count?: number;
  pending_orders?: number;
}

/**
 * Carte de statistique affichée sur le dashboard
 */
export interface StatCard {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  color: string;
}

// ============================================================================
// Types pour le profil vendeur
// ============================================================================

/**
 * Type de business du vendeur
 */
export type BusinessType = 'physical' | 'digital' | 'hybrid';

/**
 * Informations du vendeur courant
 */
export interface CurrentVendorInfo {
  canAccessPOS: boolean;
  businessType: BusinessType | null;
}

// ============================================================================
// Types pour le layout et composants
// ============================================================================

/**
 * Props du composant DashboardHome
 */
export interface DashboardHomeProps {
  recentOrders: RecentOrder[];
  showAllOrders: boolean;
  onToggleShowAllOrders: () => void;
  canAccessPOS: boolean;
  vendorId?: string;
}

/**
 * Props du composant VendorHeader
 */
export interface VendorHeaderProps {
  userName: string;
  userEmail?: string;
  onSignOut: () => Promise<void>;
  onNavigateToSettings: () => void;
}

/**
 * Props pour les actions rapides
 */
export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  disabled?: boolean;
  disabledMessage?: string;
}

// ============================================================================
// Types pour les erreurs et états
// ============================================================================

/**
 * État d'erreur du dashboard
 */
export interface DashboardError {
  message: string;
  code?: string;
  isVendorMissing?: boolean;
  isOffline?: boolean;
}

/**
 * État de chargement du dashboard
 */
export interface DashboardLoadingState {
  isLoading: boolean;
  isStatsLoading: boolean;
  isOrdersLoading: boolean;
}

// ============================================================================
// Utilitaires de transformation
// ============================================================================

/**
 * Transforme les données brutes de commande en RecentOrder
 */
export function transformOrderToRecentOrder(order: OrderFromSupabase): RecentOrder {
  return {
    order_number: order.order_number,
    customer_label: order.customer?.user_id
      ? `Client ${order.customer.user_id.slice(0, 6)}`
      : 'Client',
    status: (order.status as OrderStatus) || 'pending',
    total_amount: order.total_amount || 0,
    currency: order.currency || 'GNF',
    created_at: order.created_at,
  };
}

/**
 * Vérifie si un statut de commande est valide
 */
export function isValidOrderStatus(status: string): status is OrderStatus {
  return [
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
  ].includes(status);
}

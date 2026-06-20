/**
 * STRIPE PAYMENT TYPES
 * Types TypeScript pour le système de paiement Stripe
 * 224SOLUTIONS
 */
import { formatCurrency as formatCurrencyLib } from '@/lib/formatters';
// =====================================================
// PAYMENT STATUS & TYPES
// =====================================================

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED'
  | 'REFUNDED'
  | 'DISPUTED';

export type TransactionType =
  | 'PAYMENT'
  | 'COMMISSION'
  | 'WITHDRAWAL'
  | 'REFUND'
  | 'CHARGEBACK';

export type WalletStatus =
  | 'ACTIVE'
  | 'FROZEN'
  | 'SUSPENDED';

export type WithdrawalStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED';

// =====================================================
// STRIPE TRANSACTION
// =====================================================

export interface StripeTransaction {
  id: string;
  stripe_payment_intent_id: string;
  stripe_charge_id: string | null;

  // Utilisateurs
  buyer_id: string;
  seller_id: string;

  // Montants (en centimes)
  amount: number;
  currency: string;

  // Commission
  commission_rate: number;
  commission_amount: number;
  seller_net_amount: number;

  // Statut
  status: PaymentStatus;

  // Metadata
  order_id: string | null;
  service_id: string | null;
  product_id: string | null;
  metadata: Record<string, any>;

  // Paiement
  payment_method: string | null;
  last4: string | null;
  card_brand: string | null;

  // 3D Secure
  requires_3ds: boolean;
  three_ds_status: string | null;

  // Erreurs
  error_code: string | null;
  error_message: string | null;

  // Dates
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// WALLET
// =====================================================

export interface Wallet {
  id: string;
  user_id: string;

  // Soldes (en centimes)
  available_balance: number;
  pending_balance: number;
  frozen_balance: number;

  currency: string;
  status: WalletStatus;

  // Stats
  total_earned: number;
  total_withdrawn: number;
  total_transactions: number;

  // Vérification
  is_verified: boolean;
  verification_level: string | null;

  created_at: string;
  updated_at: string;
}

// =====================================================
// WALLET TRANSACTION
// =====================================================

export interface WalletTransaction {
  id: string;
  wallet_id: string;

  type: TransactionType;
  amount: number;
  currency: string;

  description: string | null;

  // Références
  stripe_transaction_id: string | null;
  order_id: string | null;
  service_id: string | null;

  // Solde avant/après
  balance_before: number;
  balance_after: number;

  metadata: Record<string, any>;
  created_at: string;
}

// =====================================================
// WITHDRAWAL
// =====================================================

export interface Withdrawal {
  id: string;
  wallet_id: string;
  user_id: string;

  amount: number;
  currency: string;
  status: WithdrawalStatus;

  destination_type: string; // bank_account, mobile_money, stripe_payout
  destination_details: Record<string, any>;

  stripe_payout_id: string | null;
  external_reference: string | null;

  fee_amount: number;
  net_amount: number;

  requested_at: string;
  processed_at: string | null;
  completed_at: string | null;

  error_message: string | null;

  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;

  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// STRIPE CONFIG
// =====================================================

export interface StripeConfig {
  id: string;
  platform_commission_rate: number;
  stripe_publishable_key: string | null;
  // stripe_secret_key: NEVER exposed to frontend - server-side only
  // stripe_webhook_secret: NEVER exposed to frontend - server-side only
  default_currency: string;
  supported_currencies: string[];
  require_3d_secure: boolean;
  enable_subscriptions: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// API REQUEST/RESPONSE
// =====================================================

export interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  seller_id: string;
  order_id?: string;
  service_id?: string;
  product_id?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentResponse {
  success: boolean;
  client_secret: string;
  payment_intent_id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  commission_amount: number;
  seller_net_amount: number;
}

export interface ConfirmPaymentRequest {
  payment_intent_id: string;
}

export interface ConfirmPaymentResponse {
  success: boolean;
  transaction: StripeTransaction;
  message: string;
}

export interface RequestWithdrawalRequest {
  amount: number;
  destination_type: string;
  destination_details: Record<string, any>;
}

export interface RequestWithdrawalResponse {
  success: boolean;
  withdrawal_id: string;
  message: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export const formatAmount = (amount: number, currency: string = 'GNF'): string => {
  const mainAmount = amount / 100;
  return formatCurrencyLib(mainAmount, currency);
};

export const getPaymentStatusLabel = (status: PaymentStatus): string => {
  const labels: Record<PaymentStatus, string> = {
    PENDING: 'En attente',
    PROCESSING: 'En cours',
    SUCCEEDED: 'Réussi',
    FAILED: 'Échoué',
    CANCELED: 'Annulé',
    REFUNDED: 'Remboursé',
    DISPUTED: 'Litige'
  };
  return labels[status] || status;
};

export const getPaymentStatusColor = (status: PaymentStatus): string => {
  const colors: Record<PaymentStatus, string> = {
    PENDING: 'yellow',
    PROCESSING: 'blue',
    SUCCEEDED: 'green',
    FAILED: 'red',
    CANCELED: 'gray',
    REFUNDED: 'orange',
    DISPUTED: 'red'
  };
  return colors[status] || 'gray';
};

export const getWalletStatusLabel = (status: WalletStatus): string => {
  const labels: Record<WalletStatus, string> = {
    ACTIVE: 'Actif',
    FROZEN: 'Gelé',
    SUSPENDED: 'Suspendu'
  };
  return labels[status] || status;
};

export const getWalletStatusColor = (status: WalletStatus): string => {
  const colors: Record<WalletStatus, string> = {
    ACTIVE: 'default',
    FROZEN: 'destructive',
    SUSPENDED: 'secondary'
  };
  return colors[status] || 'default';
};

export const getWithdrawalStatusLabel = (status: WithdrawalStatus): string => {
  const labels: Record<WithdrawalStatus, string> = {
    PENDING: 'En attente',
    PROCESSING: 'En cours',
    COMPLETED: 'Terminé',
    FAILED: 'Échoué',
    CANCELED: 'Annulé'
  };
  return labels[status] || status;
};

export const getTransactionTypeLabel = (type: TransactionType): string => {
  const labels: Record<TransactionType, string> = {
    PAYMENT: 'Paiement',
    COMMISSION: 'Commission',
    WITHDRAWAL: 'Retrait',
    REFUND: 'Remboursement',
    CHARGEBACK: 'Rétrofacturation'
  };
  return labels[type] || type;
};

export const calculateCommission = (amount: number, rate: number): number => {
  return Math.round((amount * rate) / 100);
};

export const calculateSellerNetAmount = (amount: number, commissionAmount: number): number => {
  return amount - commissionAmount;
};

// =====================================================
// VALIDATION
// =====================================================

export const isValidAmount = (amount: number): boolean => {
  return amount > 0 && Number.isInteger(amount);
};

export const isValidCurrency = (currency: string, supportedCurrencies: string[]): boolean => {
  return supportedCurrencies.includes(currency.toUpperCase());
};

export const canRequestWithdrawal = (wallet: Wallet, amount: number): boolean => {
  return (
    wallet.status === 'ACTIVE' &&
    wallet.available_balance >= amount &&
    wallet.is_verified === true
  );
};

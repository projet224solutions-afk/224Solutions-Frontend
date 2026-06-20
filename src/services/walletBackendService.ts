/**
 * 💰 WALLET BACKEND SERVICE — Phase 6
 * Client centralisé pour les opérations wallet via le backend Node.js
 * Remplace les appels supabase.functions.invoke('wallet-operations')
 */

import { backendFetch, generateIdempotencyKey } from './backendApi';

// ==================== TYPES ====================

export interface WalletBalance {
  id: string;
  balance: number;
  currency: string;
  currency_locked?: boolean;
  currency_lock_reason?: string | null;
  wallet_status: string;
  is_blocked: boolean;
  daily_limit: number;
  monthly_limit: number;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  sender_wallet_id: string;
  receiver_wallet_id: string;
  transaction_type: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
  metadata: any;
}

export interface WalletStatus {
  id: string;
  balance: number;
  currency: string;
  wallet_status: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  biometric_enabled: boolean;
  pin_enabled?: boolean;
  pin_failed_attempts?: number;
  pin_locked_until?: string | null;
  pin_updated_at?: string | null;
  daily_limit: number;
  monthly_limit: number;
  created_at: string;
  updated_at: string;
}

export interface WalletPinStatus {
  pin_enabled: boolean;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
  pin_updated_at: string | null;
  policy: {
    pinLength: number;
    maxFailedAttempts: number;
    lockoutMinutes: number;
    resetMaxFailedAttempts?: number;
    resetLockoutMinutes?: number;
  };
}

export interface WalletOperationResult {
  success: boolean;
  new_balance?: number;
  operation?: string;
  transaction_id?: string;
  error?: string;
}

export interface WalletTransferPreviewResult {
  success: boolean;
  error?: string;
  is_international: boolean;
  sender?: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    custom_id: string | null;
  };
  receiver?: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    custom_id: string | null;
  };
  receiver_name?: string | null;
  receiver_email?: string | null;
  receiver_phone?: string | null;
  receiver_code?: string | null;
  amount_sent: number;
  currency_sent: string;
  fee_percentage: number;
  fee_amount: number;
  amount_after_fee: number;
  total_debit: number;
  amount_received: number;
  currency_received: string;
  rate_displayed: number;
  official_rate?: number;
  fx_margin?: number;
  rate_source?: string | null;
  rate_fetched_at?: string | null;
  rate_source_type?: string | null;
  rate_source_url?: string | null;
  rate_is_official?: boolean;
  rate_is_stale?: boolean;
  sender_balance: number;
  balance_after: number;
  sender_country?: string | null;
  receiver_country?: string | null;
  commission_conversion?: number;
  frais_international?: number;
  rate_lock_seconds?: number;
}

export interface WalletRecipientResolved {
  userId: string;
  query: string;
  matchedBy: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  publicId: string | null;
  customId: string | null;
}

function extractOperationValue<T extends keyof WalletOperationResult>(
  response: any,
  key: T
): WalletOperationResult[T] | undefined {
  const nested = response?.data && typeof response.data === 'object' ? response.data : null;
  return (nested?.[key] ?? response?.[key]) as WalletOperationResult[T] | undefined;
}

function extractResponsePayload<T extends Record<string, any>>(response: any): T | undefined {
  if (response?.data && typeof response.data === 'object') {
    const nested = response.data as T;
    return ('success' in nested ? nested : { success: Boolean(response?.success), ...nested }) as T;
  }

  if (response && typeof response === 'object') {
    const { _data, _error, _error_code, _details, _meta, ...rest } = response;
    if (Object.keys(rest).length > 0) {
      return rest as T;
    }
  }

  return undefined;
}

// ==================== API CALLS ====================

/**
 * Récupère le solde du wallet
 */
export async function getWalletBalance(signal?: AbortSignal) {
  return backendFetch<WalletBalance>('/api/v2/wallet/balance', {
    method: 'GET',
    signal,
  });
}

/**
 * Initialise le wallet si inexistant
 */
export async function initializeWallet(signal?: AbortSignal) {
  return backendFetch<{ wallet: WalletBalance; created: boolean }>('/api/v2/wallet/initialize', {
    method: 'POST',
    signal,
  });
}

/**
 * Récupère l'historique des transactions
 */
export async function getWalletTransactions(
  options: { limit?: number; offset?: number } = {},
  signal?: AbortSignal
) {
  const { limit = 20, offset = 0 } = options;
  return backendFetch<WalletTransaction[]>(
    `/api/v2/wallet/transactions?limit=${limit}&offset=${offset}`,
    { method: 'GET', signal }
  );
}

/**
 * Récupère le statut complet du wallet
 */
export async function getWalletStatus(signal?: AbortSignal) {
  return backendFetch<WalletStatus>('/api/v2/wallet/status', {
    method: 'GET',
    signal,
  });
}

/**
 * Résout un destinataire de transfert via ID public/custom, email, téléphone ou UUID.
 */
export async function resolveWalletRecipient(query: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(query.trim());
  return backendFetch<WalletRecipientResolved>(`/api/v2/wallet/recipient/resolve?q=${encoded}`, {
    method: 'GET',
    signal,
  });
}

/**
 * Dépôt sur le wallet
 */
export async function depositToWallet(
  amount: number,
  description?: string,
  reference?: string
): Promise<WalletOperationResult> {
  const idempotencyKey = generateIdempotencyKey();
  const result = await backendFetch<WalletOperationResult>('/api/v2/wallet/deposit', {
    method: 'POST',
    body: { amount, description, reference, idempotency_key: idempotencyKey },
    idempotencyKey,
  });

  if (!result.success) {
    return { success: false, error: result.error || 'Erreur lors du dépôt' };
  }
  return {
    success: true,
    new_balance: extractOperationValue(result, 'new_balance'),
    operation: (extractOperationValue(result, 'operation') as string | undefined) || 'deposit',
  };
}

/**
 * Retrait du wallet
 */
export async function withdrawFromWallet(
  amount: number,
  description?: string,
  pin?: string
): Promise<WalletOperationResult> {
  const idempotencyKey = generateIdempotencyKey();
  const result = await backendFetch<WalletOperationResult>('/api/v2/wallet/withdraw', {
    method: 'POST',
    body: { amount, description, pin, idempotency_key: idempotencyKey },
    idempotencyKey,
  });

  if (!result.success) {
    return { success: false, error: result.error || 'Erreur lors du retrait' };
  }
  return {
    success: true,
    new_balance: extractOperationValue(result, 'new_balance'),
    operation: (extractOperationValue(result, 'operation') as string | undefined) || 'withdraw',
  };
}

/**
 * Transfert P2P vers un autre wallet
 */
export async function transferToWallet(
  recipientId: string,
  amount: number,
  description?: string,
  pin?: string,
  /** Taux NET affiché au preview (international) → garde anti-dérive côté backend. */
  expectedRate?: number
): Promise<WalletOperationResult> {
  const idempotencyKey = generateIdempotencyKey();
  const result = await backendFetch<WalletOperationResult>('/api/v2/wallet/transfer', {
    method: 'POST',
    body: {
      amount,
      recipient_id: recipientId,
      description,
      pin,
      idempotency_key: idempotencyKey,
      ...(Number.isFinite(expectedRate) && (expectedRate as number) > 0 ? { expected_rate: expectedRate } : {}),
    },
    idempotencyKey,
  });

  if (!result.success) {
    return { success: false, error: result.error || 'Erreur lors du transfert' };
  }
  return {
    success: true,
    transaction_id: extractOperationValue(result, 'transaction_id'),
    operation: (extractOperationValue(result, 'operation') as string | undefined) || 'transfer',
  };
}

/**
 * Prévisualise un transfert (frais + conversion + solde après) côté backend Node.js.
 */
export async function previewWalletTransfer(recipientId: string, amount: number) {
  const response = await backendFetch<WalletTransferPreviewResult>('/api/v2/wallet/transfer/preview', {
    method: 'POST',
    body: {
      recipient_id: recipientId,
      amount,
    },
  });

  if (!response.success) {
    return response;
  }

  return {
    ...response,
    data: extractResponsePayload<WalletTransferPreviewResult>(response),
  };
}

/**
 * Crédit admin/interne (réservé aux admins)
 */
export async function adminCreditWallet(
  userId: string,
  amount: number,
  description: string,
  reference?: string
): Promise<WalletOperationResult> {
  const result = await backendFetch<WalletOperationResult>('/api/v2/wallet/credit', {
    method: 'POST',
    body: { user_id: userId, amount, description, reference },
  });

  if (!result.success) {
    return { success: false, error: result.error || 'Erreur lors du crédit' };
  }
  return {
    success: true,
    new_balance: extractOperationValue(result, 'new_balance'),
    operation: (extractOperationValue(result, 'operation') as string | undefined) || 'admin_credit',
  };
}

export async function getWalletPinStatus(signal?: AbortSignal) {
  return backendFetch<WalletPinStatus>('/api/v2/wallet/pin/status', {
    method: 'GET',
    signal,
  });
}

export async function setupWalletPin(pin: string, confirmPin: string) {
  return backendFetch<{ message: string }>('/api/v2/wallet/pin/setup', {
    method: 'POST',
    body: { pin, confirm_pin: confirmPin },
  });
}

export async function changeWalletPin(currentPin: string, newPin: string, confirmPin: string) {
  return backendFetch<{ message: string }>('/api/v2/wallet/pin/change', {
    method: 'POST',
    body: {
      current_pin: currentPin,
      new_pin: newPin,
      confirm_pin: confirmPin,
    },
  });
}

export async function resetWalletPin(accountPassword: string, newPin: string, confirmPin: string) {
  return backendFetch<{ message: string }>('/api/v2/wallet/pin/reset', {
    method: 'POST',
    body: {
      account_password: accountPassword,
      new_pin: newPin,
      confirm_pin: confirmPin,
    },
  });
}

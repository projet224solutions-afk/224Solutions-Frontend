/**
 * 💳 PAYMENT BACKEND SERVICE — Phase 6
 * Client centralisé pour les opérations de paiement via le backend Node.js
 * Remplace les appels Edge Functions: payment-core, secure-payment-*, resolve-payment-link, process-payment-link
 */

import { backendFetch, generateIdempotencyKey } from './backendApi';

// ==================== TYPES ====================

export interface PaymentLinkData {
  id: string;
  payment_id: string;
  produit: string;
  description: string;
  montant: number;
  remise: number;
  type_remise: string;
  frais: number;
  total: number;
  devise: string;
  status: string;
  expires_at: string;
  created_at: string;
  vendeur: { name: string };
}

export interface ResolvedPaymentLink {
  id: string;
  token: string;
  linkType: string;
  title: string;
  description: string;
  amount: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  isSingleUse: boolean;
  paymentType: string;
  reference: string;
  ownerType: string;
  remise: number;
  typeRemise: string;
}

export interface SecurePaymentInit {
  transaction_id: string;
  requested_amount: number;
  fee_amount: number;
  total_amount: number;
  net_amount: number;
  signature: string;
  payment_method: string;
  status: string;
}

export interface SecurePaymentValidation {
  credited_amount: number;
  new_balance: number;
  transaction_id: string;
}

// ==================== PAYMENT LINKS (legacy) ====================

/**
 * Récupère un lien de paiement par paymentId
 */
export async function getPaymentLink(paymentId: string, signal?: AbortSignal) {
  return backendFetch<{ payment: PaymentLinkData }>(
    `/api/payments/link/${paymentId}`,
    { method: 'GET', signal }
  );
}

/**
 * Confirme un paiement via lien
 */
export async function payPaymentLink(
  paymentId: string,
  paymentMethod: string,
  transactionId?: string,
  clientInfo?: any
) {
  return backendFetch<{ payment_id: string; status: string; transaction_id: string }>(
    `/api/payments/link/${paymentId}/pay`,
    {
      method: 'POST',
      body: { payment_method: paymentMethod, transaction_id: transactionId, client_info: clientInfo },
    }
  );
}

// ==================== PAYMENT LINKS (unified /pay/:token) ====================

/**
 * Résout un lien de paiement par token (public, no auth)
 * Remplace supabase.functions.invoke('resolve-payment-link')
 */
export async function resolvePaymentLink(token: string) {
  return backendFetch<{
    link: ResolvedPaymentLink;
    owner: { name: string; avatar?: string; business_name?: string };
    product: any;
    service: any;
  }>('/api/payments/resolve-link', {
    method: 'POST',
    body: { token },
  });
}

/**
 * Traite un paiement via lien unifié
 * Remplace supabase.functions.invoke('process-payment-link')
 */
export async function processPaymentLink(
  token: string,
  paymentMethod: string,
  payerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    user_id?: string;
  }
) {
  const idempotencyKey = generateIdempotencyKey();
  return backendFetch<{
    payment_id: string;
    status: string;
    seller_credited: boolean;
    amount_credited: number;
  }>('/api/payments/process-link', {
    method: 'POST',
    body: { token, payment_method: paymentMethod, payer_info: payerInfo },
    idempotencyKey,
  });
}

// ==================== SECURE PAYMENTS ====================

/**
 * Initialise un paiement sécurisé (calcul frais + signature HMAC côté backend)
 * Remplace supabase.functions.invoke('secure-payment-init')
 */
export async function initSecurePayment(
  requestedAmount: number,
  paymentMethod: string = 'OM',
  transactionType: string = 'deposit',
  interfaceType: string = 'client'
) {
  return backendFetch<SecurePaymentInit>('/api/payments/secure/init', {
    method: 'POST',
    body: {
      requested_amount: requestedAmount,
      payment_method: paymentMethod,
      transaction_type: transactionType,
      interface_type: interfaceType,
    },
  });
}

/**
 * Valide un paiement sécurisé (vérification signature + crédit wallet)
 * Remplace supabase.functions.invoke('secure-payment-validate')
 */
export async function validateSecurePayment(
  transactionId: string,
  externalTransactionId: string,
  amountPaid: number,
  paymentStatus: string,
  signature: string
) {
  return backendFetch<SecurePaymentValidation>('/api/payments/secure/validate', {
    method: 'POST',
    body: {
      transaction_id: transactionId,
      external_transaction_id: externalTransactionId,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      signature,
    },
  });
}

// ==================== PAYMENT HISTORY ====================

/**
 * Historique des paiements
 */
export async function getPaymentHistory(
  options: { limit?: number; offset?: number; status?: string } = {},
  signal?: AbortSignal
) {
  const { limit = 20, offset = 0, status } = options;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.set('status', status);
  return backendFetch<any[]>(`/api/payments?${params}`, { method: 'GET', signal });
}

/**
 * Résumé des paiements
 */
export async function getPaymentSummary(signal?: AbortSignal) {
  return backendFetch<{
    total_sent: number;
    total_fees: number;
    total_received: number;
    transactions_sent: number;
    transactions_received: number;
    currency: string;
  }>('/api/payments/summary/me', { method: 'GET', signal });
}

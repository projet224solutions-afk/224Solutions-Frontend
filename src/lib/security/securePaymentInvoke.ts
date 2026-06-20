/**
 * 🔐 SECURE PAYMENT INVOKE - Wrapper sécurisé pour toutes les opérations financières
 *
 * Utilise signedInvoke avec:
 * - HMAC-SHA256 signature
 * - Idempotency key (anti-double-transaction)
 * - Fraud scoring client-side
 * - Retry avec backoff
 *
 * 224Solutions
 */

import { signedInvoke, generateIdempotencyKey } from './hmacSigner';

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'payment';

interface SecureInvokeOptions {
  functionName: string;
  body: Record<string, unknown>;
  transactionType: TransactionType;
  userId?: string;
  /** Custom idempotency key (auto-generated if not provided) */
  idempotencyKey?: string;
  /** Max retries on network failure */
  maxRetries?: number;
}

interface SecureInvokeResult {
  success: boolean;
  data?: any;
  error?: string;
  idempotencyKey: string;
}

/**
 * 🔐 Execute a secured payment function call
 * Includes: HMAC signing, idempotency, fraud checks
 */
export async function securePaymentInvoke(options: SecureInvokeOptions): Promise<SecureInvokeResult> {
  const {
    functionName,
    body,
    transactionType,
    userId,
    maxRetries = 1,
  } = options;

  const idempotencyKey = options.idempotencyKey || generateIdempotencyKey(transactionType, userId);

  // Client-side fraud check
  const amount = Number(body.amount || 0);
  if (amount <= 0) {
    return { success: false, error: 'Montant invalide', idempotencyKey };
  }

  // Anti-automation: check timing
  const lastCallKey = `last_payment_${transactionType}`;
  const lastCall = sessionStorage.getItem(lastCallKey);
  const now = Date.now();

  if (lastCall && now - parseInt(lastCall) < 2000) {
    console.warn('🚨 [SECURITY] Rapid successive calls detected');
    return { success: false, error: 'Veuillez patienter avant de réessayer', idempotencyKey };
  }
  sessionStorage.setItem(lastCallKey, now.toString());

  // Execute with retry
  let lastError = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await signedInvoke(functionName, body, { idempotencyKey });

      if (error) {
        lastError = error.message || 'Erreur Edge Function';
        console.error(`[SECURE-INVOKE] Attempt ${attempt + 1} failed:`, error);

        // Don't retry on auth/validation errors
        if (error.message?.includes('401') || error.message?.includes('signature')) {
          return { success: false, error: lastError, idempotencyKey };
        }

        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
      }

      return {
        success: data?.success ?? true,
        data,
        error: data?.error,
        idempotencyKey,
      };
    } catch (err: any) {
      lastError = err.message || 'Erreur réseau';
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  return { success: false, error: lastError, idempotencyKey };
}

// ═══════════════════════════════════════════════════════
// Pre-built secure wrappers for each transaction type
// ═══════════════════════════════════════════════════════

export async function secureDeposit(body: Record<string, unknown>, userId?: string) {
  return securePaymentInvoke({
    functionName: 'paypal-deposit',
    body,
    transactionType: 'deposit',
    userId,
  });
}

export async function secureWithdrawal(body: Record<string, unknown>, userId?: string) {
  return securePaymentInvoke({
    functionName: 'paypal-withdrawal',
    body,
    transactionType: 'withdrawal',
    userId,
  });
}

export async function secureMobileMoneyWithdrawal(body: Record<string, unknown>, userId?: string) {
  return securePaymentInvoke({
    functionName: 'mobile-money-withdrawal',
    body,
    transactionType: 'withdrawal',
    userId,
  });
}

export async function secureWalletTransfer(body: Record<string, unknown>, userId?: string) {
  return securePaymentInvoke({
    functionName: 'wallet-transfer',
    body,
    transactionType: 'transfer',
    userId,
  });
}

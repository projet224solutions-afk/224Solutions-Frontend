import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type DjomyPaymentMethod = 'OM' | 'MOMO' | 'KULU' | 'VISA' | 'MASTERCARD';

export interface DjomyPaymentOptions {
  amount: number;
  payerPhone?: string;
  phoneNumber?: string;
  paymentMethod?: DjomyPaymentMethod;
  description?: string;
  orderId?: string;
  vendorId?: string;
  returnUrl?: string;
  cancelUrl?: string;
  successUrl?: string;
  failureUrl?: string;
  callbackUrl?: string;
  countryCode?: string;
  useGateway?: boolean;
  useSandbox?: boolean;
}

export interface DjomyPaymentResult {
  success: boolean;
  transactionId?: string;
  redirectUrl?: string;
  status?: string;
  error?: string;
  data?: unknown;
}

export interface DjomyPaymentStatus {
  success: boolean;
  transactionId: string;
  status: string;
  originalStatus?: string;
  message?: string;
  data?: unknown;
  error?: string;
}

// ⚠️ Production mode: paiements réels activés
const shouldUseSandboxByDefault = (): boolean => {
  // Toujours utiliser la production - les identifiants sont configurés pour prod
  return false;
};

export function useDjomyPayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializePayment = useCallback(async (
    options: DjomyPaymentOptions
  ): Promise<DjomyPaymentResult> => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate phone number format if provided
      let formattedPhone = options.payerPhone?.replace(/\s/g, '') || '';
      if (formattedPhone && !formattedPhone.startsWith('00') && !formattedPhone.startsWith('+')) {
        // Assume Guinea if no country code
        if (formattedPhone.startsWith('6')) {
          formattedPhone = '00224' + formattedPhone;
        }
      }
      formattedPhone = formattedPhone.replace('+', '00');

      // Get current origin for return URLs
      const origin = window.location.origin;
      const defaultReturnUrl = `${origin}/payment/success`;
      const defaultCancelUrl = `${origin}/payment/cancel`;

      const payload = {
        amount: options.amount,
        payerPhone: formattedPhone || undefined,
        paymentMethod: options.paymentMethod,
        description: options.description || 'Paiement 224Solutions',
        orderId: options.orderId,
        returnUrl: options.successUrl || options.returnUrl || defaultReturnUrl,
        cancelUrl: options.failureUrl || options.cancelUrl || defaultCancelUrl,
        callbackUrl: options.callbackUrl,
        countryCode: options.countryCode || 'GN',
        useGateway: options.useGateway ?? true,
        useSandbox: options.useSandbox ?? shouldUseSandboxByDefault(),
      };

      console.log('[useDjomyPayment] Initializing payment:', payload);

      const { data, error: fnError } = await supabase.functions.invoke('djomy-init-payment', {
        body: {
          amount: options.amount,
          payerPhone: formattedPhone || options.phoneNumber,
          paymentMethod: options.paymentMethod,
          description: options.description,
          orderId: options.orderId,
          vendorId: options.vendorId,
          useSandbox: options.useSandbox ?? shouldUseSandboxByDefault(),
          countryCode: options.countryCode || 'GN',
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Payment initialization failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Payment initialization failed');
      }

      console.log('[useDjomyPayment] Payment initialized:', data);

      return {
        success: true,
        transactionId: data.transactionId,
        redirectUrl: data.redirectUrl,
        status: data.status,
        data: data.data,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du paiement';
      console.error('[useDjomyPayment] Error:', errorMessage);
      setError(errorMessage);
      toast.error(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyPayment = useCallback(async (
    transactionId: string,
    useSandbox = shouldUseSandboxByDefault()
  ): Promise<DjomyPaymentStatus> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useDjomyPayment] Verifying payment:', transactionId);

      const { data, error: fnError } = await supabase.functions.invoke('djomy-verify', {
        body: { transactionId, useSandbox },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Payment verification failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Payment verification failed');
      }

      console.log('[useDjomyPayment] Payment verified:', data);

      return {
        success: true,
        transactionId: data.transactionId,
        status: data.status,
        originalStatus: data.originalStatus,
        data: data.data,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de vérification';
      console.error('[useDjomyPayment] Verification error:', errorMessage);
      setError(errorMessage);

      return {
        success: false,
        transactionId,
        status: 'error',
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openPaymentPage = useCallback(async (
    options: DjomyPaymentOptions
  ): Promise<boolean> => {
    const result = await initializePayment({
      ...options,
      useGateway: true,
    });

    if (result.success && result.redirectUrl) {
      // Open in new tab
      window.open(result.redirectUrl, '_blank');
      return true;
    }

    return false;
  }, [initializePayment]);

  const pollPaymentStatus = useCallback(async (
    transactionId: string,
    options?: {
      maxAttempts?: number;
      intervalMs?: number;
      useSandbox?: boolean;
      onStatusChange?: (status: DjomyPaymentStatus) => void;
    }
  ): Promise<DjomyPaymentStatus | null> => {
    const {
      maxAttempts = 30,
      intervalMs = 5000,
      useSandbox = shouldUseSandboxByDefault(),
      onStatusChange,
    } = options || {};

    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[useDjomyPayment] Polling attempt ${attempts}/${maxAttempts}`);

      const status = await verifyPayment(transactionId, useSandbox);

      if (onStatusChange) {
        onStatusChange(status);
      }

      // Check if payment is in a final state
      const finalStatuses = ['completed', 'failed', 'cancelled', 'SUCCESS', 'FAILED', 'CANCELLED'];
      if (finalStatuses.includes(status.status)) {
        return status;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    console.log('[useDjomyPayment] Max polling attempts reached');
    return null;
  }, [verifyPayment]);

  return {
    initializePayment,
    verifyPayment,
    openPaymentPage,
    pollPaymentStatus,
    isLoading,
    error,
  };
}

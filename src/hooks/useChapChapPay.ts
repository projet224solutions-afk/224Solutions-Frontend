/**
 * 🪝 HOOK CHAPCHAPPAY - 224SOLUTIONS
 * Hook React pour utiliser les paiements Mobile Money via ChapChapPay
 */

import { useState, useCallback } from "react";
import {
  chapChapPayService,
  CCPEcommerceRequest,
  CCPPullRequest,
  CCPPushRequest,
  CCPPaymentResult,
  CCPStatusResult
} from "@/services/payment/ChapChapPayService";
import { toast } from "sonner";

// Type exporté pour les méthodes de paiement ChapChapPay
export type ChapChapPayMethod = 'orange_money' | 'mtn_momo' | 'paycard' | 'card';

export function useChapChapPay() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create E-Commerce payment and optionally redirect
   */
  const createEcommercePayment = useCallback(async (
    request: CCPEcommerceRequest,
    options?: { autoRedirect?: boolean }
  ): Promise<CCPPaymentResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await chapChapPayService.createEcommercePayment(request);

      if (!result.success) {
        setError(result.error || "Payment failed");
        toast.error(result.error || "Échec du paiement");
        return result;
      }

      if (options?.autoRedirect && result.paymentUrl) {
        window.location.href = result.paymentUrl;
      }

      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initiate PULL payment (debit customer)
   */
  const initiatePullPayment = useCallback(async (
    request: CCPPullRequest
  ): Promise<CCPPaymentResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await chapChapPayService.initiatePullPayment(request);

      if (!result.success) {
        setError(result.error || "Payment failed");
        toast.error(result.error || "Échec du paiement");
        return result;
      }

      if (result.requiresOtp) {
        toast.info("Un code OTP a été envoyé sur votre téléphone");
      } else {
        toast.success("Paiement initié avec succès");
      }

      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initiate PUSH payment (send money)
   */
  const initiatePushPayment = useCallback(async (
    request: CCPPushRequest
  ): Promise<CCPPaymentResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await chapChapPayService.initiatePushPayment(request);

      if (!result.success) {
        setError(result.error || "Transfer failed");
        toast.error(result.error || "Échec du transfert");
        return result;
      }

      toast.success("Transfert effectué avec succès");
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check payment status
   */
  const checkStatus = useCallback(async (
    transactionId?: string,
    orderId?: string
  ): Promise<CCPStatusResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await chapChapPayService.checkStatus(transactionId, orderId);

      if (!result.success) {
        setError(result.error || "Status check failed");
      }

      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Poll status until completion
   */
  const pollStatus = useCallback(async (
    transactionId: string,
    onStatusChange?: (status: CCPStatusResult) => void
  ): Promise<CCPStatusResult> => {
    return chapChapPayService.pollStatus(transactionId, {
      onStatusChange
    });
  }, []);

  return {
    isLoading,
    error,
    createEcommercePayment,
    initiatePullPayment,
    initiatePushPayment,
    checkStatus,
    pollStatus
  };
}

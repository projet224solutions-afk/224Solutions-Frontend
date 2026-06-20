import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { previewWalletTransfer, transferToWallet } from '@/services/walletBackendService';

export interface TransferPreview {
  success: boolean;
  amount_sent: number;
  currency_sent: string;
  fee_percentage: number;
  fee_amount: number;
  amount_after_fee: number;
  rate_displayed: number;
  official_rate?: number;
  fx_margin?: number;
  rate_source?: string | null;
  rate_fetched_at?: string | null;
  rate_source_type?: string | null;
  rate_source_url?: string | null;
  rate_is_official?: boolean;
  rate_is_stale?: boolean;
  amount_received: number;
  currency_received: string;
  error?: string;
}

export interface TransferResult extends TransferPreview {
  transfer_id?: string;
  transfer_code?: string;
  transaction_id?: string;
}

interface UseWalletTransferResult {
  preview: TransferPreview | null;
  loading: boolean;
  executing: boolean;
  error: string | null;
  getPreview: (receiverId: string, amount: number) => Promise<TransferPreview | null>;
  executeTransfer: (receiverId: string, amount: number, description?: string) => Promise<TransferResult | null>;
  clearPreview: () => void;
}

export function useWalletTransfer(): UseWalletTransferResult {
  const { user } = useAuth();
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPreview = useCallback(async (receiverId: string, amount: number): Promise<TransferPreview | null> => {
    if (!user?.id) {
      setError('Non authentifié');
      return null;
    }

    if (amount <= 0) {
      setError('Le montant doit être positif');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const previewResponse = await previewWalletTransfer(receiverId, amount);
      if (!previewResponse.success) {
        throw new Error(previewResponse.error || 'Erreur lors de la prévisualisation');
      }

      const previewData = previewResponse.data;
      const normalizedPreview: TransferPreview = {
        success: true,
        amount_sent: previewData.amount_sent,
        currency_sent: previewData.currency_sent,
        fee_percentage: previewData.fee_percentage,
        fee_amount: previewData.fee_amount,
        amount_after_fee: previewData.amount_after_fee,
        rate_displayed: previewData.rate_displayed,
        official_rate: previewData.official_rate,
        fx_margin: previewData.fx_margin,
        rate_source: previewData.rate_source,
        rate_fetched_at: previewData.rate_fetched_at,
        rate_source_type: previewData.rate_source_type,
        rate_source_url: previewData.rate_source_url,
        rate_is_official: previewData.rate_is_official,
        rate_is_stale: previewData.rate_is_stale,
        amount_received: previewData.amount_received,
        currency_received: previewData.currency_received,
      };

      setPreview(normalizedPreview);
      return normalizedPreview;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de prévisualisation';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const executeTransfer = useCallback(async (
    receiverId: string,
    amount: number,
    description?: string
  ): Promise<TransferResult | null> => {
    if (!user?.id) {
      setError('Non authentifié');
      return null;
    }

    try {
      setExecuting(true);
      setError(null);

      const result = await transferToWallet(receiverId, amount, description);

      if (result.success) {
        toast.success('Transfert réussi!');

        // Déclencher l'événement de mise à jour du wallet
        window.dispatchEvent(new CustomEvent('wallet-updated'));

        setPreview(null);
        return {
          success: true,
          amount_sent: amount,
          currency_sent: preview?.currency_sent || 'GNF',
          fee_percentage: preview?.fee_percentage || 0,
          fee_amount: preview?.fee_amount || 0,
          amount_after_fee: preview?.amount_after_fee || amount,
          rate_displayed: preview?.rate_displayed || 1,
          amount_received: preview?.amount_received || amount,
          currency_received: preview?.currency_received || (preview?.currency_sent || 'GNF'),
          transfer_id: result.transaction_id,
          transaction_id: result.transaction_id,
        };
      } else {
        throw new Error(result.error || 'Erreur lors du transfert');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de transfert';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setExecuting(false);
    }
  }, [user?.id, preview]);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return {
    preview,
    loading,
    executing,
    error,
    getPreview,
    executeTransfer,
    clearPreview,
  };
}

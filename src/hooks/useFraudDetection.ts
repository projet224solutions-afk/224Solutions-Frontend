import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FraudCheckResult {
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendations: string[];
  requiresMFA: boolean;
}

/**
 * Hook pour la détection de fraude (comme Amazon Fraud Detector)
 */
export const useFraudDetection = () => {
  const [loading, setLoading] = useState(false);

  const checkTransaction = async (
    userId: string,
    amount: number,
    recipientId: string,
    method: string = 'wallet',
    metadata?: any
  ): Promise<FraudCheckResult | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fraud-detection', {
        body: {
          userId,
          amount,
          recipientId,
          method,
          metadata
        }
      });

      if (error) throw error;

      // Alerter l'utilisateur si risque élevé
      if (data.riskLevel === 'high' || data.riskLevel === 'critical') {
        toast.warning(`⚠️ Transaction à risque ${data.riskLevel.toUpperCase()}`, {
          description: data.flags.join(', ')
        });
      }

      return data as FraudCheckResult;
    } catch (error: any) {
      console.error('Error checking fraud:', error);
      toast.error('Erreur lors de la vérification de sécurité');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    checkTransaction
  };
};

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MLPrediction {
  fraudProbability: number;
  anomalyScore: number;
  behaviorDeviation: number;
  riskFactors: string[];
  confidence: number;
  modelVersion: string;
}

export interface AnalysisDetails {
  rulesScore: number;
  mlScore: number;
  behaviorScore: number;
  velocityScore: number;
}

export interface MLFraudCheckResult {
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mlPrediction: MLPrediction;
  flags: string[];
  recommendations: string[];
  requiresMFA: boolean;
  requiresManualReview: boolean;
  analysisDetails: AnalysisDetails;
}

interface CheckTransactionParams {
  userId: string;
  amount: number;
  recipientId: string;
  method?: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook pour la détection de fraude ML avec analyse comportementale prédictive
 */
export const useMLFraudDetection = () => {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<MLFraudCheckResult | null>(null);

  const checkTransaction = useCallback(async (
    params: CheckTransactionParams
  ): Promise<MLFraudCheckResult | null> => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ml-fraud-detection', {
        body: {
          userId: params.userId,
          amount: params.amount,
          recipientId: params.recipientId,
          method: params.method || 'wallet',
          transactionId: params.transactionId,
          metadata: params.metadata
        }
      });

      if (error) throw error;

      const result = data as MLFraudCheckResult;
      setLastResult(result);

      // Alerter selon le niveau de risque
      if (result.riskLevel === 'critical') {
        toast.error('🚨 Transaction BLOQUÉE - Risque critique détecté', {
          description: `Score: ${result.score}/100 - ${result.flags.slice(0, 2).join(', ')}`,
          duration: 10000
        });
      } else if (result.riskLevel === 'high') {
        toast.warning('⚠️ Risque ÉLEVÉ détecté', {
          description: `Score: ${result.score}/100 - Vérification MFA requise`,
          duration: 7000
        });
      } else if (result.riskLevel === 'medium') {
        toast.info('ℹ️ Transaction sous surveillance', {
          description: `Score: ${result.score}/100`,
          duration: 5000
        });
      }

      return result;
    } catch (error: unknown) {
      console.error('Error in ML fraud detection:', error);
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error('Erreur lors de l\'analyse ML de sécurité', {
        description: message
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRiskColor = useCallback((riskLevel: string): string => {
    switch (riskLevel) {
      case 'critical': return 'text-[#ff4000] bg-orange-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-[#ff4000] bg-orange-100';
      case 'low': return 'text-[#ff4000] bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const getRiskIcon = useCallback((riskLevel: string): string => {
    switch (riskLevel) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return '✅';
      default: return '❓';
    }
  }, []);

  const formatConfidence = useCallback((confidence: number): string => {
    if (confidence >= 90) return 'Très haute';
    if (confidence >= 75) return 'Haute';
    if (confidence >= 50) return 'Moyenne';
    return 'Basse';
  }, []);

  return {
    loading,
    lastResult,
    checkTransaction,
    getRiskColor,
    getRiskIcon,
    formatConfidence
  };
};

/**
 * CHINA SUPPLIER SCORING HOOK
 * Système de scoring anti-arnaque pour fournisseurs chinois
 *
 * @module useSupplierScoring
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  SupplierScore,
  SupplierScoreLevel
} from '@/types/china-dropshipping';
import { SUPPLIER_SCORE_THRESHOLDS } from '@/types/china-dropshipping';

// ==================== INTERFACES ====================

interface UseSupplierScoringReturn {
  loading: boolean;

  // Calculs
  calculateScore: (supplierId: string) => Promise<SupplierScore | null>;
  recalculateAllScores: () => Promise<number>;

  // Analyse
  getScoreLevel: (score: number) => SupplierScoreLevel;
  shouldWarn: (score: number) => boolean;
  shouldAutoDisable: (score: number) => boolean;

  // Actions automatiques
  checkAndApplyAutoActions: (supplierId: string) => Promise<{
    warned: boolean;
    disabled: boolean;
    reason?: string;
  }>;

  // Rapports
  getScoreBreakdown: (supplierId: string) => Promise<ScoreBreakdown | null>;
  getTopSuppliers: (limit?: number) => Promise<SupplierScore[]>;
  getFlaggedSuppliers: () => Promise<SupplierScore[]>;
}

interface ScoreBreakdown {
  supplierId: string;

  // Composantes du score
  deliverySuccessScore: number; // 0-25
  onTimeScore: number; // 0-25
  qualityScore: number; // 0-25
  responseTimeScore: number; // 0-15
  disputeScore: number; // 0-10

  // Pondération
  weights: {
    deliverySuccess: number;
    onTime: number;
    quality: number;
    responseTime: number;
    disputes: number;
  };

  // Score final
  totalScore: number;
  level: SupplierScoreLevel;

  // Métriques brutes
  metrics: {
    totalOrders: number;
    successfulOrders: number;
    cancelledOrders: number;
    disputedOrders: number;
    avgDeliveryDays: number;
    expectedDeliveryDays: number;
    avgResponseHours: number;
    qualityRating: number;
  };

  // Recommandations
  recommendations: string[];
}

// ==================== CONSTANTS ====================

const SCORE_WEIGHTS = {
  deliverySuccess: 0.25,
  onTime: 0.25,
  quality: 0.25,
  responseTime: 0.15,
  disputes: 0.10
};

// ==================== HOOK ====================

export function useSupplierScoring(): UseSupplierScoringReturn {
  const [loading, setLoading] = useState(false);

  // ==================== HELPERS ====================

  const getScoreLevel = useCallback((score: number): SupplierScoreLevel => {
    if (score >= SUPPLIER_SCORE_THRESHOLDS.gold_min) return 'GOLD';
    if (score >= SUPPLIER_SCORE_THRESHOLDS.silver_min) return 'SILVER';
    if (score >= SUPPLIER_SCORE_THRESHOLDS.bronze_min) return 'BRONZE';
    if (score >= SUPPLIER_SCORE_THRESHOLDS.auto_disable_threshold) return 'UNVERIFIED';
    return 'BLACKLISTED';
  }, []);

  const shouldWarn = useCallback((score: number): boolean => {
    return score < SUPPLIER_SCORE_THRESHOLDS.warning_threshold;
  }, []);

  const shouldAutoDisable = useCallback((score: number): boolean => {
    return score < SUPPLIER_SCORE_THRESHOLDS.auto_disable_threshold;
  }, []);

  // ==================== CALCUL PRINCIPAL ====================

  const calculateScore = useCallback(async (supplierId: string): Promise<SupplierScore | null> => {
    try {
      setLoading(true);

      // Récupérer les données du fournisseur et ses commandes
      const { data: supplier, error: supplierError } = await supabase
        .from('china_suppliers')
        .select('*')
        .eq('id', supplierId)
        .single();

      if (supplierError || !supplier) {
        console.error('Fournisseur non trouvé:', supplierError);
        return null;
      }

      const { data: orders, error: ordersError } = await supabase
        .from('china_supplier_orders')
        .select('*')
        .eq('supplier_id', supplierId);

      if (ordersError) {
        console.error('Erreur chargement commandes:', ordersError);
      }

      const ordersList = orders || [];

      // Calcul des métriques
      const totalOrders = ordersList.length;
      const deliveredOrders = ordersList.filter(o => o.status === 'delivered').length;
      const cancelledOrders = ordersList.filter(o => o.status === 'cancelled').length;
      const disputedOrders = ordersList.filter(o => o.status === 'disputed').length;

      // Score de livraison réussie (0-100)
      const deliverySuccessRate = totalOrders > 0
        ? ((deliveredOrders + ordersList.filter(o => !['cancelled', 'disputed'].includes(o.status)).length) / totalOrders) * 100
        : 50; // Score par défaut si pas de commandes

      // Score de ponctualité (0-100)
      // En production, comparer dates réelles vs estimées
      const onTimeRate = (supplier as any).on_time_rate || 80;

      // Score qualité (0-5 -> 0-100)
      const qualityRating = 4.0; // En production, calculer depuis les avis
      const qualityScore = (qualityRating / 5) * 100;

      // Score temps de réponse (0-100, basé sur heures)
      const avgResponseHours = (supplier as any).avg_response_time_hours || 12;
      const responseTimeScore = Math.max(0, 100 - (avgResponseHours * 2)); // Pénalité de 2pts par heure

      // Score litiges (inverse - moins c'est mieux)
      const disputeRate = totalOrders > 0 ? (disputedOrders / totalOrders) * 100 : 0;
      const disputeScore = Math.max(0, 100 - (disputeRate * 5)); // Pénalité forte pour litiges

      // Calcul du score pondéré final
      const overallScore = Math.round(
        deliverySuccessRate * SCORE_WEIGHTS.deliverySuccess +
        onTimeRate * SCORE_WEIGHTS.onTime +
        qualityScore * SCORE_WEIGHTS.quality +
        responseTimeScore * SCORE_WEIGHTS.responseTime +
        disputeScore * SCORE_WEIGHTS.disputes
      );

      const scoreLevel = getScoreLevel(overallScore);

      // Construire l'objet score
      const score: SupplierScore = {
        supplier_id: supplierId,
        delivery_success_rate: deliverySuccessRate,
        on_time_delivery_rate: onTimeRate,
        quality_rating: qualityRating,
        response_time_score: responseTimeScore,
        dispute_resolution_score: disputeScore,
        total_orders: totalOrders,
        successful_orders: deliveredOrders,
        cancelled_orders: cancelledOrders,
        disputed_orders: disputedOrders,
        overall_score: overallScore,
        score_level: scoreLevel,
        is_flagged: shouldWarn(overallScore),
        auto_disabled: shouldAutoDisable(overallScore),
        last_calculated_at: new Date().toISOString()
      };

      // Enregistrer le score en base
      await supabase
        .from('china_supplier_scores')
        .upsert({
          supplier_id: supplierId,
          ...score
        }, {
          onConflict: 'supplier_id'
        });

      // Mettre à jour le fournisseur
      await supabase
        .from('china_suppliers')
        .update({
          internal_score: overallScore,
          score_level: scoreLevel,
          successful_deliveries: deliveredOrders,
          total_deliveries: totalOrders,
          on_time_rate: onTimeRate,
          dispute_rate: disputeRate,
          updated_at: new Date().toISOString()
        })
        .eq('id', supplierId);

      return score;
    } catch (error) {
      console.error('[SupplierScoring] Erreur calcul:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getScoreLevel, shouldWarn, shouldAutoDisable]);

  // ==================== RECALCUL EN MASSE ====================

  const recalculateAllScores = useCallback(async (): Promise<number> => {
    try {
      setLoading(true);

      const { data: suppliers, error } = await supabase
        .from('china_suppliers')
        .select('id')
        .neq('score_level', 'BLACKLISTED');

      if (error || !suppliers) {
        console.error('Erreur récupération fournisseurs:', error);
        return 0;
      }

      let updatedCount = 0;

      for (const supplier of suppliers) {
        const score = await calculateScore(supplier.id);
        if (score) updatedCount++;
      }

      toast.success(`${updatedCount} scores recalculés`);
      return updatedCount;
    } catch (error) {
      console.error('[SupplierScoring] Erreur recalcul global:', error);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [calculateScore]);

  // ==================== ACTIONS AUTOMATIQUES ====================

  const checkAndApplyAutoActions = useCallback(async (supplierId: string) => {
    const result = { warned: false, disabled: false, reason: undefined as string | undefined };

    try {
      const score = await calculateScore(supplierId);
      if (!score) return result;

      // Avertissement
      if (shouldWarn(score.overall_score)) {
        result.warned = true;
        result.reason = `Score faible (${score.overall_score}/100)`;

        // Envoyer notification admin
        await supabase.from('china_dropship_logs').insert({
          log_type: 'alert',
          severity: 'warning',
          message: `Fournisseur ${supplierId} en dessous du seuil d'avertissement`,
          details: {
            score: score.overall_score,
            threshold: SUPPLIER_SCORE_THRESHOLDS.warning_threshold
          }
        });
      }

      // Désactivation automatique
      if (shouldAutoDisable(score.overall_score)) {
        result.disabled = true;
        result.reason = `Score critique (${score.overall_score}/100) - Désactivation automatique`;

        // Blacklister le fournisseur
        await supabase
          .from('china_suppliers')
          .update({
            score_level: 'BLACKLISTED',
            notes: `Désactivé automatiquement le ${new Date().toISOString()} - Score: ${score.overall_score}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', supplierId);

        // Désactiver ses produits
        await supabase
          .from('dropship_products')
          .update({ is_active: false })
          .eq('china_supplier_id', supplierId);

        // Log
        await supabase.from('china_dropship_logs').insert({
          log_type: 'alert',
          severity: 'critical',
          message: `Fournisseur ${supplierId} désactivé automatiquement`,
          details: {
            score: score.overall_score,
            threshold: SUPPLIER_SCORE_THRESHOLDS.auto_disable_threshold
          }
        });

        toast.warning('Fournisseur désactivé automatiquement (score trop bas)');
      }

      return result;
    } catch (error) {
      console.error('[SupplierScoring] Erreur auto-actions:', error);
      return result;
    }
  }, [calculateScore, shouldWarn, shouldAutoDisable]);

  // ==================== RAPPORTS ====================

  const getScoreBreakdown = useCallback(async (supplierId: string): Promise<ScoreBreakdown | null> => {
    try {
      const score = await calculateScore(supplierId);
      if (!score) return null;

      // Recommandations basées sur le score
      const recommendations: string[] = [];

      if (score.delivery_success_rate < 80) {
        recommendations.push('Améliorer le taux de livraison réussie');
      }
      if (score.on_time_delivery_rate < 80) {
        recommendations.push('Réduire les retards de livraison');
      }
      if (score.quality_rating < 4) {
        recommendations.push('Améliorer la qualité des produits');
      }
      if (score.response_time_score < 70) {
        recommendations.push('Réduire le temps de réponse aux messages');
      }
      if (score.disputed_orders > 0) {
        recommendations.push('Résoudre les litiges en cours');
      }

      return {
        supplierId,
        deliverySuccessScore: score.delivery_success_rate * SCORE_WEIGHTS.deliverySuccess,
        onTimeScore: score.on_time_delivery_rate * SCORE_WEIGHTS.onTime,
        qualityScore: (score.quality_rating / 5) * 100 * SCORE_WEIGHTS.quality,
        responseTimeScore: score.response_time_score * SCORE_WEIGHTS.responseTime,
        disputeScore: score.dispute_resolution_score * SCORE_WEIGHTS.disputes,
        weights: {
          deliverySuccess: SCORE_WEIGHTS.deliverySuccess * 100,
          onTime: SCORE_WEIGHTS.onTime * 100,
          quality: SCORE_WEIGHTS.quality * 100,
          responseTime: SCORE_WEIGHTS.responseTime * 100,
          disputes: SCORE_WEIGHTS.disputes * 100
        },
        totalScore: score.overall_score,
        level: score.score_level,
        metrics: {
          totalOrders: score.total_orders,
          successfulOrders: score.successful_orders,
          cancelledOrders: score.cancelled_orders,
          disputedOrders: score.disputed_orders,
          avgDeliveryDays: 15, // À calculer depuis les données réelles
          expectedDeliveryDays: 14,
          avgResponseHours: (100 - score.response_time_score) / 2,
          qualityRating: score.quality_rating
        },
        recommendations
      };
    } catch (error) {
      console.error('[SupplierScoring] Erreur breakdown:', error);
      return null;
    }
  }, [calculateScore]);

  const getTopSuppliers = useCallback(async (limit: number = 10): Promise<SupplierScore[]> => {
    try {
      const { data, error } = await supabase
        .from('china_supplier_scores')
        .select('*')
        .order('overall_score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as unknown as SupplierScore[];
    } catch (error) {
      console.error('[SupplierScoring] Erreur top suppliers:', error);
      return [];
    }
  }, []);

  const getFlaggedSuppliers = useCallback(async (): Promise<SupplierScore[]> => {
    try {
      const { data, error } = await supabase
        .from('china_supplier_scores')
        .select('*')
        .eq('is_flagged', true)
        .order('overall_score', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as SupplierScore[];
    } catch (error) {
      console.error('[SupplierScoring] Erreur flagged suppliers:', error);
      return [];
    }
  }, []);

  // ==================== RETURN ====================

  return {
    loading,
    calculateScore,
    recalculateAllScores,
    getScoreLevel,
    shouldWarn,
    shouldAutoDisable,
    checkAndApplyAutoActions,
    getScoreBreakdown,
    getTopSuppliers,
    getFlaggedSuppliers
  };
}

export default useSupplierScoring;

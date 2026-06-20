/**
 * SERVICE DE GESTION DES LIMITES DE PRODUITS
 * Gère la désactivation automatique des produits excédentaires
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildProductActivationPlan } from '@/lib/subscriptions/productQuotaRules';

export interface ProductLimitStatus {
  total_products: number;
  active_products: number;
  max_allowed: number;
  is_unlimited: boolean;
  excess_products: number;
  deactivated_products: string[];
}

interface ProductLimitCheckResult {
  current_count: number;
  max_products: number;
  can_add: boolean;
  is_unlimited: boolean;
  plan_name: string;
}

export class ProductLimitService {
  /**
   * Vérifie et désactive les produits en excès pour un vendeur
   * @param vendorId - ID du vendeur
   * @param userId - ID utilisateur du vendeur (pour vérifier l'abonnement)
   */
  static async enforceProductLimit(vendorId: string, userId?: string): Promise<ProductLimitStatus> {
    try {
      // 1. Si userId n'est pas fourni, le récupérer depuis le vendeur
      let userIdToCheck = userId;
      if (!userIdToCheck) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('user_id')
          .eq('id', vendorId)
          .single();

        if (!vendor) throw new Error('Vendeur introuvable');
        userIdToCheck = vendor.user_id;
      }

      // 2. Récupérer les limites de l'abonnement
      const { data: limitCheck, error: limitError } = await supabase.rpc('check_product_limit', {
        p_user_id: userIdToCheck
      });

      if (limitError) throw limitError;
      if (!limitCheck) {
        throw new Error('Impossible de vérifier les limites');
      }

      // Type assertion pour TypeScript
      const limit = limitCheck as unknown as ProductLimitCheckResult;

      // Si illimité, pas de désactivation
      if (limit.is_unlimited) {
        const { count: totalCount } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId);

        const { count: activeCount } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .eq('is_active', true);

        return {
          total_products: totalCount || activeCount || limit.current_count,
          active_products: activeCount || limit.current_count,
          max_allowed: Infinity,
          is_unlimited: true,
          excess_products: 0,
          deactivated_products: []
        };
      }

      // 3. Récupérer tous les produits du vendeur triés par date de création (les plus récents en premier)
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, created_at, is_active')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false }); // Les plus récents en premier

      if (productsError) throw productsError;
      if (!products) throw new Error('Aucun produit trouvé');

      const activationPlan = buildProductActivationPlan(products, limit.max_products, false);
      const totalProducts = activationPlan.totalProducts;
      const activeProductCount = activationPlan.activeProducts;
      const maxAllowed = activationPlan.maxAllowed;
      const excessCount = activationPlan.excessCount;

      // 4. Si pas de dépassement, ne pas toucher aux activations manuelles
      if (excessCount === 0) {
        return {
          total_products: totalProducts,
          active_products: activeProductCount,
          max_allowed: maxAllowed,
          is_unlimited: false,
          excess_products: 0,
          deactivated_products: []
        };
      }

      // 5. Identifier les produits actifs à désactiver (les plus anciens parmi les actifs)
      const deactivateIds = activationPlan.deactivateIds;

      // 6. Désactiver uniquement les produits actifs excédentaires
      if (deactivateIds.length > 0) {
        await supabase
          .from('products')
          .update({ is_active: false })
          .in('id', deactivateIds);
      }

      return {
        total_products: totalProducts,
        active_products: maxAllowed,
        max_allowed: maxAllowed,
        is_unlimited: false,
        excess_products: excessCount,
        deactivated_products: deactivateIds
      };

    } catch (error: any) {
      console.error('[ProductLimitService] Error:', error);
      throw error;
    }
  }

  /**
   * Vérifie le statut sans appliquer de changements
   * @param vendorId - ID du vendeur
   * @param userId - ID utilisateur du vendeur (pour vérifier l'abonnement)
   */
  static async checkProductLimitStatus(vendorId: string, userId?: string): Promise<ProductLimitStatus> {
    try {
      // 1. Si userId n'est pas fourni, le récupérer depuis le vendeur
      let userIdToCheck = userId;
      if (!userIdToCheck) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('user_id')
          .eq('id', vendorId)
          .single();

        if (!vendor) throw new Error('Vendeur introuvable');
        userIdToCheck = vendor.user_id;
      }

      const { data: limitCheck, error: limitError } = await supabase.rpc('check_product_limit', {
        p_user_id: userIdToCheck
      });

      if (limitError) throw limitError;
      if (!limitCheck) {
        throw new Error('Impossible de vérifier les limites');
      }

      // Type assertion pour TypeScript
      const limit = limitCheck as unknown as ProductLimitCheckResult;

      const { data: products } = await supabase
        .from('products')
        .select('id, is_active')
        .eq('vendor_id', vendorId);

      const totalProducts = products?.length || 0;
      const activationPlan = buildProductActivationPlan(products || [], limit.max_products, limit.is_unlimited);
      const activeProducts = activationPlan.activeProducts;
      const maxAllowed = activationPlan.maxAllowed;
      const excessCount = activationPlan.excessCount;

      return {
        total_products: totalProducts,
        active_products: activeProducts,
        max_allowed: limit.is_unlimited ? Infinity : maxAllowed,
        is_unlimited: limit.is_unlimited,
        excess_products: excessCount,
        deactivated_products: []
      };

    } catch (error: any) {
      console.error('[ProductLimitService] Check status error:', error);
      throw error;
    }
  }

  /**
   * Notifie le vendeur des produits désactivés
   */
  static notifyProductDeactivation(status: ProductLimitStatus) {
    if (status.excess_products > 0) {
      toast.warning(
        `⚠️ ${status.excess_products} produit(s) désactivé(s)`,
        {
          description: `Votre abonnement permet ${status.max_allowed} produits actifs. Seuls les produits actifs en excedent ont ete desactives automatiquement.`,
          duration: 8000,
          action: {
            label: 'Mettre à niveau',
            onClick: () => window.location.href = '/subscriptions'
          }
        }
      );
    }
  }
}

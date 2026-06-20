/**
 * Hook useOfflineFeatureAccess - Vérification d'accès aux fonctionnalités en mode offline
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Ce hook permet aux composants React de vérifier l'accessibilité des fonctionnalités
 * en fonction du statut online/offline.
 *
 * NOTE: Ce hook est différent de useFeatureAccess qui gère les restrictions d'abonnement.
 * Celui-ci gère uniquement les restrictions liées au mode hors ligne.
 */

import { useMemo } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import {
  checkFeatureAccess,
  requiresOnlineConnection,
  isOfflineEnabled,
  type Feature,
  type FeatureAccessResult
} from '@/lib/offline/featureGate';

/**
 * Hook pour vérifier l'accès à une fonctionnalité en mode offline
 *
 * @param feature - Nom de la fonctionnalité à vérifier
 * @returns Résultat de la vérification avec méthodes utilitaires
 *
 * @example
 * function OrderButton() {
 *   const { isAllowed, reason, block } = useOfflineFeatureAccess('online_orders');
 *
 *   const handleClick = () => {
 *     if (block()) return; // Affiche automatiquement un toast d'erreur
 *     // Continuer avec la commande
 *   };
 *
 *   return (
 *     <Button disabled={!isAllowed} onClick={handleClick}>
 *       Commander
 *       {!isAllowed && <Badge>Nécessite connexion</Badge>}
 *     </Button>
 *   );
 * }
 */
export function useOfflineFeatureAccess(feature: Feature) {
  const { isOnline } = useOnlineStatus();

  const accessResult: FeatureAccessResult = useMemo(
    () => checkFeatureAccess(feature, isOnline),
    [feature, isOnline]
  );

  /**
   * Bloque l'exécution si la fonctionnalité n'est pas accessible
   * Affiche automatiquement un message d'erreur
   *
   * @returns true si bloqué, false si autorisé
   */
  const block = (): boolean => {
    if (!accessResult.isAllowed && accessResult.reason) {
      // Import dynamique pour éviter les dépendances circulaires
      import('sonner').then(({ toast }) => {
        toast.error(accessResult.reason!.message, {
          description: accessResult.reason!.action,
          duration: 5000
        });
      });
      return true;
    }
    return false;
  };

  /**
   * Wrapper pour exécuter une fonction seulement si la fonctionnalité est accessible
   *
   * @param fn - Fonction à exécuter
   * @returns Fonction wrapped qui vérifie l'accès avant exécution
   */
  const guard = <T extends (...args: any[]) => any>(fn: T) => {
    return (...args: Parameters<T>): ReturnType<T> | void => {
      if (block()) return;
      return fn(...args);
    };
  };

  return {
    ...accessResult,
    block,
    guard,
    isOnline
  };
}

/**
 * Hook pour obtenir le statut de plusieurs fonctionnalités
 *
 * @param features - Liste des fonctionnalités à vérifier
 * @returns Map des fonctionnalités avec leur statut d'accès
 *
 * @example
 * const features = useMultipleOfflineFeatures([
 *   'online_orders',
 *   'pos_sales',
 *   'messaging'
 * ]);
 *
 * if (!features.online_orders.isAllowed) {
 *   // Désactiver bouton commande
 * }
 */
export function useMultipleOfflineFeatures(features: Feature[]) {
  const { isOnline } = useOnlineStatus();

  return useMemo(() => {
    const result: Record<string, FeatureAccessResult> = {};
    features.forEach(feature => {
      result[feature] = checkFeatureAccess(feature, isOnline);
    });
    return result;
  }, [features, isOnline]);
}

/**
 * Hook pour vérifier si au moins une fonctionnalité est accessible
 *
 * @param features - Liste des fonctionnalités
 * @returns true si au moins une est accessible
 *
 * @example
 * const canPay = useAnyOfflineFeature(['card_payment', 'mobile_money_send', 'pos_cash_payment']);
 */
export function useAnyOfflineFeature(features: Feature[]): boolean {
  const { isOnline } = useOnlineStatus();

  return useMemo(() => {
    return features.some(feature => {
      const { isAllowed } = checkFeatureAccess(feature, isOnline);
      return isAllowed;
    });
  }, [features, isOnline]);
}

/**
 * Hook pour vérifier si toutes les fonctionnalités sont accessibles
 *
 * @param features - Liste des fonctionnalités
 * @returns true si toutes sont accessibles
 *
 * @example
 * const canCheckout = useAllOfflineFeatures(['cart_checkout', 'card_payment']);
 */
export function useAllOfflineFeatures(features: Feature[]): boolean {
  const { isOnline } = useOnlineStatus();

  return useMemo(() => {
    return features.every(feature => {
      const { isAllowed } = checkFeatureAccess(feature, isOnline);
      return isAllowed;
    });
  }, [features, isOnline]);
}

/**
 * Hook utilitaire pour obtenir des informations sur le mode offline
 *
 * @returns Informations sur les fonctionnalités offline
 */
export function useOfflineInfo() {
  const { isOnline } = useOnlineStatus();

  return useMemo(() => ({
    isOnline,
    isOffline: !isOnline,
    requiresOnlineConnection,
    isOfflineEnabled
  }), [isOnline]);
}

export default useOfflineFeatureAccess;

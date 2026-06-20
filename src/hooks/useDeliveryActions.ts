/**
 * Hook pour gérer les actions de livraison
 * Extrait la logique métier du composant principal
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { supabase } from '@/integrations/supabase/client';
import {
  completeDelivery as completeDeliveryBackend,
  acceptDeliveryBackend,
  startDeliveryBackend,
  cancelDeliveryBackend,
} from '@/services/deliveryBackendService';

interface UseDeliveryActionsProps {
  driverId: string | null;
  onDeliveryAccepted?: () => void;
  onDeliveryStarted?: () => void;
  onDeliveryCompleted?: () => void;
  onDeliveryCancelled?: () => void;
}

export function useDeliveryActions({
  driverId,
  onDeliveryAccepted,
  onDeliveryStarted,
  onDeliveryCompleted,
  onDeliveryCancelled,
}: UseDeliveryActionsProps) {
  const fc = useFormatCurrency();

  /**
   * Accepter une livraison
   */
  const acceptDelivery = useCallback(async (deliveryId: string) => {
    if (!driverId) {
      toast.error('Vous devez être connecté pour accepter une livraison');
      return;
    }

    try {
      // Claim ATOMIQUE côté backend (anti double-affectation + autorisation par JWT).
      const result = await acceptDeliveryBackend(deliveryId);
      if (!result.success) {
        toast.error(result.error || 'Cette livraison n\'est plus disponible');
        return;
      }
      toast.success('Livraison acceptée! Direction le point de collecte.');
      onDeliveryAccepted?.();
    } catch (error) {
      console.error('Error accepting delivery:', error);
      toast.error('Impossible d\'accepter cette livraison');
      throw error;
    }
  }, [driverId, onDeliveryAccepted]);

  /**
   * Démarrer une livraison (collecte effectuée)
   */
  const startDelivery = useCallback(async (deliveryId: string) => {
    if (!driverId) {
      toast.error('Vous devez être connecté');
      return;
    }

    try {
      // Transition validée côté backend (seul le livreur assigné, état 'assigned').
      const result = await startDeliveryBackend(deliveryId);
      if (!result.success) {
        toast.error(result.error || 'Cette livraison n\'est pas dans le bon état');
        return;
      }
      toast.success('Livraison démarrée! En route vers le client.');
      onDeliveryStarted?.();
    } catch (error) {
      console.error('Error starting delivery:', error);
      toast.error('Impossible de démarrer la livraison');
      throw error;
    }
  }, [driverId, onDeliveryStarted]);

  /**
   * Annuler une livraison
   */
  const cancelDelivery = useCallback(async (deliveryId: string, reason: string) => {
    if (!driverId) {
      toast.error('Vous devez être connecté');
      return;
    }

    try {
      // Autorisation + transition validées côté backend.
      const result = await cancelDeliveryBackend(deliveryId, reason);
      if (!result.success) {
        toast.error(result.error || 'Impossible d\'annuler la livraison');
        return;
      }
      toast.info('Livraison annulée');
      onDeliveryCancelled?.();
    } catch (error) {
      console.error('Error cancelling delivery:', error);
      toast.error('Impossible d\'annuler la livraison');
      throw error;
    }
  }, [driverId, onDeliveryCancelled]);

  /**
   * Terminer une livraison avec preuve
   */
  const completeDeliveryWithProof = useCallback(async (
    deliveryId: string,
    photoUrl: string,
    signature: string
  ) => {
    if (!driverId) {
      toast.error('Vous devez être connecté');
      return;
    }

    try {
      console.log('🎯 [useDeliveryActions] Completing delivery:', deliveryId);

      // Vérifier que la livraison existe et appartient au driver
      const { data: existingDelivery, error: checkError } = await supabase
        .from('deliveries')
        .select('id, status, driver_id')
        .eq('id', deliveryId)
        .eq('driver_id', driverId)
        .single();

      if (checkError || !existingDelivery) {
        console.error('❌ Delivery not found or not assigned to driver');
        toast.error('Livraison introuvable');
        return;
      }

      if (existingDelivery.status === 'delivered') {
        console.warn('⚠️ Delivery already completed');
        toast.info('Cette livraison est déjà terminée');
        onDeliveryCompleted?.();
        return;
      }

      // Finalisation côté backend Node.js : écrit la preuve, calcule driver_earning (98,5 %)
      // et incrémente les totaux du livreur. Le frontend ne calcule plus les gains.
      const result = await completeDeliveryBackend(deliveryId, photoUrl, signature);

      if (!result.success) {
        console.error('❌ Backend completion error:', result.error);
        throw new Error(result.error || 'Erreur lors de la finalisation');
      }

      console.log('✅ Delivery completed successfully (backend)');
      if (result.driver_earning && result.credited) {
        toast.success(`🎉 Livraison terminée ! ${fc(result.driver_earning)} crédités sur votre wallet`);
        // Rafraîchir le solde wallet affiché
        window.dispatchEvent(new Event('wallet-updated'));
      } else if (result.driver_earning) {
        toast.success(`🎉 Livraison terminée ! Gain : ${fc(result.driver_earning)} (espèces)`);
      } else {
        toast.success('🎉 Livraison terminée avec succès!');
      }

      // Forcer le rechargement après un délai pour laisser la DB se synchroniser
      setTimeout(() => {
        onDeliveryCompleted?.();
      }, 500);
    } catch (error) {
      console.error('❌ Error completing delivery with proof:', error);
      toast.error('Erreur lors de la finalisation');
      throw error;
    }
  }, [driverId, onDeliveryCompleted]);

  /**
   * Signaler un problème
   */
  const reportProblem = useCallback(async (deliveryId: string, problem: string) => {
    if (!driverId) return;

    try {
      // Le signalement = un vrai ticket support (visible côté support/PDG). On n'écrit plus
      // `driver_notes` en direct sur la livraison (écritures conducteur réservées au backend).
      const { error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          subject: `Problème livraison #${deliveryId.slice(0, 8)}`,
          description: problem,
          category: 'delivery',
          priority: 'high',
          requester_id: driverId,
          status: 'open',
        });

      if (ticketError) {
        console.error('Erreur création ticket support:', ticketError);
        toast.warning('Problème enregistré (ticket support non créé)');
        return;
      }

      toast.success('Problème signalé au support — un ticket a été créé');
    } catch (error) {
      console.error('Error reporting problem:', error);
      toast.error('Impossible de signaler le problème');
    }
  }, [driverId]);

  return {
    acceptDelivery,
    startDelivery,
    cancelDelivery,
    completeDeliveryWithProof,
    reportProblem,
  };
}

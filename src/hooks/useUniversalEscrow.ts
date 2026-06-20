/**
 * HOOK ESCROW UNIVERSEL
 * Hook réutilisable pour gérer l'escrow dans tous les composants
 */

import { useState, useCallback } from 'react';
import { UniversalEscrowService, UniversalEscrowRequest, EscrowStatus, TransactionType } from '@/services/UniversalEscrowService';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

export function useUniversalEscrow() {
  const fc = useFormatCurrency();
  const [creating, setCreating] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [escrowStatus, setEscrowStatus] = useState<EscrowStatus | null>(null);

  /**
   * Crée un escrow
   */
  const createEscrow = useCallback(async (request: UniversalEscrowRequest) => {
    setCreating(true);
    try {
      const result = await UniversalEscrowService.createEscrow(request);

      if (result.success) {
        toast.success('Paiement sécurisé', {
          description: `Fonds bloqués en escrow - ${fc(request.amount)}`
        });
      } else {
        toast.error('Erreur escrow', {
          description: result.error || 'Impossible de créer l\'escrow'
        });
      }

      return result;
    } catch (error) {
      console.error('[useUniversalEscrow] Create error:', error);
      toast.error('Erreur', {
        description: 'Une erreur est survenue'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    } finally {
      setCreating(false);
    }
  }, []);

  /**
   * Libère un escrow
   */
  const releaseEscrow = useCallback(async (escrow_id: string, notes?: string) => {
    setReleasing(true);
    try {
      const result = await UniversalEscrowService.releaseEscrow(escrow_id, notes);

      if (result.success) {
        toast.success('Fonds libérés', {
          description: 'Le paiement a été transféré au vendeur'
        });
      } else {
        toast.error('Erreur', {
          description: result.error || 'Impossible de libérer les fonds'
        });
      }

      return result;
    } catch (error) {
      console.error('[useUniversalEscrow] Release error:', error);
      toast.error('Erreur de libération');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    } finally {
      setReleasing(false);
    }
  }, []);

  /**
   * Rembourse un escrow
   */
  const refundEscrow = useCallback(async (escrow_id: string, reason: string) => {
    setRefunding(true);
    try {
      const result = await UniversalEscrowService.refundEscrow(escrow_id, reason);

      if (result.success) {
        toast.success('Remboursement effectué', {
          description: 'Les fonds ont été remboursés'
        });
      } else {
        toast.error('Erreur', {
          description: result.error || 'Impossible de rembourser'
        });
      }

      return result;
    } catch (error) {
      console.error('[useUniversalEscrow] Refund error:', error);
      toast.error('Erreur de remboursement');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    } finally {
      setRefunding(false);
    }
  }, []);

  /**
   * Charge le statut d'un escrow
   */
  const loadEscrowStatus = useCallback(async (escrow_id: string) => {
    try {
      const status = await UniversalEscrowService.getEscrowStatus(escrow_id);
      setEscrowStatus(status);
      return status;
    } catch (error) {
      console.error('[useUniversalEscrow] Load status error:', error);
      return null;
    }
  }, []);

  /**
   * Charge les escrows d'un utilisateur
   */
  const loadUserEscrows = useCallback(async (
    user_id: string,
    filter?: { transaction_type?: TransactionType; status?: string }
  ) => {
    try {
      return await UniversalEscrowService.getUserEscrows(user_id, filter);
    } catch (error) {
      console.error('[useUniversalEscrow] Load user escrows error:', error);
      return [];
    }
  }, []);

  /**
   * Calcule les frais d'escrow
   */
  const calculateFees = useCallback((amount: number, commission_percent?: number) => {
    return UniversalEscrowService.calculateEscrowFees(amount, commission_percent);
  }, []);

  return {
    // États
    creating,
    releasing,
    refunding,
    escrowStatus,

    // Fonctions
    createEscrow,
    releaseEscrow,
    refundEscrow,
    loadEscrowStatus,
    loadUserEscrows,
    calculateFees,

    // Helpers
    isEscrowEnabled: UniversalEscrowService.isEscrowEnabled
  };
}

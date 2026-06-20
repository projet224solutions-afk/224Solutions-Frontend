/**
 * WRAPPER PAIEMENT ESCROW UNIVERSEL
 * Composant wrapper pour intégrer l'escrow dans n'importe quel flux de paiement
 */

import { ReactNode, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useUniversalEscrow } from '@/hooks/useUniversalEscrow';
import { UniversalEscrowRequest, TransactionType, PaymentProvider } from '@/services/UniversalEscrowService';
import { Badge } from '@/components/ui/badge';

interface EscrowPaymentWrapperProps {
  // Enfant (bouton ou élément déclencheur)
  children: ReactNode;

  // Configuration de la transaction
  transaction: {
    buyer_id: string;
    seller_id: string;
    amount: number;
    currency?: string;
    order_id?: string;
    transaction_type: TransactionType;
    payment_provider: PaymentProvider;
    description?: string;
  };

  // Options
  enabled?: boolean; // Active/désactive l'escrow
  showConfirmDialog?: boolean; // Affiche un dialog de confirmation

  // Callbacks
  onSuccess?: (escrow_id: string) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

export function EscrowPaymentWrapper({
  children,
  transaction,
  enabled = true,
  showConfirmDialog = true,
  onSuccess,
  onError,
  onComplete
}: EscrowPaymentWrapperProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [showDialog, setShowDialog] = useState(false);
  const { createEscrow, creating, calculateFees } = useUniversalEscrow();

  // Calculer les frais
  const fees = calculateFees(transaction.amount);

  const handleTrigger = () => {
    if (!enabled) {
      // Si l'escrow n'est pas activé, exécuter directement le paiement
      onComplete?.();
      return;
    }

    if (showConfirmDialog) {
      setShowDialog(true);
    } else {
      handleConfirm();
    }
  };

  const handleConfirm = async () => {
    try {
      const escrowRequest: UniversalEscrowRequest = {
        buyer_id: transaction.buyer_id,
        seller_id: transaction.seller_id,
        order_id: transaction.order_id,
        amount: transaction.amount,
        currency: transaction.currency || 'GNF',
        transaction_type: transaction.transaction_type,
        payment_provider: transaction.payment_provider,
        metadata: {
          description: transaction.description
        }
      };

      const result = await createEscrow(escrowRequest);

      if (result.success && result.escrow_id) {
        onSuccess?.(result.escrow_id);
      } else {
        onError?.(result.error || 'Erreur lors de la création de l\'escrow');
      }

      setShowDialog(false);
      onComplete?.();
    } catch (error) {
      console.error('[EscrowPaymentWrapper] Error:', error);
      onError?.(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  };

  return (
    <>
      <div onClick={handleTrigger} className="cursor-pointer">
        {children}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Paiement Sécurisé par Escrow
            </DialogTitle>
            <DialogDescription>
              Vos fonds seront protégés jusqu'à confirmation de la transaction
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Informations de la transaction */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="outline">
                  {transaction.transaction_type === 'product' && 'Produit'}
                  {transaction.transaction_type === 'taxi' && 'Course Taxi'}
                  {transaction.transaction_type === 'delivery' && 'Livraison'}
                  {transaction.transaction_type === 'service' && 'Service'}
                </Badge>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('escrowPaymentWrapper.methode')}</span>
                <Badge variant="secondary">
                  {transaction.payment_provider === 'wallet' && 'Wallet 224'}
                  {transaction.payment_provider === 'stripe' && 'Carte bancaire'}
                  {transaction.payment_provider === 'cash' && 'Espèces'}
                  {transaction.payment_provider === 'orange_money' && 'Mobile Money'}
                </Badge>
              </div>

              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('escrowPaymentWrapper.montant')}</span>
                  <span className="font-semibold">{fc(transaction.amount)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Frais escrow (2.5%):</span>
                  <span>{fc(fees.fee)}</span>
                </div>
              </div>
            </div>

            {/* Avantages de l'escrow */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Protection acheteur:</strong>
                <ul className="mt-1 ml-4 list-disc space-y-1">
                  <li>{t('escrowPaymentWrapper.fondsBloquesDeManiereSecurisee')}</li>
                  <li>{t('escrowPaymentWrapper.liberationUniquementApresConfirmation')}</li>
                  <li>{t('escrowPaymentWrapper.possibiliteDeRemboursementEnCas')}</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Avertissement pour cash */}
            {transaction.payment_provider === 'cash' && (
              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Le paiement sera effectué à la livraison. L'escrow sert à garantir la transaction.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={creating}
              className="gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sécurisation...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmer le paiement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Hook pour utiliser l'escrow sans le wrapper visuel
 */
export function useEscrowPayment() {
  const { createEscrow, creating } = useUniversalEscrow();

  const processWithEscrow = async (transaction: UniversalEscrowRequest) => {
    return await createEscrow(transaction);
  };

  return {
    processWithEscrow,
    processing: creating
  };
}

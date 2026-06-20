/**
 * MODAL PAIEMENT TAXI-MOTO
 * Support: Wallet, Card (Stripe), Mobile Money (Orange, MTN, Moov), Cash
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CreditCard, Smartphone, Wallet, Banknote, Loader2, Shield } from "lucide-react";
import { PaymentsService, type PaymentMethod } from "@/services/taxi/paymentsService";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UniversalEscrowService } from "@/services/UniversalEscrowService";
import { supabase } from "@/integrations/supabase/client";
import { StripeCardPaymentModal } from "@/components/pos/StripeCardPaymentModal";

interface TaxiMotoPaymentModalProps {
  open: boolean;
  onClose: () => void;
  rideId: string;
  amount: number;
  customerId: string;
  driverId: string;
  onPaymentSuccess: () => void;
}

export default function TaxiMotoPaymentModal({
  open,
  onClose,
  rideId,
  amount,
  customerId,
  driverId,
  onPaymentSuccess
}: TaxiMotoPaymentModalProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [processing, setProcessing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showStripeModal, setShowStripeModal] = useState(false);

  useEffect(() => {
    if (open && customerId) {
      loadWalletBalance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId]);

  const loadWalletBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', customerId)
        .eq('currency', 'GNF')
        .single();

      if (error) throw error;
      setWalletBalance(data?.balance || 0);
    } catch (error) {
      console.error('[TaxiPayment] Error loading balance:', error);
      setWalletBalance(0);
    }
  };

  const paymentMethods = [
    {
      id: 'wallet' as PaymentMethod,
      name: 'Wallet 224Solutions',
      description: 'Paiement instantané depuis votre wallet',
      icon: Wallet,
      color: 'text-primary'
    },
    {
      id: 'card' as PaymentMethod,
      name: 'Carte bancaire (Stripe)',
      description: 'Visa, Mastercard - Paiement sécurisé',
      icon: CreditCard,
      color: 'text-blue-600'
    },
    {
      id: 'orange_money' as PaymentMethod,
      name: 'Mobile Money',
      description: 'Orange Money, MTN Money, Moov Money',
      icon: Smartphone,
      color: 'text-orange-600'
    },
    {
      id: 'cash' as PaymentMethod,
      name: 'Espèces',
      description: 'Paiement en liquide au conducteur',
      icon: Banknote,
      color: 'text-[#ff4000]'
    }
  ];

  const handlePayment = async () => {
    // Si carte bancaire sélectionnée, ouvrir le modal Stripe
    if (paymentMethod === 'card') {
      setShowStripeModal(true);
      return;
    }

    setProcessing(true);

    try {
      console.log('[TaxiPayment] Starting payment with escrow:', {
        rideId,
        customerId,
        driverId,
        amount,
        paymentMethod
      });

      // Vérifier le solde pour wallet
      if (paymentMethod === 'wallet') {
        if (walletBalance !== null && walletBalance < amount) {
          toast.error(t('taxiMotoPaymentModal.soldeInsuffisant'), {
            description: 'Veuillez recharger votre wallet'
          });
          setProcessing(false);
          return;
        }
      }

      // Validation des champs requis
      if (paymentMethod === 'orange_money' && (!phoneNumber || phoneNumber.length < 8)) {
        toast.error(t('taxiMotoPaymentModal.numeroDeTelephoneRequis'), {
          description: 'Veuillez entrer votre numéro Mobile Money'
        });
        setProcessing(false);
        return;
      }

      // Créer l'escrow pour sécuriser le paiement
      const escrowResult = await UniversalEscrowService.createEscrow({
        buyer_id: customerId,
        seller_id: driverId,
        order_id: rideId,
        amount,
        currency: 'GNF',
        transaction_type: 'taxi',
        payment_provider: paymentMethod === 'wallet' ? 'wallet' :
                         paymentMethod === 'orange_money' ? 'orange_money' :
                         paymentMethod === 'cash' ? 'cash' : 'wallet',
        metadata: {
          ride_id: rideId,
          description: 'Paiement course taxi-moto',
          phone_number: phoneNumber,
        },
        escrow_options: {
          auto_release_days: 1,
          commission_percent: 2.5
        }
      });

      if (!escrowResult.success) {
        throw new Error(escrowResult.error || 'Échec de la création de l\'escrow');
      }

      console.log('[TaxiPayment] ✅ Escrow created:', escrowResult.escrow_id);

      // Messages selon la méthode
      if (paymentMethod === 'wallet') {
        toast.success(t('taxiMotoPaymentModal.paiementSecuriseEffectue'), {
          description: `${fc(amount)} bloqués en escrow - Seront transférés au chauffeur à la fin de la course`
        });
      } else if (paymentMethod === 'cash') {
        toast.success(t('taxiMotoPaymentModal.courseConfirmee'), {
          description: 'Vous paierez en espèces au chauffeur'
        });
      } else if (paymentMethod === 'orange_money') {
        toast.success(t('taxiMotoPaymentModal.paiementMobileMoneyInitie'), {
          description: `Confirmez sur votre téléphone ${phoneNumber}`
        });
      }

      onPaymentSuccess();
      onClose();

    } catch (error) {
      console.error('[TaxiPayment] Error:', error);
      toast.error(t('taxiMotoPaymentModal.erreurDePaiement'), {
        description: error instanceof Error ? error.message : 'Veuillez réessayer'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleStripeSuccess = async (paymentIntentId: string) => {
    console.log('[TaxiPayment] Stripe payment success:', paymentIntentId);

    // Créer l'escrow après paiement Stripe réussi
    try {
      const escrowResult = await UniversalEscrowService.createEscrow({
        buyer_id: customerId,
        seller_id: driverId,
        order_id: rideId,
        amount,
        currency: 'GNF',
        transaction_type: 'taxi',
        payment_provider: 'stripe',
        metadata: {
          ride_id: rideId,
          description: 'Paiement course taxi-moto par carte',
          stripe_payment_intent_id: paymentIntentId
        },
        escrow_options: {
          auto_release_days: 1,
          commission_percent: 2.5
        }
      });

      if (escrowResult.success) {
        toast.success(t('taxiMotoPaymentModal.paiementParCarteReussi'), {
          description: `${fc(amount)} payés par carte`
        });
      }
    } catch (error) {
      console.error('[TaxiPayment] Escrow error after Stripe:', error);
    }

    setShowStripeModal(false);
    onPaymentSuccess();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Paiement Sécurisé (Escrow)
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-2">
                <div>
                  Montant: <span className="font-bold text-lg">{fc(amount)}</span>
                </div>
                {paymentMethod === 'wallet' && walletBalance !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{t('taxiMotoPaymentModal.soldeDisponible')}</span>
                    <span className="font-semibold">{fc(walletBalance)}</span>
                  </div>
                )}
                {(paymentMethod === 'wallet' || paymentMethod === 'card') && (
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Vos fonds sont protégés par notre système Escrow jusqu'à la fin de la course
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <div key={method.id} className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
                       onClick={() => setPaymentMethod(method.id)}>
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Icon className={`w-6 h-6 ${method.color}`} />
                    <div className="flex-1">
                      <Label htmlFor={method.id} className="font-medium cursor-pointer">
                        {method.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>

            {/* Champs spécifiques selon la méthode */}
            {paymentMethod === 'orange_money' && (
              <div className="space-y-2 mt-3">
                <Label htmlFor="phone">{t('taxiMotoPaymentModal.numeroDeTelephone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Ex: 620 00 00 00"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Orange Money, MTN Money ou Moov Money
                </p>
              </div>
            )}

            {paymentMethod === 'card' && (
              <Alert className="bg-blue-50 border-blue-200">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-700">
                  Vous serez redirigé vers le formulaire de paiement Stripe sécurisé
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={processing}
            >
              Annuler
            </Button>
            <Button
              onClick={handlePayment}
              className="flex-1"
              disabled={processing ||
                (paymentMethod === 'wallet' && walletBalance !== null && walletBalance < amount) ||
                (paymentMethod === 'orange_money' && phoneNumber.length < 8)
              }
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sécurisation...
                </>
              ) : (
                paymentMethod === 'card' ? 'Payer par carte' :
                paymentMethod === 'wallet' ? 'Payer en sécurité' :
                paymentMethod === 'orange_money' ? 'Payer par Mobile Money' :
                'Confirmer la course'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Stripe pour paiement par carte */}
      <StripeCardPaymentModal
        isOpen={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        amount={amount}
        currency="GNF"
        orderId={rideId}
        sellerId={driverId}
        description={`Course taxi-moto #${rideId.slice(0, 8)}`}
        onSuccess={handleStripeSuccess}
        onError={(error) => {
          toast.error(t('taxiMotoPaymentModal.erreurPaiementCarte'), { description: error });
          setShowStripeModal(false);
        }}
      />
    </>
  );
}

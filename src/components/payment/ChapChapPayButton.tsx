/**
 * 💳 BOUTON PAIEMENT CHAPCHAPPAY - 224SOLUTIONS
 * Orange Money, MTN MoMo, PayCard via ChapChapPay
 * Supporte E-Commerce, PULL (débit client), et vérification status
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Smartphone,
  CreditCard,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { useChapChapPay } from '@/hooks/useChapChapPay';
import { CCPPaymentMethod } from '@/services/payment/ChapChapPayService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChapChapPayButtonProps {
  amount: number;
  currency?: string;
  orderId?: string;
  description?: string;
  customerName?: string;
  customerPhone?: string;
  returnUrl?: string;
  cancelUrl?: string;
  onPaymentSuccess?: (transactionId: string, status: string) => void;
  onPaymentPending?: (transactionId: string) => void;
  onPaymentFailed?: (error: string) => void;
  mode?: 'ecommerce' | 'pull' | 'auto';
  buttonText?: string;
  buttonClassName?: string;
  showMethodSelector?: boolean;
  defaultMethod?: CCPPaymentMethod;
}

interface PaymentMethodOption {
  id: CCPPaymentMethod;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  phonePrefix?: string;
  phonePlaceholder?: string;
}

const paymentMethodOptions: PaymentMethodOption[] = [
  {
    id: 'orange_money',
    name: 'Orange Money',
    description: "Paiement instantané via Orange Money",
    icon: <Smartphone className="h-5 w-5 text-orange-500" />,
    iconBg: 'bg-orange-100',
    phonePrefix: '620',
    phonePlaceholder: '620 XX XX XX'
  },
  {
    id: 'mtn_momo',
    name: 'MTN Mobile Money',
    description: "Paiement via MTN MoMo",
    icon: <Smartphone className="h-5 w-5 text-[#ff4000]" />,
    iconBg: 'bg-orange-100',
    phonePrefix: '660',
    phonePlaceholder: '660 XX XX XX'
  },
  {
    id: 'paycard',
    name: 'PayCard',
    description: "Carte de paiement locale",
    icon: <CreditCard className="h-5 w-5 text-blue-600" />,
    iconBg: 'bg-blue-100'
  },
  {
    id: 'card',
    name: 'Carte Bancaire',
    description: 'VISA / Mastercard',
    icon: <CreditCard className="h-5 w-5 text-[#04439e]" />,
    iconBg: 'bg-blue-100'
  }
];

export function ChapChapPayButton({
  amount,
  currency = 'XOF',
  orderId,
  description,
  customerName,
  customerPhone: initialPhone,
  returnUrl,
  cancelUrl,
  onPaymentSuccess,
  onPaymentPending,
  onPaymentFailed,
  mode = 'auto',
  buttonText = 'Payer maintenant',
  buttonClassName,
  showMethodSelector = true,
  defaultMethod = 'orange_money'
}: ChapChapPayButtonProps) {
  const { t } = useTranslation();
  const {
    createEcommercePayment,
    initiatePullPayment,
    pollStatus,
    isLoading
  } = useChapChapPay();

  const [open, setOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<CCPPaymentMethod>(defaultMethod);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || '');
  const [otp, setOtp] = useState('');
  const [processing, setProcessing] = useState(false);
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [_currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'polling' | 'success' | 'failed'>('idle');

  const selectedOption = paymentMethodOptions.find(m => m.id === selectedMethod);
  const requiresPhone = selectedMethod === 'orange_money' || selectedMethod === 'mtn_momo';

  const handlePayment = async () => {
    if (requiresPhone && (!phoneNumber || phoneNumber.length < 9)) {
      toast.error(t('chapChapPayButton.numeroDeTelephoneInvalide'));
      return;
    }

    setProcessing(true);
    setPaymentStatus('processing');

    try {
      // Mode E-Commerce (redirection) ou PULL (débit direct)
      const effectiveMode = mode === 'auto'
        ? (selectedMethod === 'card' ? 'ecommerce' : 'pull')
        : mode;

      if (effectiveMode === 'ecommerce') {
        // E-Commerce: Redirection vers page de paiement
        const result = await createEcommercePayment({
          amount,
          currency,
          orderId: orderId || `order-${Date.now()}`,
          description: description || 'Paiement 224Solutions',
          customerName,
          customerPhone: phoneNumber,
          returnUrl: returnUrl || `${window.location.origin}/payment/success`,
          cancelUrl: cancelUrl || `${window.location.origin}/payment/cancel`
        }, { autoRedirect: true });

        if (!result.success) {
          throw new Error(result.error || 'Échec initialisation paiement');
        }

        // Le redirect est automatique
        setPaymentStatus('success');

      } else {
        // PULL: Débit direct du client
        const result = await initiatePullPayment({
          amount,
          currency,
          paymentMethod: selectedMethod,
          customerPhone: phoneNumber,
          customerName,
          description: description || 'Paiement 224Solutions',
          orderId: orderId || `order-${Date.now()}`,
          otp: requiresOtp ? otp : undefined
        });

        if (!result.success) {
          throw new Error(result.error || 'Échec du paiement');
        }

        // Vérifier si OTP requis
        if (result.requiresOtp && !requiresOtp) {
          setRequiresOtp(true);
          setCurrentTransactionId(result.transactionId || null);
          setProcessing(false);
          setPaymentStatus('idle');
          toast.info(t('chapChapPayButton.entrezLeCodeOtpRecu'));
          return;
        }

        // Polling du statut
        if (result.transactionId) {
          setCurrentTransactionId(result.transactionId);
          setPaymentStatus('polling');

          onPaymentPending?.(result.transactionId);

          const finalStatus = await pollStatus(result.transactionId, (status) => {
            console.log('[ChapChapPay] Status update:', status);
          });

          if (finalStatus.status === 'completed') {
            setPaymentStatus('success');
            toast.success(t('chapChapPayButton.paiementReussi'));
            onPaymentSuccess?.(result.transactionId, 'SUCCESS');
            setOpen(false);
          } else if (finalStatus.status === 'failed' || finalStatus.status === 'cancelled') {
            setPaymentStatus('failed');
            toast.error(t('chapChapPayButton.paiementEchoue'));
            onPaymentFailed?.(finalStatus.error || 'Paiement refusé');
          } else {
            // Toujours en attente après timeout
            toast.info(t('chapChapPayButton.paiementEnAttenteDeConfirmation'));
            onPaymentPending?.(result.transactionId);
          }
        }
      }
    } catch (error: any) {
      console.error('[ChapChapPay] Payment error:', error);
      setPaymentStatus('failed');
      toast.error(error.message || 'Erreur de paiement');
      onPaymentFailed?.(error.message || 'Erreur inconnue');
    } finally {
      setProcessing(false);
    }
  };

  // Affichage succès
  if (paymentStatus === 'success') {
    return (
      <div className="p-6 text-center bg-orange-50 rounded-lg border border-orange-200">
        <CheckCircle className="h-12 w-12 text-[#ff4000] mx-auto mb-3" />
        <h3 className="text-lg font-bold text-[#ff4000] mb-2">{t('chapChapPayButton.paiementReussi2')}</h3>
        <p className="text-sm text-[#ff4000]">
          {amount.toLocaleString()} {currency}
        </p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className={cn(
            "bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/40",
            buttonClassName
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Smartphone className="h-4 w-4 mr-2" />
          )}
          {buttonText}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Paiement Mobile Money
          </DialogTitle>
          <DialogDescription>
            Paiement sécurisé via ChapChapPay
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Montant */}
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-3xl font-bold text-primary">
              {amount.toLocaleString()} {currency}
            </p>
            <p className="text-sm text-muted-foreground">{t('chapChapPayButton.montantAPayer')}</p>
          </div>

          {/* Erreur */}
          {paymentStatus === 'failed' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('chapChapPayButton.paiementEchoueVeuillezReessayer')}</AlertDescription>
            </Alert>
          )}

          {/* Sélection méthode */}
          {showMethodSelector && (
            <RadioGroup
              value={selectedMethod}
              onValueChange={(value) => {
                setSelectedMethod(value as CCPPaymentMethod);
                setRequiresOtp(false);
                setOtp('');
              }}
              className="space-y-2"
              disabled={processing}
            >
              {paymentMethodOptions.map((method) => (
                <div key={method.id}>
                  <Label
                    htmlFor={method.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                      selectedMethod === method.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/30",
                      processing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <RadioGroupItem
                      value={method.id}
                      id={method.id}
                      disabled={processing}
                      className="border-2 flex-shrink-0"
                    />

                    <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0", method.iconBg)}>
                      {method.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="font-medium block text-sm">{method.name}</span>
                      <span className="text-xs text-muted-foreground block">{method.description}</span>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {/* Champ téléphone */}
          {requiresPhone && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
              <Label htmlFor="ccp-phone" className="flex items-center gap-2 text-sm">
                <Smartphone className="h-4 w-4" />
                Numéro {selectedOption?.name}
              </Label>
              <Input
                id="ccp-phone"
                type="tel"
                placeholder={selectedOption?.phonePlaceholder || '6XX XX XX XX'}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={processing}
              />
              <p className="text-xs text-muted-foreground">
                Une demande de confirmation sera envoyée sur ce numéro
              </p>
            </div>
          )}

          {/* Champ OTP si requis */}
          {requiresOtp && (
            <div className="space-y-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <Label htmlFor="ccp-otp" className="flex items-center gap-2 text-sm text-[#ff4000]">
                <Shield className="h-4 w-4" />
                Code OTP reçu par SMS
              </Label>
              <Input
                id="ccp-otp"
                type="text"
                placeholder="XXXXXX"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={processing}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
          )}

          {/* Status polling */}
          {paymentStatus === 'polling' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Vérification du paiement en cours... Veuillez confirmer sur votre téléphone.
              </AlertDescription>
            </Alert>
          )}

          {/* Boutons action */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={processing}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handlePayment}
              disabled={processing || (requiresPhone && phoneNumber.length < 9) || (requiresOtp && otp.length < 4)}
              className="flex-1 bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/40"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  Confirmer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Sécurité */}
          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <Shield className="h-3 w-3" />
            Paiement sécurisé par ChapChapPay
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ChapChapPayButton;

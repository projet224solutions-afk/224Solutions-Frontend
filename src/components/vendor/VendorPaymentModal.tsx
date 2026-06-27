/**
 * MODAL PAIEMENT VENDEUR - 224SOLUTIONS
 * Support de 5 méthodes: wallet, cash, mobile_money, card, stripe
 * Stripe utilise Elements pour paiement carte sécurisé
 */

import { useState, lazy, Suspense } from 'react';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, Banknote, Smartphone, CreditCard, Loader2 } from 'lucide-react';
import { VendorPaymentService } from '@/services/vendor/VendorPaymentService';
import { toast } from 'sonner';

const StripeCheckoutButton = lazy(() => import('@/components/payment/StripeCheckoutButton'));

interface VendorPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  customerId: string;
  onPaymentSuccess?: () => void;
}

type PaymentMethodType = 'wallet' | 'cash' | 'mobile_money' | 'card' | 'stripe';

export const VendorPaymentModal = ({
  isOpen,
  onClose,
  orderId,
  amount,
  customerId,
  onPaymentSuccess
}: VendorPaymentModalProps) => {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('wallet');
  const [isProcessing, setIsProcessing] = useState(false);

  // Mobile Money
  const [mobileProvider, setMobileProvider] = useState<'orange' | 'mtn' | 'moov'>('orange');
  const [mobilePhone, setMobilePhone] = useState('');

  // Card
  const [cardToken, setCardToken] = useState('');

  const handlePayment = async () => {
    if (selectedMethod === 'stripe') return; // Stripe handled by Elements
    setIsProcessing(true);

    try {
      let result;

      switch (selectedMethod) {
        case 'wallet':
          result = await VendorPaymentService.payWithWallet(orderId, amount, customerId);
          break;
        case 'cash':
          result = await VendorPaymentService.payWithCash(orderId, amount, customerId);
          break;
        case 'mobile_money':
          if (!mobilePhone) {
            toast.error(t('vendorPaymentModal.enterPhone'));
            setIsProcessing(false);
            return;
          }
          result = await VendorPaymentService.payWithMobileMoney(orderId, amount, customerId, mobilePhone, mobileProvider);
          break;
        case 'card':
          if (!cardToken) {
            toast.error(t('vendorPaymentModal.enterCardToken'));
            setIsProcessing(false);
            return;
          }
          result = await VendorPaymentService.payWithCard(orderId, amount, customerId, cardToken);
          break;
        default:
          throw new Error(t('vendorPaymentModal.methodNotSupported'));
      }

      if (result.success) {
        toast.success(t('vendorPaymentModal.paymentSuccess'));
        onPaymentSuccess?.();
        onClose();
      } else {
        toast.error(result.error || t('vendorPaymentModal.paymentError'));
      }
    } catch (error: any) {
      console.error('[VendorPaymentModal] Payment error:', error);
      toast.error(error.message || t('vendorPaymentModal.paymentError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStripeSuccess = async (data: { paymentIntentId: string; amount: number; currency: string }) => {
    try {
      await VendorPaymentService.payWithCard(orderId, amount, customerId, data.paymentIntentId);
      onPaymentSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[VendorPaymentModal] Stripe post-payment error:', error);
    }
  };

  const formatAmount = useFormatCurrency();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('vendorPaymentModal.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Montant */}
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">{t('vendorPaymentModal.amountToPay')}</p>
            <p className="text-2xl font-bold text-primary">{formatAmount(amount)}</p>
          </div>

          {/* Sélection de la méthode de paiement */}
          <div className="space-y-2">
            <Label>{t('vendorPaymentModal.method')}</Label>
            <RadioGroup value={selectedMethod} onValueChange={(v) => setSelectedMethod(v as PaymentMethodType)}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                <RadioGroupItem value="wallet" id="wallet" />
                <Label htmlFor="wallet" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Wallet className="h-4 w-4" />
                  Wallet 224Solutions
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Banknote className="h-4 w-4" />
                  {t('vendorPaymentModal.cash')}
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                <RadioGroupItem value="mobile_money" id="mobile_money" />
                <Label htmlFor="mobile_money" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Smartphone className="h-4 w-4" />
                  Mobile Money
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="h-4 w-4" />
                  {t('vendorPaymentModal.card')}
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                <RadioGroupItem value="stripe" id="stripe" />
                <Label htmlFor="stripe" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="h-4 w-4" />
                  {t('vendorPaymentModal.cardStripe')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Champs conditionnels */}
          {selectedMethod === 'mobile_money' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="provider">{t('vendorPaymentModal.operator')}</Label>
                <Select value={mobileProvider} onValueChange={(v) => setMobileProvider(v as any)}>
                  <SelectTrigger id="provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orange">Orange Money</SelectItem>
                    <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                    <SelectItem value="moov">Moov Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('vendorPaymentModal.phone')}</Label>
                <Input
                  id="phone"
                  placeholder="622123456"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {selectedMethod === 'card' && (
            <div className="space-y-2">
              <Label htmlFor="cardToken">{t('vendorPaymentModal.cardToken')}</Label>
              <Input
                id="cardToken"
                placeholder="tok_xxxxxxxxxxxxx"
                value={cardToken}
                onChange={(e) => setCardToken(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
              />
              <p className="text-xs text-muted-foreground">
                {t('vendorPaymentModal.cardTokenHint')}
              </p>
            </div>
          )}

          {selectedMethod === 'stripe' && (
            <Suspense fallback={
              <div className="flex items-center justify-center p-4 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t('vendorPaymentModal.loadingStripe')}</span>
              </div>
            }>
              <StripeCheckoutButton
                amount={amount}
                currency="USD"
                description={`${t('vendorPaymentModal.orderPrefix')} ${orderId}`}
                orderId={orderId}
                onSuccess={handleStripeSuccess}
                onCancel={() => toast.info(t('vendorPaymentModal.paymentCancelled'))}
              />
            </Suspense>
          )}

          {selectedMethod === 'cash' && (
            <Alert>
              <AlertDescription>
                {t('vendorPaymentModal.cashInfo')}
              </AlertDescription>
            </Alert>
          )}

          {selectedMethod === 'wallet' && (
            <Alert>
              <AlertDescription>
                {t('vendorPaymentModal.walletInfo')}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions — masqué pour Stripe (géré par Elements) */}
          {selectedMethod !== 'stripe' && (
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onClose} disabled={isProcessing} className="flex-1">
                {t('vendorPaymentModal.cancel')}
              </Button>
              <Button onClick={handlePayment} disabled={isProcessing} className="flex-1">
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('vendorPaymentModal.processing')}
                  </>
                ) : (
                  t('vendorPaymentModal.confirm')
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * 💳 SÉLECTEUR DE PAIEMENT - MULTI-PROVIDERS
 * Stripe pour les cartes bancaires, ChapChapPay pour Mobile Money (Orange, MTN, PayCard)
 * Méthodes: Carte Bancaire (Stripe), Orange Money, MTN MoMo, PayCard (ChapChapPay)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Smartphone,
  CreditCard,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle,
  Wallet,
  Truck,
  Phone
} from 'lucide-react';
import { useChapChapPay } from '@/hooks/useChapChapPay';
import { CCPPaymentMethod } from '@/services/payment/ChapChapPayService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import StripeCheckoutButton from '@/components/payment/StripeCheckoutButton';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { formatCurrency } from '@/lib/formatters';
import { transferToWallet } from '@/services/walletBackendService';
import { WalletPinPromptDialog } from '@/components/wallet/WalletPinDialogs';
import { getFinalRate } from '@/services/exchangeService';

interface JomyPaymentSelectorProps {
  amount: number;
  currency?: string; // Devise du produit/vendeur (ex: XOF, EUR). Défaut: GNF
  orderId?: string;
  description?: string;
  transactionType?: 'product' | 'taxi' | 'delivery' | 'service' | 'transfer';
  productType?: 'physical' | 'digital';
  onPaymentSuccess: (transactionId: string, status: string) => void | Promise<void>;
  onPaymentPending?: (transactionId: string) => void;
  onPaymentFailed?: (error: string) => void;
  onCashOnDelivery?: (addressData?: any) => void;
  onCancel: () => void;
  enableEscrow?: boolean;
  recipientId?: string;
  sellerId?: string;
  cartItems?: Array<{ id: string; name?: string; price: number; quantity: number; vendorId?: string; vendor_id?: string }>;
}

type PaymentMethodId = 'CARD' | 'WALLET' | 'CASH_ON_DELIVERY' | 'CCP_ORANGE' | 'CCP_MTN' | 'CCP_PAYCARD';

interface PaymentMethodOption {
  id: PaymentMethodId;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  requiresPhone: boolean;
  phonePrefix?: string;
  phonePlaceholder?: string;
  provider?: 'chapchappay' | 'wallet' | 'stripe';
}

export function JomyPaymentSelector({
  amount,
  currency = 'GNF',
  orderId,
  description,
  transactionType = 'product',
  productType = 'physical',
  onPaymentSuccess,
  onPaymentPending,
  onPaymentFailed,
  onCashOnDelivery,
  onCancel,
  enableEscrow = true,
  recipientId,
  sellerId,
  cartItems,
}: JomyPaymentSelectorProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { initiatePullPayment, pollStatus, isLoading, error } = useChapChapPay();
  const _chapchapLoading = isLoading;

  const { convert, userCurrency, loading: _converterLoading } = usePriceConverter();

  const displayCurrency = currency.toUpperCase();
  const formattedAmount = formatCurrency(amount, displayCurrency);

  // Conversion si devise produit ≠ devise utilisateur
  const converted = useMemo(() => {
    if (!amount || displayCurrency === userCurrency.toUpperCase()) return null;
    return convert(amount, displayCurrency);
  }, [amount, displayCurrency, userCurrency, convert]);

  // FRAIS DE SERVICE acheteur (purchase_fee_percent, géré par le PDG). Affiché ICI et prélevé EN PLUS
  // par le backend (create_order_core). Uniquement pour les achats produit (pas les transferts P2P).
  const NO_DEC_CUR = useMemo(() => new Set(['GNF', 'XOF', 'XAF', 'JPY', 'KRW', 'VND', 'CLP']), []);
  const [feePercent, setFeePercent] = useState(0);
  useEffect(() => {
    if (transactionType === 'transfer') { setFeePercent(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('system_settings')
          .select('setting_value').eq('setting_key', 'purchase_fee_percent').maybeSingle();
        if (!cancelled) setFeePercent(Math.max(0, Math.min(50, Number(data?.setting_value ?? 0))));
      } catch { if (!cancelled) setFeePercent(0); }
    })();
    return () => { cancelled = true; };
  }, [transactionType]);

  const serviceFee = useMemo(() => {
    const raw = amount * (feePercent / 100);
    return NO_DEC_CUR.has(displayCurrency) ? Math.round(raw) : Math.round(raw * 100) / 100;
  }, [amount, feePercent, displayCurrency, NO_DEC_CUR]);
  const grandTotal = amount + serviceFee;

  // Format dans la devise utilisateur (null si même devise que le produit → on n'affiche que l'original).
  const inUserCur = useCallback((amt: number) => {
    if (displayCurrency === userCurrency.toUpperCase()) return null;
    return convert(amt, displayCurrency).formatted;
  }, [convert, displayCurrency, userCurrency]);
  const inProductCur = useCallback((amt: number) => formatCurrency(amt, displayCurrency), [displayCurrency]);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>((recipientId || enableEscrow) ? 'WALLET' : 'CARD');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'polling' | 'success' | 'failed'>('idle');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletCurrency, setWalletCurrency] = useState<string>('GNF');
  const [amountInWalletCurrency, setAmountInWalletCurrency] = useState<number | null>(null);
  const [showStripeInline, setShowStripeInline] = useState(false);
  const [walletPinPromptOpen, setWalletPinPromptOpen] = useState(false);
  const [walletPinLoading, setWalletPinLoading] = useState(false);
  const [walletPinError, setWalletPinError] = useState<string | null>(null);

  // Reset error state when switching payment methods
  const handleMethodChange = (value: string) => {
    setSelectedMethod(value as PaymentMethodId);
    setPaymentStatus('idle');
    setShowStripeInline(false);
  };

  // État pour adresse de livraison (COD)
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '',
    neighborhood: '',
    city: 'Conakry',
    landmark: '',
    instructions: ''
  });

  // Charger le solde wallet et calculer la conversion si devise produit ≠ devise wallet
  useEffect(() => {
    const loadWalletBalance = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('wallets')
          .select('balance, currency')
          .eq('user_id', user.id)
          .single();
        if (data) {
          setWalletBalance(data.balance);
          const wCur = data.currency || 'GNF';
          setWalletCurrency(wCur);

          if (displayCurrency === wCur) {
            setAmountInWalletCurrency(amount);
          } else {
            const rate = await getFinalRate(displayCurrency, wCur);
            setAmountInWalletCurrency(rate ? Math.round(amount * rate) : null);
          }
        }
      } catch (err) {
        console.error('Error loading wallet balance:', err);
      }
    };
    loadWalletBalance();
  }, [user?.id, amount, displayCurrency]);

  // Méthodes de paiement disponibles
  const paymentMethods: PaymentMethodOption[] = [
    // Option Wallet : toujours visible en mode marketplace (enableEscrow=true) ou transfert P2P (recipientId fourni)
    ...((recipientId || enableEscrow) ? [{
      id: 'WALLET' as const,
      name: 'Wallet 224Solutions',
      description: `Solde: ${walletBalance !== null ? formatCurrency(walletBalance, walletCurrency) : '...'}`,
      icon: <Wallet className="h-5 w-5 text-[#ff4000]" />,
      iconBg: 'bg-orange-100',
      requiresPhone: false,
      provider: 'wallet' as const
    }] : []),
    {
      id: 'CARD' as const,
      name: 'Carte Bancaire',
      description: 'Paiement sécurisé par carte VISA / Mastercard via Stripe',
      icon: <CreditCard className="h-5 w-5 text-blue-600" />,
      iconBg: 'bg-blue-100',
      requiresPhone: false,
      provider: 'stripe' as const
    },
    // ChapChapPay - Orange Money (prioritaire)
    {
      id: 'CCP_ORANGE' as const,
      name: 'Orange Money',
      description: 'Paiement instantané via ChapChapPay',
      icon: <Smartphone className="h-5 w-5 text-orange-500" />,
      iconBg: 'bg-orange-100',
      requiresPhone: true,
      phonePrefix: '620',
      phonePlaceholder: '620 XX XX XX',
      provider: 'chapchappay' as const
    },
    // ChapChapPay - MTN MoMo
    {
      id: 'CCP_MTN' as const,
      name: 'MTN Mobile Money',
      description: 'Paiement via MTN MoMo (ChapChapPay)',
      icon: <Smartphone className="h-5 w-5 text-[#ff4000]" />,
      iconBg: 'bg-orange-100',
      requiresPhone: true,
      phonePrefix: '660',
      phonePlaceholder: '660 XX XX XX',
      provider: 'chapchappay' as const
    },
    // Paiement à la livraison - uniquement pour produits physiques
    ...(productType === 'physical' && transactionType === 'product' && onCashOnDelivery ? [{
      id: 'CASH_ON_DELIVERY' as const,
      name: 'Paiement à la livraison',
      description: 'Vous serez contacté pour confirmer l\'adresse de livraison',
      icon: <Truck className="h-5 w-5 text-[#ff4000]" />,
      iconBg: 'bg-orange-100',
      requiresPhone: false,
      provider: undefined
    }] : [])
  ];

  const selectedOption = paymentMethods.find(m => m.id === selectedMethod);
  const requiresPhone = selectedOption?.requiresPhone || false;

  const handlePayment = async () => {
    console.log('🔵 [JomyPaymentSelector] handlePayment called');
    console.log('🔵 [JomyPaymentSelector] selectedMethod:', selectedMethod);

    if (!user) {
      toast.error(t('jomyPaymentSelector.vousDevezEtreConnectePour'));
      return;
    }

    // Paiement à la livraison
    if (selectedMethod === 'CASH_ON_DELIVERY') {
      // Valider les informations minimales pour rappeler le client.
      if (!deliveryAddress.street.trim()) {
        toast.error(t('jomyPaymentSelector.numeroRequis'), {
          description: 'Veuillez entrer le numéro à contacter'
        });
        return;
      }

      if (!deliveryAddress.city) {
        toast.error('Ville requise', {
          description: 'Veuillez sélectionner votre ville'
        });
        return;
      }

      if (onCashOnDelivery) {
        onCashOnDelivery({
          ...deliveryAddress,
          phone: deliveryAddress.street,
          address: 'Adresse à confirmer par téléphone',
        } as any);
      }
      return;
    }

    // Paiement par Carte Bancaire (Stripe)
    if (selectedMethod === 'CARD') {
      console.log('🔵 [JomyPaymentSelector] Showing Stripe inline');
      setShowStripeInline(true);
      return;
    }

    // Paiement par Wallet
    if (selectedMethod === 'WALLET') {
      await executeWalletTransfer();
      return;
    }

    // ChapChapPay - Orange Money, MTN MoMo, PayCard
    const isChapChapPayMethod = selectedMethod === 'CCP_ORANGE' || selectedMethod === 'CCP_MTN' || selectedMethod === 'CCP_PAYCARD';

    if (isChapChapPayMethod) {
      if (requiresPhone && (!phoneNumber || phoneNumber.length < 9)) {
        toast.error(t('jomyPaymentSelector.numeroDeTelephoneInvalide'));
        return;
      }

      setProcessing(true);
      setPaymentStatus('processing');

      try {
        // Mapper vers les méthodes ChapChapPay
        const ccpMethodMap: Record<string, CCPPaymentMethod> = {
          'CCP_ORANGE': 'orange_money',
          'CCP_MTN': 'mtn_momo',
          'CCP_PAYCARD': 'paycard'
        };

        const result = await initiatePullPayment({
          amount,
          currency: 'XOF',
          paymentMethod: ccpMethodMap[selectedMethod],
          customerPhone: phoneNumber,
          description: description || `Paiement ${transactionType}`,
          orderId: orderId || `${transactionType}-${Date.now()}`
        });

        if (!result.success) {
          throw new Error(result.error || 'Échec du paiement');
        }

        // Polling pour vérifier le statut ChapChapPay
        if (result.transactionId) {
          setPaymentStatus('polling');

          const finalStatus = await pollStatus(result.transactionId, (status) => {
            if (status.status === 'completed') {
              setPaymentStatus('success');
              toast.success(t('jomyPaymentSelector.paiementReussiViaChapchappay'));
              onPaymentSuccess(result.transactionId!, 'SUCCESS_MOBILE_MONEY');
            } else if (status.status === 'failed' || status.status === 'cancelled') {
              setPaymentStatus('failed');
              toast.error(t('jomyPaymentSelector.paiementEchoue'));
              onPaymentFailed?.(status.error || 'Paiement refusé');
            }
          });

          if (finalStatus) {
            if (finalStatus.status === 'completed') {
              setPaymentStatus('success');
              onPaymentSuccess(result.transactionId, 'SUCCESS_MOBILE_MONEY');
            } else if (finalStatus.status === 'pending') {
              onPaymentPending?.(result.transactionId);
              toast.info(t('jomyPaymentSelector.paiementEnAttenteDeConfirmation'));
            } else {
              setPaymentStatus('failed');
              onPaymentFailed?.(finalStatus.error || 'Paiement échoué');
            }
          }
        }
      } catch (err) {
        console.error('[ChapChapPay] Payment error:', err);
        setPaymentStatus('failed');
        toast.error(err instanceof Error ? err.message : 'Erreur de paiement');
        onPaymentFailed?.(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setProcessing(false);
      }
      return;
    }

    // Ce bloc n'est plus utilisé - ChapChapPay gère tous les paiements Mobile Money
    toast.error(t('jomyPaymentSelector.methodeDePaiementNonSupportee'));
    setProcessing(false);
  };

  const isWalletPinRequiredError = (message?: string) => /code pin requis/i.test(message || '');

  const executeWalletTransfer = async (pin?: string) => {
    // Comparer les montants dans la même devise (celle du wallet acheteur)
    const neededInWalletCur = amountInWalletCurrency ?? amount;
    if (walletBalance !== null && walletBalance < neededInWalletCur) {
      const neededStr = formatCurrency(neededInWalletCur, walletCurrency);
      const availableStr = formatCurrency(walletBalance, walletCurrency);
      toast.error(`Solde insuffisant — ${neededStr} requis, ${availableStr} disponible`);
      return false;
    }

    // ─── Mode Escrow Marketplace ─────────────────────────────────────────────
    // Quand enableEscrow=true (achat marketplace), on NE fait PAS de transfert P2P.
    // C'est create_order_core qui débite le wallet de l'acheteur de façon atomique
    // et place les fonds en escrow. Cela évite le problème "Destinataire introuvable"
    // lorsque le vendeur n'a pas de user_id configuré.
    if (enableEscrow && transactionType !== 'transfer') {
      setProcessing(true);
      setPaymentStatus('processing');
      try {
        await onPaymentSuccess('', 'SUCCESS_WALLET_ESCROW');
        setPaymentStatus('success');
        return true;
      } catch (err) {
        setPaymentStatus('failed');
        const message = err instanceof Error ? err.message : 'Erreur lors de la création de la commande';
        toast.error(message);
        return false;
      } finally {
        setProcessing(false);
      }
    }

    // ─── Mode Transfert P2P standard ─────────────────────────────────────────
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const transferTarget = (sellerId && uuidRegex.test(sellerId)) ? sellerId : recipientId;

    if (!transferTarget) {
      toast.error(t('jomyPaymentSelector.idDuDestinataireRequis'));
      return false;
    }

    setProcessing(true);
    setPaymentStatus('processing');

    try {
      const result = await transferToWallet(
        transferTarget,
        amount,
        description || 'Transfert',
        pin
      );

      if (!result.success) {
        const errorMessage = result.error || 'Échec du transfert';
        if (!pin && isWalletPinRequiredError(errorMessage)) {
          setWalletPinError(null);
          setWalletPinPromptOpen(true);
          return false;
        }
        throw new Error(errorMessage);
      }

      setPaymentStatus('success');
      toast.success(t('jomyPaymentSelector.transfertReussi'));
      onPaymentSuccess(result.transaction_id || '', 'SUCCESS_WALLET');
      return true;
    } catch (err) {
      console.error('[Wallet] Transfer error:', err);
      setPaymentStatus('failed');
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(errorMessage);
      onPaymentFailed?.(errorMessage);
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleStripeSuccess = (data: { paymentIntentId: string; amount: number; currency: string }) => {
    console.log('✅ [JomyPaymentSelector] Stripe payment success:', data);
    setShowStripeInline(false);
    setPaymentStatus('success');
    onPaymentSuccess(data.paymentIntentId, 'SUCCESS_CARD');
  };

  const handleStripeError = (errorMsg: string) => {
    console.error('❌ [JomyPaymentSelector] Stripe payment error:', errorMsg);
    setShowStripeInline(false);
    setPaymentStatus('failed');
    onPaymentFailed?.(errorMsg);
  };

  const isConfirmDisabled =
    processing ||
    isLoading ||
    (requiresPhone && (!phoneNumber || phoneNumber.length < 9));

  // Affichage succès
  if (paymentStatus === 'success') {
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-16 w-16 text-[#ff4000] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#ff4000] mb-2">{t('jomyPaymentSelector.paiementReussi')}</h3>
          <p className="text-muted-foreground mb-4">
            Votre paiement de {formattedAmount} a été effectué avec succès.
          </p>
          <Button onClick={() => onPaymentSuccess('', 'SUCCESS')} className="w-full">
            Continuer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Paiement sécurisé
          </CardTitle>
          <div className="mt-2">
            {transactionType === 'transfer' || feePercent <= 0 ? (
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{inUserCur(grandTotal) ?? inProductCur(grandTotal)}</p>
                <p className="text-sm text-muted-foreground">{t('jomyPaymentSelector.montantAPayer')}</p>
                {inUserCur(grandTotal) && <p className="text-sm text-muted-foreground mt-1">({inProductCur(grandTotal)})</p>}
              </div>
            ) : (
              <div className="text-left bg-muted/40 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between items-start text-sm">
                  <span className="text-muted-foreground">{t('jomyPaymentSelector.sousTotalProduits')}</span>
                  <span className="text-right">
                    <span className="font-medium">{inUserCur(amount) ?? inProductCur(amount)}</span>
                    {inUserCur(amount) && <span className="block text-xs text-muted-foreground">({inProductCur(amount)})</span>}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Frais de service ({feePercent}%)</span>
                  <span className="font-medium">+{inUserCur(serviceFee) ?? inProductCur(serviceFee)}</span>
                </div>
                <div className="flex justify-between items-start border-t pt-1.5 font-bold">
                  <span>{t('jomyPaymentSelector.totalAPayer')}</span>
                  <span className="text-right text-primary">
                    <span>{inUserCur(grandTotal) ?? inProductCur(grandTotal)}</span>
                    {inUserCur(grandTotal) && <span className="block text-xs font-normal text-muted-foreground">({inProductCur(grandTotal)})</span>}
                  </span>
                </div>
              </div>
            )}

            {enableEscrow && transactionType !== 'transfer' && (
              <Alert className="mt-3">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Vos fonds sont protégés par notre système Escrow jusqu'à la confirmation de la livraison
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Erreur — only show ChapChapPay error when a ChapChapPay method is selected */}
          {paymentStatus === 'failed' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(selectedMethod.startsWith('CCP_') && error) ? error : 'Paiement échoué. Veuillez réessayer.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Méthodes de paiement */}
          <RadioGroup
            value={selectedMethod}
            onValueChange={handleMethodChange}
            className="space-y-2"
            disabled={processing}
          >
            {paymentMethods.map((method) => (
              <div key={method.id}>
                <Label
                  htmlFor={method.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    selectedMethod === method.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/50 ring-offset-0"
                      : "border-border hover:border-primary/50 hover:bg-muted/30",
                    processing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem
                    value={method.id}
                    id={method.id}
                    disabled={processing}
                    className="border-2 flex-shrink-0 focus-visible:ring-1 focus-visible:ring-offset-0"
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

          {/* Champ téléphone pour Mobile Money */}
          {requiresPhone && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border animate-in slide-in-from-top-2">
              <Label htmlFor="phone-number" className="flex items-center gap-2 text-sm">
                <Smartphone className="h-4 w-4" />
                Numéro {selectedOption?.name}
              </Label>
              <Input
                id="phone-number"
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

          {/* Formulaire téléphone et ville pour COD */}
          {selectedMethod === 'CASH_ON_DELIVERY' && (
            <div className="space-y-3 p-4 bg-orange-50 border border-orange-200 rounded-lg animate-in slide-in-from-top-2">
              <h4 className="font-semibold text-[#ff4000] flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                Informations de contact
              </h4>

              <div className="space-y-2">
                <Label htmlFor="cod-phone" className="text-sm">
                  Numéro à contacter <span className="text-[#ff4000]">*</span>
                </Label>
                <Input
                  id="cod-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="Ex: 620 00 00 00"
                  value={deliveryAddress.street}
                  onChange={(e) => setDeliveryAddress({...deliveryAddress, street: e.target.value})}
                  className="bg-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cod-city" className="text-sm">
                  Ville <span className="text-[#ff4000]">*</span>
                </Label>
                <Input
                  id="cod-city"
                  placeholder="Ex: Conakry, Kindia, Dakar..."
                  value={deliveryAddress.city}
                  onChange={(e) => setDeliveryAddress({...deliveryAddress, city: e.target.value})}
                  className="bg-white"
                  required
                />
              </div>

              <Alert className="bg-orange-50 border-orange-200 mt-2">
                <Truck className="h-4 w-4 text-[#ff4000]" />
                <AlertDescription className="text-[#ff4000]">
                  <strong>{t('jomyPaymentSelector.paiementALaLivraisonConfirme')}</strong><br/>
                  Vous serez contacté par téléphone pour confirmer votre adresse exacte avant la livraison.
                  Préparez {formattedAmount} en espèces.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Info statut */}
          {paymentStatus === 'polling' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                En attente de confirmation du paiement...
              </AlertDescription>
            </Alert>
          )}

          {/* Stripe inline — formulaire carte affiché directement */}
          {showStripeInline && selectedMethod === 'CARD' ? (
            <div className="pt-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">{t('jomyPaymentSelector.saisissezVosInformationsDeCarte')}</span>
              </div>
              <StripeCheckoutButton
                amount={amount}
                currency={displayCurrency}
                description={description || 'Paiement 224Solutions'}
                orderId={orderId}
                sellerId={sellerId || recipientId}
                edgeFunction={
                  transactionType === 'taxi' ? 'taxi-payment' :
                  transactionType === 'delivery' ? 'delivery-payment' :
                  transactionType === 'service' ? 'service-payment' :
                  transactionType === 'product' ? 'marketplace-escrow-payment' :
                  undefined
                }
                extraParams={transactionType === 'product' && cartItems && cartItems.length > 0 ? { cartItems } : undefined}
                onSuccess={handleStripeSuccess}
                onCancel={() => setShowStripeInline(false)}
                onError={handleStripeError}
              />
              <Button
                variant="outline"
                onClick={() => setShowStripeInline(false)}
                className="w-full"
              >
                Retour
              </Button>
            </div>
          ) : (
            /* Boutons standard */
            <div className="pt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
                disabled={processing}
              >
                Annuler
              </Button>
              <Button
                onClick={handlePayment}
                disabled={isConfirmDisabled}
                className="flex-1"
              >
                {processing || isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  'Payer maintenant'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <WalletPinPromptDialog
        open={walletPinPromptOpen}
        onOpenChange={(value) => {
          setWalletPinPromptOpen(value);
          if (!value) {
            setWalletPinError(null);
          }
        }}
        loading={walletPinLoading}
        error={walletPinError}
        onConfirm={async (pin) => {
          try {
            setWalletPinLoading(true);
            setWalletPinError(null);
            const success = await executeWalletTransfer(pin);
            if (success) {
              setWalletPinPromptOpen(false);
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Code PIN invalide';
            setWalletPinError(errorMessage);
          } finally {
            setWalletPinLoading(false);
          }
        }}
      />
    </>
  );
}

export default JomyPaymentSelector;

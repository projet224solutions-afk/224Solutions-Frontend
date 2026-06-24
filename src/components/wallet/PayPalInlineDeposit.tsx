/**
 * PayPal Inline Deposit Component
 * Renders PayPal + Card buttons directly in the wallet
 * Supports: PayPal balance, Visa, Mastercard, Amex
 * 224SOLUTIONS
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PayPalScriptProvider, PayPalButtons, FUNDING } from '@paypal/react-paypal-js';
import { supabase } from '@/integrations/supabase/client';
import { signedInvoke } from '@/lib/security/hmacSigner';
import { backendConfig } from '@/config/backend';
import { toast } from 'sonner';
import { Loader2, Shield, CreditCard, Wallet } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getSortedCurrencies, getCurrencyByCode } from '@/data/currencies';
import { useTranslation } from "@/hooks/useTranslation";

const PAYPAL_NATIVE_CODES = new Set([
  'USD','EUR','GBP','CAD','AUD','JPY','CHF','SEK','NOK','DKK','PLN',
  'BRL','MXN','SGD','HKD','NZD','CZK','HUF','ILS','MYR','PHP','THB','TWD','RUB','TRY',
]);

interface PayPalInlineDepositProps {
  onSuccess: () => void;
  onClose?: () => void;
}

const QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500];

export default function PayPalInlineDeposit({ onSuccess, onClose }: PayPalInlineDepositProps) {
  const { t } = useTranslation();
  const { currency: userCurrency } = useCurrency();
  const allCurrencies = getSortedCurrencies().filter(c => PAYPAL_NATIVE_CODES.has(c.code));
  const defaultCurrency = PAYPAL_NATIVE_CODES.has(userCurrency) ? userCurrency : 'USD';
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrency);
  const currencyInfo = getCurrencyByCode(selectedCurrency);
  const symbol = currencyInfo?.symbol || selectedCurrency;
  const [amount, setAmount] = useState('');
  const [showPayPal, setShowPayPal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [feeRate, setFeeRate] = useState(0.02);
  const [paymentTab, setPaymentTab] = useState<'paypal' | 'card'>('paypal');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Fetch PayPal client ID and deposit fee in parallel
    Promise.all([
      fetch(`${backendConfig.baseUrl}/edge-functions/paypal-client-id`).then((response) => response.json()),
      supabase.from('pdg_settings').select('setting_value').eq('setting_key', 'deposit_fee_percentage').maybeSingle(),
    ]).then(([clientRes, feeRes]) => {
      if (!mountedRef.current) return;
      const clientIdValue = clientRes?.clientId || clientRes?.client_id;
      if (clientIdValue) setClientId(clientIdValue);
      const val = (feeRes.data?.setting_value as any)?.value;
      if (val != null) setFeeRate(Number(val) / 100);
    });

    return () => { mountedRef.current = false; };
  }, []);

  const numAmount = parseFloat(amount);
  const isValidAmount = numAmount >= 5;
  const fee = isValidAmount ? Math.round(numAmount * feeRate * 100) / 100 : 0;
  const netAmount = isValidAmount ? Math.round((numAmount - fee) * 100) / 100 : 0;

  const handleAmountConfirm = () => {
    if (!isValidAmount) {
      toast.error(`Montant minimum: 5 ${selectedCurrency}`);
      return;
    }
    setShowPayPal(true);
  };

  const createOrder = useCallback(async () => {
    const successUrl = new URL(window.location.href);
    successUrl.searchParams.set('paypal_result', 'success');
    const cancelUrl = new URL(window.location.href);
    cancelUrl.searchParams.set('paypal_result', 'cancel');

    const { data, error } = await signedInvoke('paypal-deposit', {
      amount: numAmount,
      currency: selectedCurrency,
      userCurrency: selectedCurrency,
      action: 'create',
      returnUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Erreur création ordre PayPal');
    return data.orderId;
  }, [numAmount, selectedCurrency]);

  const onApprove = useCallback(async (data: any) => {
    if (!mountedRef.current) return;
    setProcessing(true);
    try {
      const { data: captureData, error } = await signedInvoke('paypal-deposit', {
        action: 'capture', orderId: data.orderID
      });
      if (error) throw new Error(error.message);
      if (!captureData?.success) throw new Error(captureData?.error || 'Capture échouée');

      toast.success(t('payPalInlineDeposit.depotReussi'), {
        description: `${captureData.netAmount?.toFixed(2)} ${selectedCurrency} crédités sur votre wallet`,
      });
      window.dispatchEvent(new Event('wallet-updated'));
      onSuccess();
    } catch (err) {
      console.error('[PayPal] capture error:', err);
      toast.error(err instanceof Error ? err.message: t('payPalInlineDeposit.erreurDeCapture'));
    } finally {
      if (mountedRef.current) setProcessing(false);
    }
  }, [onSuccess, selectedCurrency]);

  // Amount input form
  if (!showPayPal) {
    return (
      <div className="space-y-4">
        {/* Sélecteur de devise */}
        <div className="space-y-2">
          <Label>Devise de dépôt {currencyInfo?.flag && <span>{currencyInfo.flag}</span>}</Label>
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger>
              <SelectValue placeholder={t('payPalInlineDeposit.choisirUneDevise')}>
                {currencyInfo && (
                  <span className="flex items-center gap-1.5">
                    {currencyInfo.flag && <span>{currencyInfo.flag}</span>}
                    <span>{currencyInfo.code} - {currencyInfo.name}</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              onPointerDownOutside={(e) => e.stopPropagation()}
            >
              <ScrollArea className="h-[300px]">
                {allCurrencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="flex items-center gap-2">
                      {c.flag && <span>{c.flag}</span>}
                      <span className="font-medium">{c.code}</span>
                      <span className="text-muted-foreground text-xs truncate">{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </ScrollArea>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Montants rapides ({selectedCurrency})</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <Button
                key={amt}
                variant={amount === amt.toString() ? "default" : "outline"}
                size="sm"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAmount(amt.toString()); }}
                type="button"
                className="text-xs"
              >
                {symbol}{amt}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="paypal-card-amount">Montant personnalisé ({selectedCurrency})</Label>
          <Input
            id="paypal-card-amount"
            type="number"
            inputMode="decimal"
            placeholder="Ex: 50"
            min="5"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onFocus={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-xs text-muted-foreground mt-1">Minimum: {symbol}5 {selectedCurrency} · Frais: {(feeRate * 100).toFixed(1)}%</p>
        </div>

        {isValidAmount && (
          <div className="p-3 rounded-lg bg-muted space-y-1">
            <div className="flex justify-between text-sm">
              <span>{t('payPalInlineDeposit.montant')}</span>
              <span className="font-medium">{symbol}{numAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Frais ({(feeRate * 100).toFixed(1)}%)</span>
              <span>-{symbol}{fee.toFixed(2)}</span>
            </div>
            <div className="border-t pt-1 flex justify-between text-sm font-bold">
              <span>{t('payPalInlineDeposit.credite')}</span>
              <span className="text-primary">{symbol}{netAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
          <Shield className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground">{t('payPalInlineDeposit.paiementSecuriseViaPaypalVisa')}</p>
        </div>

        <Button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAmountConfirm(); }}
          disabled={!isValidAmount}
          className="w-full"
          type="button"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Continuer — {symbol}{isValidAmount ? numAmount.toFixed(2) : '0.00'}
        </Button>
      </div>
    );
  }

  // PayPal buttons view
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-muted text-center">
        <p className="text-sm font-medium">{t('payPalInlineDeposit.montant2')} <span className="text-primary">{symbol}{numAmount.toFixed(2)} {selectedCurrency}</span></p>
        <p className="text-xs text-muted-foreground">Crédité après frais: {symbol}{netAmount.toFixed(2)}</p>
      </div>

      {processing && (
        <div className="flex items-center justify-center gap-2 p-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">{t('payPalInlineDeposit.traitementDuPaiement')}</span>
        </div>
      )}

      {!clientId ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm ml-2">Chargement PayPal...</span>
        </div>
      ) : (
        <PayPalScriptProvider
          options={{
            clientId,
            currency: selectedCurrency,
            intent: 'capture',
            components: 'buttons',
          }}
        >
          <Tabs value={paymentTab} onValueChange={(v) => setPaymentTab(v as 'paypal' | 'card')}>
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="paypal" className="gap-1.5 text-xs">
                <Wallet className="w-3.5 h-3.5" />
                Solde PayPal
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-1.5 text-xs">
                <CreditCard className="w-3.5 h-3.5" />
                Carte bancaire
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paypal">
              <PayPalButtons
                style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 45 }}
                fundingSource={FUNDING.PAYPAL}
                createOrder={async () => {
                  try { return await createOrder(); }
                  catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); throw err; }
                }}
                onApprove={async (data) => { await onApprove(data); }}
                onError={(err: any) => {
                  console.error('[PayPal] SDK error:', err);
                  toast.error(t('payPalInlineDeposit.erreurPaypalVeuillezReessayer'));
                }}
                onCancel={() => toast.info(t('payPalInlineDeposit.paiementAnnule'))}
              />
            </TabsContent>

            <TabsContent value="card">
              <PayPalButtons
                style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 45 }}
                fundingSource={FUNDING.CARD}
                createOrder={async () => {
                  try { return await createOrder(); }
                  catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); throw err; }
                }}
                onApprove={async (data) => { await onApprove(data); }}
                onError={(err: any) => {
                  console.error('[PayPal Card] SDK error:', err);
                  toast.error(t('payPalInlineDeposit.erreurPaiementCarteVeuillezReessayer'));
                }}
                onCancel={() => toast.info(t('payPalInlineDeposit.paiementAnnule'))}
              />
              <div className="flex items-center gap-2 mt-3 justify-center">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('payPalInlineDeposit.visaMastercardAmexSansCompte')}</p>
              </div>
            </TabsContent>
          </Tabs>
        </PayPalScriptProvider>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPayPal(false); }}
      >
        ← Modifier le montant
      </Button>
    </div>
  );
}

/**
 * PayPal Checkout Button - Pour paiement de produits/services
 * Supporte: Solde PayPal + Carte bancaire (Visa, Mastercard, Amex)
 * 224SOLUTIONS
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { PayPalScriptProvider, PayPalButtons, FUNDING } from '@paypal/react-paypal-js';
import { signedInvoke, generateIdempotencyKey } from '@/lib/security/hmacSigner';
import { backendConfig } from '@/config/backend';
import { toast } from 'sonner';
import { Loader2, Shield, CreditCard, Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  'AUD', 'BRL', 'CAD', 'CNY', 'CZK', 'DKK', 'EUR', 'HKD', 'HUF', 'ILS',
  'JPY', 'MYR', 'MXN', 'TWD', 'NZD', 'NOK', 'PHP', 'PLN', 'GBP', 'SGD',
  'SEK', 'CHF', 'THB', 'USD', 'RUB',
]);

interface PayPalCheckoutButtonProps {
  amount: number;
  currency?: string;
  description?: string;
  orderId?: string;
  onSuccess: (captureData: {
    paypalOrderId: string;
    captureId: string;
    amount: number;
    currency: string;
  }) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
  /** If true, credit wallet instead of just returning capture data */
  creditWallet?: boolean;
  /** If true, show only card payment (no PayPal balance tab) */
  cardOnly?: boolean;
  disabled?: boolean;
}

export default function PayPalCheckoutButton({
  amount,
  currency = 'USD',
  description = 'Achat 224Solutions',
  orderId,
  onSuccess,
  onCancel,
  onError,
  creditWallet = false,
  cardOnly = false,
  disabled = false,
}: PayPalCheckoutButtonProps) {
  const { t } = useTranslation();
  const [clientId, setClientId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'paypal' | 'card'>('paypal');
  const mountedRef = useRef(true);

  // Use a PayPal-supported currency for the SDK; the edge function handles conversion
  const sdkCurrency = useMemo(() => {
    const upper = currency.toUpperCase();
    if (PAYPAL_SUPPORTED_CURRENCIES.has(upper)) return upper;
    return 'USD';
  }, [currency]);

  useEffect(() => {
    mountedRef.current = true;
    fetch(`${backendConfig.baseUrl}/edge-functions/paypal-client-id`)
      .then((response) => response.json())
      .then((data) => {
        if (!mountedRef.current) return;
        const clientIdValue = data?.clientId || data?.client_id;
        if (clientIdValue) setClientId(clientIdValue);
      })
      .catch((error) => {
        console.error('[PayPal Checkout] client id error:', error);
      });
    return () => { mountedRef.current = false; };
  }, []);

  const createOrder = useCallback(async () => {
    const _action = creditWallet ? 'create' : 'create';
    const successUrl = new URL(window.location.href);
    successUrl.searchParams.set('paypal_result', 'success');
    const cancelUrl = new URL(window.location.href);
    cancelUrl.searchParams.set('paypal_result', 'cancel');

    const idempotencyKey = generateIdempotencyKey('payment');
    const { data, error } = await signedInvoke('paypal-deposit', {
      amount,
      currency,
      action: 'create',
      returnUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    }, { idempotencyKey });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Erreur PayPal');
    return data.orderId;
  }, [amount, currency, creditWallet]);

  const handleApprove = useCallback(async (data: any) => {
    if (!mountedRef.current) return;
    setProcessing(true);
    try {
      const { data: captureData, error } = await signedInvoke('paypal-deposit', {
        action: 'capture', orderId: data.orderID
      });

      if (error) throw new Error(error.message);
      if (!captureData?.success) throw new Error(captureData?.error || 'Capture échouée');

      toast.success(t('payPalCheckoutButton.paiementReussi'));

      if (creditWallet) {
        window.dispatchEvent(new Event('wallet-updated'));
      }

      onSuccess({
        paypalOrderId: data.orderID,
        captureId: captureData.captureId || data.orderID,
        amount: captureData.capturedAmount || amount,
        currency: captureData.paypalCurrency || currency,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de paiement';
      console.error('[PayPal Checkout] capture error:', err);
      toast.error(msg);
      onError?.(msg);
    } finally {
      if (mountedRef.current) setProcessing(false);
    }
  }, [amount, currency, creditWallet, onSuccess, onError]);

  if (disabled) {
    return (
      <div className="opacity-50 pointer-events-none p-4 text-center text-sm text-muted-foreground">
        Paiement PayPal non disponible
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="flex items-center justify-center p-4 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Chargement PayPal...</span>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="flex items-center justify-center gap-2 p-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm">{t('payPalCheckoutButton.traitementDuPaiement')}</span>
      </div>
    );
  }

  return (
    <PayPalScriptProvider
      key={sdkCurrency}
      options={{
        clientId,
        currency: sdkCurrency,
        intent: 'capture',
        components: 'buttons',
      }}
    >
      <div className="space-y-3">
        {cardOnly ? (
          /* Mode carte uniquement — pas d'onglets */
          <PayPalButtons
            style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 45 }}
            fundingSource={FUNDING.CARD}
            createOrder={async () => {
              try { return await createOrder(); }
              catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); throw err; }
            }}
            onApprove={async (data) => { await handleApprove(data); }}
            onError={(err: any) => {
              console.error('[PayPal Card] error:', err);
              toast.error(t('payPalCheckoutButton.erreurPaiementCarteVeuillezReessayer'));
              onError?.('Erreur carte');
            }}
            onCancel={() => { toast.info(t('payPalCheckoutButton.paiementAnnule')); onCancel?.(); }}
          />
        ) : (
          /* Mode complet avec onglets PayPal + Carte */
          <Tabs value={paymentTab} onValueChange={(v) => setPaymentTab(v as 'paypal' | 'card')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paypal" className="gap-1.5 text-xs">
                <Wallet className="w-3.5 h-3.5" />
                PayPal
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-1.5 text-xs">
                <CreditCard className="w-3.5 h-3.5" />
                Carte bancaire
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paypal" className="mt-3">
              <PayPalButtons
                style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 45 }}
                fundingSource={FUNDING.PAYPAL}
                createOrder={async () => {
                  try { return await createOrder(); }
                  catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); throw err; }
                }}
                onApprove={async (data) => { await handleApprove(data); }}
                onError={(err: any) => {
                  console.error('[PayPal Checkout] error:', err);
                  toast.error(t('payPalCheckoutButton.erreurPaypalVeuillezReessayer'));
                  onError?.('Erreur PayPal');
                }}
                onCancel={() => { toast.info(t('payPalCheckoutButton.paiementAnnule')); onCancel?.(); }}
              />
            </TabsContent>

            <TabsContent value="card" className="mt-3">
              <PayPalButtons
                style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 45 }}
                fundingSource={FUNDING.CARD}
                createOrder={async () => {
                  try { return await createOrder(); }
                  catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); throw err; }
                }}
                onApprove={async (data) => { await handleApprove(data); }}
                onError={(err: any) => {
                  console.error('[PayPal Card Checkout] error:', err);
                  toast.error(t('payPalCheckoutButton.erreurPaiementCarteVeuillezReessayer'));
                  onError?.('Erreur carte');
                }}
                onCancel={() => { toast.info(t('payPalCheckoutButton.paiementAnnule')); onCancel?.(); }}
              />
            </TabsContent>
          </Tabs>
        )}

        <div className="flex items-center gap-2 justify-center">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{t('payPalCheckoutButton.paiementSecuriseVerifieCoteServeur')}</p>
        </div>
      </div>
    </PayPalScriptProvider>
  );
}

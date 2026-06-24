/**
 * WRAPPER PAIEMENT PAYPAL 224SOLUTIONS
 * Paiement via compte PayPal (PAS pour carte bancaire - utiliser StripePaymentWrapper)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { PayPalButtons, PayPalScriptProvider, FUNDING } from '@paypal/react-paypal-js';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle2, CreditCard, Loader2, Lock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePriceConverter } from '@/hooks/usePriceConverter';

interface Custom224PaymentWrapperProps {
  amount: number;
  currency?: string;
  sellerName: string;
  sellerId: string;
  orderDescription?: string;
  metadata?: Record<string, string>;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

interface ConversionInfo {
  source_currency: string;
  source_amount: number;
  paypal_currency: string;
  paypal_amount: string;
  fx_rate: number;
  fx_source: string;
  was_converted: boolean;
}

const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  'AUD', 'BRL', 'CAD', 'CNY', 'CZK', 'DKK', 'EUR', 'HKD', 'HUF', 'ILS',
  'JPY', 'MYR', 'MXN', 'TWD', 'NZD', 'NOK', 'PHP', 'PLN', 'GBP', 'SGD',
  'SEK', 'CHF', 'THB', 'USD', 'RUB',
]);

export function Custom224PaymentWrapper({
  amount,
  currency = 'GNF',
  sellerName,
  sellerId,
  orderDescription,
  metadata = {},
  onSuccess,
  onError,
}: Custom224PaymentWrapperProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { convert, userCurrency } = usePriceConverter();

  const [paypalClientId, setPaypalClientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [succeeded, setSucceeded] = useState(false);
  const [conversionInfo, setConversionInfo] = useState<ConversionInfo | null>(null);

  const sourceCurrency = currency.toUpperCase();

  const sdkCurrency = useMemo(() => {
    if (PAYPAL_SUPPORTED_CURRENCIES.has(sourceCurrency)) return sourceCurrency;
    const preferred = userCurrency?.toUpperCase();
    if (preferred && PAYPAL_SUPPORTED_CURRENCIES.has(preferred)) return preferred;
    return 'USD';
  }, [sourceCurrency, userCurrency]);

  const localAmount = useMemo(() => convert(amount, sourceCurrency), [amount, sourceCurrency, convert]);

  useEffect(() => {
    fetchPayPalClientId();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPayPalClientId = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error: fnError } = await supabase.functions.invoke('paypal-client-id');
      if (fnError) throw fnError;
      const clientIdValue = data?.clientId || data?.client_id;
      if (!clientIdValue) {
        throw new Error('PayPal Client ID non disponible');
      }
      setPaypalClientId(clientIdValue);
    } catch (err) {
      console.error('Error fetching PayPal client ID:', err);
      const message = "Impossible d'initialiser le paiement";
      setError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async () => {
    try {
      setError('');

      const { data, error: fnError } = await supabase.functions.invoke('create-paypal-order', {
        body: {
          amount,
          currency: sourceCurrency,
          seller_id: sellerId,
          description: orderDescription || `Paiement 224Solutions - ${sellerName}`,
          preferred_paypal_currency: sdkCurrency,
          metadata: {
            ...metadata,
            platform: '224solutions',
            seller_name: sellerName,
            user_currency: userCurrency,
          },
        },
      });

      if (fnError) {
        throw new Error('Service paiement indisponible');
      }

      if (!data?.success || !data?.paypal_order_id) {
        throw new Error(data?.error || 'Erreur lors de la création du paiement');
      }

      if (data?.conversion) {
        setConversionInfo(data.conversion as ConversionInfo);
      }

      return data.paypal_order_id as string;
    } catch (err) {
      console.error('Error creating PayPal order:', err);
      const message = err instanceof Error ? err.message: t('custom224PaymentWrapper.erreurLorsDuPaiement');
      setError(message);
      onError(message);
      throw err;
    }
  };

  const handleApprove = async (data: any, actions: any) => {
    try {
      const capture = await actions?.order?.capture?.();

      if (!capture || capture.status !== 'COMPLETED') {
        throw new Error("Le paiement n'a pas été confirmé");
      }

      setSucceeded(true);
      toast.success(t('custom224PaymentWrapper.paiementReussi'));
      onSuccess(data.orderID);
    } catch (err) {
      console.error('Error capturing PayPal order:', err);
      const message = err instanceof Error ? err.message: t('custom224PaymentWrapper.erreurLorsDeLaValidation');
      setError(message);
      onError(message);
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="py-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('custom224PaymentWrapper.initialisationDuPaiementSecurise')}</p>
        </div>
      </div>
    );
  }

  if (error && !paypalClientId) {
    return (
      <div className="py-6 text-center space-y-4">
        <div className="text-destructive text-3xl">❌</div>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={fetchPayPalClientId}>{t('custom224PaymentWrapper.reessayer')}</Button>
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="py-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/15 p-4">
            <CheckCircle2 className="w-14 h-14 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-primary">{t('custom224PaymentWrapper.paiementReussi')}</h3>
        <p className="text-foreground text-lg font-semibold">{localAmount.formatted}</p>
      </div>
    );
  }

  if (!paypalClientId) return null;

  return (
    <div className="space-y-5">
      <div className="bg-muted/40 rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{t('custom224PaymentWrapper.montantAPayer')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">à {sellerName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{localAmount.formatted}</p>
            {localAmount.wasConverted && (
              <p className="text-xs text-muted-foreground mt-1">Base: {fc(amount, sourceCurrency)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground">Paiement VISA / Mastercard</span>
      </div>

      {conversionInfo?.was_converted && (
        <Alert>
          <AlertDescription>
            Conversion automatique : <strong>{conversionInfo.paypal_amount} {conversionInfo.paypal_currency}</strong>
            {' '}(taux {conversionInfo.fx_rate.toFixed(6)}).
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PayPalScriptProvider
        key={sdkCurrency}
        options={{
          clientId: paypalClientId,
          currency: sdkCurrency,
          intent: 'capture',
          components: 'buttons,funding-eligibility',
        }}
      >
        <PayPalButtons
          fundingSource={FUNDING.CARD}
          style={{ layout: 'vertical', color: 'black', shape: 'rect', label: 'pay', height: 55 }}
          createOrder={createOrder}
          onApprove={handleApprove}
          onError={(err) => {
            console.error('PayPal error:', err);
            const message = 'Erreur PayPal. Veuillez réessayer.';
            setError(message);
            onError(message);
          }}
          onCancel={() => toast.info(t('custom224PaymentWrapper.paiementAnnule'))}
        />
      </PayPalScriptProvider>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
        <Lock className="w-3.5 h-3.5" />
        <span>{t('custom224PaymentWrapper.paiementSecuriseSslPciDss')}</span>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Shield className="w-3.5 h-3.5" />
        <span>{t('custom224PaymentWrapper.vosFondsSontProtegesPar')}</span>
      </div>
    </div>
  );
}

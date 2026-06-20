/**
 * STRIPE CHECKOUT BUTTON - Paiement par carte bancaire via Stripe
 * Remplace PayPalCheckoutButton
 * 224SOLUTIONS
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Stripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { resolveBackendUrl } from '@/config/backend';
import { toast } from 'sonner';
import { Loader2, Shield, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getStripeInstance, resetStripeInstance } from '@/lib/stripe/client';

interface StripeCheckoutButtonProps {
  amount: number;
  currency?: string;
  description?: string;
  orderId?: string;
  /** If provided, uses stripe-pos-payment with commission logic */
  sellerId?: string;
  /** Custom edge function name override */
  edgeFunction?: string;
  /** Extra params to send to the edge function */
  extraParams?: Record<string, unknown>;
  onSuccess: (data: {
    paymentIntentId: string;
    amount: number;
    currency: string;
  }) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
  /** If true, credit wallet instead of just returning capture data */
  creditWallet?: boolean;
  disabled?: boolean;
}

const NODE_ORDER_PAYMENT_FUNCTIONS = new Set([
  'marketplace-escrow-payment',
  'stripe-marketplace-payment',
]);

/** Inner form rendered inside <Elements> */
function CheckoutForm({
  amount,
  currency,
  onSuccess,
  onCancel,
  onError,
  creditWallet,
}: {
  amount: number;
  currency: string;
  onSuccess: StripeCheckoutButtonProps['onSuccess'];
  onCancel?: () => void;
  onError?: (error: string) => void;
  creditWallet?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        const msg = error.message || 'Erreur de paiement';
        setErrorMessage(msg);
        onError?.(msg);
        toast.error(msg);
      } else if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        const isEscrow = paymentIntent.status === 'requires_capture';

        // Pour les dépôts wallet, confirmer et créditer côté serveur
        if (creditWallet && paymentIntent.status === 'succeeded') {
          try {
            const { data: confirmData, error: confirmError } = await supabase.functions.invoke(
              'confirm-stripe-deposit',
              { body: { paymentIntentId: paymentIntent.id } }
            );
            if (confirmError) {
              console.error('❌ [DEPOSIT CONFIRM] Error:', confirmError);
              toast.error('Paiement reçu mais erreur de crédit. Contactez le support.');
              onError?.('Erreur de confirmation du dépôt');
              return;
            }
            if (!confirmData?.success) {
              console.error('❌ [DEPOSIT CONFIRM] Failed:', confirmData?.error);
              toast.error(confirmData?.error || 'Erreur de confirmation');
              onError?.(confirmData?.error || 'Erreur de confirmation');
              return;
            }
            toast.success('Wallet crédité avec succès !');
          } catch (confirmErr) {
            console.error('❌ [DEPOSIT CONFIRM] Exception:', confirmErr);
            toast.error('Paiement reçu mais erreur de crédit. Contactez le support.');
            onError?.('Erreur de confirmation du dépôt');
            return;
          }
          window.dispatchEvent(new Event('wallet-updated'));
        } else {
          toast.success(isEscrow ? 'Fonds sécurisés en escrow !' : 'Paiement réussi !');
        }

        onSuccess({
          paymentIntentId: paymentIntent.id,
          amount,
          currency,
        });
      } else if (paymentIntent?.status === 'processing') {
        toast.info('Paiement en cours de traitement...');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setErrorMessage(msg);
      onError?.(msg);
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card'],
        }}
      />

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full"
        size="lg"
      >
        {processing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Traitement...</>
        ) : (
          <><CreditCard className="mr-2 h-4 w-4" /> Payer par carte</>
        )}
      </Button>

      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel} className="w-full" size="sm">
          Annuler
        </Button>
      )}

      <div className="flex items-center gap-2 justify-center">
        <Shield className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Paiement sécurisé via Stripe</p>
      </div>
    </form>
  );
}

export default function StripeCheckoutButton({
  amount,
  currency = 'USD',
  description = 'Paiement 224Solutions',
  orderId,
  sellerId,
  edgeFunction,
  extraParams,
  onSuccess,
  onCancel,
  onError,
  creditWallet = false,
  disabled = false,
}: StripeCheckoutButtonProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const initCalledRef = useRef(false);

  // Stabilize extraParams to prevent re-init on every render
  const extraParamsKey = useMemo(() => JSON.stringify(extraParams ?? {}), [extraParams]);

  useEffect(() => {
    mountedRef.current = true;
    initCalledRef.current = false;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    initCalledRef.current = false;
    setClientSecret(null);
    setError(null);

    if (!disabled) {
      setLoading(true);
    }
  }, [amount, currency, orderId, sellerId, edgeFunction, description, extraParamsKey, creditWallet, disabled]);

  useEffect(() => {
    // Guard against duplicate calls (StrictMode double-mount)
    if (initCalledRef.current) return;

    const init = async () => {
      initCalledRef.current = true;
      try {
        setLoading(true);
        setError(null);

        console.log('🔄 [CHECKOUT START] amount:', amount, currency);
        const stripeInstance = await getStripeInstance();
        if (!mountedRef.current) return;
        setStripe(stripeInstance);

        if (!stripeInstance) {
          throw new Error('Impossible de charger Stripe. Vérifiez la configuration.');
        }

        let data: any;

        // Branche POS (avec sellerId) — backend Node.js avec fallback Edge Function
        if (!edgeFunction && sellerId && !creditWallet) {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          if (!token) throw new Error('Non authentifié — reconnectez-vous');

          const posPayload = {
            amount,
            currency: currency.toLowerCase(),
            orderId,
            sellerId,
            description,
          };

          let backendData: any = null;
          let shouldFallbackToEdge = false;

          try {
            const resp = await fetch(resolveBackendUrl('/api/pos/stripe-payment'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(posPayload),
            });

            backendData = await resp.json();
            shouldFallbackToEdge =
              resp.status === 503 ||
              /stripe non configur|paiement par carte non disponible/i.test(String(backendData?.error || ''));
          } catch (backendError) {
            console.warn('⚠️ [CHECKOUT FALLBACK] Backend POS indisponible, tentative via Edge Function', backendError);
            shouldFallbackToEdge = true;
          }

          if (shouldFallbackToEdge) {
            console.warn('⚠️ [CHECKOUT FALLBACK] Bascule vers stripe-pos-payment');
            const { data: invokeData, error: apiError } = await supabase.functions.invoke('stripe-pos-payment', {
              body: posPayload,
            });
            if (apiError) throw new Error(apiError.message);
            data = invokeData;
          } else {
            data = backendData;
          }
        } else {
          // Autres cas (stripe-deposit, custom edgeFunction) — via Edge Function
          let functionName: string;
          let body: Record<string, unknown>;
          if (edgeFunction) {
            functionName = edgeFunction;
            body = { amount, currency: currency.toLowerCase(), orderId, sellerId, description, ...extraParams };
          } else if (creditWallet) {
            functionName = 'stripe-deposit';
            body = { amount, currency: currency.toLowerCase() };
          } else {
            functionName = 'stripe-deposit';
            body = { amount, currency: currency.toLowerCase() };
          }
          if (edgeFunction && NODE_ORDER_PAYMENT_FUNCTIONS.has(edgeFunction)) {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            if (!token) throw new Error('Non authentifié - reconnectez-vous');

            const response = await fetch(resolveBackendUrl(`/edge-functions/orders/${edgeFunction}`), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(body),
            });

            const backendData = await response.json();
            if (!response.ok) {
              throw new Error(backendData?.error || `Erreur backend ${response.status}`);
            }

            data = backendData;
          } else {
            const { data: invokeData, error: apiError } = await supabase.functions.invoke(functionName, { body });
            if (!mountedRef.current) return;
            if (apiError) throw new Error(apiError.message);
            data = invokeData;
          }
        }

        if (!mountedRef.current) return;
        if (!data?.success && !data?.clientSecret && !data?.client_secret) {
          throw new Error(data?.error || 'Erreur création paiement');
        }

        const secret = data.clientSecret || data.client_secret;
        if (!secret) throw new Error('Pas de client secret retourné');

        setClientSecret(secret);
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : 'Erreur initialisation';
        setError(msg);
        onError?.(msg);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    if (!disabled) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, currency, orderId, sellerId, edgeFunction, description, extraParamsKey, creditWallet, disabled]);

  if (disabled) {
    return (
      <div className="opacity-50 pointer-events-none p-4 text-center text-sm text-muted-foreground">
        Paiement par carte non disponible
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Chargement du paiement...</span>
      </div>
    );
  }

  if (error || !clientSecret || !stripe) {
    const isMissingKey = error?.includes('clé Stripe') || error?.includes('not configured') || error?.includes('non configurée');
    return (
      <div className="space-y-3 my-2">
        <Alert variant="destructive">
          <AlertDescription>
            {isMissingKey
              ? 'Le paiement par carte bancaire n\'est pas encore configuré. Contactez l\'administrateur.'
              : error || 'Impossible de charger le système de paiement.'}
          </AlertDescription>
        </Alert>
        {!isMissingKey && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              initCalledRef.current = false;
              resetStripeInstance();
              setError(null);
              setLoading(true);
            }}
          >
            Réessayer le paiement
          </Button>
        )}
      </div>
    );
  }

  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: 'hsl(var(--primary))',
        colorBackground: 'hsl(var(--background))',
        colorText: 'hsl(var(--foreground))',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '0.5rem',
      },
    },
    loader: 'auto',
  };

  return (
    <Elements stripe={stripe} options={elementsOptions}>
      <CheckoutForm
        amount={amount}
        currency={currency}
        onSuccess={onSuccess}
        onCancel={onCancel}
        onError={onError}
        creditWallet={creditWallet}
      />
    </Elements>
  );
}

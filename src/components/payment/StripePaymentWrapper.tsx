/**
 * STRIPE PAYMENT WRAPPER
 * Wrapper avec Stripe Elements Provider
 * 224SOLUTIONS
 * v2 - Support mode hors ligne amélioré
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Elements } from '@stripe/react-stripe-js';
import { Stripe, StripeElementsOptions } from '@stripe/stripe-js';
import { StripePaymentForm } from './StripePaymentForm';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertTriangle, WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getStripeInstance, STRIPE_OFFLINE_ERROR } from '@/lib/stripe/client';

interface StripePaymentWrapperProps {
  amount: number;
  currency: string;
  sellerId: string;
  sellerName: string;
  orderId?: string;
  serviceId?: string;
  productId?: string;
  orderDescription?: string;
  metadata?: Record<string, string>;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

/**
 * Vérifie si l'app est en mode hors ligne
 */
const isOffline = (): boolean => {
  return typeof navigator !== 'undefined' && !navigator.onLine;
};

const getStripe = async (): Promise<Stripe | null> => {
  if (isOffline()) {
    throw new Error(STRIPE_OFFLINE_ERROR);
  }

  try {
    return await getStripeInstance();
  } catch (error) {
    console.error('❌ Error loading Stripe:', error);
    throw error;
  }
};

export function StripePaymentWrapper({
  amount,
  currency,
  sellerId,
  sellerName,
  orderId,
  serviceId,
  productId,
  orderDescription,
  metadata = {},
  onSuccess,
  onError
}: StripePaymentWrapperProps) {
  const { t } = useTranslation();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);

  useEffect(() => {
    const initializePayment = async () => {
      try {
        setLoading(true);
        setError(null);

        // Charger Stripe
        const stripeInstance = await getStripe();
        setStripe(stripeInstance);

        if (!stripeInstance) {
          throw new Error('Failed to load Stripe');
        }

        // Créer PaymentIntent via Edge Function
        const { data, error: apiError } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            amount,
            currency: currency.toLowerCase(),
            seller_id: sellerId,
            order_id: orderId,
            service_id: serviceId,
            product_id: productId,
            metadata,
          }
        });

        if (apiError) {
          throw new Error(apiError.message || 'Failed to create payment intent');
        }

        // Support both camelCase and snake_case responses
        const secret = data?.client_secret || data?.clientSecret;
        if (!secret) {
          throw new Error(data?.error || 'No client secret returned from Stripe');
        }

        const piId = data?.payment_intent_id || data?.paymentIntentId;
        console.log('✅ Stripe PaymentIntent created:', piId);
        setClientSecret(secret);

      } catch (err) {
        console.error('❌ Payment initialization error:', err);
        const message = err instanceof Error ? err.message : 'Erreur lors de l\'initialisation du paiement';
        setError(message);
        toast.error(message);
        onError(message);
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, currency, sellerId, orderId, serviceId, productId]);

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('stripePaymentWrapper.chargementDuPaiementSecurise')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !clientSecret || !stripe) {
    const isOfflineError = error?.includes('OFFLINE') || !navigator.onLine;

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          {isOfflineError ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <WifiOff className="h-12 w-12 text-muted-foreground" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">Mode hors ligne</h3>
                <p className="text-sm text-muted-foreground">
                  Le paiement nécessite une connexion internet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Veuillez vous reconnecter pour effectuer ce paiement.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                Réessayer
              </Button>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error || 'Impossible de charger le système de paiement. Veuillez réessayer.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
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
        colorDanger: 'hsl(var(--destructive))',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '0.5rem',
      },
    },
    loader: 'auto',
  };

  return (
    <Elements stripe={stripe} options={elementsOptions}>
      <StripePaymentForm
        amount={amount}
        currency={currency}
        sellerName={sellerName}
        orderDescription={orderDescription}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

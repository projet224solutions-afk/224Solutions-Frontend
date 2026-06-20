/**
 * STRIPE PAYMENT FORM
 * Formulaire de paiement Stripe personnalisé avec Elements
 * 224SOLUTIONS
 */

import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, CreditCard, CheckCircle2, XCircle } from 'lucide-react';
import { formatAmount } from '@/types/stripePayment';
import { toast } from 'sonner';

interface StripePaymentFormProps {
  amount: number;
  currency: string;
  sellerName: string;
  orderDescription?: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

export function StripePaymentForm({
  amount,
  currency,
  sellerName,
  orderDescription,
  onSuccess,
  onError
}: StripePaymentFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();

  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage('Stripe n\'est pas encore chargé. Veuillez réessayer.');
      return;
    }

    setProcessing(true);
    setErrorMessage(null);

    try {
      // Confirmer le paiement
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`,
        },
        redirect: 'if_required', // Ne redirige que si 3D Secure nécessaire
      });

      if (error) {
        // Erreur de paiement
        const message = error.message || 'Une erreur est survenue lors du paiement';
        setErrorMessage(message);
        onError(message);
        toast.error(message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Paiement réussi
        setSucceeded(true);
        toast.success(t('stripePaymentForm.paiementReussi'));
        onSuccess(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === 'processing') {
        // Paiement en cours (3D Secure, etc.)
        toast.info(t('stripePaymentForm.votrePaiementEstEnCours'));
      } else {
        setErrorMessage('Statut de paiement inattendu. Veuillez contacter le support.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setErrorMessage(message);
      onError(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  if (succeeded) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-orange-100 p-3">
                <CheckCircle2 className="w-12 h-12 text-[#ff4000]" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#ff4000]">{t('stripePaymentForm.paiementReussi')}</h3>
              <p className="text-muted-foreground mt-2">
                Votre paiement de <strong>{formatAmount(amount, currency)}</strong> a été traité avec succès.
              </p>
              <p className="text-sm text-muted-foreground mt-1 animate-pulse">
                Redirection vers vos achats…
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <CardTitle>{t('stripePaymentForm.paiementSecurise')}</CardTitle>
        </div>
        <CardDescription>
          Paiement à <strong>{sellerName}</strong>
          {orderDescription && <span className="block mt-1">{orderDescription}</span>}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Montant */}
          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('stripePaymentForm.montantAPayer')}</span>
              <span className="text-2xl font-bold text-primary">
                {formatAmount(amount, currency)}
              </span>
            </div>
          </div>

          {/* Stripe Payment Element */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('stripePaymentForm.informationsDePaiement')}</span>
            </div>
            <PaymentElement
              options={{
                layout: 'tabs',
                paymentMethodOrder: ['card'],
              }}
            />
          </div>

          {/* Message d'erreur */}
          {errorMessage && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Sécurité */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{t('stripePaymentForm.paiement100Securise')}</p>
              <p className="mt-1">
                Vos informations bancaires sont protégées par Stripe et ne sont jamais stockées sur nos serveurs.
                Compatible 3D Secure.
              </p>
            </div>
          </div>

          {/* Bouton paiement */}
          <Button
            type="submit"
            disabled={!stripe || processing || succeeded}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement en cours...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Payer {formatAmount(amount, currency)}
              </>
            )}
          </Button>

          {/* Logos cartes acceptées */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className="text-xs text-muted-foreground">{t('stripePaymentForm.cartesAcceptees')}</span>
            <div className="flex gap-2">
              <div className="w-10 h-6 bg-gradient-to-r from-primary to-secondary rounded flex items-center justify-center text-white text-[8px] font-bold">
                VISA
              </div>
              <div className="w-10 h-6 bg-gradient-to-r from-[#ff4000] to-orange-500 rounded flex items-center justify-center">
                <div className="flex gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-white opacity-80"></div>
                  <div className="w-2 h-2 rounded-full bg-white opacity-60"></div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

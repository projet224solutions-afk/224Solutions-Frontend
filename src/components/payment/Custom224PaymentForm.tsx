/**
 * FORMULAIRE DE PAIEMENT PERSONNALISÉ 224SOLUTIONS
 * Design custom avec Stripe Elements pour la sécurité
 * Branding 224Solutions avec gestion Stripe
 */

import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  PaymentElement,
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, Lock, CheckCircle2, CreditCard } from 'lucide-react';
import { formatAmount } from '@/types/stripePayment';
import { toast } from 'sonner';

interface Custom224PaymentFormProps {
  amount: number;
  currency: string;
  sellerName: string;
  orderDescription?: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

// Style personnalisé 224Solutions pour les champs Stripe
const STRIPE_ELEMENT_STYLE = {
  base: {
    color: '#1a1a1a',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSmoothing: 'antialiased',
    fontSize: '16px',
    '::placeholder': {
      color: '#a0a0a0',
    },
  },
  invalid: {
    color: '#ff4000',
    iconColor: '#ff4000',
  },
};

const STRIPE_ELEMENT_OPTIONS = {
  style: STRIPE_ELEMENT_STYLE,
  showIcon: true,
};

export function Custom224PaymentForm({
  amount,
  currency,
  sellerName,
  orderDescription,
  onSuccess,
  onError
}: Custom224PaymentFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();

  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [cardComplete, setCardComplete] = useState({
    number: false,
    expiry: false,
    cvc: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage('Le système de paiement n\'est pas encore chargé. Veuillez patienter.');
      return;
    }

    // Vérifier que tous les champs sont remplis
    if (!cardComplete.number || !cardComplete.expiry || !cardComplete.cvc) {
      setErrorMessage('Veuillez remplir tous les champs de la carte');
      return;
    }

    setProcessing(true);
    setErrorMessage(null);

    try {
      const cardNumberElement = elements.getElement(CardNumberElement);

      if (!cardNumberElement) {
        throw new Error('Élément de carte introuvable');
      }

      // Créer le Payment Method
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumberElement,
      });

      if (paymentMethodError) {
        throw new Error(paymentMethodError.message);
      }

      // Confirmer le paiement avec le Payment Method
      const clientSecret = (window as any).clientSecret;
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret, // Défini par StripePaymentWrapper
        {
          payment_method: paymentMethod.id,
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        setSucceeded(true);
        toast.success(t('custom224PaymentForm.paiementReussi'));
        onSuccess(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === 'processing') {
        toast.info(t('custom224PaymentForm.votrePaiementEstEnCours'));
      } else {
        throw new Error('Statut de paiement inattendu');
      }
    } catch (err) {
      console.error('Payment error:', err);
      const message = err instanceof Error ? err.message : 'Erreur lors du paiement';
      setErrorMessage(message);
      onError(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  if (succeeded) {
    return (
      <Card className="w-full max-w-lg mx-auto bg-gradient-to-br from-orange-50 to-orange-50">
        <CardContent className="pt-8 pb-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-orange-100 p-4">
                <CheckCircle2 className="w-16 h-16 text-[#ff4000]" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#ff4000]">{t('custom224PaymentForm.paiementReussi')}</h3>
              <p className="text-gray-600 mt-2 text-lg">
                <strong>{formatAmount(amount, currency)}</strong>
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Merci pour votre confiance en 224Solutions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl border-2 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo 224Solutions */}
            <div className="bg-white rounded-lg p-2">
              <span className="text-2xl font-bold text-primary">224</span>
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('custom224PaymentForm.t224solutionsPaiement')}</h2>
              <p className="text-sm text-white/90">{t('custom224PaymentForm.paiementSecuriseParStripe')}</p>
            </div>
          </div>
          <Shield className="w-8 h-8 text-white/90" />
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Montant */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-5 border-2 border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">{t('custom224PaymentForm.montantAPayer')}</p>
              <p className="text-xs text-gray-500 mt-1">à {sellerName}</p>
              {orderDescription && (
                <p className="text-xs text-gray-500">{orderDescription}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {formatAmount(amount, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire de carte */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <span className="font-semibold text-gray-700">{t('custom224PaymentForm.informationsDeCarte')}</span>
            </div>

            {/* Numéro de carte */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Numéro de carte
              </label>
              <div className="border-2 border-gray-300 rounded-lg p-4 hover:border-primary focus-within:border-primary transition-colors bg-white">
                <CardNumberElement
                  options={STRIPE_ELEMENT_OPTIONS}
                  onChange={(e) => setCardComplete({ ...cardComplete, number: e.complete })}
                />
              </div>
            </div>

            {/* Expiration et CVC */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Date d'expiration
                </label>
                <div className="border-2 border-gray-300 rounded-lg p-4 hover:border-primary focus-within:border-primary transition-colors bg-white">
                  <CardExpiryElement
                    options={{ style: STRIPE_ELEMENT_STYLE }}
                    onChange={(e) => setCardComplete({ ...cardComplete, expiry: e.complete })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Code CVC
                </label>
                <div className="border-2 border-gray-300 rounded-lg p-4 hover:border-primary focus-within:border-primary transition-colors bg-white">
                  <CardCvcElement
                    options={{ style: STRIPE_ELEMENT_STYLE }}
                    onChange={(e) => setCardComplete({ ...cardComplete, cvc: e.complete })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Erreur */}
          {errorMessage && (
            <Alert variant="destructive" className="border-2">
              <AlertDescription className="flex items-center gap-2">
                <span className="font-medium">❌</span>
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Bouton de paiement */}
          <Button
            type="submit"
            disabled={processing || !stripe || !cardComplete.number || !cardComplete.expiry || !cardComplete.cvc}
            className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Traitement en cours...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-5 w-5" />
                Payer {formatAmount(amount, currency)}
              </>
            )}
          </Button>

          {/* Sécurité */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-4">
            <Shield className="w-4 h-4" />
            <span>{t('custom224PaymentForm.paiementSecuriseParStripeCryptage')}</span>
          </div>

          {/* Logo 224Solutions */}
          <div className="text-center pt-3 border-t">
            <p className="text-xs text-gray-400">
              Propulsé par <span className="font-bold text-primary">224Solutions</span>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

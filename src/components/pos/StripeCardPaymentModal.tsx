/**
 * STRIPE CARD PAYMENT MODAL - Modal de paiement carte POS
 * Utilise Stripe Elements pour un paiement sécurisé
 *
 * LOGIQUE MARKETPLACE:
 * - Le client paye (montant produit + commission)
 * - Le vendeur reçoit le montant produit (net vendeur)
 */

import React, { useEffect, useState } from 'react';
import { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency as formatCurrencyUtil } from '@/lib/formatters';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Shield, CreditCard, CheckCircle2, XCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getStripeInstance } from '@/lib/stripe/client';

interface StripeCardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Montant produit (base) */
  amount: number;
  currency?: string;
  orderId: string;
  sellerId: string;
  description?: string;
  /** Edge function name to call. Defaults to 'stripe-pos-payment' */
  edgeFunction?: string;
  /** Extra body params to send to the edge function */
  extraParams?: Record<string, unknown>;
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
    console.warn('⚠️ Mode hors ligne détecté, Stripe non disponible');
    return null;
  }

  try {
    return await getStripeInstance();
  } catch (error) {
    console.error('❌ [STRIPE LOAD FAIL]', error);
    return null;
  }
};

function PaymentForm({
  productAmount,
  totalAmount,
  currency,
  commissionRate,
  commissionAmount,
  sellerNetAmount,
  onSuccess,
  onError,
  onClose,
}: {
  productAmount: number;
  totalAmount: number;
  currency: string;
  commissionRate: number;
  commissionAmount: number;
  sellerNetAmount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const formatAmount = (value: number) => {
    return formatCurrencyUtil(value, currency);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Stripe n'est pas chargé. Veuillez rafraîchir la page.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/vendeur/pos`,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Erreur de paiement');
        onError(confirmError.message || 'Erreur de paiement');
        toast.error('Paiement refusé', {
          description: confirmError.message,
        });
      } else if (paymentIntent) {
        if (paymentIntent.status === 'succeeded') {
          setSucceeded(true);
          toast.success('Paiement accepté!', {
            description: `${formatAmount(totalAmount)} encaissé`,
          });
          onSuccess(paymentIntent.id);
        } else if (paymentIntent.status === 'processing') {
          toast.info('Paiement en cours de traitement...');
        } else if (paymentIntent.status === 'requires_action') {
          toast.info('Authentification 3D Secure requise...');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      onError(message);
    } finally {
      setProcessing(false);
    }
  };

  if (succeeded) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="flex justify-center">
          <div className="rounded-full bg-orange-100 p-4">
            <CheckCircle2 className="w-16 h-16 text-[#ff4000]" />
          </div>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-[#ff4000]">Paiement réussi!</h3>
          <p className="text-muted-foreground mt-2">
            <strong>{formatAmount(totalAmount)}</strong> encaissé
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Montant net vendeur: <strong>{formatAmount(sellerNetAmount)}</strong>
          </p>
        </div>
        <Button onClick={onClose} className="mt-4">
          Fermer
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="space-y-2">
            <div className="border-b pb-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Montant produit</span>
                <span className="font-medium">{formatAmount(productAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Commission plateforme ({commissionRate}%)</span>
                <span>+{formatAmount(commissionAmount)}</span>
              </div>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total à payer</span>
              <span className="text-primary">{formatAmount(totalAmount)}</span>
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              ✅ Le vendeur recevra {formatAmount(sellerNetAmount)} net
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
        <Info className="w-4 h-4 mt-0.5 text-blue-500" />
        <div>
          <p className="font-medium text-blue-700 dark:text-blue-300">Logique Marketplace</p>
          <p className="mt-1">
            Le client paye le total (produit + commission). Le vendeur reçoit le montant produit sur son wallet interne après confirmation.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Informations de carte</span>
        </div>
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card'],
          }}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
        <Shield className="w-4 h-4 mt-0.5" />
        <div>
          <p className="font-medium">Paiement 100% sécurisé</p>
          <p className="mt-1">Cryptage SSL. Compatible 3D Secure. Données protégées par Stripe.</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={processing} className="flex-1">
          Annuler
        </Button>
        <Button type="submit" disabled={!stripe || processing} className="flex-1">
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Traitement...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Payer {formatAmount(totalAmount)}
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        <span className="text-xs text-muted-foreground">Cartes acceptées:</span>
        <div className="flex gap-2">
          <div className="w-10 h-6 bg-[#04439e] rounded flex items-center justify-center text-white text-[8px] font-bold">
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
  );
}

export function StripeCardPaymentModal({
  isOpen,
  onClose,
  amount,
  currency = 'GNF',
  orderId,
  sellerId,
  description,
  edgeFunction = 'stripe-pos-payment',
  extraParams,
  onSuccess,
  onError,
}: StripeCardPaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [paymentDetails, setPaymentDetails] = useState({
    commissionRate: 2.5,
    commissionAmount: 0,
    sellerNetAmount: 0,
    productAmount: amount,
    totalAmount: amount,
  });

  // ✅ Charger Stripe UNE SEULE FOIS au montage
  useEffect(() => {
    const loadStripeInstance = async () => {
      if (isOffline()) return;
      const stripeInstance = await getStripe();
      if (stripeInstance) {
        setStripe(stripeInstance);
      }
    };
    loadStripeInstance();
  }, []);

  // ✅ Initialiser le paiement seulement quand le modal s'ouvre avec un nouveau orderId
  useEffect(() => {
    if (!isOpen || !orderId) return;

    // Éviter la réinitialisation si on a déjà un clientSecret pour cette commande
    if (clientSecret) return;

    const initPayment = async () => {
      setLoading(true);
      setError(null);

      try {
        // Vérifier mode offline d'abord
        if (isOffline()) {
          throw new Error('Mode hors ligne - paiement indisponible. Veuillez vous reconnecter à Internet.');
        }

        if (!stripe) {
          const stripeInstance = await getStripe();
          if (!stripeInstance) {
            throw new Error('Impossible de charger Stripe. Vérifiez votre connexion Internet.');
          }
          setStripe(stripeInstance);
        }

        // Appel via Supabase Edge Function — évite la dépendance au backend Node.js
        const { data, error: fnError } = await supabase.functions.invoke(edgeFunction, {
          body: {
            amount,
            currency,
            orderId,
            sellerId,
            description,
            ...extraParams,
          },
        });

        if (fnError) {
          throw new Error(fnError.message || 'Erreur lors de l\'appel au service de paiement');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Erreur création paiement');
        }

        setClientSecret(data.clientSecret);
        setPaymentDetails({
          commissionRate: data.commissionRate || 2.5,
          commissionAmount: data.commissionAmount || 0,
          sellerNetAmount: data.sellerNetAmount || amount,
          productAmount: data.productAmount || amount,
          totalAmount: data.totalAmount || amount,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        console.error('❌ Payment init error:', message);
        setError(message);
        onError(message);
      } finally {
        setLoading(false);
      }
    };

    initPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId]);

  const handleClose = () => {
    setClientSecret(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <DialogTitle>Paiement par carte</DialogTitle>
          </div>
          <DialogDescription>Paiement sécurisé via Stripe</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Initialisation du paiement...</p>
          </div>
        )}

        {error && !loading && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {clientSecret && stripe && !loading && (
          <Elements
            stripe={stripe}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#ff4000',
                  colorBackground: '#ffffff',
                  colorText: '#1f2937',
                },
              },
            }}
          >
            <PaymentForm
              productAmount={paymentDetails.productAmount}
              totalAmount={paymentDetails.totalAmount}
              currency={currency}
              commissionRate={paymentDetails.commissionRate}
              commissionAmount={paymentDetails.commissionAmount}
              sellerNetAmount={paymentDetails.sellerNetAmount}
              onSuccess={onSuccess}
              onError={onError}
              onClose={handleClose}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}

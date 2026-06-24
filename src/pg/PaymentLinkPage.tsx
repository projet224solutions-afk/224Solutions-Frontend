import { useTranslation } from "@/hooks/useTranslation";
﻿/**
 * 💳 PAGE PUBLIQUE DE PAIEMENT - /pay/:token
 * Page professionnelle pour payer via un lien de paiement 224SOLUTIONS
 * Supporte: invités (Orange Money, Carte) + connectés (Wallet)
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { backendConfig } from '@/config/backend';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Stripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  CreditCard, Smartphone, Wallet, Shield, CheckCircle,
  AlertCircle, Clock, Loader2, ArrowLeft, Store,
  FileText, ShoppingCart, Wrench, Receipt, User
} from 'lucide-react';
import { getStripeInstance } from '@/lib/stripe/client';

interface PaymentLinkData {
  id: string;
  token: string;
  linkType: string;
  title: string;
  description?: string;
  amount: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  isSingleUse: boolean;
  paymentType: string;
  reference?: string;
  ownerType: string;
  remise?: number;
  typeRemise?: string;
  items?: { product_id?: string; name: string; price: number; qty: number; image?: string | null }[];
}

interface OwnerInfo {
  name: string;
  avatar?: string;
  business_name?: string;
}

const linkTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  payment: { icon: <CreditCard className="w-5 h-5" />, label: "Paiement", color: 'bg-primary/10 text-primary' },
  invoice: { icon: <FileText className="w-5 h-5" />, label: 'Facture', color: 'bg-orange-100 text-[#ff4000]' },
  checkout: { icon: <ShoppingCart className="w-5 h-5" />, label: 'Checkout', color: 'bg-orange-100 text-[#ff4000]' },
  service: { icon: <Wrench className="w-5 h-5" />, label: "Service", color: 'bg-blue-100 text-[#04439e]' },
};


interface CardPaymentElementFormProps {
  amountLabel: string;
  disabled?: boolean;
  onSuccess: (paymentIntentId: string) => Promise<void>;
  onError: (errorMessage: string) => void;
}

function CardPaymentElementForm({ amountLabel, disabled = false, onSuccess, onError }: CardPaymentElementFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || disabled) {
      return;
    }

    try {
      setSubmitting(true);

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Paiement carte échoué');
        return;
      }

      if (!paymentIntent) {
        onError('Aucune confirmation Stripe reçue');
        return;
      }

      if (paymentIntent.status !== 'succeeded') {
        onError(`Paiement non confirmé (${paymentIntent.status})`);
        return;
      }

      await onSuccess(paymentIntent.id);
    } catch (err) {
      onError(err instanceof Error ? err.message: t('paymentLinkPage.erreurDeConfirmationCarte'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCardSubmit} className="space-y-3">
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card'],
        }}
      />
      <Button type="submit" className="w-full" disabled={!stripe || submitting || disabled}>
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Confirmation en cours...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Confirmer et payer {amountLabel}
          </>
        )}
      </Button>
    </form>
  );
}

export default function PaymentLinkPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [linkData, setLinkData] = useState<PaymentLinkData | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  const [productInfo, setProductInfo] = useState<any>(null);
  const [_serviceInfo, setServiceInfo] = useState<any>(null);

  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '' });
  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);
  const [cardInitLoading, setCardInitLoading] = useState(false);
  const [cardFinalizeLoading, setCardFinalizeLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    if (token) resolveLink();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Pre-fill customer info if logged in
  useEffect(() => {
    if (user?.email) {
      setCustomerInfo(prev => ({ ...prev, email: user.email || '' }));
    }
  }, [user]);

  useEffect(() => {
    if (paymentMethod !== 'card') {
      setCardClientSecret(null);
      setCardError(null);
      setCardFinalizeLoading(false);
    }
  }, [paymentMethod]);

  const resolveLink = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${backendConfig.baseUrl}/api/payment-links/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json();

      if (!data?.success) {
        toast({ title: "Erreur", description: data?.error || "Lien introuvable", variant: "destructive" });
        return;
      }

      setLinkData(data.link);
      setOwnerInfo(data.owner);
      setProductInfo(data.product);
      setServiceInfo(data.service);
    } catch (err) {
      console.error('Resolve error:', err);
      toast({ title: "Erreur", description: t('paymentLinkPage.impossibleDeChargerLeLien'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const processPaymentLinkRequest = async (payload: Record<string, unknown>) => {
    const requestBody = { token, ...payload };

    // Le paiement par wallet exige d'identifier l'acheteur côté backend → on joint le JWT
    // de la session si elle existe (sinon le backend renvoie 401 « Connexion requise »).
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    } catch { /* pas de session → paiement invité (Orange Money / carte) */ }

    try {
      const resp = await fetch(`${backendConfig.baseUrl}/api/payment-links/process`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      const data = await resp.json();

      const shouldFallbackToEdge =
        resp.status >= 500 ||
        (!data?.success && /paiement par carte non disponible|stripe non configur/i.test(String(data?.error || '')));

      if (!shouldFallbackToEdge) {
        return data;
      }

      console.warn('⚠️ [PaymentLink] Backend indisponible pour Stripe, bascule vers la fonction Edge');
    } catch (error) {
      console.warn('⚠️ [PaymentLink] Erreur backend, tentative via la fonction Edge', error);
    }

    const { data, error } = await supabase.functions.invoke('process-payment-link', {
      body: requestBody,
    });

    if (error) {
      throw new Error(error.message || 'Erreur de paiement');
    }

    return data;
  };

  const initCardPayment = async () => {
    try {
      setCardInitLoading(true);
      setCardError(null);

      const data = await processPaymentLinkRequest({
        paymentMethod: 'card',
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
      });

      if (!data?.success || !data?.clientSecret) {
        const message = data?.error || 'Impossible d\'initialiser le paiement carte';
        setCardError(message);
        toast({ title: 'Erreur carte', description: message, variant: 'destructive' });
        return;
      }

      setStripePromise(getStripeInstance());
      setCardClientSecret(data.clientSecret);

      toast({
        title: t('paymentLinkPage.formulaireCartePret'),
        description: t('paymentLinkPage.entrezVosInformationsBancairesPuis'),
      });
    } catch (err: any) {
      const message = err?.message || 'Erreur de préparation carte';
      setCardError(message);
      toast({ title: 'Erreur carte', description: message, variant: 'destructive' });
    } finally {
      setCardInitLoading(false);
    }
  };

  const finalizeCardPayment = async (paymentIntentId: string) => {
    try {
      setCardFinalizeLoading(true);
      setCardError(null);

      const data = await processPaymentLinkRequest({
        paymentMethod: 'card',
        paymentIntentId,
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
      });

      if (!data?.success) {
        const message = data?.error || 'Confirmation du paiement impossible';
        setCardError(message);
        toast({ title: 'Erreur carte', description: message, variant: 'destructive' });
        await resolveLink();
        return;
      }

      await resolveLink();
      setPaymentSuccess(true);
      toast({ title: t('paymentLinkPage.paiementCarteReussi'), description: `Transaction ${paymentIntentId}` });
    } catch (err: any) {
      const message = err?.message || 'Erreur de finalisation carte';
      setCardError(message);
      toast({ title: 'Erreur carte', description: message, variant: 'destructive' });
    } finally {
      setCardFinalizeLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      toast({ title: "Erreur", description: t('paymentLinkPage.choisissezUnModeDePaiement'), variant: "destructive" });
      return;
    }

    if (paymentMethod !== 'wallet' && !user && (!customerInfo.name || !customerInfo.phone)) {
      toast({ title: "Erreur", description: t('paymentLinkPage.nomEtTelephoneRequis'), variant: "destructive" });
      return;
    }

    if (paymentMethod === 'card') {
      if (!cardClientSecret) {
        await initCardPayment();
      }
      return;
    }

    try {
      setProcessing(true);

      const data = await processPaymentLinkRequest({
        paymentMethod,
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
      });

      if (!data?.success) {
        toast({ title: "Erreur", description: data?.error || "Paiement échoué", variant: "destructive" });
        return;
      }

      if (paymentMethod === 'wallet') {
        setPaymentSuccess(true);
        toast({ title: t('paymentLinkPage.paiementReussi'), description: `Transaction ${data.transactionId}` });
      } else {
        toast({ title: t('paymentLinkPage.paiementInitie'), description: data.message || "Vérifiez votre téléphone" });
        setPaymentSuccess(true);
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || "Erreur de paiement", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('fr-FR').format(amount) + ' ' + currency;

  // -------- LOADING --------
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t('paymentLinkPage.chargementDuPaiement')}</p>
        </div>
      </div>
    );
  }

  // -------- NOT FOUND --------
  if (!linkData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Lien introuvable</h2>
            <p className="text-muted-foreground mb-4">{t('paymentLinkPage.ceLienDePaiementN')}</p>
            <Button onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4 mr-2" />Accueil</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------- EXPIRED --------
  if (linkData.status === 'expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">{t('paymentLinkPage.lienExpire')}</h2>
            <p className="text-muted-foreground mb-4">{t('paymentLinkPage.contactezLeVendeurPourUn')}</p>
            <Button onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4 mr-2" />Accueil</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------- ALREADY PAID --------
  if (linkData.status === 'success' || linkData.status === 'paid' || paymentSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-[#ff4000]" />
            </div>
            <h2 className="text-xl font-bold mb-2">{t('paymentLinkPage.paiementConfirme')}</h2>
            <p className="text-muted-foreground mb-2">
              {formatCurrency(linkData.amount, linkData.currency)}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {linkData.title}
            </p>
            {linkData.reference && (
              <p className="text-xs text-muted-foreground mb-4">Réf: {linkData.reference}</p>
            )}
            <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-lg mb-4">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{t('paymentLinkPage.unRecuSeraEnvoyePar')}</span>
            </div>
            <Button onClick={() => navigate('/')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typeConfig = linkTypeConfig[linkData.linkType] || linkTypeConfig.payment;

  // -------- MAIN PAYMENT PAGE --------
  return (
    <div
      className="min-h-screen bg-background pt-6 px-4"
      style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">224SOLUTIONS</h1>
          <p className="text-sm text-muted-foreground">{t('paymentLinkPage.paiementSecurise')}</p>
        </div>

        {/* Payment Details Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {typeConfig.icon}
                Détails
              </CardTitle>
              <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Owner */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                {ownerInfo?.avatar ? (
                  <img src={ownerInfo.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <p className="font-semibold text-sm">{ownerInfo?.business_name || ownerInfo?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {linkData.ownerType === 'provider' ? 'Prestataire' : 'Vendeur'}
                </p>
              </div>
            </div>

            <Separator />

            {/* Title & description */}
            <div>
              <h3 className="font-semibold">{linkData.title}</h3>
              {linkData.description && (
                <p className="text-sm text-muted-foreground mt-1">{linkData.description}</p>
              )}
            </div>

            {/* Devis détaillé — le client vérifie chaque produit et son prix avant de payer */}
            {linkData.items && linkData.items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border-b">
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" /> Récapitulatif de votre commande
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {linkData.items.length} article{linkData.items.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y">
                  {linkData.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0 border">
                        {it.image ? (
                          <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{it.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Prix unitaire : <span className="font-medium text-foreground">{formatCurrency(it.price, linkData.currency)}</span>
                          {'  •  '}Qté : <span className="font-medium text-foreground">{it.qty}</span>
                        </p>
                      </div>
                      <span className="text-sm font-bold shrink-0">{formatCurrency(it.price * it.qty, linkData.currency)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-muted/50 border-t">
                  <span className="text-sm font-semibold">{t('paymentLinkPage.totalAPayer')}</span>
                  <span className="text-base font-bold text-primary">{formatCurrency(linkData.amount, linkData.currency)}</span>
                </div>
              </div>
            )}

            {/* Product image if available (lien produit unique) */}
            {(!linkData.items || linkData.items.length === 0) && productInfo?.images?.[0] && (
              <div className="rounded-lg overflow-hidden border">
                <img src={productInfo.images[0]} alt={productInfo.name} className="w-full h-32 object-cover" />
              </div>
            )}

            {/* Amount breakdown */}
            <div className="space-y-1.5 p-3 bg-muted rounded-lg">
              <div className="flex justify-between text-sm">
                <span>{t('paymentLinkPage.montant')}</span>
                <span>{formatCurrency(linkData.grossAmount || linkData.amount, linkData.currency)}</span>
              </div>
              {(linkData.remise || 0) > 0 && (
                <div className="flex justify-between text-sm text-[#ff4000]">
                  <span>Remise</span>
                  <span>-{linkData.remise}{linkData.typeRemise === 'percentage' ? '%' : ` ${linkData.currency}`}</span>
                </div>
              )}
              {linkData.reference && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('paymentLinkPage.reference')}</span>
                  <span>{linkData.reference}</span>
                </div>
              )}
              {linkData.paymentType !== 'full' && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Type</span>
                  <span className="capitalize">{linkData.paymentType === 'deposit' ? 'Acompte' : linkData.paymentType}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-bold">
                <span>{t('paymentLinkPage.totalAPayer')}</span>
                <span className="text-primary">{formatCurrency(linkData.amount, linkData.currency)}</span>
              </div>
            </div>

            {/* Expiry */}
            {linkData.expiresAt && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expire le {new Date(linkData.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Customer Info (guests) */}
        {!user && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-5 h-5" />
                Vos informations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="cust-name">Nom complet *</Label>
                <Input
                  id="cust-name"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  placeholder={t('paymentLinkPage.votreNom')}
                />
              </div>
              <div>
                <Label htmlFor="cust-phone">{t('paymentLinkPage.telephone')}</Label>
                <Input
                  id="cust-phone"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  placeholder="+224 XXX XX XX XX"
                />
              </div>
              <div>
                <Label htmlFor="cust-email">Email (optionnel)</Label>
                <Input
                  id="cust-email"
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                  placeholder="email@exemple.com"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Methods */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Mode de paiement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Orange Money */}
            <button
              onClick={() => setPaymentMethod('orange_money')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                paymentMethod === 'orange_money' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Orange Money</p>
                <p className="text-xs text-muted-foreground">{t('paymentLinkPage.paiementMobileInstantane')}</p>
              </div>
            </button>

            {/* Card */}
            <button
              onClick={() => setPaymentMethod('card')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Carte bancaire</p>
                <p className="text-xs text-muted-foreground">Visa, Mastercard</p>
              </div>
            </button>

            {/* Wallet — toujours proposé ; si pas connecté, on redirige vers la connexion
                (les clients qui ont un compte peuvent payer avec leur solde). */}
            <button
              onClick={() => {
                if (!user) {
                  try { sessionStorage.setItem('post_auth_redirect', window.location.pathname + window.location.search); } catch { /* ignore */ }
                  toast({ title: t('paymentLinkPage.connexionRequise'), description: t('paymentLinkPage.connectezVousPourPayerAvec') });
                  navigate('/auth');
                  return;
                }
                setPaymentMethod('wallet');
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                paymentMethod === 'wallet' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#ff4000]" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Wallet 224SOLUTIONS</p>
                <p className="text-xs text-muted-foreground">
                  {user ? 'Paiement depuis votre solde' : 'Connectez-vous pour utiliser votre solde'}
                </p>
              </div>
            </button>

            {paymentMethod === 'card' && cardError && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>{cardError}</AlertDescription>
              </Alert>
            )}

            {paymentMethod === 'card' && cardClientSecret && stripePromise && (
              <div className="mt-3 p-3 border rounded-lg bg-muted/30 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Finalisez le paiement avec votre carte. Le lien passe à "payé" uniquement après confirmation Stripe.
                </p>
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret: cardClientSecret,
                    appearance: { theme: 'stripe' },
                  } as StripeElementsOptions}
                >
                  <CardPaymentElementForm
                    amountLabel={formatCurrency(linkData.amount, linkData.currency)}
                    disabled={cardFinalizeLoading}
                    onSuccess={finalizeCardPayment}
                    onError={(message) => {
                      setCardError(message);
                      toast({ title: 'Erreur carte', description: message, variant: 'destructive' });
                    }}
                  />
                </Elements>
              </div>
            )}

            {/* Security badge */}
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg mt-3">
              <Shield className="w-4 h-4 text-[#ff4000] shrink-0" />
              <p className="text-xs text-[#ff4000] dark:text-[#ff4000]">
                Paiement sécurisé et chiffré SSL
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pay Button */}
        <Button
          onClick={handlePayment}
          disabled={processing || cardInitLoading || cardFinalizeLoading || !paymentMethod || (paymentMethod === 'card' && !!cardClientSecret)}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {processing || cardInitLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Traitement...
            </>
          ) : paymentMethod === 'card' && cardClientSecret ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Formulaire carte affiché ci-dessus
            </>
          ) : paymentMethod === 'card' ? (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              Continuer vers le formulaire carte
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              Payer {formatCurrency(linkData.amount, linkData.currency)}
            </>
          )}
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Propulsé par <span className="font-semibold">224SOLUTIONS</span>
        </p>
      </div>
    </div>
  );
}

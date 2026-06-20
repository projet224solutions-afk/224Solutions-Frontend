/**
 * 💳 PAGE DE PAIEMENT PAYMENT CORE 224SOLUTIONS
 * Accessible via /payment-core
 * Gère tous types de paiements via le Payment Core centralisé
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PaymentCoreForm } from '@/components/payment/PaymentCoreForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CreditCard, Shield, Crown, Truck, Building2, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

type PaymentType = 'ORDER_PAYMENT' | 'SUBSCRIPTION' | 'BOOST' | 'DELIVERY' | 'COMMISSION' | 'WALLET_TOPUP';

const paymentTypeIcons: Record<PaymentType, React.ReactNode> = {
  ORDER_PAYMENT: <CreditCard className="h-6 w-6" />,
  SUBSCRIPTION: <Crown className="h-6 w-6" />,
  BOOST: <Crown className="h-6 w-6" />,
  DELIVERY: <Truck className="h-6 w-6" />,
  COMMISSION: <Building2 className="h-6 w-6" />,
  WALLET_TOPUP: <Wallet className="h-6 w-6" />,
};

const paymentTypeLabels: Record<PaymentType, string> = {
  ORDER_PAYMENT: 'Paiement de commande',
  SUBSCRIPTION: 'Abonnement vendeur',
  BOOST: 'Boost produit/boutique',
  DELIVERY: 'Paiement livraison',
  COMMISSION: 'Commission plateforme',
  WALLET_TOPUP: 'Recharge portefeuille',
};

export default function PaymentCorePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const _navigate = useNavigate();

  // Paramètres URL
  const urlType = searchParams.get('type') as PaymentType | null;
  const urlAmount = searchParams.get('amount');
  const urlRef = searchParams.get('ref');
  const urlVendor = searchParams.get('vendor');
  const urlDesc = searchParams.get('desc');

  // États du formulaire
  const [showForm, setShowForm] = useState(!!urlType && !!urlAmount && !!urlRef);
  const [type, setType] = useState<PaymentType>(urlType || 'WALLET_TOPUP');
  const [amount, setAmount] = useState(urlAmount ? parseInt(urlAmount) : 10000);
  const [referenceId, setReferenceId] = useState(urlRef || `REF-${Date.now()}`);
  const [vendorId, setVendorId] = useState(urlVendor || '');
  const [description, setDescription] = useState(urlDesc || '');

  // Si paramètres URL complets, afficher directement le formulaire
  useEffect(() => {
    if (urlType && urlAmount && urlRef) {
      setShowForm(true);
      setType(urlType);
      setAmount(parseInt(urlAmount));
      setReferenceId(urlRef);
      if (urlVendor) setVendorId(urlVendor);
      if (urlDesc) setDescription(urlDesc);
    }
  }, [urlType, urlAmount, urlRef, urlVendor, urlDesc]);

  const handleSuccess = (transactionId: string, orderId: string) => {
    console.log('Payment success:', { transactionId, orderId });
  };

  const handleError = (error: string) => {
    console.error('Payment error:', error);
  };

  const handleStartPayment = () => {
    if (amount > 0 && referenceId) {
      setShowForm(true);
    }
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>224Solutions</span>
            </div>
          </div>

          <PaymentCoreForm
            type={type}
            referenceId={referenceId}
            amount={amount}
            vendorId={vendorId || undefined}
            description={description || undefined}
            metadata={{ source: 'payment_core_page' }}
            onSuccess={handleSuccess}
            onError={handleError}
            onCancel={() => setShowForm(false)}
          />
        </div>
      </div>
    );
  }

  // Interface de configuration
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-primary/10 rounded-full">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Payment Core 224Solutions</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('paymentCore.systemeDePaiementUnifie')}</h1>
          <p className="text-muted-foreground">
            Initiez un paiement sécurisé via Orange Money, MTN MoMo ou Carte
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t('paymentCore.typesDePaiementsSupportes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(Object.keys(paymentTypeLabels) as PaymentType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`
                    flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all
                    ${type === t
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                    }
                  `}
                >
                  <div className="text-primary">{paymentTypeIcons[t]}</div>
                  <span className="text-sm font-medium">{paymentTypeLabels[t]}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('paymentCore.configurerLePaiement')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('paymentCore.montantGnf')}</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                  min={1000}
                  step={1000}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('paymentCore.typeDePaiement')}</Label>
                <Select value={type} onValueChange={(v) => setType(v as PaymentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(paymentTypeLabels) as PaymentType[]).map((t) => (
                      <SelectItem key={t} value={t}>{paymentTypeLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('paymentCore.referenceUnique')}</Label>
              <Input
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder={t('paymentCore.idCommandeAbonnementEtc')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('paymentCore.idVendeurOptionnel')}</Label>
              <Input
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                placeholder={t('paymentCore.uuidDuVendeur')}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('paymentCore.descriptionDuPaiement')}
              />
            </div>

            <Button
              onClick={handleStartPayment}
              className="w-full"
              size="lg"
              disabled={amount <= 0 || !referenceId}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Démarrer le paiement de {formatCurrency(amount)}
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">{t('paymentCore.integrationApi')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Endpoint: <code className="bg-muted px-2 py-1 rounded">POST /functions/v1/payment-core</code>
            </p>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`{
  "type": "${type}",
  "reference_id": "${referenceId}",
  "amount": ${amount},
  "currency": "GNF",
  "phone": "6XXXXXXXX",
  "method": "OM | MOMO | CARD | MTN | KULU"
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useTranslation } from "@/hooks/useTranslation";
/**
 * PAGE DE DÉMONSTRATION - PAIEMENT 224SOLUTIONS
 * Exemple d'intégration du formulaire de paiement personnalisé
 */

import React, { useState } from 'react';
import { Custom224PaymentWrapper } from '@/components/payment/Custom224PaymentWrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function Custom224PaymentDemo() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: 50000, // 500 GNF
    sellerName: 'Boutique 224',
    sellerId: '',
    orderDescription: 'Commande #12345',
  });

  const handlePaymentSuccess = (paymentIntentId: string) => {
    console.log('Paiement réussi:', paymentIntentId);
    toast.success(t('custom224PaymentDemo.paiementEffectueAvecSucces'));
    
    // Redirection ou action après paiement
    setTimeout(() => {
      setShowPayment(false);
    }, 3000);
  };

  const handlePaymentError = (error: string) => {
    console.error('Erreur paiement:', error);
    toast.error(error);
  };

  if (showPayment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => setShowPayment(false)}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          <Custom224PaymentWrapper
            amount={paymentData.amount}
            currency="GNF"
            sellerName={paymentData.sellerName}
            sellerId={paymentData.sellerId}
            orderDescription={paymentData.orderDescription}
            metadata={{
              order_id: '12345',
              customer_id: 'demo_user',
            }}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* En-tête */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl shadow-lg">
            <span className="text-3xl font-bold text-white">224</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">
            Paiement Personnalisé 224Solutions
          </h1>
          <p className="text-lg text-gray-600">
            Design 100% personnalisé • Sécurité Stripe • Branding 224Solutions
          </p>
        </div>

        {/* Configuration du paiement */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>{t('custom224PaymentDemo.configurerLePaiementDeTest')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t('custom224PaymentDemo.montantEnGnf')}</Label>
              <Input
                id="amount"
                type="number"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: parseInt(e.target.value) || 0 })}
                placeholder="50000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seller">{t('custom224PaymentDemo.nomDuVendeur')}</Label>
              <Input
                id="seller"
                value={paymentData.sellerName}
                onChange={(e) => setPaymentData({ ...paymentData, sellerName: e.target.value })}
                placeholder={t('custom224PaymentDemo.boutique224')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sellerId">{t('custom224PaymentDemo.idVendeur')}</Label>
              <Input
                id="sellerId"
                value={paymentData.sellerId}
                onChange={(e) => setPaymentData({ ...paymentData, sellerId: e.target.value })}
                placeholder={t('custom224PaymentDemo.uuidDuVendeur')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={paymentData.orderDescription}
                onChange={(e) => setPaymentData({ ...paymentData, orderDescription: e.target.value })}
                placeholder={t('custom224PaymentDemo.commande12345')}
              />
            </div>

            <Button
              onClick={() => setShowPayment(true)}
              className="w-full h-12 text-lg"
              disabled={!paymentData.sellerId}
            >
              Afficher le formulaire de paiement
            </Button>

            {!paymentData.sellerId && (
              <p className="text-sm text-[#ff4000] text-center">
                ⚠️ Entrez un ID vendeur valide pour continuer
              </p>
            )}
          </CardContent>
        </Card>

        {/* Caractéristiques */}
        <Card className="shadow-xl border-2 border-primary/20">
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-xl font-bold text-center mb-4">{t('custom224PaymentDemo.caracteristiques')}</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                <span className="text-2xl">🎨</span>
                <div>
                  <h4 className="font-semibold text-[#ff4000]">{t('custom224PaymentDemo.designPersonnalise')}</h4>
                  <p className="text-sm text-[#ff4000]">{t('custom224PaymentDemo.logoEtCouleurs224solutions')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-2xl">🔒</span>
                <div>
                  <h4 className="font-semibold text-blue-900">{t('custom224PaymentDemo.securiteStripe')}</h4>
                  <p className="text-sm text-blue-700">PCI-DSS, 3D Secure, SSL</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-2xl">💳</span>
                <div>
                  <h4 className="font-semibold text-[#04439e]">{t('custom224PaymentDemo.toutesLesCartes')}</h4>
                  <p className="text-sm text-[#04439e]">VISA, Mastercard, AMEX</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                <span className="text-2xl">⚡</span>
                <div>
                  <h4 className="font-semibold text-orange-900">{t('custom224PaymentDemo.tempsReel')}</h4>
                  <p className="text-sm text-orange-700">{t('custom224PaymentDemo.confirmationInstantanee')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carte de test Stripe */}
        <Card className="shadow-xl bg-gradient-to-r from-[#04439e] to-[#ff4000] text-white">
          <CardContent className="pt-6 space-y-3">
            <h3 className="text-xl font-bold">{t('custom224PaymentDemo.carteDeTestStripe')}</h3>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 space-y-2">
              <p className="font-mono text-lg">4242 4242 4242 4242</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm opacity-90">Expiration</p>
                  <p className="font-mono">12/34</p>
                </div>
                <div>
                  <p className="text-sm opacity-90">CVC</p>
                  <p className="font-mono">123</p>
                </div>
              </div>
            </div>
            <p className="text-sm opacity-90">
              ℹ️ Cette carte de test ne débite pas de vrais fonds
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

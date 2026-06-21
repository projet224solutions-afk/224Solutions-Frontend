/**
 * STRIPE WALLET TOPUP - Recharge wallet par carte bancaire
 * Utilise StripeCheckoutButton avec creditWallet=true pour créditer le wallet côté serveur
 */

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ArrowDownCircle, Shield } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import StripeCheckoutButton from '@/components/payment/StripeCheckoutButton';
import { useTranslation } from "@/hooks/useTranslation";

interface StripeWalletTopupProps {
  userId: string;
  walletId: string | number;
  onSuccess?: () => void;
}

export default function StripeWalletTopup({ userId, walletId, onSuccess }: StripeWalletTopupProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [showStripe, setShowStripe] = useState(false);

  const quickAmounts = [10000, 25000, 50000, 100000, 250000, 500000];

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount >= 5000;

  const handleSuccess = () => {
    setShowStripe(false);
    setAmount("");
    window.dispatchEvent(new Event('wallet-updated'));
    onSuccess?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Recharger par Carte Bancaire
        </CardTitle>
        <CardDescription>
          Rechargez votre wallet instantanément avec Visa ou Mastercard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showStripe ? (
          <>
            {/* Montants rapides */}
            <div className="space-y-2">
              <Label>Montants rapides</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickAmounts.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    variant={numAmount === quickAmount ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAmount(quickAmount.toString())}
                    className="text-xs"
                  >
                    {quickAmount.toLocaleString()} GNF
                  </Button>
                ))}
              </div>
            </div>

            {/* Montant personnalisé */}
            <div className="space-y-2">
              <Label htmlFor="topup-amount">{t('stripeWalletTopup.montantPersonnaliseGnf')}</Label>
              <Input
                id="topup-amount"
                type="number"
                placeholder="Ex: 100000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="5000"
              />
              <p className="text-xs text-muted-foreground">{t('stripeWalletTopup.montantMinimum5000Gnf')}</p>
            </div>

            {/* Info sécurité */}
            <Alert className="bg-primary/5 border-primary/20">
              <Shield className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm text-primary/80">
                Paiement 100% sécurisé via Stripe. Vos données bancaires ne sont jamais stockées.
              </AlertDescription>
            </Alert>

            {/* Bouton de recharge */}
            <Button
              onClick={() => setShowStripe(true)}
              disabled={!isValid}
              className="w-full"
              size="lg"
            >
              <ArrowDownCircle className="w-4 h-4 mr-2" />
              Recharger {numAmount > 0 ? `${numAmount.toLocaleString()} GNF` : ''}
            </Button>

            {/* Cartes acceptées */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="text-xs text-muted-foreground">{t('stripeWalletTopup.cartesAcceptees')}</span>
              <div className="flex gap-2">
                <div className="w-10 h-6 bg-[#04439e] rounded flex items-center justify-center text-white text-[8px] font-bold">
                  VISA
                </div>
                <div className="w-10 h-6 bg-[#ff4000] rounded flex items-center justify-center">
                  <div className="flex gap-0.5">
                    <div className="w-2 h-2 rounded-full bg-white opacity-80"></div>
                    <div className="w-2 h-2 rounded-full bg-white opacity-60"></div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
              <p className="text-lg font-bold text-primary">{numAmount.toLocaleString()} GNF</p>
              <p className="text-xs text-muted-foreground">{t('stripeWalletTopup.depotSurVotreWallet')}</p>
            </div>

            <StripeCheckoutButton
              amount={numAmount}
              currency="GNF"
              description="Recharge wallet 224Solutions"
              onSuccess={handleSuccess}
              onCancel={() => setShowStripe(false)}
              onError={() => setShowStripe(false)}
              creditWallet
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

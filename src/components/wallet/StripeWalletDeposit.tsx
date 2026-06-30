/**
 * STRIPE WALLET DEPOSIT - Dépôt par carte bancaire via Stripe
 * Remplace PayPalWalletOperations pour les dépôts
 * 224SOLUTIONS
 */

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, Shield, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import StripeCheckoutButton from '@/components/payment/StripeCheckoutButton';
import { useTranslation } from "@/hooks/useTranslation";

interface StripeWalletDepositProps {
  userId: string;
  walletId: string | number;
  onSuccess?: () => void;
}

export default function StripeWalletDeposit({ userId, walletId, onSuccess }: StripeWalletDepositProps) {
  const { t } = useTranslation();
  const [depositAmount, setDepositAmount] = useState("");
  const [showStripe, setShowStripe] = useState(false);

  const quickAmounts = [10, 25, 50, 100, 250, 500];

  const numAmount = parseFloat(depositAmount);
  const isValid = numAmount >= 5;

  const handleSuccess = (_data: { paymentIntentId: string; amount: number; currency: string }) => {
    setShowStripe(false);
    setDepositAmount("");
    window.dispatchEvent(new Event("wallet-updated"));
    onSuccess?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-primary-foreground" />
          </div>
          Carte Bancaire
        </CardTitle>
        <CardDescription>Déposez sur votre wallet via Visa / Mastercard</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showStripe ? (
          <>
            <div className="space-y-2">
              <Label>Montants rapides (USD)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickAmounts.map((q) => (
                  <Button
                    key={q}
                    variant={numAmount === q ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDepositAmount(q.toString())}
                    className="text-xs"
                  >
                    ${q}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stripe-deposit">{t('stripeWalletDeposit.montantPersonnaliseUsd')}</Label>
              <Input
                id="stripe-deposit"
                type="number"
                placeholder="Ex: 100"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                min="5"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">Minimum: $5 USD · Frais: 2%</p>
            </div>

            <Button
              onClick={() => setShowStripe(true)}
              disabled={!isValid}
              className="w-full"
              size="lg"
            >
              <ArrowDownCircle className="w-4 h-4 mr-2" /> Déposer ${depositAmount || '0'} par carte
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
              <p className="text-lg font-bold text-primary">${numAmount.toFixed(2)} USD</p>
              <p className="text-xs text-muted-foreground">{t('stripeWalletDeposit.depotSurVotreWallet')}</p>
            </div>

            <StripeCheckoutButton
              amount={numAmount}
              currency="USD"
              description="Dépôt wallet 224Solutions"
              onSuccess={handleSuccess}
              onCancel={() => setShowStripe(false)}
              onError={(_err) => setShowStripe(false)}
              creditWallet
            />
          </div>
        )}

        <Alert className="bg-primary/5 border-primary/20">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-primary/80">
            Transactions sécurisées via Stripe. Vos données bancaires ne sont jamais stockées.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

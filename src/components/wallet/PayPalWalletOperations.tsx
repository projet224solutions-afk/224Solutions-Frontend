/**
 * PAYPAL WALLET OPERATIONS - Dépôt et retrait via PayPal
 * 224SOLUTIONS
 */

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownCircle, ArrowUpCircle, Loader2, Shield, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { signedInvoke, generateIdempotencyKey } from "@/lib/security/hmacSigner";
import { useTranslation } from "@/hooks/useTranslation";

interface PayPalWalletOperationsProps {
  userId: string;
  walletId: string | number;
  onSuccess?: () => void;
}

export default function PayPalWalletOperations({ userId, walletId, onSuccess }: PayPalWalletOperationsProps) {
  const { t } = useTranslation();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [processing, setProcessing] = useState(false);
  const [depositStep, setDepositStep] = useState<'input' | 'approve' | 'capturing'>('input');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  const quickAmounts = [10, 25, 50, 100, 250, 500];

  // ============ DEPOSIT ============
  const handleCreateDeposit = async () => {
    const numAmount = parseFloat(depositAmount);
    if (!numAmount || numAmount < 5) {
      toast.error(t('payPalWalletOperations.montantInvalide'), { description: "Minimum $5 USD" });
      return;
    }

    setProcessing(true);
    try {
      const idempotencyKey = generateIdempotencyKey('deposit', userId);
      const { data, error } = await signedInvoke("paypal-deposit", {
        amount: numAmount, currency: "USD", action: "create"
      }, { idempotencyKey });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erreur PayPal");

      setCurrentOrderId(data.orderId);
      setDepositStep('approve');

      // Open PayPal approval in new window
      const approveUrl = `https://www.paypal.com/checkoutnow?token=${data.orderId}`;
      window.open(approveUrl, "_blank", "width=500,height=700,noopener,noreferrer");

      toast.info(t('payPalWalletOperations.approuvezLePaiementDansPaypal'), {
        description: t('payPalWalletOperations.uneFenetrePaypalSEst'),
        duration: 15000,
      });
    } catch (err) {
      toast.error("Erreur", { description: err instanceof Error ? err.message : "Erreur PayPal" });
    } finally {
      setProcessing(false);
    }
  };

  const handleCaptureDeposit = async () => {
    if (!currentOrderId) return;

    setDepositStep('capturing');
    setProcessing(true);

    try {
      const { data, error } = await signedInvoke("paypal-deposit", {
        action: "capture", orderId: currentOrderId
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Capture échouée");

      toast.success(t('payPalWalletOperations.depotPaypalReussi'), {
        description: `${data.netAmount?.toFixed(2)} USD crédités (frais: ${data.depositFee?.toFixed(2)} USD)`,
      });

      setDepositAmount("");
      setDepositStep('input');
      setCurrentOrderId(null);
      window.dispatchEvent(new Event("wallet-updated"));
      onSuccess?.();
    } catch (err) {
      toast.error(t('payPalWalletOperations.erreurDeCapture'), { description: err instanceof Error ? err.message : "Erreur" });
      setDepositStep('approve');
    } finally {
      setProcessing(false);
    }
  };

  // ============ WITHDRAWAL ============
  const handleWithdrawal = async () => {
    const numAmount = parseFloat(withdrawAmount);
    if (!numAmount || numAmount < 5) {
      toast.error(t('payPalWalletOperations.montantInvalide'), { description: "Minimum $5 USD" });
      return;
    }
    if (!paypalEmail || !paypalEmail.includes("@")) {
      toast.error("Email PayPal invalide");
      return;
    }

    setProcessing(true);
    try {
      const idempotencyKey = generateIdempotencyKey('withdrawal', userId);
      const { data, error } = await signedInvoke("paypal-withdrawal", {
        amount: numAmount, currency: "USD", paypalEmail
      }, { idempotencyKey });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erreur retrait");

      toast.success(t('payPalWalletOperations.retraitPaypalEffectue'), {
        description: data.message,
      });

      setWithdrawAmount("");
      setPaypalEmail("");
      window.dispatchEvent(new Event("wallet-updated"));
      onSuccess?.();
    } catch (err) {
      toast.error("Erreur retrait", { description: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#003087] flex items-center justify-center">
            <span className="text-white text-xs font-bold">PP</span>
          </div>
          PayPal
        </CardTitle>
        <CardDescription>{t('payPalWalletOperations.deposezOuRetirezViaVotre')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposit" className="gap-1">
              <ArrowDownCircle className="w-3.5 h-3.5" /> Dépôt
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="gap-1">
              <ArrowUpCircle className="w-3.5 h-3.5" /> Retrait
            </TabsTrigger>
          </TabsList>

          {/* DEPOSIT TAB */}
          <TabsContent value="deposit" className="space-y-4 mt-4">
            {depositStep === 'input' && (
              <>
                <div className="space-y-2">
                  <Label>Montants rapides (USD)</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {quickAmounts.map((q) => (
                      <Button
                        key={q}
                        variant={parseFloat(depositAmount) === q ? "default" : "outline"}
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
                  <Label htmlFor="pp-deposit">{t('payPalWalletOperations.montantPersonnaliseUsd')}</Label>
                  <Input
                    id="pp-deposit"
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
                  onClick={handleCreateDeposit}
                  disabled={!depositAmount || parseFloat(depositAmount) < 5 || processing}
                  className="w-full bg-[#0070BA] hover:bg-[#003087] text-white"
                  size="lg"
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</>
                  ) : (
                    <><ArrowDownCircle className="w-4 h-4 mr-2" /> {t('payPalWalletOperations.payerAvecPaypal')}</>
                  )}
                </Button>
              </>
            )}

            {depositStep === 'approve' && (
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-sm text-[#ff4000] font-medium">
                    Approuvez le paiement dans la fenêtre PayPal ouverte, puis cliquez ci-dessous.
                  </p>
                </div>
                <Button
                  onClick={handleCaptureDeposit}
                  disabled={processing}
                  className="w-full bg-[#ff4000] hover:bg-[#ff4000] text-white"
                  size="lg"
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirmation...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> {t('payPalWalletOperations.jAiApprouveConfirmer')}</>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDepositStep('input'); setCurrentOrderId(null); }}
                >
                  Annuler
                </Button>
              </div>
            )}

            {depositStep === 'capturing' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="w-8 h-8 animate-spin text-[#0070BA]" />
                <p className="text-sm text-muted-foreground">{t('payPalWalletOperations.finalisationDuDepot')}</p>
              </div>
            )}
          </TabsContent>

          {/* WITHDRAWAL TAB */}
          <TabsContent value="withdraw" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="pp-email">{t('payPalWalletOperations.emailPaypalDuDestinataire')}</Label>
              <Input
                id="pp-email"
                type="email"
                placeholder={t('payPalWalletOperations.votreEmailCom')}
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Montants rapides (USD)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickAmounts.map((q) => (
                  <Button
                    key={q}
                    variant={parseFloat(withdrawAmount) === q ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWithdrawAmount(q.toString())}
                    className="text-xs"
                  >
                    ${q}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pp-withdraw">{t('payPalWalletOperations.montantUsd')}</Label>
              <Input
                id="pp-withdraw"
                type="number"
                placeholder="Ex: 50"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="5"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">Minimum: $5 USD · Frais: 1.5%</p>
            </div>

            <Button
              onClick={handleWithdrawal}
              disabled={!withdrawAmount || parseFloat(withdrawAmount) < 5 || !paypalEmail || processing}
              className="w-full bg-[#0070BA] hover:bg-[#003087] text-white"
              size="lg"
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</>
              ) : (
                <><ArrowUpCircle className="w-4 h-4 mr-2" /> Retirer vers PayPal</>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        <Alert className="mt-4 bg-blue-50 border-blue-200">
          <Shield className="h-4 w-4 text-[#003087]" />
          <AlertDescription className="text-sm text-blue-700">
            Transactions sécurisées via l'API PayPal. Vos données sont protégées.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

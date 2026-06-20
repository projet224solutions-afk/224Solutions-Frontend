import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useWalletTransfer, TransferPreview } from '@/hooks/useWalletTransfer';
import { UserSearchInput } from '@/components/wallet/UserSearchInput';
import { ArrowRight, Loader2, Shield, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { getCurrencyByCode } from '@/data/currencies';
import { useTranslation } from "@/hooks/useTranslation";

interface SecureTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  currentBalance: number;
  currentCurrency?: string;
}

export function SecureTransferDialog({
  open,
  onOpenChange,
  onSuccess,
  currentBalance,
  currentCurrency = 'GNF',
}: SecureTransferDialogProps) {
  const { t } = useTranslation();
  const [recipientCode, setRecipientCode] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input');
  const [lastTransferCode, setLastTransferCode] = useState('');

  const { preview, loading, executing, error, getPreview, executeTransfer, clearPreview } = useWalletTransfer();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setRecipientCode('');
      setRecipientUserId('');
      setAmount('');
      setDescription('');
      setStep('input');
      setLastTransferCode('');
      clearPreview();
    }
  }, [open, clearPreview]);

  const handlePreview = async () => {
    const numAmount = parseFloat(amount);
    if (!recipientUserId || !numAmount || numAmount <= 0) return;

    const result = await getPreview(recipientUserId, numAmount);
    if (result?.success) {
      setStep('confirm');
    }
  };

  const handleConfirmTransfer = async () => {
    const numAmount = parseFloat(amount);
    if (!recipientUserId || !numAmount) return;

    const result = await executeTransfer(recipientUserId, numAmount, description);
    if (result?.success) {
      setLastTransferCode(result.transfer_code || '');
      setStep('success');
      onSuccess?.();
    }
  };

  const handleUserSelect = (userId: string) => {
    setRecipientUserId(userId);
  };

  const numAmount = parseFloat(amount) || 0;
  const isAmountValid = numAmount > 0 && numAmount <= currentBalance;

  const senderCurrencyInfo = getCurrencyByCode(currentCurrency);
  const receiverCurrencyInfo = preview ? getCurrencyByCode(preview.currency_received) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Transfert Sécurisé
          </DialogTitle>
          <DialogDescription>
            Transférez de l'argent vers un autre utilisateur en toute sécurité
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-4">
            {/* Solde disponible */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{t('secureTransferDialog.soldeDisponible')}</p>
              <p className="text-xl font-bold">
                {formatCurrency(currentBalance, currentCurrency)}
              </p>
            </div>

            {/* Destinataire */}
            <div className="space-y-2">
              <UserSearchInput
                value={recipientCode}
                onChange={setRecipientCode}
                onUserSelect={handleUserSelect}
              />
            </div>

            {/* Montant */}
            <div className="space-y-2">
              <Label>Montant à envoyer ({currentCurrency})</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
              />
              {numAmount > currentBalance && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Solde insuffisant
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Textarea
                placeholder={t('secureTransferDialog.motifDuTransfert')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handlePreview}
              disabled={!recipientUserId || !isAmountValid || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calcul en cours...
                </>
              ) : (
                <>
                  Continuer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'confirm' && preview && (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <h4 className="font-medium">{t('secureTransferDialog.recapitulatifDuTransfert')}</h4>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('secureTransferDialog.montantEnvoye')}</span>
                  <span className="font-medium">
                    {senderCurrencyInfo?.flag} {formatCurrency(preview.amount_sent, preview.currency_sent)}
                  </span>
                </div>

                <div className="flex justify-between text-destructive">
                  <span>Frais ({preview.fee_percentage}%)</span>
                  <span>- {formatCurrency(preview.fee_amount, preview.currency_sent)}</span>
                </div>

                <Separator />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('secureTransferDialog.apresFrais')}</span>
                  <span>{formatCurrency(preview.amount_after_fee, preview.currency_sent)}</span>
                </div>

                {preview.currency_sent !== preview.currency_received && (
                  <>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Taux de change
                      </span>
                      <span>
                        1 {preview.currency_sent} = {preview.rate_displayed.toFixed(6)} {preview.currency_received}
                      </span>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-bold text-primary">
                  <span>{t('secureTransferDialog.leDestinataireRecevra')}</span>
                  <span>
                    {receiverCurrencyInfo?.flag} {formatCurrency(preview.amount_received, preview.currency_received)}
                  </span>
                </div>
              </div>
            </div>

            {/* Note de sécurité */}
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p>
                Ce transfert est sécurisé et sera enregistré. Une fois confirmé, il ne pourra pas être annulé.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep('input');
                  clearPreview();
                }}
                disabled={executing}
              >
                Retour
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmTransfer}
                disabled={executing}
              >
                {executing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transfert en cours...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Confirmer le transfert
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-[#ff4000]" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#ff4000]">{t('secureTransferDialog.transfertReussi')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Votre transfert a été effectué avec succès
              </p>
            </div>

            {lastTransferCode && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">{t('secureTransferDialog.codeDeTransfert')}</p>
                <p className="font-mono font-medium">{lastTransferCode}</p>
              </div>
            )}

            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

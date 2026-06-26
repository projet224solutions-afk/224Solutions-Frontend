import { useTranslation } from "@/hooks/useTranslation";
import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserSearchInput } from './UserSearchInput';
import { useAuth } from '@/hooks/useAuth';
import { previewWalletTransfer, transferToWallet } from '@/services/walletBackendService';
import { toast } from 'sonner';
import { SecureButton } from '@/components/ui/SecureButton';
import { InternationalTransferConfirmation, type InternationalPreviewData } from './InternationalTransferConfirmation';
import { WalletPinPromptDialog } from './WalletPinDialogs';
import { useMoneyFormat } from '@/components/Money';
import { Loader2 } from 'lucide-react';

interface ImprovedTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  currentBalance?: number;
}

export const ImprovedTransferDialog = ({
  open,
  onOpenChange,
  onSuccess,
  currentBalance = 0
}: ImprovedTransferDialogProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { format: fmtMoney, userCurrency } = useMoneyFormat();
  const [recipientCode, setRecipientCode] = useState('');
  const [recipientUserId, setRecipientUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [intlPreview, setIntlPreview] = useState<InternationalPreviewData | null>(null);
  const [showIntlConfirm, setShowIntlConfirm] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingTransferKind, setPendingTransferKind] = useState<'local' | 'international' | null>(null);

  const isPinRequiredError = (message?: string) => /code pin requis/i.test(message || '');

  const handleUserSelect = (userId: string) => {
    setRecipientUserId(userId);
  };

  // Step 1: Preview the transfer to detect international
  const handlePreviewAndTransfer = useCallback(async () => {
    if (!user?.id || !recipientCode || !amount || !description) {
      toast.error(t('improvedTransferDialog.veuillezRemplirTousLesChamps'));
      throw new Error('Champs manquants');
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      toast.error(t('improvedTransferDialog.montantInvalide'));
      throw new Error('Montant invalide');
    }

    if (transferAmount > currentBalance) {
      toast.error(t('improvedTransferDialog.soldeInsuffisant'));
      throw new Error('Solde insuffisant');
    }

    // First, call backend preview to detect international transfers
    setPreviewLoading(true);
    try {
      // Resolve recipient ID first
      const resolvedRecipient = recipientUserId || recipientCode;

      const previewResponse = await previewWalletTransfer(resolvedRecipient, transferAmount);
      if (!previewResponse.success) {
        throw new Error(previewResponse.error || 'Erreur de prévisualisation');
      }
      const previewData = previewResponse.data;

      if (previewData.is_international) {
        // Show international confirmation dialog
        setIntlPreview(previewData as InternationalPreviewData);
        setShowIntlConfirm(true);
        onOpenChange(false); // Close main dialog
        return;
      }

      // Local transfer: execute directly
      await executeLocalTransfer(transferAmount, resolvedRecipient);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur';
      toast.error(message);
      throw err;
    } finally {
      setPreviewLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, recipientCode, recipientUserId, amount, description, currentBalance, onOpenChange]);

  // Execute local transfer (no international fees)
  const executeLocalTransfer = async (transferAmount: number, resolvedRecipient: string, pin?: string) => {
    const result = await transferToWallet(
      resolvedRecipient,
      transferAmount,
      description,
      pin
    );

    if (!result.success) {
      const errorMessage = result.error || 'Erreur lors du transfert';
      if (!pin && isPinRequiredError(errorMessage)) {
        setPendingTransferKind('local');
        setPinError(null);
        setPinPromptOpen(true);
        return false;
      }
      throw new Error(errorMessage);
    }

    toast.success(`Transfert de ${transferAmount.toLocaleString()} réussi !`);
    resetForm();
    onOpenChange(false);
    onSuccess?.();
    window.dispatchEvent(new CustomEvent('wallet-updated'));
    return true;
  };

  // Execute international transfer via backend wallet API
  const executeInternationalTransfer = useCallback(async (pin?: string) => {
    if (!intlPreview) return false;

    const resolvedRecipient = recipientUserId || recipientCode;

    const result = await transferToWallet(
      resolvedRecipient,
      intlPreview.amount_sent,
      description,
      pin
    );

    if (!result.success) {
      const errorMessage = result.error || 'Erreur lors du transfert';
      if (!pin && isPinRequiredError(errorMessage)) {
        setPendingTransferKind('international');
        setPinError(null);
        setPinPromptOpen(true);
        return false;
      }
      throw new Error(errorMessage);
    }

    toast.success(
      '🌍 Transfert international réussi !',
      { duration: 5000 }
    );

    resetForm();
    setShowIntlConfirm(false);
    setIntlPreview(null);
    onSuccess?.();
    window.dispatchEvent(new CustomEvent('wallet-updated'));
    return true;
  }, [intlPreview, recipientCode, recipientUserId, description, onSuccess]);

  const resetForm = () => {
    setRecipientCode('');
    setRecipientUserId(null);
    setAmount('');
    setDescription('');
    setIntlPreview(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('improvedTransferDialog.effectuerUnTransfert')}</DialogTitle>
            <DialogDescription>
              Transférez des fonds à un autre utilisateur — local ou international 🌍
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <UserSearchInput
              value={recipientCode}
              onChange={setRecipientCode}
              onUserSelect={handleUserSelect}
              label="Destinataire"
              placeholder={t('improvedTransferDialog.idEmailOuTelephone')}
            />

            <div className="space-y-2">
              <Label htmlFor="amount">{t('improvedTransferDialog.montant')}</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Ex: 50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Solde disponible: {fmtMoney(currentBalance, userCurrency)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('improvedTransferDialog.motifDuTransfert')}</Label>
              <Input
                id="description"
                placeholder={t('improvedTransferDialog.exPaiementProduitRemboursement')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <SecureButton
              onSecureClick={handlePreviewAndTransfer}
              disabled={!recipientCode || !amount || !description || previewLoading}
              className="w-full bg-primary hover:bg-primary/90"
              loadingText="Vérification en cours..."
              debounceMs={1000}
            >
              {previewLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                'Confirmer le transfert'
              )}
            </SecureButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* International confirmation with rate-lock timer */}
      <InternationalTransferConfirmation
        open={showIntlConfirm}
        onOpenChange={(val) => {
          setShowIntlConfirm(val);
          if (!val) setIntlPreview(null);
        }}
        preview={intlPreview}
        onConfirm={async () => {
          setExecuting(true);
          try {
            await executeInternationalTransfer();
          } catch (err) {
            const message = err instanceof Error ? err.message: t('improvedTransferDialog.erreurDeTransfert');
            toast.error(message);
          } finally {
            setExecuting(false);
          }
        }}
        loading={executing}
      />

      <WalletPinPromptDialog
        open={pinPromptOpen}
        onOpenChange={(value) => {
          setPinPromptOpen(value);
          if (!value) {
            setPinError(null);
            setPendingTransferKind(null);
          }
        }}
        loading={pinLoading}
        error={pinError}
        onConfirm={async (pin) => {
          if (!pendingTransferKind) return;

          try {
            setPinLoading(true);
            setPinError(null);

            const resolvedRecipient = recipientUserId || recipientCode;
            const transferAmount = parseFloat(amount || '0');
            const success = pendingTransferKind === 'international'
              ? await executeInternationalTransfer(pin)
              : await executeLocalTransfer(transferAmount, resolvedRecipient, pin);

            if (success) {
              setPinPromptOpen(false);
              setPendingTransferKind(null);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message: t('improvedTransferDialog.erreurLorsDuTransfert');
            const isPinError = /code pin|pin invalide|pin bloqué|tentative|configurer.*pin/i.test(message);
            if (isPinError) {
              setPinError(message);
            } else {
              setPinPromptOpen(false);
              setPendingTransferKind(null);
              toast(message, { style: { background: '#ff4000', color: 'white' } });
            }
          } finally {
            setPinLoading(false);
          }
        }}
      />
    </>
  );
};

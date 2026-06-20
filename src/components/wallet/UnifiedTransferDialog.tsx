/**
 * COMPOSANT UNIFIÉ DE TRANSFERT WALLET
 * Utilise les fonctions RPC standardisées avec codes ID
 * SUPPORTE LES TRANSFERTS MULTI-DEVISES
 */

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { UserSearchInput } from './UserSearchInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Loader2, Wallet, AlertCircle, CheckCircle, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { InternationalTransferConfirmation, type InternationalPreviewData } from './InternationalTransferConfirmation';
import { previewWalletTransfer, transferToWallet } from '@/services/walletBackendService';
import { WalletPinPromptDialog } from './WalletPinDialogs';
import { useTranslation } from "@/hooks/useTranslation";

interface UnifiedTransferDialogProps {
  senderCode: string; // Le code de l'expéditeur (USR0001, etc.)
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showText?: boolean;
  onSuccess?: () => void;
  /** Devise par défaut du wallet */
  currency?: string;
}

interface TransferPreview {
  success: boolean;
  sender: {
    id: string;
    name: string;
    email: string;
    phone: string;
    custom_id: string;
  };
  receiver: {
    id: string;
    name: string;
    email: string;
    phone: string;
    custom_id: string;
  };
  amount: number;
  fee_percent: number;
  fee_amount: number;
  total_debit: number;
  amount_received: number;
  current_balance: number;
  balance_after: number;
  error?: string;
}

export function UnifiedTransferDialog({
  senderCode,
  variant = "default",
  size = "default",
  className = "",
  showText = true,
  onSuccess,
  currency: propCurrency
}: UnifiedTransferDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [recipientCode, setRecipientCode] = useState('');
  const [recipientUserId, setRecipientUserId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [walletCurrency, setWalletCurrency] = useState(propCurrency || 'GNF');
  const [intlPreview, setIntlPreview] = useState<InternationalPreviewData | null>(null);
  const [showIntlConfirm, setShowIntlConfirm] = useState(false);
  const [intlExecuting, setIntlExecuting] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingTransferKind, setPendingTransferKind] = useState<'local' | 'international' | null>(null);

  const isPinRequiredError = (message?: string) => /code pin requis/i.test(message || '');

  // Charger la devise du wallet de l'utilisateur
  useEffect(() => {
    if (propCurrency) {
      setWalletCurrency(propCurrency);
      return;
    }

    const loadWalletCurrency = async () => {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from('wallets')
          .select('currency')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.currency) {
          setWalletCurrency(data.currency);
        }
      } catch (error) {
        console.error('Erreur chargement devise wallet:', error);
      }
    };

    loadWalletCurrency();
  }, [user?.id, propCurrency]);

  const handlePreview = async () => {
    if (!amount || !recipientCode || !description) {
      toast.error(t('unifiedTransferDialog.veuillezRemplirTousLesChamps'));
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      toast.error(t('unifiedTransferDialog.montantInvalide'));
      return;
    }

    setLoading(true);

    try {
      // Use resolved userId if available, otherwise pass code/email/phone directly
      const resolvedRecipient = recipientUserId || recipientCode;

      console.log('🔍 Prévisualisation transfert:', { sender: user?.id, recipient: resolvedRecipient, amount: transferAmount });

      const previewResponse = await previewWalletTransfer(resolvedRecipient, transferAmount);
      if (!previewResponse.success) throw new Error(previewResponse.error || 'Erreur de prévisualisation');
      const previewData = previewResponse.data;

      console.log('📋 Résultat prévisualisation:', previewData);

      if (previewData.is_international) {
        setIntlPreview({
          success: true,
          amount_sent: previewData.amount_sent || transferAmount,
          currency_sent: previewData.currency_sent || walletCurrency,
          fee_percentage: previewData.fee_percentage || 0,
          fee_amount: previewData.fee_amount || 0,
          amount_after_fee: previewData.amount_after_fee || 0,
          rate_displayed: previewData.rate_displayed || 1,
          official_rate: previewData.official_rate,
          fx_margin: previewData.fx_margin,
          rate_source: previewData.rate_source,
          rate_fetched_at: previewData.rate_fetched_at,
          rate_source_type: previewData.rate_source_type,
          rate_source_url: previewData.rate_source_url,
          rate_is_official: previewData.rate_is_official,
          rate_is_stale: previewData.rate_is_stale,
          amount_received: previewData.amount_received || 0,
          currency_received: previewData.currency_received || walletCurrency,
          is_international: true,
          sender_country: previewData.sender_country || '',
          receiver_country: previewData.receiver_country || '',
          commission_conversion: previewData.commission_conversion || 0,
          frais_international: previewData.frais_international || 0,
          rate_lock_seconds: previewData.rate_lock_seconds || 60,
          balance_after: previewData.balance_after,
          receiver_name: previewData.receiver_name,
          receiver_code: previewData.receiver_code,
        });
        setShowIntlConfirm(true);
        setOpen(false);
        return;
      }

      // Local transfer preview
      setPreview({
        success: true,
        sender: previewData.sender || { id: user?.id, name: '', email: '', phone: '', custom_id: senderCode },
        receiver: previewData.receiver || { id: resolvedRecipient, name: previewData.receiver_name || '', email: previewData.receiver_email || '', phone: previewData.receiver_phone || '', custom_id: previewData.receiver_code || recipientCode },
        amount: previewData.amount_sent || transferAmount,
        fee_percent: previewData.fee_percentage || 0,
        fee_amount: previewData.fee_amount || 0,
        total_debit: previewData.total_debit || (transferAmount + (previewData.fee_amount || 0)),
        amount_received: previewData.amount_received || transferAmount,
        current_balance: previewData.sender_balance || 0,
        balance_after: previewData.balance_after || 0,
      });
      setShowPreview(true);
      setOpen(false);
    } catch (error: any) {
      console.error('❌ Erreur prévisualisation:', error);
      toast.error(error.message || 'Erreur lors de la prévisualisation');
    } finally {
      setLoading(false);
    }
  };

  const executeLocalTransfer = async (pin?: string) => {
    if (!preview) return false;

    const resolvedRecipient = recipientUserId || recipientCode;
    console.log('💸 Exécution du transfert...');

    const result = await transferToWallet(resolvedRecipient, preview.amount, description, pin);

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

    console.log('✅ Transfert réussi:', result);
    toast.success(t('unifiedTransferDialog.transfertReussi'), { duration: 5000 });

    setAmount('');
    setRecipientCode('');
    setRecipientUserId(null);
    setDescription('');
    setPreview(null);

    onSuccess?.();
    window.dispatchEvent(new CustomEvent('wallet-updated'));
    return true;
  };

  const handleConfirm = async () => {
    if (!preview) return;

    setLoading(true);
    setShowPreview(false);

    try {
      await executeLocalTransfer();
    } catch (error: any) {
      console.error('❌ Erreur transfert:', error);
      toast.error(error.message || 'Erreur lors du transfert');
    } finally {
      setLoading(false);
    }
  };

  const executeInternationalTransfer = async (pin?: string) => {
    if (!intlPreview) return false;

    const resolvedRecipient = recipientUserId || recipientCode;
    const result = await transferToWallet(resolvedRecipient, intlPreview.amount_sent, description, pin);

    if (!result.success) {
      const errorMessage = result.error || 'Erreur lors du transfert';
      if (!pin && isPinRequiredError(errorMessage)) {
        setPendingTransferKind('international');
        setPinError(null);
        setShowIntlConfirm(false);
        setPinPromptOpen(true);
        return false;
      }
      throw new Error(errorMessage);
    }

    toast.success(t('unifiedTransferDialog.transfertInternationalReussi'), { duration: 5000 });
    setAmount('');
    setRecipientCode('');
    setRecipientUserId(null);
    setDescription('');
    setIntlPreview(null);
    setShowIntlConfirm(false);
    onSuccess?.();
    window.dispatchEvent(new CustomEvent('wallet-updated'));
    return true;
  };

  const handleIntlConfirm = async () => {
    if (!intlPreview) return;
    setIntlExecuting(true);
    try {
      await executeInternationalTransfer();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du transfert international');
    } finally {
      setIntlExecuting(false);
    }
  };

  const isPinSpecificError = (msg: string) =>
    /code pin|pin invalide|pin bloqué|tentative|configurer.*pin/i.test(msg);

  const handlePinConfirm = async (pin: string) => {
    if (!pendingTransferKind) return;

    try {
      setPinLoading(true);
      setPinError(null);

      const success = pendingTransferKind === 'international'
        ? await executeInternationalTransfer(pin)
        : await executeLocalTransfer(pin);

      if (success) {
        setPinPromptOpen(false);
        setPendingTransferKind(null);
      }
    } catch (error: any) {
      const msg = error.message || 'Erreur lors du transfert';
      if (isPinSpecificError(msg)) {
        setPinError(msg);
      } else {
        // Erreur hors PIN (solde, réseau, etc.) — ferme le dialog et affiche un toast clair
        setPinPromptOpen(false);
        setPendingTransferKind(null);
        toast.error(msg);
      }
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant={variant} size={size} className={className}>
            <Send className="h-4 w-4" />
            {showText && <span>Transfert rapide</span>}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Transfert rapide
            </DialogTitle>
            <DialogDescription>
              Transférez des fonds rapidement à un autre utilisateur
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Code expéditeur (affiché) */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('unifiedTransferDialog.votreCode')}</span>
                <Badge variant="default" className="font-mono text-base">
                  {senderCode}
                </Badge>
              </div>
            </div>

            {/* Destinataire - recherche par ID, email ou téléphone */}
            <div className="space-y-2">
              <UserSearchInput
                value={recipientCode}
                onChange={(val) => {
                  setRecipientCode(val);
                  setRecipientUserId(null);
                }}
                onUserSelect={(userId) => setRecipientUserId(userId)}
                label="Destinataire"
                placeholder={t('unifiedTransferDialog.idEmailOuTelephone')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Montant ({walletCurrency}) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="amount"
                  type="number"
                  placeholder="Ex: 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                />
                {walletCurrency !== 'GNF' && (
                  <Badge variant="secondary" className="shrink-0">
                    <Globe className="w-3 h-3 mr-1" />
                    {walletCurrency}
                  </Badge>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('unifiedTransferDialog.motifDuTransfert')}</Label>
              <Input
                id="description"
                placeholder={t('unifiedTransferDialog.exPaiementProduitRemboursement')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button
              onClick={handlePreview}
              disabled={loading || !amount || !recipientCode || !description}
              className="w-full"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Vérification...' : 'Voir les frais et confirmer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation avec prévisualisation */}
      <AlertDialog open={showPreview} onOpenChange={setShowPreview}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="w-5 h-5 text-primary" />
              Confirmer le transfert
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 mt-4">
                {/* Informations du destinataire */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    👤 Informations du destinataire
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Nom:</strong> {preview?.receiver.name}</p>
                    <p><strong>Email:</strong> {preview?.receiver.email}</p>
                    <p><strong>{t('unifiedTransferDialog.telephone')}</strong> {preview?.receiver.phone}</p>
                    <p><strong>ID:</strong> <Badge variant="outline" className="font-mono">{preview?.receiver.custom_id}</Badge></p>
                  </div>
                </div>

                {/* Détails du transfert */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{t('unifiedTransferDialog.montantATransferer')}</span>
                    <span className="text-lg font-bold">{preview?.amount?.toLocaleString()} {walletCurrency}</span>
                  </div>
                  <div className="flex justify-between items-center text-orange-600 dark:text-orange-400">
                    <span className="text-sm font-medium">💸 Frais de transfert ({preview?.fee_percent}%)</span>
                    <span className="text-lg font-bold">{preview?.fee_amount?.toLocaleString()} {walletCurrency}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="text-sm font-medium">{t('unifiedTransferDialog.totalDebiteDeVotreCompte')}</span>
                    <span className="text-xl font-bold text-[#ff4000] dark:text-[#ff4000]">{preview?.total_debit?.toLocaleString()} {walletCurrency}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#ff4000] dark:text-[#ff4000]">
                    <span className="text-sm font-medium">{t('unifiedTransferDialog.montantNetRecuParLe')}</span>
                    <span className="text-lg font-bold">{preview?.amount_received?.toLocaleString()} {walletCurrency}</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm">
                    <strong>{t('unifiedTransferDialog.soldeActuel')}</strong> {preview?.current_balance?.toLocaleString()} {walletCurrency}
                    <br />
                    <strong>{t('unifiedTransferDialog.soldeApresTransfert')}</strong> {preview?.balance_after?.toLocaleString()} {walletCurrency}
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  Souhaitez-vous confirmer ce transfert ?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>{t('unifiedTransferDialog.nonAnnuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Oui, confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* International confirmation with rate-lock timer */}
      <InternationalTransferConfirmation
        open={showIntlConfirm}
        onOpenChange={(val) => {
          setShowIntlConfirm(val);
          if (!val && !pinPromptOpen) setIntlPreview(null);
        }}
        preview={intlPreview}
        onConfirm={handleIntlConfirm}
        loading={intlExecuting}
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
        onConfirm={handlePinConfirm}
      />
    </>
  );
}

/**
 * 💳 PANNEAU OPÉRATIONS WALLET
 * Interface complète pour dépôt, retrait, transfert
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWallet } from '@/hooks/useWallet';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  Smartphone,
  Wallet as WalletIcon,
  Loader2,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { changeWalletPin, getWalletPinStatus, previewWalletTransfer, resetWalletPin, resolveWalletRecipient, setupWalletPin } from '@/services/walletBackendService';
import { WalletPinPromptDialog, WalletPinSetupDialog } from '@/components/wallet/WalletPinDialogs';
import { InternationalTransferConfirmation, type InternationalPreviewData } from '@/components/wallet/InternationalTransferConfirmation';
import { useTranslation } from "@/hooks/useTranslation";

// ChapChapPay - Mobile Money
const PAYMENT_METHODS = [
  { value: 'orange_money', label: 'Orange Money', icon: Smartphone, color: 'text-orange-600' },
  { value: 'mtn_money', label: 'MTN Money', icon: Smartphone, color: 'text-[#ff4000]' },
  { value: 'wallet_224', label: '224Wallet', icon: WalletIcon, color: 'text-[#04439e]' }
];

export function WalletOperationsPanel() {
  const { t } = useTranslation();
  const { wallet, balance, currency, processing, deposit, withdraw, transfer } = useWallet();
  const [pinStatus, setPinStatus] = useState<{ pin_enabled: boolean; pin_locked_until: string | null } | null>(null);
  const [pinAction, setPinAction] = useState<'withdraw' | 'transfer' | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinSetupMode, setPinSetupMode] = useState<'setup' | 'change' | 'reset'>('setup');
  const [intlPreview, setIntlPreview] = useState<InternationalPreviewData | null>(null);
  const [showIntlConfirm, setShowIntlConfirm] = useState(false);
  const [intlConfirmLoading, setIntlConfirmLoading] = useState(false);

  // États formulaires
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('card');

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('card');

  const [transferAmount, setTransferAmount] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

  const loadPinStatus = async () => {
    try {
      const response = await getWalletPinStatus();
      if (response.success && response.data) {
        setPinStatus({
          pin_enabled: response.data.pin_enabled,
          pin_locked_until: response.data.pin_locked_until,
        });
        return;
      }
    } catch (error) {
      console.warn('Impossible de charger le statut PIN du wallet:', error);
    }

    setPinStatus({
      pin_enabled: false,
      pin_locked_until: null,
    });
  };

  useEffect(() => {
    void loadPinStatus();
  }, []);

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('walletOperationsPanel.montantInvalide'));
      return;
    }

    const success = await deposit(amount, depositMethod, {
      description: `Dépôt via ${PAYMENT_METHODS.find(m => m.value === depositMethod)?.label}`
    });

    if (success) {
      setDepositAmount('');
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('walletOperationsPanel.montantInvalide'));
      return;
    }

    if (amount > balance) {
      toast.error(t('walletOperationsPanel.soldeInsuffisant'));
      return;
    }

    setPinAction('withdraw');

    if (!pinStatus?.pin_enabled) {
      setPinSetupMode('setup');
      setPinSetupOpen(true);
      return;
    }

    setPinPromptOpen(true);
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('walletOperationsPanel.montantInvalide'));
      return;
    }

    if (!recipientId || recipientId.trim().length < 3) {
      toast.error('Destinataire invalide');
      return;
    }

    if (!transferDescription) {
      toast.error('Description requise');
      return;
    }

    const recipientResolution = await resolveWalletRecipient(recipientId);
    if (!recipientResolution.success || !recipientResolution.data?.userId) {
      toast.error(recipientResolution.error || 'Destinataire introuvable');
      return;
    }

    const resolvedId = recipientResolution.data.userId;
    if (resolvedId === wallet.user_id) {
      toast.error(t('walletOperationsPanel.vousNePouvezPasTransferer'));
      return;
    }

    setRecipientId(resolvedId);
    setPinAction('transfer');

    // Vérifier si le transfert est international avant le PIN
    const preview = await previewWalletTransfer(resolvedId, amount);
    if (preview.success && preview.data?.is_international) {
      setIntlPreview(preview.data as InternationalPreviewData);
      setShowIntlConfirm(true);
      return; // Afficher la confirmation internationale d'abord
    }

    // Transfert local : passer directement au PIN
    if (!pinStatus?.pin_enabled) {
      setPinSetupMode('setup');
      setPinSetupOpen(true);
      return;
    }

    setPinPromptOpen(true);
  };

  const handlePinConfirm = async (pin: string) => {
    try {
      setPinLoading(true);
      setPinError(null);

      let success = false;

      if (pinAction === 'withdraw') {
        const amount = parseFloat(withdrawAmount);
        success = await withdraw(amount, withdrawMethod, {
          description: `Retrait via ${PAYMENT_METHODS.find(m => m.value === withdrawMethod)?.label}`,
          pin,
        });
        if (success) {
          setWithdrawAmount('');
        }
      }

      if (pinAction === 'transfer') {
        const amount = parseFloat(transferAmount);
        success = await transfer(recipientId, amount, transferDescription, { pin });
        if (success) {
          setTransferAmount('');
          setRecipientId('');
          setTransferDescription('');
        }
      }

      if (success) {
        setPinPromptOpen(false);
        setPinAction(null);
        setPinError(null);
      }
      // Échec : dialog reste ouvert pour retry — le toast de useWallet affiche déjà l'erreur
    } catch (error: any) {
      const msg = error?.message || 'Erreur lors de l\'opération';
      const isPinError = /code pin|pin invalide|pin bloqué|tentative|configurer.*pin/i.test(msg);
      if (isPinError) {
        setPinError(msg);
      } else {
        setPinPromptOpen(false);
        setPinAction(null);
        setPinError(null);
        toast.error(msg);
      }
    } finally {
      setPinLoading(false);
      await loadPinStatus();
    }
  };

  const handlePinSetup = async ({
    currentPin,
    accountPassword,
    pin,
    confirmPin,
  }: {
    currentPin?: string;
    accountPassword?: string;
    pin: string;
    confirmPin: string;
  }) => {
    try {
      setPinLoading(true);
      setPinError(null);

      const response = pinSetupMode === 'change'
        ? await changeWalletPin(currentPin || '', pin, confirmPin)
        : pinSetupMode === 'reset'
          ? await resetWalletPin(accountPassword || '', pin, confirmPin)
          : await setupWalletPin(pin, confirmPin);

      if (!response.success) {
        throw new Error(response.error || 'Erreur configuration code PIN');
      }

      await loadPinStatus();
      setPinSetupOpen(false);

      if (pinSetupMode === 'setup' && pinAction) {
        toast.success(t('walletOperationsPanel.codePinActiveConfirmezMaintenant'));
        setPinPromptOpen(true);
        return;
      }

      toast.success(
        pinSetupMode === 'change'
          ? 'Code PIN modifié'
          : pinSetupMode === 'reset'
            ? 'Code PIN réinitialisé'
            : 'Code PIN activé'
      );
      setPinAction(null);
    } catch (error: any) {
      setPinError(error?.message || 'Erreur configuration code PIN');
    } finally {
      setPinLoading(false);
    }
  };

  if (!wallet) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <WalletIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('walletOperationsPanel.walletEnCoursDeChargement')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('walletOperationsPanel.operationsWallet')}</CardTitle>
          <CardDescription>
            Dépôt, retrait et transfert d'argent
          </CardDescription>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {pinStatus?.pin_enabled ? 'Code PIN actif pour retraits et transferts' : 'Code PIN non configuré'}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setPinAction(null);
              setPinSetupMode(pinStatus?.pin_enabled ? 'change' : 'setup');
              setPinError(null);
              setPinSetupOpen(true);
            }}>
              <Shield className="w-4 h-4 mr-2" />
              {pinStatus?.pin_enabled ? 'Modifier PIN' : 'Activer PIN'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="deposit" className="gap-1 text-xs sm:text-sm sm:gap-2">
                <ArrowDownToLine className="w-3 h-3 sm:w-4 sm:h-4" />
                Dépôt
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="gap-1 text-xs sm:text-sm sm:gap-2">
                <ArrowUpFromLine className="w-3 h-3 sm:w-4 sm:h-4" />
                Retrait
              </TabsTrigger>
              <TabsTrigger value="transfer" className="gap-1 text-xs sm:text-sm sm:gap-2">
                <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                Transfert
              </TabsTrigger>
            </TabsList>

          {/* Dépôt */}
          <TabsContent value="deposit" className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-[#ff4000]">
                Solde actuel: <span className="font-bold">{balance.toLocaleString()} {currency}</span>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="deposit-amount">Montant à déposer ({currency})</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  placeholder="10000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="0"
                />
              </div>

              <div>
                <Label>{t('walletOperationsPanel.methodeDePaiement')}</Label>
                <Select value={depositMethod} onValueChange={setDepositMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <method.icon className={`w-4 h-4 ${method.color}`} />
                          {method.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleDeposit}
                disabled={!depositAmount || processing}
                className="w-full bg-[#ff4000] hover:bg-[#ff4000]"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4 mr-2" />
                    Confirmer le dépôt
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Retrait */}
          <TabsContent value="withdraw" className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-800">
                Solde disponible: <span className="font-bold">{balance.toLocaleString()} {currency}</span>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="withdraw-amount">Montant à retirer ({currency})</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="10000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="0"
                  max={balance}
                />
              </div>

              <div>
                <Label>{t('walletOperationsPanel.methodeDeRetrait')}</Label>
                <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <method.icon className={`w-4 h-4 ${method.color}`} />
                          {method.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || processing}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="w-4 h-4 mr-2" />
                    Confirmer le retrait
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Transfert */}
          <TabsContent value="transfer" className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                Solde disponible: <span className="font-bold">{balance.toLocaleString()} {currency}</span>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Destinataire</Label>
                <Input
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  placeholder={t('walletOperationsPanel.idEmailOuTelephone')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Entrez l'ID (ex: CLT0001), l'email ou le numéro de téléphone
                </p>
              </div>

              <div>
                <Label htmlFor="transfer-amount">Montant à envoyer ({currency})</Label>
                <Input
                  id="transfer-amount"
                  type="number"
                  placeholder="10000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  min="0"
                  max={balance}
                />
              </div>

              <div>
                <Label htmlFor="transfer-description">{t('walletOperationsPanel.motifDuTransfert')}</Label>
                <Textarea
                  id="transfer-description"
                  placeholder={t('walletOperationsPanel.exPaiementFactureRemboursement')}
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleTransfer}
                disabled={!transferAmount || !recipientId || !transferDescription || processing}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Confirmer le transfert
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <WalletPinPromptDialog
        open={pinPromptOpen}
        onOpenChange={(value) => {
          setPinPromptOpen(value);
          if (!value) {
            setPinError(null);
            setPinAction(null);
          }
        }}
        loading={pinLoading}
        error={pinError}
        onConfirm={handlePinConfirm}
        onForgotPin={() => {
          setPinPromptOpen(false);
          setPinError(null);
          setPinSetupMode('reset');
          setPinSetupOpen(true);
        }}
      />
      <WalletPinSetupDialog
        open={pinSetupOpen}
        onOpenChange={(value) => {
          setPinSetupOpen(value);
          if (!value) {
            setPinError(null);
            if (!pinPromptOpen) {
              setPinAction(null);
            }
          }
        }}
        mode={pinSetupMode}
        loading={pinLoading}
        error={pinError}
        onSubmit={handlePinSetup}
        onForgotPin={() => {
          setPinError(null);
          setPinSetupMode('reset');
        }}
      />

      {/* Confirmation transfert international */}
      <InternationalTransferConfirmation
        open={showIntlConfirm}
        onOpenChange={(val) => {
          setShowIntlConfirm(val);
          if (!val) {
            setIntlPreview(null);
            if (!pinPromptOpen) setPinAction(null);
          }
        }}
        preview={intlPreview}
        loading={intlConfirmLoading}
        onConfirm={() => {
          setShowIntlConfirm(false);
          if (!pinStatus?.pin_enabled) {
            setPinSetupMode('setup');
            setPinSetupOpen(true);
          } else {
            setPinPromptOpen(true);
          }
        }}
      />
    </>
  );
}

export default WalletOperationsPanel;

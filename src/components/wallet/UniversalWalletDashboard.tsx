import React, { useCallback, useMemo, useState } from 'react';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, RefreshCw, AlertCircle, Eye, EyeOff, CreditCard, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import WalletTransactionHistory from "@/components/WalletTransactionHistory";
import { UnifiedTransferDialog } from "./UnifiedTransferDialog";
import StripeWalletTopup from "./StripeWalletTopup";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentMethodsManager } from "@/components/payment/PaymentMethodsManager";
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

type DepositMethod = 'card' | 'orange' | 'momo' | 'cash';
type WithdrawMethod = 'orange' | 'momo' | 'cash';

interface UniversalWalletDashboardProps {
  userId: string;
  userCode?: string;
  showTransactions?: boolean;
}

export default function UniversalWalletDashboard({
  userId,
  userCode,
  showTransactions = true
}: UniversalWalletDashboardProps) {
  const { convert } = usePriceConverter();
  const { t } = useTranslation();
  const [wallet, setWallet] = useState<any>(null);
  const [_transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('card');
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawMethod>('orange');
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDepositConfirm, setShowDepositConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const loadWallet = useCallback(async () => {
    if (!userId) {
      console.warn('loadWallet: userId manquant');
      return;
    }

    try {
      setLoading(true);

      console.log('🔍 Chargement wallet pour userId:', userId);

      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (walletError) {
        console.error('❌ Erreur chargement wallet:', walletError);

        // Si le wallet n'existe pas, l'initialiser via RPC
        if (walletError.code === 'PGRST116') {
          console.log('💡 Initialisation du wallet via RPC pour:', userId);

          try {
            const { data: initResult, error: rpcError } = await supabase
              .rpc('initialize_user_wallet', { p_user_id: userId });

            console.log('📊 Résultat RPC initialize_user_wallet:', { initResult, rpcError });

            if (rpcError) {
              console.error('❌ Erreur RPC initialize_user_wallet:', rpcError);
              toast.error(t('wallet.depositError'));
              throw rpcError;
            }

            const result = initResult as any;
            if (!result || !result.success) {
              const errorMsg = result?.error || 'Échec initialisation wallet';
              console.error('❌ Échec initialisation wallet:', errorMsg);
              toast.error(errorMsg);
              throw new Error(errorMsg);
            }

            console.log('✅ Wallet initialisé via RPC:', result);

            // Recharger le wallet depuis la base de données
            const { data: reloadedWallet, error: reloadError } = await supabase
              .from('wallets')
              .select('*')
              .eq('user_id', userId)
              .single();

            if (reloadError) {
              console.error('❌ Erreur rechargement wallet:', reloadError);
              throw reloadError;
            }

            console.log('✅ Wallet rechargé avec succès:', reloadedWallet);
            setWallet(reloadedWallet);
            toast.success(t('wallet.depositSuccess'));
            setLoading(false);
            return;
          } catch (initError: any) {
            console.error('❌ Erreur lors de l\'initialisation:', initError);
            toast.error(`Erreur: ${initError?.message || 'Impossible de charger le wallet'}`);
            throw initError;
          }
        } else {
          // Autre erreur (permissions, etc.)
          toast.error(t('wallet.depositError'));
          throw walletError;
        }
      }

      console.log('✅ Wallet chargé:', walletData);
      setWallet(walletData);

      // Charger les transactions
      if (showTransactions && walletData) {
        const { data: transData } = await supabase
          .from('wallet_transactions')
          .select('*')
          .or(`sender_wallet_id.eq.${walletData.id},receiver_wallet_id.eq.${walletData.id}`)
          .order('created_at', { ascending: false })
          .limit(20);

        setTransactions(transData || []);
      }
    } catch (error: any) {
      console.error('❌ Erreur critique chargement wallet:', error);
      toast.error(t('wallet.depositError'));
      setWallet(null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, showTransactions]);

  React.useEffect(() => {
    loadWallet();

    // Écouter les mises à jour
    const channel = supabase
      .channel(`wallet-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadWallet();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadWallet]);

  const balanceDisplay = useMemo(() => {
    if (!wallet) return "—";
    if (hidden) return "••••••";
    return convert(wallet.balance, wallet.currency).formatted;
  }, [wallet, hidden, convert]);

  const handleDeposit = useCallback(async () => {
    if (!wallet) return;
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast.error(t('wallet.invalidAmount'));
      return;
    }
    if (amount < 1000) {
      toast.error(t('wallet.minDeposit'));
      return;
    }

    setShowDepositConfirm(false);

    try {
      setBusy(true);

      const referenceNumber = `DEP${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // ⚡ Update atomique du balance (évite race conditions)
      const { data: _balanceData, error: balanceError } = await supabase
        .rpc('update_wallet_balance_atomic', {
          p_wallet_id: wallet.id,
          p_amount: amount,
          p_tx_id: referenceNumber,
          p_description: 'Dépôt sur le wallet'
        });

      if (balanceError) throw balanceError;

      // Enregistrer la transaction
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          transaction_id: referenceNumber,
          transaction_type: 'deposit',
          amount: amount,
          net_amount: amount,
          fee: 0,
          currency: wallet.currency || 'GNF',
          status: 'completed',
          description: 'Dépôt sur le wallet',
          receiver_wallet_id: wallet.id,
          receiver_user_id: userId
        });

      if (transactionError) console.warn('Transaction log failed:', transactionError);

      setDepositAmount("");
      toast.success(t('wallet.depositSuccess'));
      window.dispatchEvent(new Event('wallet-updated'));
      await loadWallet();
    } catch (e: any) {
      console.error('Deposit error:', e);
      toast.error(t('wallet.depositError'));
    } finally {
      setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositAmount, userId, wallet, loadWallet]);

  const handleWithdraw = useCallback(async () => {
    if (!wallet) return;
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error(t('wallet.invalidAmount'));
      return;
    }
    if (amount < 5000) {
      toast.error(t('wallet.minWithdraw'));
      return;
    }
    if (amount > wallet.balance) {
      toast.error(t('wallet.insufficientBalance'));
      return;
    }

    setShowWithdrawConfirm(false);

    try {
      setBusy(true);

      const referenceNumber = `WDR${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // ⚡ Update atomique du balance (avec montant négatif pour retrait)
      const { data: _balanceData, error: balanceError } = await supabase
        .rpc('update_wallet_balance_atomic', {
          p_wallet_id: wallet.id,
          p_amount: -amount, // Négatif pour retrait
          p_tx_id: referenceNumber,
          p_description: 'Retrait du wallet'
        });

      if (balanceError) throw balanceError;

      // Enregistrer la transaction
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          transaction_id: referenceNumber,
          transaction_type: 'withdrawal',
          amount: amount,
          net_amount: amount,
          fee: 0,
          currency: wallet.currency || 'GNF',
          status: 'completed',
          description: 'Retrait du wallet',
          sender_wallet_id: wallet.id,
          sender_user_id: userId
        });

      if (transactionError) console.warn('Transaction log failed:', transactionError);

      setWithdrawAmount("");
      toast.success(t('wallet.withdrawSuccess'));
      window.dispatchEvent(new Event('wallet-updated'));
      await loadWallet();
    } catch (e: any) {
      console.error('Withdraw error:', e);
      toast.error(t('wallet.withdrawError'));
    } finally {
      setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawAmount, userId, wallet, loadWallet]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-4">
            <AlertCircle className="w-12 h-12 text-orange-600" />
            <div className="text-center">
              <h3 className="font-semibold text-orange-800 mb-2">{t('wallet.unavailable')}</h3>
              <p className="text-sm text-orange-600 mb-4">
                {t('error.network')}
              </p>
              <Button
                onClick={loadWallet}
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('error.tryAgain')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Carte solde */}
      <Card className="bg-[#04439e] text-white border-0">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center">
                <WalletIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-xs sm:text-sm opacity-90">{t('wallet.availableBalance')}</p>
                <p className="text-2xl sm:text-3xl font-bold">{balanceDisplay}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setHidden(!hidden)}
              >
                {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={loadWallet}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Badge variant="secondary" className="bg-white/20">
              {t('wallet.walletId')}: {String(wallet.id).slice(0, 8)}...
            </Badge>
            <Badge variant="secondary" className="bg-white/20">
              {t('wallet.walletCurrency')}: {wallet.currency}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Actions - 3 onglets principaux */}
      <Tabs defaultValue="deposit" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deposit" className="flex items-center gap-1 text-xs sm:text-sm">
            <ArrowDownCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {t('wallet.deposit')}
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="flex items-center gap-1 text-xs sm:text-sm">
            <ArrowUpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {t('wallet.withdraw')}
          </TabsTrigger>
          <TabsTrigger value="transfer" className="flex items-center gap-1 text-xs sm:text-sm">
            <WalletIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {t('wallet.transfer')}
          </TabsTrigger>
        </TabsList>

        {/* DÉPÔT - avec sous-options */}
        <TabsContent value="deposit">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowDownCircle className="w-5 h-5 text-[#ff4000]" />
                {t('wallet.rechargeMyWallet')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sélection de la méthode */}
              <div className="space-y-2">
                <Label>{t('wallet.paymentMethod')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={depositMethod === 'card' ? 'default' : 'outline'}
                    onClick={() => setDepositMethod('card')}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="text-xs">{t('wallet.card')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant={depositMethod === 'orange' ? 'default' : 'outline'}
                    onClick={() => setDepositMethod('orange')}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                  >
                    <Smartphone className="w-5 h-5 text-orange-500" />
                    <span className="text-xs">Orange Money</span>
                  </Button>
                  <Button
                    type="button"
                    variant={depositMethod === 'momo' ? 'default' : 'outline'}
                    onClick={() => setDepositMethod('momo')}
                    className="flex flex-col items-center gap-1 h-auto py-3 col-span-2 sm:col-span-1"
                  >
                    <Smartphone className="w-5 h-5 text-[#ff4000]" />
                    <span className="text-xs">MTN MoMo</span>
                  </Button>
                </div>
              </div>

              {/* Formulaire selon la méthode */}
              {depositMethod === 'card' && (
                <StripeWalletTopup
                  userId={userId}
                  walletId={wallet.id}
                  onSuccess={loadWallet}
                />
              )}

              {(depositMethod === 'orange' || depositMethod === 'momo') && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                   <Label>{t('wallet.phoneNumber')}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">+224</span>
                      <Input
                        type="tel"
                        placeholder="6XX XXX XXX"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('wallet.quickAmounts')}</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[10000, 25000, 50000, 100000, 250000, 500000].map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={depositAmount === String(amt) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDepositAmount(String(amt))}
                        >
                          {amt.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('wallet.customAmount')}</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 50000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min="5000"
                    />
                    <p className="text-xs text-muted-foreground">{t('wallet.minAmount')}: 5,000 GNF</p>
                  </div>

                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-700 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      {t('wallet.mobileConfirmNotif')} ({depositMethod === 'orange' ? 'Orange Money' : 'MTN MoMo'})
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      if (!phoneNumber) {
                        toast.error(t('wallet.enterPhone'));
                        return;
                      }
                      if (!depositAmount || parseFloat(depositAmount) < 5000) {
                        toast.error(t('wallet.minDeposit'));
                        return;
                      }
                      toast.info(`Envoi de la demande ${depositMethod === 'orange' ? 'Orange Money' : 'MTN MoMo'}...`);
                      // TODO: Intégrer l'API Orange Money / MTN MoMo
                      setTimeout(() => {
                        toast.success(t('universalWalletDashboard.demandeEnvoyeeConfirmezSurVotre'));
                      }, 1500);
                    }}
                    disabled={busy || !depositAmount || !phoneNumber}
                    className={`w-full ${depositMethod === 'orange' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#ff4000] hover:bg-[#ff4000]'}`}
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    {t('wallet.recharge')} {convert(parseFloat(depositAmount || '0'), 'GNF').formatted}
                  </Button>
                </div>
              )}

              {depositMethod === 'cash' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>{t('wallet.amountToDeposit')}</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 50000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min="1000"
                    />
                    <p className="text-xs text-muted-foreground">{t('wallet.minAmount')}: 1,000 GNF</p>
                  </div>
                  <Button
                    onClick={() => setShowDepositConfirm(true)}
                    disabled={busy || !depositAmount}
                    className="w-full"
                  >
                    {busy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}
                    {t('wallet.depositBtn')} {convert(parseFloat(depositAmount || '0'), 'GNF').formatted}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RETRAIT - avec sous-options */}
        <TabsContent value="withdraw">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowUpCircle className="w-5 h-5 text-[#ff4000]" />
                {t('wallet.withdrawFunds')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sélection de la méthode */}
              <div className="space-y-2">
                <Label>{t('wallet.withdrawalMethod')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={withdrawMethod === 'orange' ? 'default' : 'outline'}
                    onClick={() => setWithdrawMethod('orange')}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                  >
                    <Smartphone className="w-5 h-5 text-orange-500" />
                    <span className="text-xs">Orange Money</span>
                  </Button>
                  <Button
                    type="button"
                    variant={withdrawMethod === 'momo' ? 'default' : 'outline'}
                    onClick={() => setWithdrawMethod('momo')}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                  >
                    <Smartphone className="w-5 h-5 text-[#ff4000]" />
                    <span className="text-xs">MTN MoMo</span>
                  </Button>
                </div>
              </div>

              {/* Numéro pour mobile money */}
              {(withdrawMethod === 'orange' || withdrawMethod === 'momo') && (
                <div className="space-y-2">
                  <Label>{t('wallet.phoneNumber')}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">+224</span>
                    <Input
                      type="tel"
                      placeholder="6XX XXX XXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('wallet.amountToWithdraw')}</Label>
                <Input
                  type="number"
                  placeholder="Ex: 50000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="5000"
                  max={wallet.balance}
                />
                <p className="text-xs text-muted-foreground">
                  {t('wallet.minAmount')}: 5,000 GNF | {t('wallet.availableBalance')}: {convert(wallet.balance, wallet.currency).formatted}
                </p>
              </div>

              <Button
                onClick={() => {
                  if ((withdrawMethod === 'orange' || withdrawMethod === 'momo') && !phoneNumber) {
                    toast.error(t('wallet.enterPhone'));
                    return;
                  }
                  setShowWithdrawConfirm(true);
                }}
                disabled={busy || !withdrawAmount}
                variant="destructive"
                className="w-full"
              >
                {busy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUpCircle className="w-4 h-4 mr-2" />}
                {t('wallet.withdrawBtn')} {convert(parseFloat(withdrawAmount || '0'), 'GNF').formatted}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRANSFERT */}
        <TabsContent value="transfer">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletIcon className="w-5 h-5 text-blue-600" />
                {t('wallet.transferMoney')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userCode ? (
                <UnifiedTransferDialog
                  senderCode={userCode}
                  variant="default"
                  size="lg"
                  className="w-full"
                  showText={true}
                  onSuccess={() => {
                    toast.success(t('wallet.transferSuccess'));
                    loadWallet();
                  }}
                />
              ) : (
                <div className="text-center p-6">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                  <p className="text-sm text-muted-foreground">
                    {t('wallet.userCodeUnavailable')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Moyens de paiement — sous Dépôt/Retrait/Transfert */}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => setShowPaymentMethods(true)}
      >
        <CreditCard className="w-4 h-4" />
        Moyens de paiement
      </Button>

      <Dialog open={showPaymentMethods} onOpenChange={setShowPaymentMethods}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('universalWalletDashboard.moyensDePaiement')}</DialogTitle>
          </DialogHeader>
          <PaymentMethodsManager />
        </DialogContent>
      </Dialog>

      {/* Historique des transactions */}
      {showTransactions && (
        <WalletTransactionHistory limit={20} />
      )}

      {/* Dialogs de confirmation */}
      <AlertDialog open={showDepositConfirm} onOpenChange={setShowDepositConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wallet.confirmDeposit')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('wallet.depositConfirmMsg')} ({convert(parseFloat(depositAmount || '0'), 'GNF').formatted})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('wallet.cancelBtn')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeposit}>{t('wallet.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wallet.confirmWithdraw')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('wallet.withdrawConfirmMsg')} ({convert(parseFloat(withdrawAmount || '0'), 'GNF').formatted})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('wallet.cancelBtn')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleWithdraw} className="bg-destructive hover:bg-destructive/90">
              {t('wallet.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
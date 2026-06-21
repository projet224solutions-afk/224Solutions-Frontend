import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Wallet as WalletIcon, _ArrowDownCircle, ArrowUpCircle, RefreshCw, AlertCircle, Smartphone, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import WalletTransactionHistory from "@/components/WalletTransactionHistory";
import { useTranslation } from "@/hooks/useTranslation";
import { useVendorCurrency } from "@/hooks/useVendorCurrency";
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

interface WalletInfo {
  id: string;
  balance: number;
  currency: string;
}

export default function WalletDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { currency: vendorCurrency } = useVendorCurrency();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTransferPreview, setShowTransferPreview] = useState(false);
  const [transferPreview, setTransferPreview] = useState<any>(null);
  const [showFedaPayDialog, setShowFedaPayDialog] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadWalletData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadWalletData = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('id, balance, currency')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setWallet(data);
    } catch (error) {
      console.error('Erreur chargement wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const _walletId = useMemo(() => wallet?.id, [wallet]);
  const balanceDisplay = useMemo(() => {
    if (!wallet) return "—";
    // Le solde est DÉJÀ stocké dans la devise du wallet (converti par le PDG si changement).
    // On l'affiche directement, SANS reconvertir (sinon double conversion = montant faux).
    return `${Number(wallet.balance || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${wallet.currency || vendorCurrency}`;
  }, [wallet, vendorCurrency]);

  const _handleDeposit = useCallback(async () => {
    if (!user?.id || !wallet) return;
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast.error(t('wallet.invalidAmount'));
      return;
    }
    if (amount < 1000) {
      toast.error(`${t('wallet.minDeposit')} 1000 ${wallet.currency}`);
      return;
    }
    try {
      setBusy(true);

      // Créer une transaction de dépôt
      const referenceNumber = `DEP${Date.now()}${Math.floor(Math.random() * 1000)}`;

      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          transaction_id: referenceNumber,
          transaction_type: 'deposit',
          amount: amount,
          net_amount: amount,
          fee: 0,
          currency: wallet.currency,
          status: 'completed',
          description: t('wallet.deposit'),
          receiver_wallet_id: wallet.id
        });

      if (transactionError) throw transactionError;

      // Mettre à jour le solde du wallet
      const newBalance = wallet.balance + amount;
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setDepositAmount("");
      toast.success(`${t('wallet.depositSuccess')}: ${amount.toLocaleString()} ${wallet.currency}`);
      await loadWalletData();
    } catch (e: any) {
      console.error('Erreur dépôt:', e);
      toast.error(e?.message || t('wallet.depositError'));
    } finally {
      setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositAmount, user?.id, wallet, t]);

  const handleWithdraw = useCallback(async () => {
    if (!user?.id || !wallet) return;
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error(t('wallet.invalidAmount'));
      return;
    }
    if (amount < 5000) {
      toast.error(`${t('wallet.minWithdraw')} 5000 ${wallet.currency}`);
      return;
    }
    if (amount > wallet.balance) {
      toast.error(t('wallet.insufficientBalance'));
      return;
    }
    try {
      setBusy(true);

      // Créer une transaction de retrait
      const referenceNumber = `WDR${Date.now()}${Math.floor(Math.random() * 1000)}`;

      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          transaction_id: referenceNumber,
          transaction_type: 'withdraw',
          amount: -amount,
          net_amount: -amount,
          fee: 0,
          currency: wallet.currency,
          status: 'completed',
          description: t('wallet.withdraw'),
          sender_wallet_id: wallet.id
        });

      if (transactionError) throw transactionError;

      // Mettre à jour le solde du wallet
      const newBalance = wallet.balance - amount;
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setWithdrawAmount("");
      toast.success(`${t('wallet.withdrawSuccess')}: ${amount.toLocaleString()} ${wallet.currency}`);
      await loadWalletData();
    } catch (e: any) {
      console.error('Erreur retrait:', e);
      toast.error(e?.message || t('wallet.withdrawError'));
    } finally {
      setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawAmount, user?.id, wallet, t]);

  const handlePreviewTransfer = useCallback(async () => {
    if (!user?.id || !wallet) return;
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) {
      toast.error(t('wallet.invalidAmount'));
      return;
    }
    if (!receiverId) {
      toast.error(t('wallet.recipientRequired'));
      return;
    }

    try {
      setBusy(true);

      const recipientCodeUpper = receiverId.toUpperCase();

      console.log('🔍 [Vendeur] Début prévisualisation transfert:', {
        recipient: recipientCodeUpper,
        amount
      });

      // Récupérer notre propre code pour l'API
      let senderCode = null;

      // Chercher dans user_ids d'abord
      const { data: senderIdData } = await supabase
        .from('user_ids')
        .select('custom_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (senderIdData?.custom_id) {
        senderCode = senderIdData.custom_id;
      } else {
        // Sinon chercher dans profiles
        const { data: senderProfileData } = await supabase
          .from('profiles')
          .select('custom_id, public_id')
          .eq('id', user.id)
          .maybeSingle();

        senderCode = senderProfileData?.custom_id || senderProfileData?.public_id;
      }

      if (!senderCode) {
        toast.error(t('wallet.senderCodeNotFound'));
        setBusy(false);
        return;
      }

      console.log('📋 [Vendeur] Code expéditeur:', senderCode);
      console.log('📞 [Vendeur] Appel preview_wallet_transfer_by_code...');

      // Appeler la nouvelle fonction de prévisualisation par code
      const { data, error } = await supabase.rpc('preview_wallet_transfer_by_code', {
        p_sender_code: senderCode,
        p_receiver_code: recipientCodeUpper,
        p_amount: amount,
        p_currency: wallet?.currency || 'GNF'
      });

      if (error) {
        console.error('❌ [Vendeur] Erreur RPC:', error);
        throw error;
      }

      console.log('📋 [Vendeur] Résultat prévisualisation:', data);

      if (!data.success) {
        toast.error(data.error || t('wallet.previewError'));
        setBusy(false);
        return;
      }

      setTransferPreview(data);
      setShowTransferPreview(true);
    } catch (e: any) {
      console.error('Erreur prévisualisation:', e);
      toast.error(e?.message || t('wallet.previewError'));
    } finally {
      setBusy(false);
    }
  }, [transferAmount, receiverId, user?.id, wallet, t]);

  const handleConfirmTransfer = useCallback(async () => {
    if (!user?.id || !transferPreview) return;

    try {
      setBusy(true);
      setShowTransferPreview(false);

      console.log('💸 [Vendeur] Exécution du transfert...');

      // Récupérer notre code pour l'API
      let senderCode = null;
      const { data: senderIdData } = await supabase
        .from('user_ids')
        .select('custom_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (senderIdData?.custom_id) {
        senderCode = senderIdData.custom_id;
      } else {
        const { data: senderProfileData } = await supabase
          .from('profiles')
          .select('custom_id, public_id')
          .eq('id', user.id)
          .maybeSingle();

        senderCode = senderProfileData?.custom_id || senderProfileData?.public_id;
      }

      // Exécuter le transfert avec la nouvelle fonction
      const currency = wallet?.currency || 'GNF';
      const { _data, error } = await supabase.rpc('process_wallet_transfer_with_fees', {
        p_sender_code: senderCode,
        p_receiver_code: transferPreview.receiver.custom_id,
        p_amount: transferPreview.amount,
        p_currency: currency,
        p_description: transferReason || `Transfert de ${transferPreview.amount.toLocaleString()} ${currency}`
      });

      if (error) throw error;

      setTransferAmount("");
      setReceiverId("");
      setTransferReason("");
      setTransferPreview(null);

      toast.success(
        `✅ ${t('wallet.transferSuccess')}\n💸 ${t('wallet.feesApplied')}: ${transferPreview.fee_amount.toLocaleString()} ${currency}\n💰 ${t('wallet.amountTransferred')}: ${transferPreview.amount.toLocaleString()} ${currency}`,
        { duration: 5000 }
      );

      await loadWalletData();
    } catch (e: any) {
      console.error('Erreur transfert:', e);
      toast.error(e?.message || t('wallet.transferError'));
    } finally {
      setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferPreview, receiverId, transferReason, user?.id, wallet?.currency, t]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WalletIcon className="w-5 h-5" />
          {t('wallet.title')}
          <Badge variant="outline" className="ml-2">{t('wallet.operational')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border">
          <div>
            <p className="text-sm text-muted-foreground">{t('wallet.currentBalance')}</p>
            <p className="text-2xl font-bold">{balanceDisplay}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadWalletData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <Tabs defaultValue="deposit">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="deposit">{t('wallet.deposit')}</TabsTrigger>
            <TabsTrigger value="withdraw">{t('wallet.withdraw')}</TabsTrigger>
            <TabsTrigger value="transfer">{t('wallet.transfer')}</TabsTrigger>
            <TabsTrigger value="history">{t('wallet.history')}</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4">
            <div className="space-y-4">
              {/* ChapChapPay - Mobile Money */}
              <div className="p-4 border rounded-lg bg-[#04439e]/5">
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold">Recharge via Mobile Money</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Rechargez votre portefeuille via Orange Money ou MTN MoMo (ChapChapPay)
                </p>
                <Button
                  onClick={() => {/* TODO: Ouvrir dialogue ChapChapPay */}}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {t('wallet.rechargeWallet')}
                </Button>
              </div>

              {/* Montants rapides */}
              <div className="space-y-2">
                <Label>{t('wallet.quickAmounts')}</Label>
                <div className="flex flex-wrap gap-2">
                  {[5000, 10000, 25000, 50000, 100000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDepositAmount(amount.toString());
                        /* TODO: Ouvrir dialogue ChapChapPay */
                      }}
                    >
                      {amount.toLocaleString()} {wallet?.currency || 'GNF'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label>{t('wallet.amountToWithdraw')}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="number" placeholder="0" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                  <Button onClick={handleWithdraw} disabled={busy || !withdrawAmount} className="min-w-[140px]">
                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                    {t('wallet.withdrawBtn')}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transfer" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-3">
                <div>
                  <Label>{t('wallet.recipientCode')}</Label>
                  <Input
                    placeholder={t('wallet.recipientCodePlaceholder')}
                    value={receiverId}
                    onChange={(e) => setReceiverId(e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('wallet.recipientCodeHint')}
                  </p>
                </div>
                <div>
                  <Label>{t('wallet.transferReason')}</Label>
                  <Input placeholder={t('wallet.transferReasonPlaceholder')} value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
                </div>
                <div>
                  <Label>{t('wallet.amountToTransfer')}</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input type="number" placeholder="0" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
                    <Button onClick={handlePreviewTransfer} disabled={busy || !transferAmount || !receiverId} className="min-w-[140px]">
                      {t('wallet.transferBtn')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <WalletTransactionHistory />
          </TabsContent>
        </Tabs>

        {/* Dialog de confirmation avec prévisualisation */}
        <AlertDialog open={showTransferPreview} onOpenChange={setShowTransferPreview}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                {t('wallet.confirmTransfer')}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 mt-4">
                  {/* Informations du destinataire */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                    <h4 className="font-semibold text-blue-900 mb-2">👤 {t('wallet.recipientInfo')}</h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>{t('common.name')}:</strong> {transferPreview?.recipient_name}</p>
                      <p><strong>{t('common.email')}:</strong> {transferPreview?.recipient_email}</p>
                      <p><strong>{t('common.phone')}:</strong> {transferPreview?.recipient_phone}</p>
                      <p><strong>ID:</strong> {transferPreview?.recipient_code}</p>
                    </div>
                  </div>

                  {/* Détails du transfert */}
                  <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">💰 {t('wallet.amountToSend')}</span>
                      <span className="text-lg font-bold">{transferPreview?.amount?.toLocaleString()} {wallet?.currency || 'GNF'}</span>
                    </div>
                    <div className="flex justify-between items-center text-orange-600">
                      <span className="text-sm font-medium">💸 {t('wallet.fees')} ({transferPreview?.fee_percent}%)</span>
                      <span className="text-lg font-bold">{transferPreview?.fee_amount?.toLocaleString()} {wallet?.currency || 'GNF'}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="text-sm font-medium">📉 {t('wallet.totalDeducted')}</span>
                      <span className="text-xl font-bold text-[#ff4000]">{transferPreview?.total_debit?.toLocaleString()} {wallet?.currency || 'GNF'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#ff4000]">
                      <span className="text-sm font-medium">📈 {t('wallet.recipientWillReceive')}</span>
                      <span className="text-lg font-bold">{transferPreview?.amount_received?.toLocaleString()} {wallet?.currency || 'GNF'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{t('wallet.currentBalance')}:</strong> {transferPreview?.current_balance?.toLocaleString()} {wallet?.currency || 'GNF'}
                      <br />
                      <strong>{t('wallet.balanceAfter')}:</strong> {transferPreview?.balance_after?.toLocaleString()} {wallet?.currency || 'GNF'}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {t('wallet.confirmQuestion')}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{t('wallet.cancelBtn')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmTransfer} disabled={busy}>
                {t('wallet.confirmBtn')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog Mobile Money ChapChapPay - fonctionnalité à implémenter */}
        <AlertDialog open={showFedaPayDialog} onOpenChange={setShowFedaPayDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#ff4000]" />
                {t('wallet.mobileMoneyRecharge')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <p className="text-center py-4">
                  {t('wallet.mobileMoneyComingSoon')}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.close')}</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

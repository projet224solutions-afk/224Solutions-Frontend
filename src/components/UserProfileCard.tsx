import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  depositToWallet,
  previewWalletTransfer,
  transferToWallet,
  withdrawFromWallet,
} from '@/services/walletBackendService';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  AlertCircle
} from 'lucide-react';

interface UserInfo {
  customId: string | null;
  wallet: {
    id: string | number;
    balance: number;
    currency: string;
  } | null;
  virtualCard: {
    id: string;
    card_number: string;
    expiry_date: string;
    status: string;
  } | null;
}

interface UserProfileCardProps {
  className?: string;
  showWalletDetails?: boolean;
}

export const UserProfileCard = ({ className = '', showWalletDetails = true }: UserProfileCardProps) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [userInfo, setUserInfo] = useState<UserInfo>({
    customId: null,
    wallet: null,
    virtualCard: null
  });
  const [loading, setLoading] = useState(true);
  const [_showCardNumber, _setShowCardNumber] = useState(true);
  const [_creatingCard, setCreatingCard] = useState(false);
  const [userRole, setUserRole] = useState<string>('client');

  // États pour les opérations wallet
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showTransferPreview, setShowTransferPreview] = useState(false);
  const [transferPreview, setTransferPreview] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadUserInfo();
      detectUserRole();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Détecter le rôle réel de l'utilisateur (agent, vendeur, etc.)
  const detectUserRole = async () => {
    if (!user) return;

    try {
      // Vérifier si c'est un agent
      const { data: agentData } = await supabase
        .from('agents_management')
        .select('agent_code, type_agent')
        .eq('user_id', user.id)
        .maybeSingle();

      if (agentData) {
        setUserRole(agentData.type_agent === 'sous_agent' ? 'Sous-Agent' : 'Agent');
        return;
      }

      // Vérifier si c'est un vendeur
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (vendorData) {
        setUserRole('Vendeur');
        return;
      }

      // Utiliser le rôle du profil ou 'Client' par défaut
      setUserRole(profile?.role || 'Client');
      setUserRole(profile?.role || 'Client');
    } catch (error) {
      console.error('Erreur détection rôle:', error);
      setUserRole(profile?.role || 'Client');
    }
  };

  const loadUserInfo = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Source unique: profiles.public_id (ID standardisé)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('public_id')
        .eq('id', user.id)
        .single();

      // Récupérer le wallet
      const { data: walletData } = await supabase
        .from('wallets')
        .select('id, balance, currency')
        .eq('user_id', user.id)
        .maybeSingle();

      // Récupérer la carte virtuelle
      const { data: cardData } = await supabase
        .from('virtual_cards')
        .select('id, card_number, expiry_date, status')
        .eq('user_id', user.id)
        .maybeSingle();

      setUserInfo({
        customId: profileData?.public_id || null,
        wallet: walletData || null,
        virtualCard: cardData || null
      });

    } catch (error) {
      console.error('Erreur chargement infos utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const _createVirtualCard = async () => {
    if (!user || !userInfo.wallet) {
      toast.error(t('userProfileCard.walletRequisPourCreerUne'));
      return;
    }

    setCreatingCard(true);
    try {
      // Générer les données de la carte
      const cardNumber = '2245' + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
      const cvv = Math.floor(Math.random() * 900 + 100).toString();
      const currentDate = new Date();
      const expiryDate = new Date(currentDate.getFullYear() + 3, currentDate.getMonth());

      const cardHolderName = profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`.toUpperCase()
        : user.email?.split('@')[0].toUpperCase() || 'UTILISATEUR 224SOLUTIONS';

      const { data, error } = await supabase
        .from('virtual_cards')
        .insert({
          user_id: user.id,
          card_number: cardNumber,
          holder_name: cardHolderName,
          expiry_date: expiryDate.toISOString(),
          cvv: cvv,
          daily_limit: 500000,
          monthly_limit: 2000000,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(t('userProfileCard.carteVirtuelleCreeeAvecSucces'));
      await loadUserInfo(); // Recharger les données

    } catch (error) {
      console.error('Erreur création carte virtuelle:', error);
      toast.error(t('userProfileCard.erreurLorsDeLaCreation'));
    } finally {
      setCreatingCard(false);
    }
  };

  const _copyCardNumber = () => {
    if (userInfo.virtualCard) {
      navigator.clipboard.writeText(userInfo.virtualCard.card_number);
      toast.success(t('userProfileCard.numeroDeCarteCopie'));
    }
  };

  const _formatCardNumber = (cardNumber: string) => {
    return cardNumber.replace(/(.{4})/g, '$1 ').trim();
  };

  const _maskCardNumber = (cardNumber: string) => {
    return cardNumber.replace(/(.{4})(.{8})(.{4})/, '$1 **** **** $3');
  };

  // Fonction pour effectuer un dépôt
  const handleDeposit = async () => {
    if (!user?.id || !depositAmount) {
      toast.error(t('userProfileCard.veuillezEntrerUnMontant'));
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('userProfileCard.montantInvalide'));
      return;
    }

    setProcessing(true);
    console.log('🔄 Dépôt en cours:', { amount, userId: user.id });

    try {
      const result = await depositToWallet(amount, 'Dépôt sur le wallet');

      console.log('✅ Réponse dépôt:', { result });

      if (!result.success) {
        throw new Error(result.error || 'Erreur dépôt');
      }

      toast.success(`Dépôt de ${formatPrice(amount)} effectué avec succès !`);
      setDepositAmount('');
      setDepositOpen(false);

      // Recharger les données
      await loadUserInfo();

      // Mettre à jour le wallet balance localement
      if (userInfo.wallet) {
        setUserInfo(prev => ({
          ...prev,
          wallet: prev.wallet ? {
            ...prev.wallet,
            balance: prev.wallet.balance + amount
          } : null
        }));
      }
    } catch (error) {
      console.error('❌ Erreur dépôt:', error);
      toast.error(error.message || 'Erreur lors du dépôt');
    } finally {
      setProcessing(false);
    }
  };

  // Fonction pour effectuer un retrait
  const handleWithdraw = async () => {
    if (!user?.id || !withdrawAmount) {
      toast.error(t('userProfileCard.veuillezEntrerUnMontant'));
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('userProfileCard.montantInvalide'));
      return;
    }

    if (amount > (userInfo.wallet?.balance || 0)) {
      toast.error(t('userProfileCard.soldeInsuffisant'));
      return;
    }

    setProcessing(true);
    console.log('🔄 Retrait en cours:', { amount, userId: user.id });

    try {
      const result = await withdrawFromWallet(amount, 'Retrait du wallet');

      console.log('✅ Réponse retrait:', { result });

      if (!result.success) {
        throw new Error(result.error || 'Erreur retrait');
      }

      toast.success(`Retrait de ${formatPrice(amount)} effectué avec succès !`);
      setWithdrawAmount('');
      setWithdrawOpen(false);

      // Recharger les données
      await loadUserInfo();

      // Mettre à jour le wallet balance localement
      if (userInfo.wallet) {
        setUserInfo(prev => ({
          ...prev,
          wallet: prev.wallet ? {
            ...prev.wallet,
            balance: prev.wallet.balance - amount
          } : null
        }));
      }
    } catch (error) {
      console.error('❌ Erreur retrait:', error);
      toast.error(error.message || 'Erreur lors du retrait');
    } finally {
      setProcessing(false);
    }
  };

  // Fonction pour prévisualiser un transfert
  const handlePreviewTransfer = async () => {
    if (!user?.id || !transferAmount || !recipientId) {
      toast.error(t('userProfileCard.veuillezRemplirTousLesChamps'));
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('userProfileCard.montantInvalide'));
      return;
    }

    if (amount > (userInfo.wallet?.balance || 0)) {
      toast.error(t('userProfileCard.soldeInsuffisant'));
      return;
    }

    setProcessing(true);

    try {
      const previewResponse = await previewWalletTransfer(recipientId, amount);
      const previewData = (previewResponse as any)?.data || previewResponse;

      if (!previewData?.success) {
        toast.error(previewData?.error || 'Erreur lors de la prévisualisation');
        return;
      }

      setTransferPreview(previewData);
      setShowTransferPreview(true);
      setTransferOpen(false);
    } catch (error: any) {
      console.error('❌ Erreur prévisualisation:', error);
      toast.error(error.message || 'Erreur lors de la prévisualisation');
    } finally {
      setProcessing(false);
    }
  };

  // Fonction pour confirmer et effectuer un transfert
  const handleConfirmTransfer = async () => {
    if (!user?.id || !transferPreview) return;

    setProcessing(true);
    setShowTransferPreview(false);

    try {
      const result = await transferToWallet(
        recipientId,
        transferPreview.amount,
        'Transfert entre wallets'
      );

      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du transfert');
      }

      const senderCurrency = transferPreview?.currency_sent || userInfo.wallet?.currency || 'GNF';
      toast.success(
        `✅ Transfert réussi\n💸 Frais appliqués : ${Number(transferPreview.fee_amount || 0).toLocaleString()} ${senderCurrency}\n💰 Montant transféré : ${Number(transferPreview.amount || 0).toLocaleString()} ${senderCurrency}`,
        { duration: 5000 }
      );

      setTransferAmount('');
      setRecipientId('');
      setTransferPreview(null);

      // Recharger les données
      await loadUserInfo();
    } catch (error: any) {
      console.error('❌ Erreur transfert:', error);
      toast.error(error.message || 'Erreur lors du transfert');
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (amount: number, currency?: string) => {
    return `${new Intl.NumberFormat('fr-FR').format(amount)} ${currency || userInfo.wallet?.currency || 'GNF'}`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email?.split('@')[0] || 'Utilisateur';

  return (
    <Card className={`${className} border-2 border-blue-100 bg-[#04439e]/5`}>
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-4">
          <Avatar className="w-16 h-16 border-2 border-blue-200">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-[#04439e] text-white text-lg font-bold">
              {profile?.first_name?.[0]}{profile?.last_name?.[0] || user?.email?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-xl text-gray-800">{displayName}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">{userRole}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Wallet Info - Toujours affiché */}
        {showWalletDetails && (
          <div className="bg-white/60 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#ff4000]" />
                <span className="font-semibold text-gray-800">Wallet</span>
              </div>
              <Badge variant="outline" className="bg-orange-100 text-[#ff4000]">
                {userInfo.wallet ? 'Actif' : 'Création...'}
              </Badge>
            </div>
            <p className="text-2xl font-bold text-[#ff4000] mb-3">
              {userInfo.wallet ?
                `${userInfo.wallet.balance.toLocaleString()} ${userInfo.wallet.currency}` :
                'Initialisation...'
              }
            </p>
            {!userInfo.wallet && (
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Wallet en cours de création automatique...
              </p>
            )}

            {/* Boutons d'opérations */}
            {userInfo.wallet && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                {/* Bouton Dépôt */}
                <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="flex flex-col h-auto py-2">
                      <ArrowDownToLine className="w-4 h-4 mb-1 text-[#ff4000]" />
                      <span className="text-xs">{t('userProfileCard.depot')}</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('userProfileCard.effectuerUnDepot')}</DialogTitle>
                      <DialogDescription>
                        Ajoutez des fonds à votre wallet
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="deposit-amount">{t('userProfileCard.montantGnf')}</Label>
                        <Input
                          id="deposit-amount"
                          type="number"
                          placeholder="10000"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={handleDeposit}
                        disabled={processing || !depositAmount}
                        className="w-full bg-[#ff4000] hover:bg-[#ff4000]"
                      >
                        {processing ? 'Traitement...' : 'Confirmer le dépôt'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Bouton Retrait */}
                <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="flex flex-col h-auto py-2">
                      <ArrowUpFromLine className="w-4 h-4 mb-1 text-orange-600" />
                      <span className="text-xs">Retrait</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('userProfileCard.effectuerUnRetrait')}</DialogTitle>
                      <DialogDescription>
                        Retirez des fonds de votre wallet
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="withdraw-amount">{t('userProfileCard.montantGnf')}</Label>
                        <Input
                          id="withdraw-amount"
                          type="number"
                          placeholder="10000"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Solde disponible: {formatCurrency(userInfo.wallet.balance, userInfo.wallet.currency || 'GNF')}
                        </p>
                      </div>
                      <Button
                        onClick={handleWithdraw}
                        disabled={processing || !withdrawAmount}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                      >
                        {processing ? 'Traitement...' : 'Confirmer le retrait'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Bouton Transfert */}
                <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="flex flex-col h-auto py-2">
                      <Send className="w-4 h-4 mb-1 text-blue-600" />
                      <span className="text-xs">Transfert</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('userProfileCard.effectuerUnTransfert')}</DialogTitle>
                      <DialogDescription>
                        Transférez des fonds à un autre utilisateur
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="recipient-id">{t('userProfileCard.idDuDestinataire')}</Label>
                        <Input
                          id="recipient-id"
                          placeholder={t('userProfileCard.uuidDuDestinataire')}
                          value={recipientId}
                          onChange={(e) => setRecipientId(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="transfer-amount">{t('userProfileCard.montantGnf')}</Label>
                        <Input
                          id="transfer-amount"
                          type="number"
                          placeholder="10000"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Solde disponible: {formatCurrency(userInfo.wallet.balance, userInfo.wallet.currency || 'GNF')}
                        </p>
                      </div>
                      <Button
                        onClick={handlePreviewTransfer}
                        disabled={processing || !transferAmount || !recipientId}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {processing ? 'Traitement...' : 'Voir les frais et confirmer'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        )}

        {/* Dialog de confirmation avec prévisualisation des frais */}
        <AlertDialog open={showTransferPreview} onOpenChange={setShowTransferPreview}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                Confirmer le transfert
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 mt-4">
                  <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{t('userProfileCard.montantATransferer')}</span>
                      <span className="text-lg font-bold">{formatPrice(transferPreview?.amount || 0, transferPreview?.currency_sent)}</span>
                    </div>
                    <div className="flex justify-between items-center text-orange-600">
                      <span className="text-sm font-medium">💸 Frais de transfert ({transferPreview?.fee_percent ?? transferPreview?.fee_percentage ?? 0}%)</span>
                      <span className="text-lg font-bold">{formatPrice(transferPreview?.fee_amount || 0, transferPreview?.currency_sent)}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="text-sm font-medium">{t('userProfileCard.totalDebiteDeVotreCompte')}</span>
                      <span className="text-xl font-bold text-[#ff4000]">{formatPrice(transferPreview?.total_debit || 0, transferPreview?.currency_sent)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#ff4000]">
                      <span className="text-sm font-medium">{t('userProfileCard.montantNetRecuParLe')}</span>
                      <span className="text-lg font-bold">{formatPrice(transferPreview?.amount_received || 0, transferPreview?.currency_received || transferPreview?.currency_sent)}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{t('userProfileCard.soldeActuel')}</strong> {formatPrice(transferPreview?.current_balance || 0, transferPreview?.currency_sent)}
                      <br />
                      <strong>{t('userProfileCard.soldeApresTransfert')}</strong> {formatPrice(transferPreview?.balance_after || 0, transferPreview?.currency_sent)}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Souhaitez-vous confirmer ce transfert ?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>{t('userProfileCard.nonAnnuler')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmTransfer} disabled={processing}>
                Oui, confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default UserProfileCard;

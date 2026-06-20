import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, TrendingUp, Calendar, Clock, MapPin, Wallet, ArrowUpCircle, ArrowDownCircle, History, Shield } from 'lucide-react';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { Money } from '@/components/Money';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  depositToWallet,
  withdrawFromWallet,
  getWalletPinStatus,
  setupWalletPin,
  changeWalletPin,
  resetWalletPin,
} from '@/services/walletBackendService';
import { UnifiedTransferDialog } from '@/components/wallet/UnifiedTransferDialog';
import { WalletPinPromptDialog, WalletPinSetupDialog } from '@/components/wallet/WalletPinDialogs';

interface DriverEarningsProps {
  driverId: string;
}

interface Ride {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  distance_km: number;
  duration_minutes: number;
  fare: number;
  status: string;
  requested_at: string;
  completed_at: string | null;
  customer_name?: string;
}

interface EarningsStats {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  yearEarnings: number;
  todayRides: number;
  weekRides: number;
  monthRides: number;
  yearRides: number;
}

interface WalletTransaction {
  id: string | number;
  transaction_type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

export function DriverEarnings({ driverId }: DriverEarningsProps) {
  const { t } = useTranslation();
  const [rides, setRides] = useState<Ride[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    yearEarnings: 0,
    todayRides: 0,
    weekRides: 0,
    monthRides: 0,
    yearRides: 0,
  });
  const [showTransactions, setShowTransactions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [userCode, setUserCode] = useState('');

  // Wallet actions
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // PIN system
  const [pinStatus, setPinStatus] = useState<{ pin_enabled: boolean; pin_locked_until: string | null } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [pinSetupMode, setPinSetupMode] = useState<'setup' | 'change' | 'reset'>('setup');
  // pending withdraw amount waiting for PIN confirmation
  const [pendingWithdrawAmount, setPendingWithdrawAmount] = useState(0);

  const { balance, currency, reload } = useWalletBalance(userId);

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
    } catch {
      // silently ignore
    }
    setPinStatus({ pin_enabled: false, pin_locked_until: null });
  };

  const loadEarningsData = async () => {
    try {
      setLoading(true);

      const { data: driverData } = await supabase
        .from('taxi_drivers')
        .select('user_id')
        .eq('id', driverId)
        .single();

      if (driverData) {
        setUserId(driverData.user_id);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('custom_id, public_id')
          .eq('id', driverData.user_id)
          .maybeSingle();
        if (profileData) {
          setUserCode((profileData as any).custom_id || (profileData as any).public_id || '');
        }
      }

      const { data: ridesData, error: ridesError } = await supabase
        .from('taxi_trips')
        .select('*')
        .eq('driver_id', driverId)
        .in('status', ['completed', 'paid'])
        .order('completed_at', { ascending: false })
        .limit(50);

      if (ridesError) throw ridesError;

      const formattedRides: Ride[] = (ridesData || []).map((ride: any) => ({
        id: ride.id,
        pickup_address: ride.pickup_address,
        dropoff_address: ride.dropoff_address,
        distance_km: ride.distance_km,
        duration_minutes: ride.duration_minutes,
        fare: ride.fare,
        status: ride.status,
        requested_at: ride.requested_at,
        completed_at: ride.completed_at,
        customer_name: 'Client',
      }));

      setRides(formattedRides);

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const todayRides = formattedRides.filter((r) => new Date(r.completed_at || r.requested_at) >= today);
      const weekRides = formattedRides.filter((r) => new Date(r.completed_at || r.requested_at) >= weekAgo);
      const monthRides = formattedRides.filter((r) => new Date(r.completed_at || r.requested_at) >= monthAgo);
      const yearRides = formattedRides.filter((r) => new Date(r.completed_at || r.requested_at) >= yearStart);

      setStats({
        todayEarnings: todayRides.reduce((sum, r) => sum + (r.fare || 0), 0),
        weekEarnings: weekRides.reduce((sum, r) => sum + (r.fare || 0), 0),
        monthEarnings: monthRides.reduce((sum, r) => sum + (r.fare || 0), 0),
        yearEarnings: yearRides.reduce((sum, r) => sum + (r.fare || 0), 0),
        todayRides: todayRides.length,
        weekRides: weekRides.length,
        monthRides: monthRides.length,
        yearRides: yearRides.length,
      });

      if (driverData) {
        const { data: walletData } = await supabase
          .from('wallets')
          .select('id')
          .eq('user_id', driverData.user_id)
          .single();

        if (walletData) {
          const { data: transactionsData } = await supabase
            .from('wallet_transactions')
            .select('*')
            .or(`from_wallet_id.eq.${walletData.id},to_wallet_id.eq.${walletData.id}`)
            .order('created_at', { ascending: false })
            .limit(20);

          setTransactions((transactionsData || []) as unknown as WalletTransaction[]);
        }
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPinStatus();
  }, []);

  useEffect(() => {
    if (!driverId) return;

    loadEarningsData();

    const channel = supabase
      .channel('driver-earnings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taxi_trips', filter: `driver_id=eq.${driverId}` }, () => {
        loadEarningsData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  // ─── Dépôt ───────────────────────────────────────────────
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error(t('driverEarnings.veuillezEntrerUnMontantValide'));
      return;
    }

    setProcessing(true);
    try {
      const result = await depositToWallet(parseFloat(depositAmount), 'Dépôt wallet chauffeur');
      if (!result.success) throw new Error(result.error || 'Erreur lors du dépôt');

      toast.success(t('driverEarnings.depotEffectueAvecSucces'));
      setDepositAmount('');
      setDepositOpen(false);
      reload();
      loadEarningsData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du dépôt');
    } finally {
      setProcessing(false);
    }
  };

  // ─── Retrait — gating PIN ─────────────────────────────────
  const handleWithdrawRequest = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('driverEarnings.montantInvalide'));
      return;
    }
    if (amount > balance) {
      toast.error(t('driverEarnings.soldeInsuffisant'));
      return;
    }

    setPendingWithdrawAmount(amount);
    setWithdrawOpen(false);

    if (!pinStatus?.pin_enabled) {
      // Premier retrait — forcer la création du PIN
      setPinSetupMode('setup');
      setPinError(null);
      setPinSetupOpen(true);
    } else {
      setPinError(null);
      setPinPromptOpen(true);
    }
  };

  const executeWithdraw = async (pin: string) => {
    setProcessing(true);
    try {
      const result = await withdrawFromWallet(pendingWithdrawAmount, 'Retrait wallet chauffeur', pin);
      if (!result.success) throw new Error(result.error || 'Erreur lors du retrait');

      toast.success(`Retrait de ${pendingWithdrawAmount.toLocaleString()} ${currency} effectué`);
      setWithdrawAmount('');
      setPendingWithdrawAmount(0);
      setPinPromptOpen(false);
      reload();
      loadEarningsData();
    } catch (error: any) {
      throw error; // remonté au gestionnaire PIN
    } finally {
      setProcessing(false);
    }
  };

  // ─── Confirmation PIN ─────────────────────────────────────
  const handlePinConfirm = async (pin: string) => {
    try {
      setPinLoading(true);
      setPinError(null);
      await executeWithdraw(pin);
      await loadPinStatus();
    } catch (error: any) {
      const msg: string = error?.message || 'Erreur';
      const isPinError = /code pin|pin invalide|pin bloqué|tentative|configurer.*pin/i.test(msg);
      if (isPinError) {
        setPinError(msg);
      } else {
        setPinPromptOpen(false);
        setPinError(null);
        toast.error(msg);
      }
    } finally {
      setPinLoading(false);
    }
  };

  // ─── Setup / changement PIN ───────────────────────────────
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

      const response =
        pinSetupMode === 'change'
          ? await changeWalletPin(currentPin || '', pin, confirmPin)
          : pinSetupMode === 'reset'
            ? await resetWalletPin(accountPassword || '', pin, confirmPin)
            : await setupWalletPin(pin, confirmPin);

      if (!response.success) throw new Error(response.error || 'Erreur configuration code PIN');

      await loadPinStatus();
      setPinSetupOpen(false);

      if (pinSetupMode === 'setup' && pendingWithdrawAmount > 0) {
        toast.success(t('driverEarnings.codePinActiveConfirmezVotre'));
        setPinError(null);
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
    } catch (error: any) {
      setPinError(error?.message || 'Erreur configuration code PIN');
    } finally {
      setPinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 pb-24">
        {/* Wallet 224Solutions */}
        <Card className="bg-[#04439e] text-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Wallet 224Solutions
              </CardTitle>
              {/* Bouton gestion PIN */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2 text-xs"
                onClick={() => {
                  setPinSetupMode(pinStatus?.pin_enabled ? 'change' : 'setup');
                  setPinError(null);
                  setPinSetupOpen(true);
                }}
              >
                <Shield className="w-3.5 h-3.5 mr-1" />
                {pinStatus?.pin_enabled ? 'Modifier PIN' : 'Activer PIN'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm opacity-90">{t('driverEarnings.soldeDisponible')}</p>
                <p className="text-4xl font-bold mt-1">
                  <Money amount={balance || 0} from={currency || 'GNF'} />
                </p>
                {pinStatus?.pin_enabled && (
                  <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Code PIN actif
                  </p>
                )}
              </div>

              {/* Actions rapides du wallet */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* Dépôt */}
                <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full bg-white/20 hover:bg-white/30 text-white border-0">
                      <ArrowDownCircle className="w-4 h-4 mr-2" />
                      Dépôt
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('driverEarnings.effectuerUnDepot')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="deposit-amount">Montant ({currency})</Label>
                        <Input
                          id="deposit-amount"
                          type="number"
                          placeholder={t('driverEarnings.entrezLeMontant')}
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleDeposit} disabled={processing} className="w-full">
                        {processing ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traitement...</>
                        ) : (
                          <><ArrowDownCircle className="w-4 h-4 mr-2" />{t('driverEarnings.confirmerLeDepot')}</>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Retrait — avec PIN */}
                <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full bg-white/20 hover:bg-white/30 text-white border-0">
                      <ArrowUpCircle className="w-4 h-4 mr-2" />
                      Retrait
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('driverEarnings.effectuerUnRetrait')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="withdraw-amount">Montant ({currency})</Label>
                        <Input
                          id="withdraw-amount"
                          type="number"
                          placeholder={t('driverEarnings.entrezLeMontant')}
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                          Solde disponible : {(balance || 0).toLocaleString()} {currency || 'GNF'}
                        </p>
                        {pinStatus?.pin_enabled && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Votre code PIN sera demandé pour confirmer
                          </p>
                        )}
                      </div>
                      <Button onClick={handleWithdrawRequest} disabled={processing} className="w-full">
                        {processing ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traitement...</>
                        ) : (
                          <><ArrowUpCircle className="w-4 h-4 mr-2" />Continuer</>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Transfert — PIN géré par UnifiedTransferDialog */}
                <UnifiedTransferDialog
                  senderCode={userCode}
                  currency={currency}
                  variant="ghost"
                  className="w-full bg-white/20 hover:bg-white/30 text-white border-0"
                  onSuccess={() => { reload(); loadEarningsData(); }}
                />
              </div>

              {/* Historique */}
              <Button
                variant="secondary"
                className="w-full bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => setShowTransactions(!showTransactions)}
              >
                <History className="w-4 h-4 mr-2" />
                {showTransactions ? 'Masquer' : 'Voir'} l'historique
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Historique des transactions wallet */}
        {showTransactions && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('driverEarnings.transactionsRecentes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">{t('driverEarnings.aucuneTransaction')}</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {tx.transaction_type === 'credit' ? (
                          <ArrowDownCircle className="w-5 h-5 text-[#ff4000]" />
                        ) : (
                          <ArrowUpCircle className="w-5 h-5 text-orange-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{tx.description || tx.transaction_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.transaction_type === 'credit' ? 'text-[#ff4000]' : 'text-orange-600'}`}>
                          {tx.transaction_type === 'credit' ? '+' : '-'}{(tx.amount || 0).toLocaleString()} {currency || 'GNF'}
                        </p>
                        <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistiques de gains */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <Calendar className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Aujourd'hui</p>
                <p className="text-lg font-bold"><Money amount={stats.todayEarnings || 0} from="GNF" /></p>
                <p className="text-xs text-muted-foreground">{stats.todayRides || 0} courses</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <TrendingUp className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">7 jours</p>
                <p className="text-lg font-bold"><Money amount={stats.weekEarnings || 0} from="GNF" /></p>
                <p className="text-xs text-muted-foreground">{stats.weekRides || 0} courses</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <Calendar className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">30 jours</p>
                <p className="text-lg font-bold"><Money amount={stats.monthEarnings || 0} from="GNF" /></p>
                <p className="text-xs text-muted-foreground">{stats.monthRides || 0} courses</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <TrendingUp className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Année {new Date().getFullYear()}</p>
                <p className="text-lg font-bold"><Money amount={stats.yearEarnings || 0} from="GNF" /></p>
                <p className="text-xs text-muted-foreground">{stats.yearRides || 0} courses</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Historique des courses */}
        <Card>
          <CardHeader>
            <CardTitle>{t('driverEarnings.historiqueDesCourses')}</CardTitle>
          </CardHeader>
          <CardContent>
            {rides.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('driverEarnings.aucuneCourseTerminee')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rides.map((ride) => (
                  <div key={ride.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{ride.customer_name}</p>
                        <div className="flex items-start gap-2 mt-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <div className="space-y-0.5">
                            <p>{ride.pickup_address}</p>
                            <p>→ {ride.dropoff_address}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#ff4000]">
                          <Money amount={ride.fare || 0} from="GNF" />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ride.status === 'completed' ? 'Terminée' : 'Payée'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {ride.duration_minutes || 0} min
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {(ride.distance_km || 0).toFixed(1)} km
                      </span>
                      <span className="ml-auto">
                        {format(new Date(ride.completed_at || ride.requested_at), 'dd MMM HH:mm', { locale: fr })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog confirmation PIN — retrait */}
      <WalletPinPromptDialog
        open={pinPromptOpen}
        onOpenChange={(val) => {
          setPinPromptOpen(val);
          if (!val) {
            setPinError(null);
            setPendingWithdrawAmount(0);
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

      {/* Dialog setup / modification / réinitialisation PIN */}
      <WalletPinSetupDialog
        open={pinSetupOpen}
        onOpenChange={(val) => {
          setPinSetupOpen(val);
          if (!val) {
            setPinError(null);
            if (!pinPromptOpen) setPendingWithdrawAmount(0);
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
    </>
  );
}

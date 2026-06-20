import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Crown, Zap, Check, Star, Calendar, AlertTriangle, Wallet } from 'lucide-react';
import { useServiceSubscription } from '@/hooks/useServiceSubscription';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Money } from '@/components/Money';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { useTranslation } from '@/hooks/useTranslation';

interface ServiceSubscriptionCardProps {
  serviceId: string;
  serviceTypeId?: string;
  compact?: boolean;
  onSubscribed?: () => void;
}

export function ServiceSubscriptionCard({ serviceId, serviceTypeId, compact = false, onSubscribed }: ServiceSubscriptionCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    subscription,
    plans,
    loading,
    isFree,
    isActive,
    isExpired,
    isExpiringSoon,
    daysRemaining,
    subscribe,
    canAccessFeature,
    refresh,
  } = useServiceSubscription({ serviceId, serviceTypeId });

  const [showPlans, setShowPlans] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState('GNF');

  // Convertisseur (taux BCRG) : prix plans en GNF → devise réelle du wallet de l'utilisateur
  const { convert } = usePriceConverter();

  // Confirmation avant achat
  const [confirmPlan, setConfirmPlan] = useState<{ id: string; name: string; price: number } | null>(null);

  // Lire le wallet RÉEL de l'utilisateur (peu importe la devise — le PDG peut l'avoir changée).
  // On ne filtre plus sur GNF, sinon un prestataire passé en XOF/EUR verrait un solde à 0.
  const loadWalletBalance = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('wallets')
      .select('balance, currency')
      .eq('user_id', user.id)
      .maybeSingle();
    setWalletBalance(Number(data?.balance ?? 0));
    if (data?.currency) setWalletCurrency(data.currency);
  };

  useEffect(() => {
    loadWalletBalance();
  }, [user?.id]);

  // Plans triés par prix pour affichage cohérent (Gratuit → Basic → Pro → Premium)
  const sortedPlans = [...plans].sort((a, b) => a.monthly_price_gnf - b.monthly_price_gnf);

  const currentPlanDisplayName = isFree ? t('serviceSub.free') : (subscription?.plan_display_name || t('serviceSub.free'));

  // Étape 1 : vérifications pré-achat + afficher confirmation
  const handleRequestSubscribe = (planId: string) => {
    if (!user) {
      toast.error(t('serviceSub.mustBeConnected'));
      return;
    }

    const plan = sortedPlans.find(p => p.id === planId);
    if (!plan) return;

    const price = selectedBilling === 'yearly'
      ? (plan.yearly_price_gnf || plan.monthly_price_gnf * 12)
      : plan.monthly_price_gnf;

    // Pré-check de solde NON bloquant : on ne bloque que si la conversion est FIABLE
    // (même devise renvoyée par le convertisseur) ET clairement insuffisante. Sinon on
    // laisse l'utilisateur confirmer — le RPC atomique du backend est l'AUTORITÉ sur le
    // solde et renvoie « INSUFFICIENT_FUNDS » le cas échéant. Évite les faux blocages.
    if (price > 0) {
      const conv = convert(price, 'GNF');
      const reliable = (conv.userCurrency || '').toUpperCase() === (walletCurrency || '').toUpperCase();
      if (reliable && walletBalance < conv.convertedAmount) {
        toast.error(`${t('serviceSub.insufficientBalancePrefix')} ${convert(walletBalance, walletCurrency).formatted}, ${t('serviceSub.requiredLabel')} ${conv.formatted}. ${t('serviceSub.rechargeWallet')}`);
        return;
      }
    }

    // Afficher la confirmation
    setConfirmPlan({ id: planId, name: plan.display_name, price });
  };

  // Étape 2 : confirmer et débiter
  const handleConfirmSubscribe = async () => {
    if (!confirmPlan) return;
    const { id: planId } = confirmPlan;
    setConfirmPlan(null);

    try {
      setSubscribing(true);
      await subscribe(planId, selectedBilling);
      toast.success(t('serviceSub.activated'));
      setShowPlans(false);
      // Rafraîchir l'abonnement ET le solde wallet après paiement
      await Promise.all([refresh(), loadWalletBalance()]);
      // Notifier le parent pour synchroniser les composants dépendants (ex: ServiceMediaManager)
      onSubscribed?.();
    } catch (error: any) {
      toast.error(error.message || t('serviceSub.subscribeError'));
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-6 bg-muted rounded w-1/3 mb-2" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </CardContent>
      </Card>
    );
  }

  // ── Version compacte (barre horizontale) ──────────────────────────────────
  if (compact) {
    return (
      <>
        <div className={cn(
          "flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border",
          isFree ? "bg-muted/50 border-border" : "bg-primary/5 border-primary/20"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            {isFree ? (
              <Zap className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <Crown className="w-4 h-4 text-primary flex-shrink-0" />
            )}
            <span className="text-sm font-medium truncate">
              {currentPlanDisplayName}
            </span>
            {isExpiringSoon && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {t('serviceSub.expiresSoon')}
              </Badge>
            )}
            {isActive && daysRemaining > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {daysRemaining}{t('serviceSub.daysLeftShort')}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant={isFree ? "default" : "outline"}
            className="text-xs flex-shrink-0"
            onClick={() => setShowPlans(true)}
          >
            {isFree ? (
              <>
                <Crown className="w-3 h-3 mr-1" />
                {t('serviceSub.upgrade')}
              </>
            ) : (
              t('serviceSub.manage')
            )}
          </Button>
        </div>

        <PlansDialog
          open={showPlans}
          onOpenChange={setShowPlans}
          plans={sortedPlans}
          currentPlanId={subscription?.plan_id}
          selectedBilling={selectedBilling}
          onBillingChange={setSelectedBilling}
          onSubscribe={handleRequestSubscribe}
          subscribing={subscribing}
          walletBalance={walletBalance}
          walletCurrency={walletCurrency}
        />

        <ConfirmDialog
          plan={confirmPlan}
          billing={selectedBilling}
          onConfirm={handleConfirmSubscribe}
          onCancel={() => setConfirmPlan(null)}
        />
      </>
    );
  }

  // ── Version complète (carte) ───────────────────────────────────────────────
  return (
    <>
      <Card className={cn(
        "overflow-hidden",
        isExpiringSoon && "border-destructive/50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              {t('serviceSub.serviceSubscription')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isFree ? "secondary" : "default"} className={cn(!isFree && "bg-primary")}>
                {currentPlanDisplayName}
              </Badge>
              <Button
                size="sm"
                variant={isFree ? "default" : "outline"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setShowPlans(true)}
              >
                {isFree ? (
                  <>
                    <Crown className="w-3 h-3 mr-1" />
                    {t('serviceSub.upgradeFull')}
                  </>
                ) : (
                  t('serviceSub.manage')
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Statut */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('serviceSub.status')}</span>
            <span className={cn(
              "font-medium",
              isFree || isActive ? "text-[#ff4000]" : "text-destructive"
            )}>
              {isFree
                ? t('serviceSub.statusFreeActive')
                : isActive
                  ? t('serviceSub.statusActive')
                  : isExpired
                    ? t('serviceSub.statusExpired')
                    : t('serviceSub.statusPending')}
            </span>
          </div>

          {/* Jours restants */}
          {isActive && daysRemaining > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {t('serviceSub.daysRemaining')}
              </span>
              <span className={cn(
                "font-medium",
                daysRemaining <= 7 ? "text-destructive" : "text-foreground"
              )}>
                {daysRemaining} {t('serviceSub.daysWord')}
              </span>
            </div>
          )}

          {/* Date de fin d'abonnement */}
          {isActive && subscription?.current_period_end && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('serviceSub.renewal')}</span>
              <span className="font-medium">
                {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}

          {/* Solde wallet */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              {t('serviceSub.walletBalance')}
            </span>
            <span className="font-medium"><Money amount={walletBalance} from={walletCurrency} /></span>
          </div>

          {/* Limites du plan */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t('serviceSub.planLimits')}</p>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center gap-1">
                <Check className="w-3 h-3 text-[#ff4000]" />
                <span>
                  {t('serviceSub.productsLabel')}{' '}
                  {subscription?.max_products != null
                    ? subscription.max_products
                    : isFree ? '5' : '∞'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {canAccessFeature('priority_listing') ? (
                  <Check className="w-3 h-3 text-[#ff4000]" />
                ) : (
                  <span className="w-3 h-3 text-muted-foreground text-center">✗</span>
                )}
                <span>{t('serviceSub.priorityListing')}</span>
              </div>
            </div>
          </div>

          {/* Alerte expiration */}
          {isExpiringSoon && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                {t('serviceSub.expiresIn')} {daysRemaining} {t('serviceSub.dayWord')}. {t('serviceSub.renewWarning')}
              </span>
            </div>
          )}

        </CardContent>
      </Card>

      <PlansDialog
        open={showPlans}
        onOpenChange={setShowPlans}
        plans={sortedPlans}
        currentPlanId={subscription?.plan_id}
        selectedBilling={selectedBilling}
        onBillingChange={setSelectedBilling}
        onSubscribe={handleRequestSubscribe}
        subscribing={subscribing}
        walletBalance={walletBalance}
        walletCurrency={walletCurrency}
      />

      <ConfirmDialog
        plan={confirmPlan}
        billing={selectedBilling}
        onConfirm={handleConfirmSubscribe}
        onCancel={() => setConfirmPlan(null)}
      />
    </>
  );
}

// ── Dialog de confirmation avant paiement ─────────────────────────────────────
function ConfirmDialog({
  plan,
  billing,
  onConfirm,
  onCancel,
}: {
  plan: { id: string; name: string; price: number } | null;
  billing: 'monthly' | 'yearly';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={plan !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            {t('serviceSub.confirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-1">
              <p>{t('serviceSub.aboutToSubscribe')}</p>
              <div className="rounded-lg border bg-muted/50 px-4 py-3 space-y-1.5 text-sm text-foreground">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('serviceSub.planLabel')}</span>
                  <span className="font-semibold">{plan?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('serviceSub.billingLabel')}</span>
                  <span className="font-medium">{billing === 'yearly' ? t('serviceSub.yearly') : t('serviceSub.monthly')}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 mt-1.5">
                  <span className="text-muted-foreground">{t('serviceSub.amountDebited')}</span>
                  <span className="font-bold text-primary">
                    {plan ? <Money amount={plan.price} from="GNF" /> : '—'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('serviceSub.debitInfo')}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t('serviceSub.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-primary">
            <Wallet className="w-4 h-4 mr-2" />
            {t('serviceSub.confirmPay')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Dialog de sélection de plan ───────────────────────────────────────────────
function PlansDialog({
  open,
  onOpenChange,
  plans,
  currentPlanId,
  selectedBilling,
  onBillingChange,
  onSubscribe,
  subscribing,
  walletBalance,
  walletCurrency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: any[];
  currentPlanId?: string;
  selectedBilling: 'monthly' | 'yearly';
  onBillingChange: (billing: 'monthly' | 'yearly') => void;
  onSubscribe: (planId: string) => void;
  subscribing: boolean;
  walletBalance: number;
  walletCurrency: string;
}) {
  const { t } = useTranslation();
  const { convert } = usePriceConverter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            {t('serviceSub.choosePlan')}
          </DialogTitle>
        </DialogHeader>

        {/* Solde disponible */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Wallet className="w-4 h-4" />
            {t('serviceSub.availableBalance')}
          </span>
          <span className="font-semibold"><Money amount={walletBalance} from={walletCurrency} /></span>
        </div>

        {/* Toggle facturation */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Button
            size="sm"
            variant={selectedBilling === 'monthly' ? 'default' : 'outline'}
            onClick={() => onBillingChange('monthly')}
          >
            {t('serviceSub.monthlyBtn')}
          </Button>
          <Button
            size="sm"
            variant={selectedBilling === 'yearly' ? 'default' : 'outline'}
            onClick={() => onBillingChange('yearly')}
          >
            {t('serviceSub.yearlyBtn')}
            <Badge variant="secondary" className="ml-1 text-[10px]">-15%</Badge>
          </Button>
        </div>

        {/* Plans */}
        {plans.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t('serviceSub.noPlans')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const price = selectedBilling === 'yearly'
                ? (plan.yearly_price_gnf || plan.monthly_price_gnf * 12)
                : plan.monthly_price_gnf;
              // Prix (GNF) converti dans la devise du wallet pour comparer correctement
              const priceInWalletCurrency = convert(price, 'GNF').convertedAmount;
              const canAfford = plan.monthly_price_gnf === 0 || walletBalance >= priceInWalletCurrency;

              return (
                <Card key={plan.id} className={cn(
                  "relative overflow-hidden transition-all",
                  isCurrent && "border-primary ring-1 ring-primary",
                  plan.name === 'pro' && !isCurrent && "border-primary/50"
                )}>
                  {plan.name === 'pro' && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-bl-lg font-medium flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {t('serviceSub.popular')}
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute top-0 left-0 bg-[#ff4000] text-white text-[10px] px-2 py-0.5 rounded-br-lg font-medium">
                      {t('serviceSub.current')}
                    </div>
                  )}

                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg">{plan.display_name}</h3>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black">
                        {plan.monthly_price_gnf === 0 ? t('serviceSub.free') : <Money amount={price} from="GNF" />}
                      </span>
                      {plan.monthly_price_gnf > 0 && (
                        <span className="text-xs text-muted-foreground">
                          /{selectedBilling === 'yearly' ? t('serviceSub.perYear') : t('serviceSub.perMonth')}
                        </span>
                      )}
                    </div>

                    {/* Alerte solde insuffisant */}
                    {!canAfford && plan.monthly_price_gnf > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-destructive">
                        <AlertTriangle className="w-3 h-3" />
                        {t('serviceSub.insufficientPrefix')}{convert(Math.max(0, priceInWalletCurrency - walletBalance), walletCurrency).formatted} {t('serviceSub.missingSuffix')}
                      </div>
                    )}

                    <ul className="space-y-1">
                      {(plan.features || [])
                        .filter((f: string) => !/réservation|api/i.test(f))
                        .slice(0, 5)
                        .map((feature: string, i: number) => (
                          <li key={i} className="flex items-center gap-1.5 text-xs">
                            <Check className="w-3 h-3 text-[#ff4000] flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                    </ul>

                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      <div>📦 {t('serviceSub.productsLabel2')} {plan.max_products ?? '∞'}</div>
                      <div>👥 {t('serviceSub.staffLabel')} {plan.max_staff ?? '∞'}</div>
                    </div>

                    <Button
                      className="w-full"
                      variant={isCurrent ? 'outline' : plan.name === 'pro' ? 'default' : 'secondary'}
                      disabled={isCurrent || subscribing || plan.monthly_price_gnf === 0 || !canAfford}
                      onClick={() => onSubscribe(plan.id)}
                    >
                      {subscribing ? (
                        <span className="animate-pulse">{t('serviceSub.processing')}</span>
                      ) : isCurrent ? (
                        t('serviceSub.currentPlan')
                      ) : plan.monthly_price_gnf === 0 ? (
                        t('serviceSub.freePlan')
                      ) : !canAfford ? (
                        t('serviceSub.insufficientBalance2')
                      ) : (
                        <>
                          <Zap className="w-3 h-3 mr-1" />
                          {t('serviceSub.choose')}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

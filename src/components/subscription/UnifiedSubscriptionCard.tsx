import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard, Wallet, Smartphone, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { useState } from 'react';
import { useUnifiedSubscription } from '@/hooks/useUnifiedSubscription';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UnifiedSubscriptionCardProps {
  userRole?: 'vendeur' | 'taxi' | 'livreur';
  compact?: boolean;
}

export function UnifiedSubscriptionCard({ userRole, compact = false }: UnifiedSubscriptionCardProps) {
  const { t } = useTranslation();
  const {
    subscription,
    plans,
    loading,
    subscribing,
    hasAccess,
    isExpired,
    daysRemaining,
    walletBalance,
    subscribe,
    cancelSubscription,
    enableAutoRenew,
    formatPrice,
    calculatePrice,
  } = useUnifiedSubscription();

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'mobile_money' | 'card'>('wallet');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const handleSubscribe = async () => {
    if (!selectedPlanId) {
      return;
    }
    await subscribe(selectedPlanId, paymentMethod, billingCycle);
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const price = selectedPlan ? calculatePrice(selectedPlan, billingCycle) : 0;
  const discount = selectedPlan?.yearly_discount_percentage || 15;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Mon Abonnement 224Solutions</span>
          {hasAccess && !isExpired && (
            <Badge variant="outline" className="bg-success/10 text-success border-success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Actif
            </Badge>
          )}
          {isExpired && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Expiré
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Abonnement pour accéder à tous les services de 224Solutions
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Abonnement actif */}
        {hasAccess && subscription && (
          <div className="space-y-4">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{subscription.plan_display_name}</span>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {subscription.billing_cycle === 'yearly' ? 'Annuel' : 'Mensuel'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('unifiedSubscriptionCard.expireLe')}</p>
                  <p className="font-medium">
                    {format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Jours restants</p>
                  <p className="font-medium">{daysRemaining} jours</p>
                </div>
              </div>

              {subscription.auto_renew ? (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t('unifiedSubscriptionCard.renouvellementAutomatiqueActive')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  <span>{t('unifiedSubscriptionCard.renouvellementAutomatiqueDesactive')}</span>
                </div>
              )}
            </div>

            {/* Actions sur l'abonnement actif */}
            <div className="flex gap-2">
              {subscription.auto_renew ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelSubscription}
                  className="flex-1"
                >
                  Désactiver le renouvellement
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={enableAutoRenew}
                  className="flex-1"
                >
                  Activer le renouvellement
                </Button>
              )}
            </div>

            {/* Fonctionnalités du plan */}
            {!compact && subscription.features && subscription.features.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('unifiedSubscriptionCard.fonctionnalitesIncluses')}</p>
                <ul className="space-y-1">
                  {subscription.features.map((feature, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Pas d'abonnement ou expiré - Afficher les plans */}
        {(!hasAccess || isExpired) && (
          <div className="space-y-4">
            {/* Sélection du cycle de facturation */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('unifiedSubscriptionCard.dureeDeLAbonnement')}</Label>
              <RadioGroup value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'monthly' | 'yearly')}>
                <div className={`flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer transition ${billingCycle === 'monthly' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="monthly" id="monthly" />
                  <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                    <p className="font-medium">Mensuel</p>
                    <p className="text-xs text-muted-foreground">30 jours</p>
                  </Label>
                </div>

                <div className={`flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer transition ${billingCycle === 'yearly' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="yearly" id="yearly" />
                  <Label htmlFor="yearly" className="flex-1 cursor-pointer flex items-center justify-between">
                    <div>
                      <p className="font-medium">Annuel</p>
                      <p className="text-xs text-muted-foreground">365 jours</p>
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-[#ff4000]">
                      Économisez {discount}%
                    </Badge>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Sélection du plan */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('unifiedSubscriptionCard.choisirUnPlan')}</Label>
              <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId}>
                {plans.map((plan) => {
                  const planPrice = calculatePrice(plan, billingCycle);
                  return (
                    <div
                      key={plan.id}
                      className={`flex items-start space-x-2 p-4 border rounded-lg hover:bg-accent cursor-pointer transition ${selectedPlanId === plan.id ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" />
                      <Label htmlFor={plan.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold">{plan.display_name}</p>
                          <p className="text-lg font-bold text-primary">
                            {formatPrice(planPrice)}
                          </p>
                        </div>

                        {!compact && plan.features && plan.features.length > 0 && (
                          <ul className="space-y-1 mt-2">
                            {plan.features.slice(0, 3).map((feature, index) => (
                              <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                                <CheckCircle2 className="h-3 w-3 text-success mt-0.5 flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Méthode de paiement */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('unifiedSubscriptionCard.methodeDePaiement')}</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <div className={`flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer ${paymentMethod === 'wallet' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="wallet" id="wallet" />
                  <Wallet className="h-4 w-4" />
                  <Label htmlFor="wallet" className="flex-1 cursor-pointer flex items-center justify-between">
                    <span>{t('unifiedSubscriptionCard.portefeuille')}</span>
                    <span className="text-sm font-medium">{formatPrice(walletBalance)}</span>
                  </Label>
                </div>

                <div className={`flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer ${paymentMethod === 'mobile_money' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="mobile_money" id="mobile_money" />
                  <Smartphone className="h-4 w-4" />
                  <Label htmlFor="mobile_money" className="flex-1 cursor-pointer">
                    Mobile Money
                  </Label>
                </div>

                <div className={`flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer ${paymentMethod === 'card' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="card" id="card" />
                  <CreditCard className="h-4 w-4" />
                  <Label htmlFor="card" className="flex-1 cursor-pointer">
                    Carte bancaire
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Prix total */}
            {selectedPlan && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>{t('unifiedSubscriptionCard.totalAPayer')}</span>
                  <span className="text-primary">{formatPrice(price)}</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Soit {formatPrice(Math.round(price / 12))}/mois
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {(!hasAccess || isExpired) && (
        <CardFooter>
          <Button
            onClick={handleSubscribe}
            disabled={subscribing || !selectedPlanId}
            className="w-full"
            size="lg"
          >
            {subscribing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement en cours...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                S'abonner maintenant
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export default UnifiedSubscriptionCard;

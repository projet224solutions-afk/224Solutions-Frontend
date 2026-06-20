import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, CreditCard, Wallet, Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import { useDriverSubscription } from '@/hooks/useDriverSubscription';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function DriverSubscriptionCard() {
  const { t } = useTranslation();
  const {
    subscription,
    config,
    loading,
    hasAccess,
    isExpired,
    expiryDate,
    priceFormatted,
    subscribe
  } = useDriverSubscription();

  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'mobile_money' | 'card'>('wallet');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [processing, setProcessing] = useState(false);

  const monthlyPrice = config?.price || 0;
  const yearlyPrice = config?.yearly_price || monthlyPrice * 12 * 0.95;
  const discount = config?.yearly_discount_percentage || 15;

  const handleSubscribe = async () => {
    setProcessing(true);
    await subscribe(paymentMethod, billingCycle);
    setProcessing(false);
  };

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
          Abonnement mensuel ou annuel pour accéder aux services de 224Solutions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Choix du cycle de facturation */}
        {(!hasAccess || isExpired) && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('driverSubscriptionCard.dureeDeLAbonnement')}</Label>
            <RadioGroup value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'monthly' | 'yearly')}>
              <div className={`flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent cursor-pointer ${billingCycle === 'monthly' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Mensuel</p>
                      <p className="text-sm text-muted-foreground">30 jours</p>
                    </div>
                    <p className="text-lg font-bold text-primary"><Money amount={monthlyPrice} from="GNF" /></p>
                  </div>
                </Label>
              </div>

              <div className={`flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent cursor-pointer ${billingCycle === 'yearly' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="yearly" id="yearly" />
                <Label htmlFor="yearly" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Annuel</p>
                      <p className="text-sm text-muted-foreground">365 jours</p>
                      <Badge variant="secondary" className="mt-1 bg-orange-100 text-[#ff4000]">
                        Économisez {discount}%
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground line-through"><Money amount={monthlyPrice * 12} from="GNF" /></p>
                      <p className="text-lg font-bold text-primary"><Money amount={yearlyPrice} from="GNF" /></p>
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Prix de l'abonnement actif */}
        {hasAccess && !isExpired && (
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Abonnement actuel</p>
                <p className="text-3xl font-bold text-primary"><Money amount={monthlyPrice} from="GNF" /></p>
              </div>
              <Calendar className="h-12 w-12 text-primary opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {subscription?.billing_cycle === 'yearly' ? 'Valable 365 jours' : 'Valable 30 jours'} à compter de l'activation
            </p>
          </div>
        )}

        {/* Statut de l'abonnement */}
        {subscription && hasAccess && expiryDate && (
          <div className="border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">{t('driverSubscriptionCard.informationsDeLAbonnement')}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Date d'expiration</p>
                <p className="font-medium">
                  {format(expiryDate, 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('driverSubscriptionCard.modeDePaiement')}</p>
                <p className="font-medium capitalize">{subscription.payment_method}</p>
              </div>
            </div>
          </div>
        )}

        {/* Méthodes de paiement */}
        {(!hasAccess || isExpired) && (
          <>
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('driverSubscriptionCard.modeDePaiement')}</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="wallet" id="wallet" />
                  <Label htmlFor="wallet" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Wallet className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Wallet 224Solutions</p>
                      <p className="text-xs text-muted-foreground">{t('driverSubscriptionCard.paiementInstantane')}</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer opacity-50">
                  <RadioGroupItem value="mobile_money" id="mobile_money" disabled />
                  <Label htmlFor="mobile_money" className="flex items-center gap-2 cursor-not-allowed flex-1">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Mobile Money</p>
                      <p className="text-xs text-muted-foreground">{t('driverSubscriptionCard.bientotDisponible')}</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer opacity-50">
                  <RadioGroupItem value="card" id="card" disabled />
                  <Label htmlFor="card" className="flex items-center gap-2 cursor-not-allowed flex-1">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Carte bancaire</p>
                      <p className="text-xs text-muted-foreground">{t('driverSubscriptionCard.bientotDisponible')}</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Bouton d'action */}
            <Button
              onClick={handleSubscribe}
              disabled={processing}
              className="w-full"
              size="lg"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traitement en cours...
                </>
              ) : isExpired ? (
                'Renouveler mon abonnement'
              ) : (
                'Activer mon abonnement'
              )}
            </Button>
          </>
        )}

        {/* Avantages */}
        <div className="bg-primary/5 p-4 rounded-lg space-y-2">
          <p className="font-medium text-sm">{t('driverSubscriptionCard.avecLAbonnementVousAccedez')}</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Réception illimitée de courses/livraisons
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Système GPS et tracking en temps réel
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Notifications instantanées
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Support prioritaire 7j/7
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

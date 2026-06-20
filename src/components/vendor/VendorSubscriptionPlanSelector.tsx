import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, Calendar, Wallet, Package, ImageIcon, Infinity } from "lucide-react";
import { SubscriptionService, Plan } from "@/services/subscriptionService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import walletService from "@/services/walletService";
import { Money } from "@/components/Money";

interface VendorSubscriptionPlanSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

const BILLING_CYCLE_LABELS = {
  monthly: 'Mensuel (1 mois)',
  quarterly: 'Trimestriel (3 mois)',
  yearly: 'Annuel (12 mois)'
};

const BILLING_CYCLE_DURATION = {
  monthly: 1,
  quarterly: 3,
  yearly: 12
};

function buildPlanDescription(plan: Plan): string {
  const parts: string[] = [];
  const featureSet = new Set<string>();

  const normalizeFeature = (value: string): string => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('analytic')) return 'analytics';
    if (normalized.includes('support')) return 'support prioritaire';
    if (normalized.includes('avant') || normalized.includes('featured')) return 'mise en avant';
    if (normalized.includes('api')) return ''; // Accès API retiré (aucun système API vendeur)
    if (normalized.includes('branding') || normalized.includes('marque')) return 'branding personnalise';
    return normalized;
  };

  if (plan.max_products === null) {
    parts.push('produits illimites');
  } else {
    parts.push(`${plan.max_products} produits max`);
  }

  if (plan.max_images_per_product !== null) {
    parts.push(`${plan.max_images_per_product} images/produit`);
  }

  if (plan.analytics_access) featureSet.add('analytics');
  if (plan.priority_support) featureSet.add('support prioritaire');
  if (plan.featured_products) featureSet.add('mise en avant');
  if (plan.custom_branding) featureSet.add('branding personnalise');

  if (Array.isArray(plan.features)) {
    for (const feature of plan.features) {
      const normalized = normalizeFeature(feature);
      if (!normalized) continue;
      if (normalized.includes('produit') || normalized.includes('image')) continue;
      featureSet.add(normalized);
    }
  }

  const orderedMainFeatures = [
    'analytics',
    'support prioritaire',
    'mise en avant',
    'branding personnalise',
  ];

  for (const feature of orderedMainFeatures) {
    if (featureSet.has(feature)) {
      parts.push(feature);
      featureSet.delete(feature);
    }
  }

  for (const feature of featureSet) {
    parts.push(feature);
  }

  return parts.join(' · ');
}

function getPlanLabel(plan: Plan): string {
  if (plan.name === 'free') return 'Gratuit';
  return plan.display_name;
}

export function VendorSubscriptionPlanSelector({
  open,
  onOpenChange,
  onSuccess
}: VendorSubscriptionPlanSelectorProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState('GNF');

  useEffect(() => {
    if (open) {
      void loadPlans();
      void loadWalletBalance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await SubscriptionService.getPlans();
      setPlans(data);
    } catch (error) {
      console.error("Erreur chargement plans:", error);
      toast.error(t('vendorSubscriptionPlanSelector.erreurDeChargementDesPlans'));
    } finally {
      setLoading(false);
    }
  };

  const loadWalletBalance = async () => {
    if (!user?.id) return;
    try {
      const wallet = await walletService.getUserWallet(user.id);
      setWalletBalance(wallet?.balance || 0);
      if (wallet?.currency) setWalletCurrency(wallet.currency);
    } catch (error) {
      console.error("Erreur chargement wallet:", error);
    }
  };

  const calculatePrice = (plan: Plan): number => {
    const monthlyPrice = plan.monthly_price_gnf;
    const duration = BILLING_CYCLE_DURATION[billingCycle];

    if (billingCycle === 'yearly' && plan.yearly_price_gnf) {
      return plan.yearly_price_gnf;
    }

    return monthlyPrice * duration;
  };

  const calculateDiscount = (plan: Plan): number | null => {
    if (billingCycle === 'yearly' && plan.yearly_price_gnf && plan.yearly_discount_percentage) {
      return plan.yearly_discount_percentage;
    }
    return null;
  };

  // Rabais annuel réel max parmi les plans payants (évite un pourcentage codé en dur faux).
  const maxYearlyDiscount = plans.reduce((max, p) => {
    const pct = p.yearly_discount_percentage
      ?? (p.monthly_price_gnf && p.yearly_price_gnf
        ? Math.round(((p.monthly_price_gnf * 12 - p.yearly_price_gnf) / (p.monthly_price_gnf * 12)) * 100)
        : 0);
    return Math.max(max, pct || 0);
  }, 0);

  const handleSubscribe = async () => {
    if (!selectedPlan || !user?.id) return;

    const priceGNF = calculatePrice(selectedPlan);

    // NB: pas de blocage sur le solde ici — le backend calcule le montant réel
    // (0 pour un downgrade avant expiration, différence au prorata pour un upgrade)
    // et renvoie une erreur explicite si le solde est insuffisant.
    try {
      setSubscribing(true);

      const subscriptionId = await SubscriptionService.recordSubscriptionPayment({
        userId: user.id,
        planId: selectedPlan.id,
        pricePaid: priceGNF,
        paymentMethod: 'wallet',
        billingCycle: billingCycle
      });

      if (subscriptionId) {
        toast.success(t('vendorSubscriptionPlanSelector.abonnementActiveAvecSucces'), {
          description: `Plan ${selectedPlan.display_name} - ${BILLING_CYCLE_LABELS[billingCycle]}`
        });

        await loadWalletBalance();
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(t('vendorSubscriptionPlanSelector.erreurLorsDeLActivation'));
      }
    } catch (error) {
      console.error("Erreur souscription:", error);
      toast.error(t('vendorSubscriptionPlanSelector.erreurSystemeLorsDeLa'));
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('vendorSubscriptionPlanSelector.choisirUnPlanDAbonnement')}</DialogTitle>
          <DialogDescription>
            Selectionnez le plan et la duree qui vous conviennent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="text-sm font-medium">{t('vendorSubscriptionPlanSelector.dureeDeLAbonnement')}</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(Object.keys(BILLING_CYCLE_LABELS) as BillingCycle[]).map((cycle) => (
              <Card
                key={cycle}
                className={`p-4 cursor-pointer transition-all hover:border-primary ${
                  billingCycle === cycle ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => setBillingCycle(cycle)}
              >
                <div className="flex items-center gap-2">
                  {billingCycle === cycle && <Check className="w-4 h-4 text-primary" />}
                  <Calendar className="w-4 h-4" />
                </div>
                <p className="font-medium mt-2">{BILLING_CYCLE_LABELS[cycle]}</p>
                {cycle === 'yearly' && maxYearlyDiscount > 0 && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    Économisez jusqu'à {maxYearlyDiscount}%
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">{t('vendorSubscriptionPlanSelector.choisissezVotrePlan')}</label>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {plans.map((plan) => {
                const price = calculatePrice(plan);
                const discount = calculateDiscount(plan);
                const isUnlimited = plan.max_products === null;

                return (
                  <Card
                    key={plan.id}
                    className={`p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:shadow-md ${
                      selectedPlan?.id === plan.id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border/70'
                    }`}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {selectedPlan?.id === plan.id && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                          <h3 className="font-bold text-lg tracking-tight">{getPlanLabel(plan)}</h3>
                          {discount && (
                            <Badge variant="secondary" className="text-xs">
                              -{discount}%
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1.5 mb-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Package className="w-3.5 h-3.5" />
                            <span>
                              {isUnlimited ? (
                                <span className="inline-flex items-center gap-1"><Infinity className="w-3.5 h-3.5" /> {t('vendorSubscriptionPlanSelector.produitsIllimites')}</span>
                              ) : `${plan.max_products} produits max`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>{plan.max_images_per_product} images/produit</span>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed text-[#000000] mb-3 min-h-[2.5rem]">
                          {buildPlanDescription(plan)}
                        </p>

                        <div className="space-y-1">
                          <span className="text-2xl font-extrabold tracking-tight text-primary">
                            <Money amount={price} from="GNF" />
                          </span>
                          <p className="text-sm text-muted-foreground/90">
                            pour {BILLING_CYCLE_DURATION[billingCycle]} mois
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">{t('vendorSubscriptionPlanSelector.soldeWallet')}</span>
          </div>
          <span className="font-bold"><Money amount={walletBalance} from={walletCurrency} /></span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={subscribing}>
            Annuler
          </Button>
          <Button
            onClick={handleSubscribe}
            disabled={!selectedPlan || subscribing}
          >
            {subscribing ? "Traitement..." : "Confirmer l'abonnement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

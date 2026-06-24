import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, TrendingUp, Rocket, Package, ImageIcon, Infinity } from 'lucide-react';
import { SubscriptionService, Plan, ActiveSubscription } from '@/services/subscriptionService';
import { Money } from '@/components/Money';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

const planIcons = {
  free: Zap,
  basic: Check,
  pro: TrendingUp,
  business: Crown,
  premium: Rocket,
};

/**
 * Génère la description marketing à partir des vraies données du plan.
 * Aucune promesse inventée — tout est basé sur les champs réels.
 */
function buildPlanDescription(plan: Plan): string {
  const featureHighlights = getPlanFeatureHighlights(plan);
  const parts: string[] = [];

  if (plan.max_products === null) {
    parts.push('produits illimites');
  } else {
    parts.push(`${plan.max_products} produits max`);
  }

  if (plan.max_images_per_product) {
    parts.push(`${plan.max_images_per_product} images/produit`);
  }

  for (const feature of featureHighlights) {
    parts.push(feature);
  }

  return parts.join(' · ');
}

function getPlanFeatureHighlights(plan: Plan): string[] {
  const featureSet = new Set<string>();

  const normalizeFeature = (value: string): string => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('analytic')) return 'analytics';
    if (normalized.includes('support')) return 'support prioritaire';
    if (normalized.includes('avant') || normalized.includes('featured')) return 'mise en avant';
    if (normalized.includes('api')) return ''; // Accès API retiré (aucun système API)
    if (normalized.includes('branding') || normalized.includes('marque')) return 'branding personnalise';
    return normalized;
  };

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

  const orderedFeatures: string[] = [];
  for (const feature of orderedMainFeatures) {
    if (featureSet.has(feature)) {
      orderedFeatures.push(feature);
      featureSet.delete(feature);
    }
  }

  for (const feature of featureSet) {
    orderedFeatures.push(feature);
  }

  return orderedFeatures;
}

function getPlanLabel(plan: Plan): string {
  if (plan.name === 'free') return 'Gratuit';
  return plan.display_name;
}

interface SubscriptionPlansProps {
  onSelectPlan: (plan: Plan) => void;
}

export function SubscriptionPlans({ onSelectPlan }: SubscriptionPlansProps) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const plansData = await SubscriptionService.getPlans();
      setPlans(plansData);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const subscription = await SubscriptionService.getActiveSubscription(user.id);
        setCurrentSubscription(subscription);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erreur',
        description: t('subscriptionPlans.impossibleDeChargerLesPlans'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isCurrentPlan = (planName: string) => {
    return currentSubscription?.plan_name === planName;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">
          Choisissez votre plan d'abonnement
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Développez votre activité avec les outils adaptés à vos besoins
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = planIcons[plan.name as keyof typeof planIcons] || Check;
          const isCurrent = isCurrentPlan(plan.name);
          const isPremium = plan.name === 'premium';
          const isUnlimited = plan.max_products === null;

          return (
            <Card
              key={plan.id}
              className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                isPremium ? 'border-primary/70 shadow-primary/20 bg-gradient-to-b from-primary/5 to-transparent' : 'border-border/70'
              } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
            >
              {isPremium && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary-glow">
                    <Crown className="w-3 h-3 mr-1" />
                    Populaire
                  </Badge>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-4 right-4">
                  <Badge variant="secondary" className="shadow-sm">Plan actuel</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4 relative z-10">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl tracking-tight">{getPlanLabel(plan)}</CardTitle>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground">
                    <Package className="w-4 h-4 text-primary" />
                    {isUnlimited ? (
                      <span className="flex items-center gap-1">
                        <Infinity className="w-4 h-4" /> produits illimites
                      </span>
                    ) : (
                      <span>{plan.max_products} produits max</span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{plan.max_images_per_product} images/produit</span>
                  </div>
                </div>

                <CardDescription className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-[#000000]">
                  {buildPlanDescription(plan)}
                </CardDescription>

                <div className="mt-4 space-y-1">
                  <div className="text-3xl font-extrabold tracking-tight text-foreground">
                    <Money amount={plan.monthly_price_gnf} from="GNF" />
                  </div>
                  <div className="text-sm text-muted-foreground/90">{t('subscriptionPlans.pour1Mois')}</div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 relative z-10">
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-muted-foreground">
                    Fonctionnalités :
                  </div>
                  <ul className="space-y-2">
                    {(plan.features as string[]).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={() => onSelectPlan(plan)}
                  disabled={isCurrent || plan.name === 'free'}
                  className="w-full"
                  variant={isPremium ? 'default' : 'outline'}
                >
                  {isCurrent
                    ? 'Plan actuel'
                    : plan.name === 'free'
                    ? 'Plan gratuit'
                    : 'Choisir ce plan'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('subscriptionPlans.verificationDesFonctionnalitesParPlan')}</CardTitle>
          <CardDescription className="text-xs">
            Controle rapide des limites et fonctionnalites reellement appliquees a chaque plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:grid grid-cols-12 gap-3 text-xs font-semibold text-muted-foreground pb-2 border-b">
            <div className="col-span-2">Plan</div>
            <div className="col-span-3">Limites</div>
            <div className="col-span-7">Fonctionnalites incluses</div>
          </div>
          <div className="space-y-3 mt-3">
            {plans.map((plan) => {
              const limitLabel = plan.max_products === null
                ? 'produits illimites'
                : `${plan.max_products} produits max`;
              const features = getPlanFeatureHighlights(plan);

              return (
                <div key={`check-${plan.id}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 p-3 rounded-lg border bg-background/60">
                  <div className="md:col-span-2 text-sm font-semibold">{getPlanLabel(plan)}</div>
                  <div className="md:col-span-3 text-xs text-muted-foreground">
                    {limitLabel} · {plan.max_images_per_product} images/produit
                  </div>
                  <div className="md:col-span-7 text-xs leading-relaxed text-muted-foreground">
                    {features.length > 0 ? features.join(' · ') : 'aucune fonctionnalite additionnelle'}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {currentSubscription && currentSubscription.current_period_end && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{t('subscriptionPlans.votreAbonnementActuel')}</h3>
                <p className="text-sm text-muted-foreground">
                  Plan <strong>{currentSubscription.plan_display_name}</strong> -{' '}
                  {SubscriptionService.getDaysRemaining(currentSubscription.current_period_end)}{' '}
                  jours restants
                </p>
              </div>
              {currentSubscription.auto_renew && (
                <Badge variant="outline">Renouvellement automatique</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import { ArrowLeft, Store, Calendar, CreditCard, Wallet, CalendarDays, CheckCircle2, XCircle, Loader2, Crown, Sparkles, Package, ImageIcon, BarChart3, Headphones, Star, Palette, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVendorSubscription } from '@/hooks/useVendorSubscription';
import { Plan, SubscriptionService } from '@/services/subscriptionService';
import { useVendorCurrency } from '@/hooks/useVendorCurrency';
import { format, addMonths, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProductLimitInfo {
  current_count: number;
  max_products: number | null;
  can_add: boolean;
  is_unlimited: boolean;
  plan_name: string;
}

interface DigitalPlanPreset {
  key: 'starter' | 'growth' | 'scale';
  title: string;
  badge: string;
  audience: string;
  emphasis: string;
}

// Helper: get the plan the user is on (from subscription or free fallback)
function getActivePlan(plans: Plan[], subscription: any, hasAccess: boolean, isExpired: boolean): Plan | null {
  if (subscription && hasAccess && !isExpired) {
    return plans.find(p => p.id === subscription.plan_id) || null;
  }
  return plans.find(p => p.name === 'free') || null;
}

// Feature row component
function FeatureRow({ label, icon: Icon, enabled }: { label: string; icon: any; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1">{label}</span>
      {enabled ? (
        <CheckCircle2 className="h-4 w-4 text-[#ff4000] shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      )}
    </div>
  );
}

/**
 * Génère une description marketing dynamique à partir des données réelles du plan.
 * Aucune valeur hardcodée - tout vient de l'objet plan.
 */
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

  // Produits
  if (plan.max_products === null) {
    parts.push('produits illimités');
  } else {
    parts.push(`${plan.max_products} produits`);
  }

  // Images
  if (plan.max_images_per_product !== null) {
    parts.push(`${plan.max_images_per_product} images/produit`);
  }

  // Features cles
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

  const extras: string[] = [];
  for (const feature of orderedMainFeatures) {
    if (featureSet.has(feature)) {
      extras.push(feature);
      featureSet.delete(feature);
    }
  }

  for (const feature of featureSet) {
    extras.push(feature);
  }

  if (extras.length > 0) {
    parts.push(extras.join(', '));
  }

  // Construct sentence
  const toneMap: Record<string, string> = {
    free: 'Idéal pour démarrer',
    basic: 'Pour structurer votre boutique',
    pro: 'Pour accélérer votre croissance',
    business: 'Pour une activité à grande échelle',
    premium: 'Pour une gestion avancée et complète',
  };
  const tone = toneMap[plan.name] || 'Un plan adapté à vos besoins';

  return `${tone} avec ${parts.join(', ')}.`;
}

function buildPlanDescriptionForContext(plan: Plan, isDigitalSubscription: boolean): string {
  if (!isDigitalSubscription) {
    return buildPlanDescription(plan);
  }

  const parts: string[] = [];
  const extras = getDigitalFeatureList(plan).slice(0, 3);

  parts.push(plan.max_products === null ? 'offres numeriques illimitees' : `${plan.max_products} offres numeriques`);

  if (plan.max_images_per_product !== null) {
    parts.push(`${plan.max_images_per_product} visuels par offre`);
  }

  if (extras.length > 0) {
    parts.push(extras.join(', '));
  }

  const toneMap: Record<string, string> = {
    free: 'Ideal pour lancer votre catalogue digital',
    basic: 'Pour structurer vos premieres ventes numeriques',
    pro: 'Pour accelerer vos lancements et votre distribution',
    business: 'Pour piloter une activite digitale a plus grande echelle',
    premium: 'Pour une marque digitale complete et plus visible',
  };

  const tone = toneMap[plan.name] || 'Un plan adapte a votre activite digitale';
  return `${tone} avec ${parts.join(', ')}.`;
}

function sanitizeDigitalFeature(feature: string): string | null {
  const value = feature.trim();
  if (!value) return null;

  const normalized = value.toLowerCase();

  if (
    normalized.includes('pos') ||
    normalized.includes('point de vente') ||
    normalized.includes('caisse') ||
    normalized.includes('terminal') ||
    normalized.includes('code barre') ||
    normalized.includes('magasin physique') ||
    normalized.includes('stock physique')
  ) {
    return null;
  }

  if (normalized.includes('analytic')) return 'Analytics ventes, telechargements et abonnements';
  if (normalized.includes('support')) return 'Support prioritaire pour vos lancements';
  if (normalized.includes('avant') || normalized.includes('featured')) return 'Visibilite marketplace et mise en avant';
  if (normalized.includes('api')) return null;
  if (normalized.includes('branding') || normalized.includes('marque')) return 'Branding de vos pages de vente';
  if (normalized.includes('image')) return value.replace(/produit/gi, 'offre').replace(/images?/gi, 'visuels');
  if (normalized.includes('produit')) return value.replace(/produits?/gi, 'offres').replace(/boutique/gi, 'catalogue digital');

  return value.replace(/boutique/gi, 'catalogue digital');
}

function getDigitalFeatureList(plan: Plan): string[] {
  const features = new Set<string>();

  if (plan.analytics_access) features.add('Analytics ventes, telechargements et abonnements');
  if (plan.priority_support) features.add('Support prioritaire pour vos lancements');
  if (plan.featured_products) features.add('Visibilite marketplace et mise en avant');
  if (plan.custom_branding) features.add('Branding de vos pages de vente');

  if (Array.isArray(plan.features)) {
    for (const feature of plan.features) {
      const sanitized = sanitizeDigitalFeature(feature);
      if (sanitized) {
        features.add(sanitized);
      }
    }
  }

  return Array.from(features);
}

function getDigitalPlanPreset(index: number): DigitalPlanPreset {
  const presets: DigitalPlanPreset[] = [
    {
      key: 'starter',
      title: 'Starter Digital',
      badge: 'Demarrage',
      audience: 'Pour lancer votre catalogue et vendre proprement vos premieres offres numeriques.',
      emphasis: 'Catalogue, visuels, liens de paiement et suivi des premieres ventes.',
    },
    {
      key: 'growth',
      title: 'Croissance Digitale',
      badge: 'Croissance',
      audience: 'Pour un vendeur digital qui veut accelerer sa diffusion et ses conversions.',
      emphasis: 'Campagnes, visibilite marketplace, analytics et affiliation.',
    },
    {
      key: 'scale',
      title: 'Scale Digital',
      badge: 'Avance',
      audience: 'Pour une activite digitale plus structuree avec plus de volume et d automatisation.',
      emphasis: 'Branding, support prioritaire, automatisations et capacite elevee de publication.',
    },
  ];

  return presets[Math.min(index, presets.length - 1)];
}

function getDigitalPlanSelection(plans: Plan[], activePlanId?: string | null): Plan[] {
  const paidPlans = [...plans]
    .filter((plan) => plan.name !== 'free')
    .sort((first, second) => {
      if (first.display_order !== second.display_order) {
        return first.display_order - second.display_order;
      }
      return first.monthly_price_gnf - second.monthly_price_gnf;
    });

  if (paidPlans.length <= 3) {
    return paidPlans;
  }

  const selectedIndexes = new Set<number>([0, Math.floor((paidPlans.length - 1) / 2), paidPlans.length - 1]);
  const activeIndex = activePlanId ? paidPlans.findIndex((plan) => plan.id === activePlanId) : -1;

  if (activeIndex >= 0 && !selectedIndexes.has(activeIndex)) {
    selectedIndexes.delete(Math.floor((paidPlans.length - 1) / 2));
    selectedIndexes.add(activeIndex);
  }

  while (selectedIndexes.size < 3) {
    for (let index = 0; index < paidPlans.length && selectedIndexes.size < 3; index += 1) {
      selectedIndexes.add(index);
    }
  }

  return Array.from(selectedIndexes)
    .sort((first, second) => first - second)
    .slice(0, 3)
    .map((index) => paidPlans[index]);
}

function getFeatureRows(plan: Plan, isDigitalSubscription: boolean) {
  if (!isDigitalSubscription) {
    return [
      { icon: BarChart3, label: 'Analytics & statistiques', enabled: plan.analytics_access },
      { icon: Headphones, label: 'Support prioritaire', enabled: plan.priority_support },
      { icon: Star, label: 'Produits mis en avant', enabled: plan.featured_products },
      { icon: Palette, label: 'Branding personnalise', enabled: plan.custom_branding },
    ];
  }

  return [
    { icon: BarChart3, label: 'Analytics ventes, telechargements et abonnes', enabled: plan.analytics_access },
    { icon: Headphones, label: 'Support prioritaire pour vos lancements', enabled: plan.priority_support },
    { icon: Star, label: 'Mise en avant du catalogue et des offres', enabled: plan.featured_products },
    { icon: Palette, label: 'Branding des pages de vente et de paiement', enabled: plan.custom_branding },
  ];
}

const DIGITAL_MODULE_BADGES = [
  'Catalogue digital',
  'Campagnes multicanales',
  'Liens de paiement',
  'Affiliation',
  'Wallet vendeur',
];

export default function VendorSubscriptionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { businessType, vendorId, userId: currentVendorUserId } = useCurrentVendor();
  const {
    subscription,
    plans,
    loading,
    hasAccess,
    isExpired,
    daysRemaining,
    expiryDate,
    priceFormatted,
    refresh,
  } = useVendorSubscription();

  const { currency: vendorCurrency, convert, isReady: currencyReady } = useVendorCurrency();
  // fmt: convertit GNF → devise du vendeur et formate. '—' pendant le chargement.
  const fmt = (amount: number) =>
    currencyReady
      ? `${Math.round(convert(amount)).toLocaleString('fr-FR')} ${vendorCurrency}`
      : '—';

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [processing, setProcessing] = useState(false);
  const [productLimit, setProductLimit] = useState<ProductLimitInfo | null>(null);

  const activePlan = getActivePlan(plans, subscription, hasAccess, isExpired);
  const isDigitalSubscription = location.pathname.startsWith('/vendeur-digital') || businessType === 'digital';
  const featureRows = activePlan ? getFeatureRows(activePlan, isDigitalSubscription) : [];
  const sanitizedActiveFeatures = activePlan
    ? isDigitalSubscription
      ? getDigitalFeatureList(activePlan)
      : activePlan.features
    : [];
  const displayedPlans = isDigitalSubscription
    ? getDigitalPlanSelection(plans, activePlan?.id)
    : plans;
  const productLabel = isDigitalSubscription ? 'Offres numeriques publiees' : 'Produits';
  const imageLabel = isDigitalSubscription ? 'Visuels par offre' : 'Images par produit';

  useEffect(() => {
    void loadProductLimit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription, activePlan?.id, isDigitalSubscription, vendorId, currentVendorUserId]);

  const loadProductLimit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = currentVendorUserId || user?.id;
    if (!effectiveUserId) return;

    if (isDigitalSubscription) {
      let query = supabase
        .from('digital_products')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published');

      if (vendorId) {
        query = query.or(`vendor_id.eq.${vendorId},merchant_id.eq.${effectiveUserId}`);
      } else {
        query = query.eq('merchant_id', effectiveUserId);
      }

      const { count, error } = await query;
      if (error) {
        console.error('Erreur chargement limite produits digitaux:', error);
        return;
      }

      setProductLimit({
        current_count: count || 0,
        max_products: activePlan?.max_products ?? null,
        can_add: activePlan?.max_products === null ? true : (count || 0) < activePlan.max_products,
        is_unlimited: activePlan?.max_products === null,
        plan_name: activePlan?.display_name || subscription?.plan_display_name || 'Gratuit',
      });
      return;
    }

    const limit = await SubscriptionService.checkProductLimit(effectiveUserId);
    if (limit) setProductLimit(limit as unknown as ProductLimitInfo);
  };

  const handleBack = () => {
    if (location.pathname.startsWith('/vendeur-digital')) {
      navigate('/vendeur-digital/dashboard');
      return;
    }

    navigate('/vendeur/dashboard');
  };

  const handleSelectPlan = (plan: Plan) => {
    if (plan.name === 'free') return;
    if (subscription && hasAccess && !isExpired && subscription.plan_id === plan.id) return;
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };

  const calculatePrice = (plan: Plan, cycle: 'monthly' | 'yearly') => {
    if (cycle === 'yearly') {
      return plan.yearly_price_gnf || Math.round(plan.monthly_price_gnf * 12 * 0.85);
    }
    return plan.monthly_price_gnf;
  };

  const calculateEndDate = (cycle: 'monthly' | 'yearly') => {
    return cycle === 'yearly' ? addYears(new Date(), 1) : addMonths(new Date(), 1);
  };

  const calculateYearlySavings = (plan: Plan) => {
    const monthlyTotal = plan.monthly_price_gnf * 12;
    const yearlyPrice = plan.yearly_price_gnf || Math.round(monthlyTotal * 0.85);
    return monthlyTotal - yearlyPrice;
  };

  const getYearlySavingsPercent = (plan: Plan) => {
    const monthlyTotal = plan.monthly_price_gnf * 12;
    const yearlyPrice = plan.yearly_price_gnf || Math.round(monthlyTotal * 0.85);
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    try {
      setProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Vous devez être connecté'); return; }

      const price = calculatePrice(selectedPlan, billingCycle);

      // Pas de blocage sur le solde ici : le backend calcule le montant réel
      // (0 pour un downgrade avant expiration, différence au prorata pour un upgrade)
      // et renvoie une erreur explicite si le solde est insuffisant.
      const subscriptionId = await SubscriptionService.recordSubscriptionPayment({
        userId: user.id,
        planId: selectedPlan.id,
        pricePaid: price,
        paymentMethod: 'wallet',
        billingCycle,
      });

      if (subscriptionId) {
        const endDate = format(calculateEndDate(billingCycle), 'dd/MM/yyyy', { locale: fr });
        toast.success(`Abonnement ${selectedPlan.display_name} activé jusqu'au ${endDate}`);
        setIsDialogOpen(false);
        refresh();
      } else {
        throw new Error('Échec de la création');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.message || 'Impossible de souscrire');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPrice = selectedPlan ? calculatePrice(selectedPlan, billingCycle) : 0;
  const endDate = calculateEndDate(billingCycle);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-3xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isDigitalSubscription ? 'Abonnement Vendeur Digital' : 'Abonnement Vendeur'}</h1>
            <p className="text-muted-foreground">
              {isDigitalSubscription
                ? 'Gerez votre plan pour vos offres numeriques, votre visibilite et vos ventes digitales'
                : 'Gerez votre plan et vos limites'}
            </p>
          </div>
        </div>

        {/* Current status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  {isDigitalSubscription ? 'Mon Plan Digital Actuel' : 'Mon Plan Actuel'}
                </CardTitle>
                <CardDescription>
                  {!subscription
                    ? isDigitalSubscription
                      ? 'Vous utilisez actuellement le plan de base pour votre catalogue digital'
                      : 'Vous utilisez actuellement le plan gratuit'
                    : isExpired
                      ? 'Votre abonnement a expiré'
                      : `Plan ${subscription.plan_display_name} actif`}
                </CardDescription>
              </div>
              {hasAccess && !isExpired ? (
                <Badge variant="outline" className="bg-orange-50 text-[#ff4000] border-orange-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Actif
                </Badge>
              ) : isExpired ? (
                <Badge variant="outline" className="bg-orange-50 text-[#ff4000] border-orange-200">Expiré</Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">Gratuit</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasAccess && subscription && !isExpired && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan actuel</p>
                    <p className="text-lg font-bold text-primary">{subscription.plan_display_name}</p>
                    <p className="text-2xl font-bold text-primary">{fmt(subscription?.price_paid || 0)}</p>
                  </div>
                  <Calendar className="h-12 w-12 text-primary/30" />
                </div>
                {expiryDate && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-primary/10">
                    <div>
                      <p className="text-xs text-muted-foreground">Expiration</p>
                      <p className="font-medium">{format(expiryDate, 'dd MMMM yyyy', { locale: fr })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Jours restants</p>
                      <p className="font-medium">{daysRemaining} jours</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isDigitalSubscription && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-sm text-[#04439e]">Modules couverts par votre abonnement digital</h3>
                  <p className="text-xs text-[#04439e]/80">
                    Votre plan pilote surtout la capacite de publication, la visibilite et l'accompagnement de vos ventes numeriques.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DIGITAL_MODULE_BADGES.map((badge) => (
                    <Badge key={badge} variant="secondary" className="border border-blue-200 bg-white text-[#04439e]">
                      {badge}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-[#04439e]/80">
                  Ici, la limite de produits correspond au nombre d'offres numeriques publiees dans votre catalogue digital.
                </p>
              </div>
            )}

            {/* Usage Limits */}
            {activePlan && (
              <div className="p-4 border rounded-xl space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  {isDigitalSubscription ? 'Capacites de votre plan digital' : 'Limites de votre plan'}
                </h3>

                {/* Products */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{productLabel}</span>
                    <span className="font-medium">
                      {productLimit
                        ? activePlan.max_products === null
                          ? `${productLimit.current_count} (illimité)`
                          : `${productLimit.current_count} / ${activePlan.max_products}`
                        : activePlan.max_products === null ? 'Illimité' : `Max ${activePlan.max_products}`}
                    </span>
                  </div>
                  {activePlan.max_products !== null && productLimit && (
                    <Progress
                      value={Math.min((productLimit.current_count / activePlan.max_products) * 100, 100)}
                      className="h-2"
                    />
                  )}
                  {activePlan.max_products !== null && productLimit && productLimit.current_count >= activePlan.max_products * 0.8 && (
                    <p className="text-xs text-orange-600">
                      {productLimit.current_count >= activePlan.max_products
                        ? isDigitalSubscription
                          ? 'Limite atteinte - passez au plan superieur pour publier davantage d\'offres numeriques'
                          : 'Limite atteinte - mettez a niveau pour ajouter des produits'
                        : isDigitalSubscription
                          ? 'Vous approchez de la limite de publication de votre catalogue digital'
                          : 'Proche de la limite'}
                    </p>
                  )}
                </div>

                {/* Images */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{imageLabel}</span>
                  <span className="font-medium">
                    {activePlan.max_images_per_product === null ? 'Illimité' : `Max ${activePlan.max_images_per_product}`}
                  </span>
                </div>
              </div>
            )}

            {/* Current plan features from DB */}
            {activePlan && (
              <div className="p-4 border rounded-xl space-y-3">
                <h3 className="font-semibold text-sm">
                  {isDigitalSubscription ? 'Fonctionnalites incluses pour votre activite digitale' : 'Fonctionnalites incluses'}
                </h3>
                <div className="grid gap-2">
                  {featureRows.map((feature) => (
                    <FeatureRow
                      key={feature.label}
                      icon={feature.icon}
                      label={feature.label}
                      enabled={feature.enabled}
                    />
                  ))}
                </div>
                {sanitizedActiveFeatures && sanitizedActiveFeatures.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Autres avantages :</p>
                    {sanitizedActiveFeatures.map((feature, index) => (
                      <p key={`${feature}-${index}`} className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-[#ff4000] shrink-0" /> {feature}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plans comparison */}
        {displayedPlans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{isDigitalSubscription ? 'Choisir un plan digital' : 'Choisir un plan'}</CardTitle>
              <CardDescription>
                {isDigitalSubscription
                  ? 'Le vendeur digital ne voit que 3 offres: debuter, accelerer et structurer la croissance de son activite numerique.'
                  : 'Comparez les plans et choisissez celui adapte a votre activite'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {displayedPlans.map((plan, index) => {
                const isCurrentPlan = activePlan?.id === plan.id;
                const digitalPreset = isDigitalSubscription ? getDigitalPlanPreset(index) : null;
                const isRecommended = isDigitalSubscription ? digitalPreset?.key === 'growth' : plan.name === 'pro';
                const isPopular = isDigitalSubscription ? digitalPreset?.key === 'starter' : plan.name === 'basic';
                const savingsPercent = plan.name !== 'free' ? getYearlySavingsPercent(plan) : 0;
                const digitalFeatures = isDigitalSubscription ? getDigitalFeatureList(plan) : plan.features;

                return (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isCurrentPlan
                        ? 'border-primary bg-primary/5'
                        : plan.name === 'free'
                          ? 'border-border bg-muted/20'
                          : 'border-border hover:border-primary/50 cursor-pointer'
                    }`}
                    onClick={() => !isCurrentPlan && plan.name !== 'free' && handleSelectPlan(plan)}
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base">{isDigitalSubscription ? digitalPreset?.title : plan.display_name}</h3>
                          {isDigitalSubscription && digitalPreset && (
                            <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-[#04439e]">
                              {digitalPreset.badge}
                            </Badge>
                          )}
                          {isCurrentPlan && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">Actuel</Badge>
                          )}
                          {isRecommended && !isCurrentPlan && (
                            <Badge className="bg-gradient-to-r from-[#ff4000] to-orange-500 text-white text-xs border-0">
                              <Crown className="h-3 w-3 mr-1" /> Recommandé
                            </Badge>
                          )}
                          {isPopular && !isCurrentPlan && (
                            <Badge className="bg-blue-500 text-white text-xs border-0">
                              <Sparkles className="h-3 w-3 mr-1" /> Populaire
                            </Badge>
                          )}
                        </div>
                        {isDigitalSubscription && digitalPreset && (
                          <div className="mt-2 space-y-1">
                            <p className="text-sm font-medium text-slate-900">{digitalPreset.audience}</p>
                            <p className="text-xs text-muted-foreground">{digitalPreset.emphasis}</p>
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Base technique: {plan.display_name}</p>
                          </div>
                        )}
                        <p className="text-sm text-[#000000] mt-1 leading-snug">
                          {buildPlanDescriptionForContext(plan, isDigitalSubscription)}
                        </p>
                      </div>
                      {!isCurrentPlan && plan.name !== 'free' && (
                        <Button size="sm">Choisir</Button>
                      )}
                    </div>

                    {/* KEY LIMITS - highly visible */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="flex items-center gap-2.5 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                        <Package className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="text-sm font-bold leading-tight">
                            {plan.max_products === null ? 'Illimité' : plan.max_products}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            {isDigitalSubscription
                              ? plan.max_products === null
                                ? 'offres publiees'
                                : plan.max_products === 1
                                  ? 'offre publiee max'
                                  : 'offres publiees max'
                              : plan.max_products === null
                                ? 'produits'
                                : plan.max_products === 1
                                  ? 'produit max'
                                  : 'produits max'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                        <ImageIcon className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="text-sm font-bold leading-tight">
                            {plan.max_images_per_product === null ? 'Illimité' : plan.max_images_per_product}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            {isDigitalSubscription
                              ? plan.max_images_per_product === null
                                ? 'visuels / offre'
                                : plan.max_images_per_product === 1
                                  ? 'visuel / offre'
                                  : 'visuels / offre'
                              : plan.max_images_per_product === null
                                ? 'images / produit'
                                : plan.max_images_per_product === 1
                                  ? 'image / produit'
                                  : 'images / produit'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-3">
                      <p className="text-sm font-semibold">
                        {plan.name === 'free'
                          ? 'Gratuit - aucun paiement requis'
                          : `${fmt(plan.monthly_price_gnf)}/mois`}
                      </p>
                      {savingsPercent > 0 && (
                        <p className="text-xs text-[#ff4000] font-medium">
                          Économisez {savingsPercent}% en annuel
                        </p>
                      )}
                    </div>

                    {/* Features grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        {plan.analytics_access ? <CheckCircle2 className="h-3.5 w-3.5 text-[#ff4000]" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />}
                        <span className={!plan.analytics_access ? 'text-muted-foreground/60' : ''}>
                          {isDigitalSubscription ? 'Ventes et abonnes' : 'Analytics'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {plan.priority_support ? <CheckCircle2 className="h-3.5 w-3.5 text-[#ff4000]" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />}
                        <span className={!plan.priority_support ? 'text-muted-foreground/60' : ''}>Support prioritaire</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {plan.featured_products ? <CheckCircle2 className="h-3.5 w-3.5 text-[#ff4000]" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />}
                        <span className={!plan.featured_products ? 'text-muted-foreground/60' : ''}>
                          {isDigitalSubscription ? 'Visibilite marketplace' : 'Mise en avant'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {plan.custom_branding ? <CheckCircle2 className="h-3.5 w-3.5 text-[#ff4000]" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />}
                        <span className={!plan.custom_branding ? 'text-muted-foreground/60' : ''}>
                          {isDigitalSubscription ? 'Pages brandees' : 'Branding personnalise'}
                        </span>
                      </div>
                    </div>

                    {/* Free-text features */}
                    {digitalFeatures && digitalFeatures.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        {digitalFeatures.map((feature, index) => (
                          <p key={`${feature}-${index}`} className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-[#ff4000] shrink-0" /> {feature}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Subscription dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmer votre abonnement</DialogTitle>
            <DialogDescription>
              Plan: <strong>{selectedPlan?.display_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Cycle de facturation :</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    billingCycle === 'monthly' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Mensuel</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedPlan && fmt(selectedPlan.monthly_price_gnf)}/mois
                  </p>
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`p-3 rounded-lg border-2 transition-all text-left relative ${
                    billingCycle === 'yearly' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  {selectedPlan && (
                    <div className="absolute -top-2 -right-2 bg-[#ff4000] text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      -{getYearlySavingsPercent(selectedPlan)}%
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Annuel</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedPlan && fmt(calculatePrice(selectedPlan, 'yearly'))}/an
                  </p>
                </button>
              </div>
              {billingCycle === 'yearly' && selectedPlan && (
                <p className="text-xs text-[#ff4000] font-medium">
                  Économisez {fmt(calculateYearlySavings(selectedPlan))} par an !
                </p>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="font-bold text-lg">{fmt(currentPrice)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valable jusqu'au</span>
                <span className="font-medium">{format(endDate, 'dd/MM/yyyy', { locale: fr })}</span>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="font-medium">Paiement par Wallet</span>
              </div>
              <p className="text-xs text-muted-foreground">Le montant sera débité de votre wallet</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubscribe} disabled={processing}>
              <CreditCard className="w-4 h-4 mr-2" />
              {processing ? 'Traitement...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

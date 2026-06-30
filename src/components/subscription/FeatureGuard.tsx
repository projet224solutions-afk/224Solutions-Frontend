import { useTranslation } from "@/hooks/useTranslation";
import { ReactNode, useState } from 'react';
import { useSubscriptionFeatures, SubscriptionFeature, FEATURE_MIN_PLAN } from '@/hooks/useSubscriptionFeatures';
import { Button } from '@/components/ui/button';
import { Lock, Crown, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VendorSubscriptionPlanSelector } from '@/components/vendor/VendorSubscriptionPlanSelector';

interface FeatureGuardProps {
  feature: SubscriptionFeature;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  'free': 'Gratuit',
  'basic': 'Basic',
  'pro': 'Pro',
  'business': 'Business',
  'premium': 'Premium',
};

const PLAN_COLORS: Record<string, string> = {
  'free': 'bg-gray-100 text-gray-700',
  'basic': 'bg-blue-100 text-blue-700',
  'pro': 'bg-blue-100 text-[#04439e]',
  'business': 'bg-orange-100 text-orange-700',
  'premium': 'bg-[#ff4000] text-white',
};

const _PLAN_DESCRIPTIONS: Record<string, string> = {
  'free': "Plan basique pour démarrer : gestion des produits, commandes simples, tableau de bord et profil public.",
  'basic': "Plan intermédiaire pour une gestion structurée : produits avancés, suivi des commandes/livraisons, analytics de base, facturation automatique.",
  'pro': "Plan avancé pour développer l’activité : inventaire, marketing/affiliation, programme d’affiliation, produits en vedette et support prioritaire.",
  'business': "Plan complet pour une gestion étendue : POS, fournisseurs et dettes, multi‑entrepôts, exports et accès API.",
  'premium': "Plan premium avec outils et accompagnement avancés : assistant IA Gemini, hub de communication, analytics temps réel, account manager dédié et formation.",
};

const PLAN_FEATURES_PREVIEW: Record<string, string[]> = {
  'basic': [
    'POS - Point de vente',
    'Gestion inventaire',
    'Livraison intégrée',
    'Messages clients',
    'Copilot IA',
  ],
  'pro': [
    'Tout de Basic +',
    'Marketing & Promotions',
    'Programme affiliation',
    'Produits en vedette',
    'Analytics avancés',
  ],
  'business': [
    'Tout de Pro +',
    'Devis & Factures',
    'Liens de paiement',
    'Gestion dettes',
    'Multi-entrepôts',
  ],
  'premium': [
    'Toutes les fonctionnalités',
    'Support prioritaire dédié',
    'Assistant IA Gemini',
    'API Premium',
    'Formation personnalisée',
  ],
};

export function FeatureGuard({
  feature,
  children,
  fallback,
  showUpgradePrompt = true
}: FeatureGuardProps) {
  const { t } = useTranslation();
  const { canAccessFeature, loading, getPlanName, isActive } = useSubscriptionFeatures();
  const [showDialog, setShowDialog] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);

  // En cours de chargement
  if (loading) {
    return <div className="animate-pulse bg-muted h-20 rounded" />;
  }

  // Vérifier l'accès à la fonctionnalité
  // Pour le plan gratuit, on vérifie si la feature est dans le plan free
  const hasAccess = canAccessFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const handleSubscribe = () => {
    setShowDialog(false);
    setShowPlanSelector(true);
  };

  const handleSubscriptionSuccess = () => {
    setShowPlanSelector(false);
    window.location.reload();
  };

  const minPlan = FEATURE_MIN_PLAN[feature] || 'basic';
  const minPlanDisplay = PLAN_DISPLAY_NAMES[minPlan] || minPlan;

  if (showUpgradePrompt) {
    return (
      <>
        <div className="relative min-h-[200px]">
          <div className="opacity-30 pointer-events-none blur-[2px]">
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-background rounded-lg">
            <div className="text-center space-y-4 p-6 max-w-md">
              <div className="mx-auto w-16 h-16 rounded-full bg-[#ff4000] flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('featureGuard.fonctionnalitePremium')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {!isActive()
                    ? "Votre abonnement est expiré ou inactif."
                    : <>{t('featureGuard.requiertLePlan')} <Badge className={PLAN_COLORS[minPlan]}>{minPlanDisplay}</Badge> {t('featureGuard.ouSuperieur')}</>
                  }
                </p>
              </div>
              <Button
                className="gap-2 bg-[#ff4000] hover:bg-[#ff4000] text-white shadow-lg shadow-[#ff4000]/40"
                onClick={() => setShowDialog(true)}
              >
                <Crown className="w-4 h-4" />
                Mettre à niveau
              </Button>
            </div>
          </div>
        </div>

        {/* Dialog d'information */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-[#ff4000]">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <span>{t('featureGuard.fonctionnalitePremium')}</span>
              </DialogTitle>
              <DialogDescription className="pt-2">
                {!isActive() ? (
                  <span className="text-destructive font-medium">
                    Votre abonnement est expiré ou inactif.
                  </span>
                ) : (
                  <span>
                    Cette fonctionnalité nécessite le plan{' '}
                    <Badge className={PLAN_COLORS[minPlan]}>{minPlanDisplay}</Badge> ou supérieur.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Plan actuel */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">{t('featureGuard.votrePlanActuel')}</span>
                <Badge variant="outline">{getPlanName()}</Badge>
              </div>

              {/* Aperçu des fonctionnalités du plan minimum */}
              {minPlan !== 'free' && PLAN_FEATURES_PREVIEW[minPlan] && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Crown className="w-4 h-4 text-[#ff4000]" />
                    Ce que vous obtiendrez avec {minPlanDisplay}
                  </p>
                  <ul className="space-y-1.5">
                    {PLAN_FEATURES_PREVIEW[minPlan]?.slice(0, 5).map((feat, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-[#ff4000] flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                Plus tard
              </Button>
              <Button
                onClick={handleSubscribe}
                className="flex-1 bg-[#ff4000] hover:bg-[#ff4000] text-white shadow-lg shadow-[#ff4000]/40"
              >
                <Crown className="w-4 h-4 mr-2" />
                Mettre à niveau
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sélecteur de plan intégré */}
        <VendorSubscriptionPlanSelector
          open={showPlanSelector}
          onOpenChange={setShowPlanSelector}
          onSuccess={handleSubscriptionSuccess}
        />
      </>
    );
  }

  return null;
}

// Composant pour les boutons de fonctionnalité
interface FeatureButtonProps {
  feature: SubscriptionFeature;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
}

export function FeatureButton({
  feature,
  onClick,
  children,
  className,
  variant = 'default',
  size = 'default',
  disabled = false
}: FeatureButtonProps) {
  const { t } = useTranslation();
  const { canAccessFeature, loading, isActive, getPlanName } = useSubscriptionFeatures();
  const [showDialog, setShowDialog] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);

  // Vérifier l'accès à la fonctionnalité ET que l'abonnement est actif
  const hasAccess = isActive() && canAccessFeature(feature);

  const handleClick = () => {
    if (hasAccess && !disabled) {
      onClick();
    } else if (!hasAccess) {
      setShowDialog(true);
    }
  };

  const handleSubscribe = () => {
    setShowDialog(false);
    setShowPlanSelector(true);
  };

  const handleSubscriptionSuccess = () => {
    setShowPlanSelector(false);
    window.location.reload();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={loading || disabled}
      >
        {!hasAccess && <Lock className="w-3 h-3 mr-1" />}
        {children}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#ff4000]" />
              Fonctionnalité Premium
            </DialogTitle>
            <DialogDescription>
              {!isActive()
                ? "Votre abonnement est expiré ou inactif. Veuillez le renouveler pour accéder à cette fonctionnalité."
                : `Cette fonctionnalité n'est pas disponible avec votre plan actuel: ${getPlanName()}`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Passez à un plan supérieur pour accéder à cette fonctionnalité et bien d'autres avantages.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Fermer
            </Button>
            <Button onClick={handleSubscribe}>
              S'abonner maintenant
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <VendorSubscriptionPlanSelector
        open={showPlanSelector}
        onOpenChange={setShowPlanSelector}
        onSuccess={handleSubscriptionSuccess}
      />
    </>
  );
}

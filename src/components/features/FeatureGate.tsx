import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Crown } from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface FeatureGateProps {
  featureKey: string;
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  showUpgradeButton?: boolean;
}

export function FeatureGate({
  featureKey,
  children,
  fallbackTitle,
  fallbackMessage,
  showUpgradeButton = true
}: FeatureGateProps) {
  const { hasAccess, checkAndLogAccess, restrictions, userPlan } = useFeatureAccess();
  const navigate = useNavigate();
  const { toast } = useToast();

  const restriction = restrictions.find(r => r.feature_key === featureKey);
  const access = hasAccess(featureKey);

  const handleFeatureClick = async () => {
    await checkAndLogAccess(featureKey);

    if (!access) {
      toast({
        title: 'Fonctionnalité non disponible',
        description: `Cette fonctionnalité nécessite un plan supérieur. Vous êtes actuellement sur le plan ${userPlan}.`,
        variant: 'destructive'
      });
    }
  };

  if (access) {
    return <>{children}</>;
  }

  // Afficher le contenu flouté avec overlay
  return (
    <div className="relative">
      {/* Contenu flouté */}
      <div className="blur-sm pointer-events-none select-none opacity-40">
        {children}
      </div>

      {/* Overlay de blocage */}
      <div
        className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm cursor-pointer"
        onClick={handleFeatureClick}
      >
        <Card className="max-w-md mx-auto shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <Lock className="w-12 h-12 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold">
                {fallbackTitle || restriction?.feature_name || 'Fonctionnalité Premium'}
              </h3>
              <p className="text-muted-foreground">
                {fallbackMessage || restriction?.feature_description || 'Cette fonctionnalité nécessite un plan supérieur'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline">Plan actuel: {userPlan}</Badge>
              <Badge className="bg-gradient-to-r from-primary to-primary-glow">
                <Crown className="w-3 h-3 mr-1" />
                Premium requis
              </Badge>
            </div>

            {showUpgradeButton && (
              <div className="space-y-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/vendeur/subscription');
                  }}
                  className="w-full"
                  size="lg"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Mettre à niveau mon plan
                </Button>

                <p className="text-xs text-muted-foreground">
                  Débloquez toutes les fonctionnalités premium
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

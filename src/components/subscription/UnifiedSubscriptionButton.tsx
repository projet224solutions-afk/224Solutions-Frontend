import { Button } from '@/components/ui/button';
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { useUnifiedSubscription } from '@/hooks/useUnifiedSubscription';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface UnifiedSubscriptionButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function UnifiedSubscriptionButton({ variant = 'outline', size = 'default' }: UnifiedSubscriptionButtonProps) {
  const { t } = useTranslation();
  const { subscription, loading, hasAccess, isExpired, daysRemaining } = useUnifiedSubscription();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Button variant={variant} size={size} disabled>
        <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-primary animate-spin"></div>
      </Button>
    );
  }

  const handleNavigate = () => {
    navigate('/subscription');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className="relative">
          <Calendar className="h-4 w-4 mr-2" />
          Abonnement
          {hasAccess && !isExpired && (
            <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success">
              Actif
            </Badge>
          )}
          {isExpired && (
            <Badge variant="outline" className="ml-2 bg-destructive/10 text-destructive border-destructive">
              Expiré
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        {hasAccess && subscription ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h4 className="font-semibold">Abonnement Actif</h4>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Plan:</span>
                <span className="font-medium">{subscription.plan_display_name}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('unifiedSubscriptionButton.expireLe')}</span>
                <span className="font-medium">
                  {format(new Date(subscription.current_period_end), 'dd MMM yyyy', { locale: fr })}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Jours restants:</span>
                <span className={`font-medium ${daysRemaining < 7 ? 'text-destructive' : 'text-success'}`}>
                  {daysRemaining} jours
                </span>
              </div>

              {subscription.auto_renew && (
                <div className="flex items-center gap-2 text-xs text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{t('unifiedSubscriptionButton.renouvellementAutomatiqueActive')}</span>
                </div>
              )}
            </div>

            <Button onClick={handleNavigate} className="w-full" size="sm">
              Gérer mon abonnement
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              <h4 className="font-semibold">{t('unifiedSubscriptionButton.aucunAbonnement')}</h4>
            </div>

            <p className="text-sm text-muted-foreground">
              Souscrivez à un abonnement pour accéder à toutes les fonctionnalités de 224Solutions.
            </p>

            <Button onClick={handleNavigate} className="w-full" size="sm">
              Choisir un plan
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default UnifiedSubscriptionButton;

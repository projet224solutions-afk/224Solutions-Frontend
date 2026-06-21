import { AlertTriangle, Clock, Ban } from 'lucide-react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { useDriverSubscription } from '@/hooks/useDriverSubscription';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function DriverSubscriptionBanner() {
  const { t } = useTranslation();
  const { subscription, isExpired, isExpiringSoon, daysRemaining, hasAccess, isDriver, loading } = useDriverSubscription();
  const navigate = useNavigate();

  // Ne rien afficher si: chargement, pas chauffeur, a accès, ou jamais souscrit (pas d'abonnement)
  if (loading || !isDriver || hasAccess || !subscription) {
    return null;
  }

  const handleSubscribe = () => {
    navigate('/driver-subscription');
  };

  if (isExpired) {
    return (
      <div className="mx-2 mt-2 mb-3">
        <div className={cn(
          "relative overflow-hidden rounded-xl",
          "bg-[#ff4000]/20",
          "border border-[#ff4000]/30",
          "p-3"
        )}>
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-[#ff4000]/20 flex items-center justify-center">
              <Ban className="w-4 h-4 text-[#ff4000]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[#ff4000] font-bold text-sm">{t('driverSubscriptionBanner.abonnementExpire')}</h4>
              <p className="text-[#ff4000]/80 text-xs mt-0.5 leading-relaxed">
                Vous ne pouvez plus recevoir de courses. Veuillez renouveler pour continuer.
              </p>
              <Button
                onClick={handleSubscribe}
                size="sm"
                className="mt-2 h-7 px-3 text-xs bg-[#ff4000] hover:bg-[#ff4000] text-white"
              >
                Renouveler maintenant
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isExpiringSoon) {
    return (
      <div className="mx-2 mt-2 mb-3">
        <div className={cn(
          "relative overflow-hidden rounded-xl",
          "bg-[#ff4000]/20",
          "border border-[#ff4000]/30",
          "p-3"
        )}>
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-[#ff4000]/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#ff4000]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[#ff4000] font-bold text-sm flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Expire dans {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}
              </h4>
              <p className="text-[#ff4000]/80 text-xs mt-0.5">
                Pensez à renouveler pour éviter toute interruption.
              </p>
              <Button
                onClick={handleSubscribe}
                size="sm"
                variant="outline"
                className="mt-2 h-7 px-3 text-xs border-[#ff4000]/50 text-[#ff4000] hover:bg-[#ff4000]/20"
              >
                Renouveler
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

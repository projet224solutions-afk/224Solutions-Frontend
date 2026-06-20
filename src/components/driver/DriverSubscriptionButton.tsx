import { Calendar } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { useDriverSubscription } from "@/hooks/useDriverSubscription";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DriverSubscriptionButton() {
  const { t } = useTranslation();
  const { subscription, loading } = useDriverSubscription();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
        <Calendar className="w-3 h-3" />
        <span className="hidden sm:inline">...</span>
      </Button>
    );
  }

  if (!subscription) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1 text-xs h-8 border-gray-300"
        onClick={() => navigate('/driver-subscription')}
      >
        <Calendar className="w-3 h-3" />
        <span className="hidden sm:inline">{t('driverSubscriptionButton.aucunAbonnement')}</span>
      </Button>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: fr });
    } catch (_error) {
      return "Date invalide";
    }
  };

  const endDate = formatDate(subscription.end_date);
  const isActive = subscription.status === 'active';
  const isExpired = subscription.status === 'expired';
  const daysRemaining = subscription.days_remaining || 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1 text-xs h-8 ${
            isActive
              ? 'border-orange-300 bg-orange-50 hover:bg-orange-100'
              : isExpired
              ? 'border-orange-300 bg-orange-50 hover:bg-orange-100'
              : 'border-gray-300'
          }`}
        >
          <Calendar className={`w-3 h-3 ${
            isActive ? 'text-[#ff4000]' : isExpired ? 'text-[#ff4000]' : 'text-gray-600'
          }`} />
          <span className="hidden sm:inline">
            {isActive ? `${daysRemaining}j restant${daysRemaining > 1 ? 's' : ''}` : isExpired ? 'Expiré' : 'Abonnement'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Mon Abonnement
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('driverSubscriptionButton.debut')}</span>
              <span className="font-medium">{formatDate(subscription.start_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fin:</span>
              <span className="font-medium">{endDate}</span>
            </div>
          </div>

          {daysRemaining > 0 && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-center text-blue-800 font-medium">
              ⏳ {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
            </div>
          )}

          {isExpired && (
            <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-center text-[#ff4000] font-bold">
              ⚠️ Abonnement expiré
            </div>
          )}

          {isActive && (
            <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-center text-[#ff4000] font-bold">
              ✅ Abonnement actif
            </div>
          )}

          <Button
            size="sm"
            className="w-full text-xs h-8"
            onClick={() => navigate('/driver-subscription')}
          >
            Gérer mon abonnement
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

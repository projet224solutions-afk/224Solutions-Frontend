import { Calendar } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDriverSubscription } from "@/hooks/useDriverSubscription";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function DriverSubscriptionInfo() {
  const { t } = useTranslation();
  const { subscription, loading } = useDriverSubscription();

  if (loading) {
    return (
      <Card className="bg-[#04439e]/5 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-[#04439e]" />
            📅 Mon Abonnement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-gray-600" />
            📅 Mon Abonnement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('driverSubscriptionInfo.aucunAbonnementTrouve')}</p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: fr });
    } catch (_error) {
      return "Date invalide";
    }
  };

  const startDate = formatDate(subscription.start_date);
  const endDate = formatDate(subscription.end_date);

  const isActive = subscription.status === 'active';
  const isExpired = subscription.status === 'expired';

  return (
    <Card className={`border-2 ${
      isActive
        ? 'bg-[#ff4000]/5 border-orange-300'
        : isExpired
        ? 'bg-[#ff4000]/5 border-orange-300'
        : 'bg-gray-50 border-gray-300'
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className={`w-5 h-5 ${
            isActive ? 'text-[#ff4000]' : isExpired ? 'text-[#ff4000]' : 'text-gray-600'
          }`} />
          📅 Mon Abonnement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
            <span className="text-sm font-medium text-gray-700">
              🗓️ Début de l'abonnement
            </span>
            <span className="text-sm font-bold text-gray-900">
              {startDate}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
            <span className="text-sm font-medium text-gray-700">
              📆 Fin de l'abonnement
            </span>
            <span className="text-sm font-bold text-gray-900">
              {endDate}
            </span>
          </div>
        </div>

        {subscription.days_remaining !== undefined && subscription.days_remaining > 0 && (
          <div className="mt-3 p-3 bg-blue-100 border border-blue-300 rounded-lg">
            <p className="text-xs text-center text-blue-800 font-medium">
              ⏳ {subscription.days_remaining} jour{subscription.days_remaining > 1 ? 's' : ''} restant{subscription.days_remaining > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {isExpired && (
          <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg">
            <p className="text-xs text-center text-[#ff4000] font-bold">
              ⚠️ Abonnement expiré
            </p>
          </div>
        )}

        {isActive && (
          <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg">
            <p className="text-xs text-center text-[#ff4000] font-bold">
              ✅ Abonnement actif
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

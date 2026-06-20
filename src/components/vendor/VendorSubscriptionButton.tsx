import { Calendar } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useVendorSubscription } from "@/hooks/useVendorSubscription";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function VendorSubscriptionButton() {
  const { t } = useTranslation();
  const { subscription, loading } = useVendorSubscription();

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg animate-pulse">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: fr });
    } catch (_error) {
      return "Date invalide";
    }
  };

  const isActive = subscription?.status === 'active';
  const planName = subscription?.plan_display_name || 'Aucun';
  const endDate = subscription?.current_period_end
    ? formatDate(subscription.current_period_end)
    : 'N/A';

  return (
    <div className="p-3 bg-card border rounded-lg space-y-2">
      <div className="flex items-center gap-2 font-semibold text-sm">
        <Calendar className="w-4 h-4 text-primary" />
        📅 Mon Abonnement
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col">
          <span className="text-muted-foreground">Statut</span>
          <span className={`font-medium ${isActive ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
            {isActive ? 'Actif' : 'Inactif'}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-muted-foreground">Plan actuel</span>
          <span className="font-medium">{planName}</span>
        </div>

        <div className="flex flex-col col-span-2">
          <span className="text-muted-foreground">{t('vendorSubscriptionButton.dateDeFin')}</span>
          <span className="font-medium">{endDate}</span>
        </div>
      </div>
    </div>
  );
}

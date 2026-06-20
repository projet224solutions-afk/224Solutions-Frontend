/**
 * TIMELINE DE SUIVI D'EXPÉDITION
 * Affiche visuellement les étapes de livraison avec animation
 */

import { CheckCircle, Circle, Package, Truck, MapPin, CheckCheck } from 'lucide-react';
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from '@/lib/utils';

interface TimelineStep {
  status: string;
  label: string;
  icon: React.ReactNode;
  timestamp?: string;
}

interface ShipmentTimelineProps {
  currentStatus: string;
  trackingHistory?: Array<{
    status: string;
    timestamp: string;
    location?: string;
    notes?: string;
  }>;
  className?: string;
}

const SHIPMENT_STEPS: TimelineStep[] = [
  {
    status: 'created',
    label: 'Commande créée',
    icon: <Package className="h-5 w-5" />,
  },
  {
    status: 'picked_up',
    label: 'Pris en charge',
    icon: <CheckCircle className="h-5 w-5" />,
  },
  {
    status: 'in_transit',
    label: 'En transit',
    icon: <Truck className="h-5 w-5" />,
  },
  {
    status: 'delivered',
    label: 'Livré',
    icon: <CheckCheck className="h-5 w-5" />,
  },
];

export function ShipmentTimeline({ currentStatus, trackingHistory, className }: ShipmentTimelineProps) {
  const { t } = useTranslation();
  const getCurrentStepIndex = () => {
    return SHIPMENT_STEPS.findIndex(step => step.status === currentStatus);
  };

  const currentStepIndex = getCurrentStepIndex();
  const isCancelled = currentStatus === 'cancelled';

  const getStepStatus = (index: number) => {
    if (isCancelled) return 'cancelled';
    if (index < currentStepIndex) return 'completed';
    if (index === currentStepIndex) return 'current';
    return 'pending';
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Timeline verticale */}
      <div className="relative">
        {SHIPMENT_STEPS.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === SHIPMENT_STEPS.length - 1;
          const trackingEntry = trackingHistory?.find(h => h.status === step.status);

          return (
            <div key={step.status} className="relative pb-8 last:pb-0">
              {/* Ligne de connexion */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-5 top-11 w-0.5 h-full -ml-px transition-all duration-500",
                    status === 'completed' ? "bg-gradient-to-b from-[#ff4000] to-[#ff4000]" :
                    status === 'current' ? "bg-gradient-to-b from-orange-500 to-gray-200" :
                    status === 'cancelled' ? "bg-orange-200" :
                    "bg-gray-200"
                  )}
                />
              )}

              {/* Étape */}
              <div className="flex items-start gap-4 relative">
                {/* Icône */}
                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500",
                    status === 'completed' ? "bg-orange-100 border-[#ff4000] text-[#ff4000] shadow-lg shadow-orange-200" :
                    status === 'current' ? "bg-orange-100 border-orange-500 text-orange-600 animate-pulse shadow-lg shadow-orange-200" :
                    status === 'cancelled' ? "bg-orange-100 border-orange-300 text-[#ff4000]" :
                    "bg-gray-50 border-gray-200 text-gray-400"
                  )}
                >
                  {status === 'completed' ? (
                    <CheckCircle className="h-5 w-5 fill-current" />
                  ) : status === 'current' ? (
                    step.icon
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>

                {/* Contenu */}
                <div className="flex-1 pt-1 animate-in fade-in slide-in-from-left duration-500">
                  <div
                    className={cn(
                      "font-medium transition-colors duration-300",
                      status === 'completed' ? "text-[#ff4000]" :
                      status === 'current' ? "text-orange-900" :
                      status === 'cancelled' ? "text-[#ff4000]" :
                      "text-gray-400"
                    )}
                  >
                    {step.label}
                  </div>

                  {/* Détails du tracking */}
                  {trackingEntry && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {new Date(trackingEntry.timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {trackingEntry.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{trackingEntry.location}</span>
                        </div>
                      )}
                      {trackingEntry.notes && (
                        <p className="text-sm text-muted-foreground">{trackingEntry.notes}</p>
                      )}
                    </div>
                  )}

                  {/* Badge de statut actuel */}
                  {status === 'current' && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full animate-pulse">
                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
                        En cours
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message d'annulation */}
      {isCancelled && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg animate-in fade-in slide-in-from-bottom duration-300">
          <p className="text-sm font-medium text-[#ff4000]">{t('shipmentTimeline.expeditionAnnulee')}</p>
          <p className="text-xs text-[#ff4000] mt-1">
            Cette expédition a été annulée et ne sera pas livrée.
          </p>
        </div>
      )}
    </div>
  );
}

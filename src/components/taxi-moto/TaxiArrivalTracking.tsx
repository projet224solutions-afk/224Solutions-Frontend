import { useTranslation } from "@/hooks/useTranslation";
/**
 * SUIVI D'ARRIVÉE DU TAXI — 224Solutions
 *
 * S'ouvre automatiquement côté client quand le chauffeur l'a localisé.
 * Affiche « Votre taxi est en route », la carte taxi → client, la distance
 * et l'ETA, mis à jour en temps réel via la position du chauffeur.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Car, MapPin, Clock, Navigation, Radio } from 'lucide-react';
import { calculateDistance } from '@/hooks/useGeoDistance';
import type { LivePosition } from '@/lib/liveLocation';

interface TaxiArrivalTrackingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Position du client (destination du taxi). */
  clientPos: LivePosition | null;
  /** Position du taxi (chauffeur). */
  driverPos: LivePosition | null;
  driverName?: string;
}

/** Vitesse moyenne urbaine pour estimer l'ETA (km/h). */
const AVG_SPEED_KMH = 22;

export function TaxiArrivalTracking({
  open,
  onOpenChange,
  clientPos,
  driverPos,
  driverName,
}: TaxiArrivalTrackingProps) {
  const { t } = useTranslation();
  const hasBoth =
    clientPos && driverPos &&
    Number.isFinite(driverPos.lat) && Number.isFinite(driverPos.lng);

  const distanceKm = hasBoth
    ? calculateDistance(driverPos!.lat, driverPos!.lng, clientPos!.lat, clientPos!.lng)
    : null;

  const etaMin =
    distanceKm !== null && Number.isFinite(distanceKm)
      ? Math.max(1, Math.round((distanceKm / AVG_SPEED_KMH) * 60))
      : null;

  const arrived = distanceKm !== null && distanceKm <= 0.05; // ~50 m

  // Carte : itinéraire taxi → client si on a les deux points, sinon centrée client
  const mapSrc = clientPos
    ? (driverPos
        ? `https://maps.google.com/maps?saddr=${driverPos.lat},${driverPos.lng}&daddr=${clientPos.lat},${clientPos.lng}&output=embed`
        : `https://maps.google.com/maps?q=${clientPos.lat},${clientPos.lng}&z=15&output=embed`)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            {arrived ? 'Votre taxi est arrivé !' : 'Votre taxi est en route'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bandeau statut */}
          <div className="rounded-lg border bg-orange-50 border-orange-200 p-3 flex items-center gap-3">
            <Radio className="w-4 h-4 text-[#ff4000] animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#ff4000]">
                {driverName ? `${driverName} arrive vers vous` : 'Le chauffeur arrive vers vous'}
              </p>
              <p className="text-xs text-[#ff4000]">
                {driverPos ? 'Position du taxi en direct' : 'En attente de la position du taxi…'}
              </p>
            </div>
            <Badge className="bg-[#ff4000] text-xs">EN DIRECT</Badge>
          </div>

          {/* Distance + ETA */}
          {distanceKm !== null && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <MapPin className="w-4 h-4 text-primary mx-auto mb-1" />
                <div className="text-lg font-bold">{distanceKm.toFixed(distanceKm < 1 ? 2 : 1)} km</div>
                <div className="text-xs text-muted-foreground">Distance</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                <div className="text-lg font-bold">{arrived ? '0' : etaMin} min</div>
                <div className="text-xs text-muted-foreground">{t('taxiArrivalTracking.arriveeEstimee')}</div>
              </div>
            </div>
          )}

          {/* Carte */}
          {mapSrc && (
            <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
              <iframe
                title={t('taxiArrivalTracking.suiviDuTaxi')}
                width="100%"
                height="100%"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={mapSrc}
              />
            </div>
          )}

          {!driverPos && (
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <Navigation className="w-3 h-3" />
              Le taxi vous a localisé. Sa position s'affichera dès qu'il l'active.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TaxiArrivalTracking;

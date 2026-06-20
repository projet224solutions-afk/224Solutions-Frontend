/**
 * NAVIGATION CLIENT → VENDEUR/SERVICE — 224Solutions
 *
 * S'ouvre côté CLIENT quand un vendeur physique / service de proximité l'a localisé
 * (requesterRole='merchant') et que le client a confirmé sa position.
 * Le client voit l'itinéraire VERS le vendeur (carte intégrée + guidage GPS).
 * À l'arrivée (≤ seuil), la navigation se ferme automatiquement.
 */

import { useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Store, MapPin, Clock, Navigation, Radio } from 'lucide-react';
import { calculateDistance } from '@/hooks/useGeoDistance';
import type { LivePosition } from '@/lib/liveLocation';

interface ClientNavigationToMerchantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Position du client (point de départ, qui se déplace). */
  clientPos: LivePosition | null;
  /** Position du vendeur/service (destination, fixe). */
  merchantPos: LivePosition | null;
  merchantName?: string;
  /** Appelé une fois quand le client arrive (≤ seuil) → fermeture auto. */
  onArrived?: () => void;
}

const AVG_SPEED_KMH = 15; // vitesse piéton/moto urbaine pour l'ETA
// Seuil d'arrivée. Le GPS grand public n'atteint pas 2 m de façon fiable (précision
// typique 5–20 m) : on considère « arrivé » à ~20 m du vendeur.
const ARRIVAL_THRESHOLD_KM = 0.02;

export function ClientNavigationToMerchant({
  open,
  onOpenChange,
  clientPos,
  merchantPos,
  merchantName,
  onArrived,
}: ClientNavigationToMerchantProps) {
  const { t } = useTranslation();
  const hasBoth =
    clientPos && merchantPos &&
    Number.isFinite(merchantPos.lat) && Number.isFinite(merchantPos.lng) &&
    Number.isFinite(clientPos.lat) && Number.isFinite(clientPos.lng);

  const distanceKm = hasBoth
    ? calculateDistance(clientPos!.lat, clientPos!.lng, merchantPos!.lat, merchantPos!.lng)
    : null;

  const etaMin =
    distanceKm !== null && Number.isFinite(distanceKm)
      ? Math.max(1, Math.round((distanceKm / AVG_SPEED_KMH) * 60))
      : null;

  const arrived = distanceKm !== null && distanceKm <= ARRIVAL_THRESHOLD_KM;

  // Fermeture automatique à l'arrivée
  useEffect(() => {
    if (arrived) {
      const t = setTimeout(() => onArrived?.(), 1500);
      return () => clearTimeout(t);
    }
  }, [arrived, onArrived]);

  // Carte intégrée : itinéraire client → vendeur
  const mapSrc = hasBoth
    ? `https://maps.google.com/maps?saddr=${clientPos!.lat},${clientPos!.lng}&daddr=${merchantPos!.lat},${merchantPos!.lng}&output=embed`
    : (merchantPos
        ? `https://maps.google.com/maps?q=${merchantPos.lat},${merchantPos.lng}&z=16&output=embed`
        : null);

  // Guidage vocal externe (client → vendeur)
  const navUrl = hasBoth
    ? `https://www.google.com/maps/dir/?api=1&origin=${clientPos!.lat},${clientPos!.lng}&destination=${merchantPos!.lat},${merchantPos!.lng}&travelmode=driving&dir_action=navigate`
    : (merchantPos
        ? `https://www.google.com/maps/dir/?api=1&destination=${merchantPos.lat},${merchantPos.lng}&travelmode=driving&dir_action=navigate`
        : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            {arrived ? 'Vous êtes arrivé !' : 'Rendez-vous chez'}
            {!arrived && merchantName ? ` ${merchantName}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bandeau statut */}
          <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 flex items-center gap-3">
            <Radio className="w-4 h-4 text-primary animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {arrived
                  ? `Vous êtes arrivé chez ${merchantName || 'le vendeur'}`
                  : `Suivez l'itinéraire vers ${merchantName || 'le vendeur'}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {merchantPos ? 'Position du vendeur en direct' : 'En attente de la position du vendeur…'}
              </p>
            </div>
            <Badge className="bg-primary text-xs">EN DIRECT</Badge>
          </div>

          {/* Distance + ETA */}
          {distanceKm !== null && !arrived && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <MapPin className="w-4 h-4 text-primary mx-auto mb-1" />
                <div className="text-lg font-bold">{distanceKm.toFixed(distanceKm < 1 ? 2 : 1)} km</div>
                <div className="text-xs text-muted-foreground">Distance</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                <div className="text-lg font-bold">{etaMin} min</div>
                <div className="text-xs text-muted-foreground">{t('clientNavigationToMerchant.arriveeEstimee')}</div>
              </div>
            </div>
          )}

          {/* Carte intégrée */}
          {mapSrc && !arrived && (
            <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
              <iframe
                title={t('clientNavigationToMerchant.itineraireVersLeVendeur')}
                width="100%"
                height="100%"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={mapSrc}
              />
            </div>
          )}

          {/* Bouton guidage GPS externe */}
          {navUrl && !arrived && (
            <Button
              onClick={() => window.open(navUrl, '_blank', 'noopener')}
              className="w-full"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Démarrer la navigation GPS
            </Button>
          )}

          {arrived && (
            <p className="text-sm text-center text-[#ff4000] font-medium">
              🎉 Vous êtes à destination. Bonne visite !
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ClientNavigationToMerchant;

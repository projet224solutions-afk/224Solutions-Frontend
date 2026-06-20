/**
 * PAGE PUBLIQUE DE SUIVI DE POSITION — 224Solutions
 *
 * Ouverte via le lien partagé par le client : /track/:userId
 * Affiche en temps réel la position partagée + carte + itinéraire Google Maps.
 * Accessible sans authentification (le chauffeur peut l'ouvrir directement).
 */

import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Radio, Clock } from 'lucide-react';
import { useTrackLocation } from '@/hooks/useLiveLocation';
import { formatElapsed, googleMapsDirectionsUrl } from '@/lib/liveLocation';

export default function LiveLocationTrack() {
  const { userId } = useParams<{ userId: string }>();
  const { position, connected, sharerStopped } = useTrackLocation(userId);

  const hasPosition = !!position;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background p-4 flex flex-col items-center">
      <div className="w-full max-w-lg space-y-4">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Suivi de position en direct
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* État de connexion */}
            <div
              className={`rounded-lg border p-3 flex items-center gap-3 ${
                hasPosition ? 'bg-orange-50 border-orange-200' : 'bg-muted/40 border-border'
              }`}
            >
              <Radio
                className={`w-4 h-4 flex-shrink-0 ${
                  hasPosition ? 'text-[#ff4000] animate-pulse' : 'text-muted-foreground'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {sharerStopped
                    ? 'Partage arrêté'
                    : hasPosition
                    ? 'Position reçue'
                    : connected
                    ? 'En attente de la position…'
                    : 'Connexion…'}
                </p>
                {position?.name && (
                  <p className="text-xs text-muted-foreground truncate">{position.name}</p>
                )}
              </div>
              {hasPosition && !sharerStopped && (
                <Badge variant="default" className="bg-[#ff4000] text-xs">
                  EN DIRECT
                </Badge>
              )}
            </div>

            {hasPosition ? (
              <>
                {/* Carte intégrée */}
                <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
                  <iframe
                    title="Position en direct"
                    width="100%"
                    height="100%"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${position.lat},${position.lng}&z=16&output=embed`}
                  />
                </div>

                {/* Coordonnées */}
                <div className="text-xs font-mono bg-muted rounded p-2 flex items-center justify-between">
                  <span>
                    {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                    {position.accuracy ? ` (±${Math.round(position.accuracy)} m)` : ''}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatElapsed(position.ts)}
                  </span>
                </div>

                <Button
                  className="w-full"
                  onClick={() =>
                    window.open(googleMapsDirectionsUrl(position.lat, position.lng), '_blank')
                  }
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Itinéraire vers le client
                </Button>
              </>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <p className="text-sm text-[#ff4000]">
                  {sharerStopped
                    ? 'Le client a arrêté le partage de sa position.'
                    : 'En attente que le client démarre le partage de sa position.'}
                </p>
                <p className="text-xs text-[#ff4000] mt-1">
                  La position s'affichera automatiquement dès qu'elle sera disponible.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          🔒 Ce lien affiche uniquement la position partagée volontairement par l'utilisateur.
        </p>
      </div>
    </div>
  );
}

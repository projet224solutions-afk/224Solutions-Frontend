/**
 * EMERGENCY MAP VIEW - Vue carte avec tracking temps réel
 * 224Solutions - Carte interactive pour suivi GPS
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { emergencyService } from '@/services/emergencyService';
import type { EmergencyAlert, EmergencyGPSTracking } from '@/types/emergency';

interface EmergencyMapViewProps {
  alert: EmergencyAlert;
  onResolve: (alert: EmergencyAlert, notes?: string) => void;
  onMarkAsFalse: (alert: EmergencyAlert) => void;
}

export const EmergencyMapView: React.FC<EmergencyMapViewProps> = ({
  alert,
  onResolve,
  onMarkAsFalse
}) => {
  const [gpsHistory, setGpsHistory] = useState<EmergencyGPSTracking[]>([]);
  const [isLoadingMap, setIsLoadingMap] = useState(true);

  /**
   * Charger l'historique GPS
   */
  const loadGPSHistory = useCallback(async () => {
    try {
      const history = await emergencyService.getGPSTracking(alert.id, 50);
      setGpsHistory(history);
    } catch (error) {
      console.error('❌ Erreur chargement historique GPS:', error);
    }
  }, [alert.id]);

  useEffect(() => {
    loadGPSHistory();
  }, [loadGPSHistory]);

  /**
   * S'abonner aux mises à jour GPS en temps réel
   */
  useEffect(() => {
    const unsubscribe = emergencyService.subscribeToGPSTracking(alert.id, (newPoint) => {
      setGpsHistory((prev) => [newPoint, ...prev].slice(0, 50));
    });

    return () => {
      unsubscribe();
    };
  }, [alert.id]);

  // Coordonnées actuelles ou initiales
  const currentLat = alert.current_latitude || alert.initial_latitude;
  const currentLng = alert.current_longitude || alert.initial_longitude;

  // URL Google Maps (en attendant l'intégration d'une vraie carte)
  const googleMapsUrl = `https://www.google.com/maps?q=${currentLat},${currentLng}&z=16`;
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${currentLat},${currentLng}`;

  // Style de la carte (simulation)
  const _mapMarkers = gpsHistory.slice(0, 10).map((point, index) => ({
    lat: point.latitude,
    lng: point.longitude,
    opacity: 1 - (index * 0.1)
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#ff4000]" />
            Position Temps Réel
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(googleMapsUrl, '_blank', 'noopener,noreferrer')}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Voir sur Maps
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(googleMapsDirectionsUrl, '_blank', 'noopener,noreferrer')}
            >
              <Navigation className="h-4 w-4 mr-2" />
              Itinéraire
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Carte interactive (Simulation) */}
        <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
          {/* Image de fond simulant une carte */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isLoadingMap && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* Iframe Google Maps */}
            <iframe
              src={`https://maps.google.com/maps?q=${currentLat},${currentLng}&z=16&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              onLoad={() => setIsLoadingMap(false)}
              title="Emergency Location Map"
            />
          </div>

          {/* Badge position actuelle */}
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-20">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-[#ff4000] rounded-full animate-ping" />
              <div>
                <p className="text-xs font-medium">Position Actuelle</p>
                <p className="text-xs text-muted-foreground">
                  {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
                </p>
              </div>
            </div>
          </div>

          {/* Badge vitesse */}
          {alert.current_speed !== undefined && (
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 z-20">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs font-medium">Vitesse</p>
                  <p className="text-lg font-bold text-blue-600">
                    {alert.current_speed.toFixed(1)} km/h
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Historique des positions */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Historique GPS ({gpsHistory.length} points)</h4>
          <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
            {gpsHistory.slice(0, 5).map((point, _index) => (
              <div
                key={point.id}
                className="flex items-center justify-between p-2 bg-muted rounded"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">
                    {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {point.speed?.toFixed(1)} km/h • {new Date(point.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions rapides */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={() => onResolve(alert, 'Situation résolue depuis la carte')}
            className="flex-1"
            variant="default"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Marquer comme Résolue
          </Button>
          <Button
            onClick={() => onMarkAsFalse(alert)}
            className="flex-1"
            variant="outline"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Fausse Alerte
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmergencyMapView;

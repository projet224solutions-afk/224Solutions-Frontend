/**
 * CARTE SIMPLE POUR VISUALISATION
 * Affiche une carte simple sans dépendances Google Maps
 */

import { Card } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { MapPin, Navigation } from 'lucide-react';

interface SimpleMapViewProps {
  driverLocation?: { latitude: number; longitude: number };
  pickupLocation?: { latitude: number; longitude: number };
  destinationLocation?: { latitude: number; longitude: number };
  height?: string;
}

export function SimpleMapView({
  driverLocation,
  pickupLocation,
  destinationLocation,
  height = '400px'
}: SimpleMapViewProps) {
  const { t } = useTranslation();
  const locations = [
    driverLocation && { ...driverLocation, label: t('simpleMapView.vous'), color: 'blue' },
    pickupLocation && { ...pickupLocation, label: t('simpleMapView.depart'), color: 'green' },
    destinationLocation && { ...destinationLocation, label: t('simpleMapView.arrivee'), color: 'red' }
  ].filter(Boolean);

  return (
    <Card className="overflow-hidden shadow-lg bg-[#04439e]/5" style={{ height }}>
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          <div className="grid grid-cols-8 grid-rows-8 h-full w-full">
            {Array.from({ length: 64 }).map((_, i) => (
              <div key={i} className="border border-gray-300" />
            ))}
          </div>
        </div>

        <div className="relative z-10 space-y-4 p-6 w-full">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-3 bg-blue-600 rounded-lg">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Localisation</h3>
          </div>

          {locations.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">{t('simpleMapView.aucunePositionDisponible')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {driverLocation && (
                <div className="flex items-start gap-3 p-4 bg-white/80 backdrop-blur rounded-lg shadow">
                  <div className="p-2 bg-blue-600 rounded-full">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900">{t('simpleMapView.votrePosition')}</p>
                    <p className="text-sm text-gray-600">
                      {driverLocation.latitude.toFixed(6)}, {driverLocation.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}

              {pickupLocation && (
                <div className="flex items-start gap-3 p-4 bg-white/80 backdrop-blur rounded-lg shadow">
                  <div className="p-2 bg-[#ff4000] rounded-full">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#ff4000]">{t('simpleMapView.pointDeDepart')}</p>
                    <p className="text-sm text-gray-600">
                      {pickupLocation.latitude.toFixed(6)}, {pickupLocation.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}

              {destinationLocation && (
                <div className="flex items-start gap-3 p-4 bg-white/80 backdrop-blur rounded-lg shadow">
                  <div className="p-2 bg-[#ff4000] rounded-full">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#ff4000]">Destination</p>
                    <p className="text-sm text-gray-600">
                      {destinationLocation.latitude.toFixed(6)}, {destinationLocation.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}

              {pickupLocation && destinationLocation && (
                <div className="mt-4 p-4 bg-blue-600 text-white rounded-lg text-center">
                  <p className="text-sm font-semibold">{t('simpleMapView.navigationActivee')}</p>
                  <p className="text-xs mt-1">{t('simpleMapView.suivezLesInstructionsVocales')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

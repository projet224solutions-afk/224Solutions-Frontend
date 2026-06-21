/**
 * COMPOSANT STATUS TOGGLE LIVREUR
 * Bouton pour passer online/offline/pause
 */

import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Power, Pause, Navigation } from 'lucide-react';
import { useState } from 'react';
import { useCurrentLocation } from '@/hooks/useGeolocation';

interface DriverStatusToggleProps {
  status: 'offline' | 'online' | 'on_delivery' | 'paused';
  isOnline: boolean;
  onGoOnline: (location: { lat: number; lng: number }) => Promise<void>;
  onGoOffline: () => Promise<void>;
  onPause: () => Promise<void>;
}

export function DriverStatusToggle({
  status,
  isOnline,
  onGoOnline,
  onGoOffline,
  onPause,
}: DriverStatusToggleProps) {
  const { location, getCurrentLocation, watchLocation, stopWatching } = useCurrentLocation();
  const [loading, setLoading] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    try {
      if (checked) {
        // Passer en ligne - on a besoin de la localisation
        console.log('[DriverStatusToggle] 📍 Demande GPS automatique...');
        const currentPos = await getCurrentLocation();
        console.log('[DriverStatusToggle] 📍 Position obtenue:', currentPos);

        if (currentPos) {
          await onGoOnline({ lat: currentPos.latitude, lng: currentPos.longitude });

          // Démarrer le suivi GPS continu
          const id = watchLocation();
          if (id) {
            setWatchId(id);
            setGpsActive(true);
            console.log('[DriverStatusToggle] 📍 Suivi GPS activé');
          }
        } else {
          console.error('[DriverStatusToggle] ❌ Impossible d\'obtenir la position GPS');
        }
      } else {
        // Passer hors ligne - arrêter le suivi GPS
        if (watchId) {
          stopWatching(watchId);
          setWatchId(null);
          setGpsActive(false);
          console.log('[DriverStatusToggle] 📍 Suivi GPS désactivé');
        }
        await onGoOffline();
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-[#16a34a]';
      case 'on_delivery':
        return 'bg-[#04439e]';
      case 'paused':
        return 'bg-[#ff4000]';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'online':
        return 'En ligne';
      case 'on_delivery':
        return 'En livraison';
      case 'paused':
        return 'En pause';
      default:
        return 'Hors ligne';
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2 flex-1">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{getStatusLabel()}</span>
          {(location || gpsActive) && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Navigation className="h-3 w-3 text-[#04439e]" />
              <span className="text-[#04439e] font-medium">GPS actif</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isOnline && status === 'online' && (
          <Button
            size="sm"
            variant="outline"
            onClick={onPause}
            className="gap-2"
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        )}

        <div className="flex items-center gap-2">
          <Power className={`h-4 w-4 ${isOnline ? 'text-[#16a34a]' : 'text-gray-500'}`} />
          <Switch
            checked={isOnline}
            onCheckedChange={handleToggle}
            disabled={loading || status === 'on_delivery'}
          />
        </div>
      </div>
    </div>
  );
}

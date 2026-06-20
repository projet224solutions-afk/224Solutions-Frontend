/**
 * NOTIFICATION DE NOUVELLE COURSE
 * Notification animée avec son pour les demandes de course
 */

import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Clock } from "lucide-react";
import { useEffect, useRef } from "react";

interface RideRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerRating: number;
  pickupAddress: string;
  destinationAddress: string;
  distance: number;
  estimatedEarnings: number;
  estimatedDuration: number;
  requestTime: string;
}

interface RideRequestNotificationProps {
  request: RideRequest;
  onAccept: () => void;
  onDecline: () => void;
  index: number;
  isAccepting?: boolean;
}

export function RideRequestNotification({
  request,
  onAccept,
  onDecline,
  index,
  isAccepting = false
}: RideRequestNotificationProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Jouer le son uniquement pour la première notification
    if (index === 0) {
      try {
        audioRef.current = new Audio('/notification.mp3');
        audioRef.current.play().catch(() => {});
      } catch (e) {
        console.error('Audio playback failed:', e);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [index]);

  // Calculer le temps écoulé depuis la demande
  const timeAgo = Math.floor((Date.now() - new Date(request.requestTime).getTime()) / 1000);
  const timeDisplay = timeAgo < 60 ? `${timeAgo}s` : `${Math.floor(timeAgo / 60)}min`;

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-orange-50 border-orange-300 shadow-xl animate-in slide-in-from-top duration-300">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{t('rideRequestNotification.nouvelleCourse')}</h3>
              <Badge variant="destructive" className="animate-pulse">
                {timeDisplay}
              </Badge>
            </div>
            <p className="text-sm text-gray-700 font-medium">{request.customerName}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#ff4000]">
              +{request.estimatedEarnings.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-gray-600">GNF</div>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-start gap-2 bg-white/70 p-2 rounded">
            <MapPin className="w-4 h-4 text-[#ff4000] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700">{t('rideRequestNotification.depart')}</p>
              <p className="text-sm font-semibold truncate">{request.pickupAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white/70 p-2 rounded">
            <MapPin className="w-4 h-4 text-[#ff4000] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700">{t('rideRequestNotification.arrivee')}</p>
              <p className="text-sm font-semibold truncate">{request.destinationAddress}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white/70 p-2 rounded mb-3">
          <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <span>{request.distance.toFixed(1)} km</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{request.estimatedDuration} min</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
            <span className="font-bold">{request.customerRating}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => {
              console.log('🚫 Bouton REFUSER cliqué pour la course:', request.id);
              onDecline();
            }}
            variant="outline"
            size="lg"
            disabled={isAccepting}
            className="flex-1 border-2 border-[#ff4000] text-[#ff4000] hover:bg-orange-50 hover:border-[#ff4000] font-bold text-base transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-xl mr-1">❌</span> Refuser
          </Button>
          <Button
            onClick={() => {
              console.log('✅ Bouton ACCEPTER cliqué pour la course:', request.id);
              onAccept();
            }}
            size="lg"
            disabled={isAccepting}
            className="flex-1 bg-gradient-to-r from-[#ff4000] to-[#ff4000] hover:from-[#ff4000] hover:to-[#ff4000] text-white shadow-lg font-bold text-base animate-pulse hover:animate-none transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAccepting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Acceptation...
              </>
            ) : (
              <>
                <span className="text-xl mr-1">✅</span> Accepter
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

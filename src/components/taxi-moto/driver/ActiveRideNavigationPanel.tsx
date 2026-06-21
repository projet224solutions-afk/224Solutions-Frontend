/**
 * PANNEAU DE NAVIGATION COURSE ACTIVE - UBER/BOLT STYLE
 * Interface de navigation optimisée pour le conducteur
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Money } from '@/components/Money';
import {
  Navigation,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  ExternalLink,
  User,
  Route,
  Zap,
  CheckCircle,
  Car,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TaxiMotoGeolocationService } from "@/services/taxi/TaxiMotoGeolocationService";

interface ActiveRide {
  id: string;
  customerName: string;
  customerPhone: string;
  pickup: {
    address: string;
    coords: { latitude: number; longitude: number };
  };
  destination: {
    address: string;
    coords: { latitude: number; longitude: number };
  };
  status: 'accepted' | 'arriving' | 'arrived' | 'picked_up' | 'in_progress';
  estimatedPrice: number;
  estimatedEarnings: number;
}

interface ActiveRideNavigationPanelProps {
  activeRide: ActiveRide | null;
  currentLocation: { latitude: number; longitude: number } | null;
  onContactCustomer: (phone: string) => void;
  onUpdateStatus: (status: string) => Promise<void>;
  onCancelRide: () => Promise<void>;
  isLoading?: boolean;
}

export function ActiveRideNavigationPanel({
  activeRide,
  currentLocation,
  onContactCustomer,
  onUpdateStatus,
  onCancelRide,
  isLoading = false
}: ActiveRideNavigationPanelProps) {
  const { t } = useTranslation();
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [_isCalculating, setIsCalculating] = useState(false);

  // Calculer la route
  const calculateRoute = useCallback(async () => {
    if (!activeRide || !currentLocation) return;

    setIsCalculating(true);
    try {
      const isGoingToPickup = activeRide.status === 'accepted' || activeRide.status === 'arriving';
      const target = isGoingToPickup ? activeRide.pickup.coords : activeRide.destination.coords;

      const routeInfo = await TaxiMotoGeolocationService.getRoute(
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        { latitude: target.latitude, longitude: target.longitude }
      );

      setDistance(routeInfo.distance);
      setDuration(routeInfo.duration);
    } catch (_error) {
      // Fallback calcul simple
      const target = activeRide.status === 'accepted' || activeRide.status === 'arriving'
        ? activeRide.pickup.coords
        : activeRide.destination.coords;

      const dist = TaxiMotoGeolocationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        target.latitude,
        target.longitude
      );
      setDistance(dist);
      setDuration(Math.ceil(dist * 3));
    } finally {
      setIsCalculating(false);
    }
  }, [activeRide, currentLocation]);

  useEffect(() => {
    calculateRoute();
    // Recalculer toutes les 30 secondes
    const interval = setInterval(calculateRoute, 30000);
    return () => clearInterval(interval);
  }, [calculateRoute]);

  // Ouvrir Google Maps
  const openGoogleMaps = () => {
    if (!activeRide || !currentLocation) {
      toast.error(t('activeRideNavigationPanel.impossibleDOuvrirLaNavigation'));
      return;
    }

    const isGoingToPickup = activeRide.status === 'accepted' || activeRide.status === 'arriving';
    const target = isGoingToPickup ? activeRide.pickup.coords : activeRide.destination.coords;

    const origin = `${currentLocation.latitude},${currentLocation.longitude}`;
    const destination = `${target.latitude},${target.longitude}`;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  // Ouvrir Waze
  const openWaze = () => {
    if (!activeRide) {
      toast.error(t('activeRideNavigationPanel.impossibleDOuvrirLaNavigation'));
      return;
    }

    const isGoingToPickup = activeRide.status === 'accepted' || activeRide.status === 'arriving';
    const target = isGoingToPickup ? activeRide.pickup.coords : activeRide.destination.coords;

    const wazeUrl = `https://waze.com/ul?ll=${target.latitude},${target.longitude}&navigate=yes`;
    window.open(wazeUrl, '_blank', 'noopener,noreferrer');
  };

  if (!activeRide) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <Navigation className="w-10 h-10 text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Aucune course active
        </h3>
        <p className="text-gray-400 text-sm">
          Acceptez une course pour démarrer la navigation
        </p>
      </div>
    );
  }

  const isGoingToPickup = activeRide.status === 'accepted' || activeRide.status === 'arriving';
  const currentTarget = isGoingToPickup ? 'pickup' : 'destination';

  // Déterminer le statut et les actions
  const getStatusConfig = () => {
    switch (activeRide.status) {
      case 'accepted':
        return {
          label: 'En route vers client',
          color: 'bg-[#ff4000]',
          nextAction: 'arriving',
          nextLabel: "Je suis arrivé",
          nextIcon: CheckCircle
        };
      case 'arriving':
        return {
          label: 'Arrivé au point',
          color: 'bg-blue-500',
          nextAction: 'started',
          nextLabel: "Client à bord",
          nextIcon: Car
        };
      case 'picked_up':
      case 'in_progress':
        return {
          label: 'Course en cours',
          color: 'bg-[#ff4000]',
          nextAction: 'completed',
          nextLabel: "Terminer course",
          nextIcon: CheckCircle
        };
      default:
        return {
          label: 'Course active',
          color: 'bg-gray-500',
          nextAction: null,
          nextLabel: '',
          nextIcon: null
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="bg-gray-900 min-h-screen pb-24">
      {/* Header avec statut */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between",
        statusConfig.color
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold">{statusConfig.label}</p>
            <p className="text-white/80 text-xs">
              {isGoingToPickup ? 'Vers point de départ' : 'Vers destination'}
            </p>
          </div>
        </div>
        <Badge className="bg-white/20 text-white border-0">
          {distance.toFixed(1)} km • {duration} min
        </Badge>
      </div>

      {/* Boutons navigation externes */}
      <div className="px-4 py-3 flex gap-2">
        <Button
          onClick={openGoogleMaps}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
          size="lg"
        >
          <ExternalLink className="w-5 h-5" />
          Google Maps
        </Button>
        <Button
          onClick={openWaze}
          className="flex-1 bg-[#04439e] hover:bg-[#04439e] text-white gap-2"
          size="lg"
        >
          <Route className="w-5 h-5" />
          Waze
        </Button>
      </div>

      {/* Infos distance et temps */}
      <div className="px-4 grid grid-cols-2 gap-3 py-3">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Route className="w-4 h-4 text-[#ff4000]" />
            <span className="text-gray-400 text-xs">Distance</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {distance.toFixed(1)}
            <span className="text-lg text-gray-400 ml-1">km</span>
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-gray-400 text-xs">{t('activeRideNavigationPanel.tempsEstime')}</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {duration}
            <span className="text-lg text-gray-400 ml-1">min</span>
          </p>
        </div>
      </div>

      {/* Info client */}
      <div className="px-4 py-2">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff4000] to-[#ff4000] flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold">{activeRide.customerName}</p>
                <p className="text-gray-400 text-sm">{activeRide.customerPhone}</p>
              </div>
            </div>
            <Button
              onClick={() => onContactCustomer(activeRide.customerPhone)}
              className="bg-[#ff4000] hover:bg-[#ff4000] text-white rounded-full w-12 h-12"
              size="icon"
            >
              <Phone className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Itinéraire */}
      <div className="px-4 py-2">
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          {/* Point de départ */}
          <div className={cn(
            "p-4 border-l-4 flex items-start gap-3",
            currentTarget === 'pickup' ? 'border-[#ff4000] bg-[#ff4000]/10' : 'border-gray-600'
          )}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
              currentTarget === 'pickup' ? 'bg-[#ff4000]' : 'bg-gray-600'
            )}>
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-xs font-semibold mb-1",
                currentTarget === 'pickup' ? 'text-[#ff4000]' : 'text-gray-500'
              )}>
                POINT DE DÉPART
              </p>
              <p className="text-white text-sm truncate">{activeRide.pickup.address}</p>
            </div>
            {currentTarget === 'pickup' && (
              <Zap className="w-5 h-5 text-[#ff4000] animate-pulse flex-shrink-0" />
            )}
          </div>

          {/* Séparateur */}
          <div className="px-4 py-1 flex items-center gap-2">
            <div className="flex-1 border-t border-dashed border-gray-700" />
            <ArrowRight className="w-4 h-4 text-gray-500" />
            <div className="flex-1 border-t border-dashed border-gray-700" />
          </div>

          {/* Destination */}
          <div className={cn(
            "p-4 border-l-4 flex items-start gap-3",
            currentTarget === 'destination' ? 'border-[#ff4000] bg-[#ff4000]/10' : 'border-gray-600'
          )}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
              currentTarget === 'destination' ? 'bg-[#ff4000]' : 'bg-gray-600'
            )}>
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-xs font-semibold mb-1",
                currentTarget === 'destination' ? 'text-[#ff4000]' : 'text-gray-500'
              )}>
                DESTINATION
              </p>
              <p className="text-white text-sm truncate">{activeRide.destination.address}</p>
            </div>
            {currentTarget === 'destination' && (
              <Zap className="w-5 h-5 text-[#ff4000] animate-pulse flex-shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* Gains estimés */}
      <div className="px-4 py-2">
        <div className="bg-gradient-to-r from-[#ff4000]/50 to-[#ff4000]/30 rounded-xl p-4 border border-[#ff4000]/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#ff4000] text-xs font-medium mb-1">{t('activeRideNavigationPanel.vosGains')}</p>
              <p className="text-2xl font-bold text-white">
                {activeRide.estimatedEarnings.toLocaleString()} <span className="text-sm text-gray-400">GNF</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs mb-1">Prix course</p>
              <p className="text-white font-semibold"><Money amount={activeRide.estimatedPrice} from="GNF" /></p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions principales */}
      <div className="px-4 py-4 space-y-3">
        {statusConfig.nextAction && statusConfig.nextIcon && (
          <Button
            onClick={async () => {
              try {
                console.log(`[Navigation] Mise à jour statut vers: ${statusConfig.nextAction}`);
                await onUpdateStatus(statusConfig.nextAction!);
              } catch (error) {
                console.error('[Navigation] Erreur mise à jour:', error);
              }
            }}
            disabled={isLoading}
            className={cn(
              "w-full h-14 text-lg font-semibold gap-3",
              statusConfig.nextAction === 'completed'
                ? 'bg-[#ff4000] hover:bg-[#ff4000]'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <statusConfig.nextIcon className="w-6 h-6" />
            )}
            {statusConfig.nextLabel}
          </Button>
        )}

        <Button
          onClick={onCancelRide}
          disabled={isLoading}
          variant="outline"
          className="w-full h-12 border-[#ff4000]/50 text-[#ff4000] hover:bg-[#ff4000]/10 hover:text-orange-300"
        >
          <X className="w-5 h-5 mr-2" />
          Annuler la course
        </Button>
      </div>
    </div>
  );
}

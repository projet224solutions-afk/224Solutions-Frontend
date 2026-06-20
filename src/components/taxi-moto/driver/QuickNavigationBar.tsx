/**
 * BARRE DE NAVIGATION RAPIDE - Affichée en bas pendant une course
 * Accès rapide à Google Maps et aux actions de course
 */

import { Navigation, Phone, MapPin, ExternalLink, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickNavigationBarProps {
  isVisible: boolean;
  distance: number;
  duration: number;
  targetAddress: string;
  targetType: 'pickup' | 'destination';
  onOpenGoogleMaps: () => void;
  onOpenWaze: () => void;
  onCall: () => void;
}

export function QuickNavigationBar({
  isVisible,
  distance,
  duration,
  targetAddress,
  targetType,
  onOpenGoogleMaps,
  onOpenWaze,
  onCall
}: QuickNavigationBarProps) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 transition-transform duration-300",
      isVisible ? "translate-y-0" : "translate-y-full"
    )}>
      <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
        {/* Info de navigation */}
        <div className={cn(
          "px-4 py-2 flex items-center gap-3",
          targetType === 'pickup' ? 'bg-[#ff4000]/20' : 'bg-[#ff4000]/20'
        )}>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            targetType === 'pickup' ? 'bg-[#ff4000]' : 'bg-[#ff4000]'
          )}>
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{targetAddress}</p>
            <p className="text-gray-400 text-xs">
              {distance.toFixed(1)} km • {duration} min
            </p>
          </div>
          <Navigation className={cn(
            "w-5 h-5 animate-pulse",
            targetType === 'pickup' ? 'text-[#ff4000]' : 'text-[#ff4000]'
          )} />
        </div>

        {/* Boutons d'action rapide */}
        <div className="px-3 py-2 flex gap-2">
          <Button
            onClick={onOpenGoogleMaps}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-10 gap-1.5"
          >
            <ExternalLink className="w-4 h-4" />
            Maps
          </Button>
          <Button
            onClick={onOpenWaze}
            className="flex-1 bg-[#04439e] hover:bg-[#04439e] text-white text-xs h-10 gap-1.5"
          >
            <Route className="w-4 h-4" />
            Waze
          </Button>
          <Button
            onClick={onCall}
            className="bg-[#ff4000] hover:bg-[#ff4000] text-white h-10 w-10 p-0"
          >
            <Phone className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

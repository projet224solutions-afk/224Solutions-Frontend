/**
 * MINI CARTE - ULTRA PROFESSIONNEL
 * Affichage élégant de la position GPS
 */

import { MapPin, Navigation2, Maximize2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MiniMapProps {
  latitude: number | null;
  longitude: number | null;
  isOnline: boolean;
  onExpand?: () => void;
}

export function MiniMap({ latitude, longitude, isOnline, onExpand }: MiniMapProps) {
  const hasLocation = latitude !== null && longitude !== null;

  return (
    <div className="relative">
      {/* Map Container - hauteur réduite pour mobile */}
      <div className={cn(
        "relative h-36 sm:h-44 rounded-xl overflow-hidden",
        "bg-gray-800",
        "border border-gray-700/50",
        "shadow-xl shadow-black/20"
      )}>
        {/* Map placeholder with grid pattern */}
        <div className="absolute inset-0">
          <div className="w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />

          {/* Radial gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/50 to-gray-900/80" />
        </div>

        {/* Center marker */}
        {hasLocation ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Pulse rings */}
            {isOnline && (
              <>
                <div className="absolute w-20 h-20 rounded-full bg-[#ff4000]/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute w-14 h-14 rounded-full bg-[#ff4000]/20 animate-pulse" />
              </>
            )}

            {/* Marker - plus petit */}
            <div className={cn(
              "relative z-10 w-10 h-10 rounded-full flex items-center justify-center",
              "shadow-xl",
              isOnline
                ? "bg-[#ff4000] shadow-[#ff4000]/30"
                : "bg-gray-600 shadow-black/30"
            )}>
              <Navigation2 className={cn(
                "w-5 h-5",
                isOnline ? "text-white" : "text-gray-400"
              )} />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mb-1" />
            <span className="text-xs">Recherche GPS...</span>
          </div>
        )}

        {/* Coordinates display - plus compact */}
        {hasLocation && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MapPin className={cn(
                    "w-3.5 h-3.5",
                    isOnline ? "text-[#ff4000]" : "text-gray-400"
                  )} />
                  <span className="text-gray-300 text-[10px] font-mono">
                    {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
                  </span>
                </div>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isOnline ? "bg-[#ff4000] animate-pulse" : "bg-gray-500"
                )} />
              </div>
            </div>
          </div>
        )}

        {/* Expand button */}
        {onExpand && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onExpand}
            className="absolute top-2 right-2 h-7 w-7 bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-lg"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

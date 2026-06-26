/**
 * CARTE DE DEMANDE DE COURSE - ULTRA PROFESSIONNEL
 * Design moderne avec animations et informations claires
 */

import { MapPin, Clock, User, Check, X, Loader2, Route, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/Money";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RideRequestCardProps {
  request: {
    id: string;
    customerName: string;
    pickupAddress: string;
    destinationAddress: string;
    distance: number;
    estimatedEarnings: number;
    estimatedDuration: number;
    requestTime: string;
  };
  onAccept: () => void;
  onDecline: () => void;
  isAccepting: boolean;
}

export function RideRequestCard({
  request,
  onAccept,
  onDecline,
  isAccepting = false
}: RideRequestCardProps) {
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(request.requestTime), {
        addSuffix: true,
        locale: fr
      });
    } catch {
      return 'À l\'instant';
    }
  })();

  return (
    <div className={cn(
      "relative overflow-hidden",
      "bg-gray-800/90",
      "backdrop-blur-sm",
      "rounded-2xl",
      "border border-[#ff4000]/20",
      "shadow-xl shadow-black/20",
      "animate-in slide-in-from-bottom-4 fade-in duration-300"
    )}>
      {/* Top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#ff4000]" />

      {/* Glow effect */}
      <div className="absolute inset-0 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative p-4 space-y-4">
        {/* Header: Customer & Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ff4000] flex items-center justify-center shadow-lg shadow-[#ff4000]/20">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">
                {request.customerName || 'Client'}
              </h3>
              <p className="text-gray-500 text-xs">{timeAgo}</p>
            </div>
          </div>

          {/* Earnings badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#ff4000]/30">
            <Zap className="w-4 h-4 text-[#ff4000]" />
            <span className="text-[#ff4000] font-bold text-sm">
              <Money amount={request.estimatedEarnings || 0} from="GNF" />
            </span>
          </div>
        </div>

        {/* Route Info */}
        <div className="space-y-2">
          {/* Pickup */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff4000]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Prise en charge</p>
              <p className="text-white text-sm font-medium truncate">{request.pickupAddress}</p>
            </div>
          </div>

          {/* Route line */}
          <div className="flex items-center gap-3">
            <div className="w-8 flex justify-center">
              <div className="w-0.5 h-4 bg-[#ff4000] rounded-full" />
            </div>
          </div>

          {/* Destination */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Destination</p>
              <p className="text-white text-sm font-medium truncate">{request.destinationAddress}</p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-gray-900/50 border border-gray-700/50">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Route className="w-4 h-4" />
            <span className="text-xs font-medium">{(request.distance || 0).toFixed(1)} km</span>
          </div>
          <div className="w-px h-4 bg-gray-700" />
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">~{request.estimatedDuration || 15} min</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onDecline}
            variant="outline"
            disabled={isAccepting}
            className="flex-1 h-12 rounded-xl bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all"
          >
            <X className="w-5 h-5 mr-2" />
            Refuser
          </Button>

          <Button
            onClick={onAccept}
            disabled={isAccepting}
            className={cn(
              "flex-1 h-12 rounded-xl font-semibold",
              "bg-[#ff4000]",
              "",
              "text-white shadow-lg shadow-[#ff4000]/30",
              "transition-all",
              "disabled:opacity-70"
            )}
          >
            {isAccepting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Acceptation...
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Accepter
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

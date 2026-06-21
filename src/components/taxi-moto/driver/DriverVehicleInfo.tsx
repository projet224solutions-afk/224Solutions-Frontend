/**
 * INFORMATIONS VÉHICULE CONDUCTEUR - MOBILE OPTIMISÉ
 * Affiche: ID Chauffeur, Plaque d'immatriculation, Numéro de gilet, Numéro de série
 */

import { Car, CreditCard, Hash, User } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface DriverVehicleInfoProps {
  driverId?: string | null;
  vehiclePlate?: string;
  giletNumber?: string;
  serialNumber?: string;
  className?: string;
}

export function DriverVehicleInfo({
  driverId,
  vehiclePlate,
  giletNumber,
  serialNumber,
  className
}: DriverVehicleInfoProps) {
  const { t } = useTranslation();
  // Afficher même avec juste l'ID du chauffeur
  const hasInfo = driverId || vehiclePlate || giletNumber || serialNumber;

  if (!hasInfo) {
    return null;
  }

  // Formater l'ID du chauffeur pour l'affichage
  // - si c'est un UUID, on affiche une version courte (8 premiers caractères)
  // - sinon (custom_id / public_id), on affiche l'identifiant complet
  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const displayDriverId = driverId
    ? (isUuid(driverId) ? driverId.substring(0, 8).toUpperCase() : driverId)
    : null;

  return (
    <div className={cn(
      "relative overflow-hidden",
      "bg-gray-800/50",
      "backdrop-blur-sm",
      "rounded-xl p-3",
      "border border-gray-700/50",
      className
    )}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-blue-500/5/5" />

      <div className="relative">
        {/* Header compact */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
            <Car className="w-3 h-3 text-blue-400" />
          </div>
          <h3 className="text-white font-semibold text-xs">Informations Conducteur</h3>
        </div>

        {/* Driver Info - Grid layout for better organization */}
        <div className="grid grid-cols-2 gap-2">
          {/* ID Chauffeur - Toujours affiché en premier */}
          {displayDriverId && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#ff4000]/10 border border-[#ff4000]/30 col-span-2">
              <User className="w-3 h-3 text-[#ff4000]" />
              <span className="text-[#ff4000] text-[10px] font-medium">ID:</span>
              <span
                className="text-white text-xs font-mono font-bold tracking-wider"
                title={driverId ?? undefined}
              >
                {displayDriverId}
              </span>
            </div>
          )}

          {/* Plaque d'immatriculation */}
          {vehiclePlate && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800/30 border border-gray-700/30">
              <CreditCard className="w-3 h-3 text-blue-400" />
              <span className="text-gray-400 text-[10px]">Plaque:</span>
              <span className="text-white text-[10px] font-mono font-medium">{vehiclePlate}</span>
            </div>
          )}

          {/* Numéro de gilet */}
          {giletNumber && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800/30 border border-gray-700/30">
              <CreditCard className="w-3 h-3 text-[#ff4000]" />
              <span className="text-gray-400 text-[10px]">Gilet:</span>
              <span className="text-white text-[10px] font-mono font-medium">{giletNumber}</span>
            </div>
          )}

          {/* Numéro de série moto */}
          {serialNumber && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800/30 border border-gray-700/30 col-span-2">
              <Hash className="w-3 h-3 text-[#04439e]" />
              <span className="text-gray-400 text-[10px]">{t('driverVehicleInfo.serie')}</span>
              <span className="text-white text-[10px] font-mono font-medium truncate" title={serialNumber}>
                {serialNumber}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

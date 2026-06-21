/**
 * DASHBOARD PRINCIPAL CONDUCTEUR - ULTRA PROFESSIONNEL
 * Interface moderne avec glassmorphism et animations
 */

import { DriverSubscriptionBanner } from '@/components/driver/DriverSubscriptionBanner';
import { useTranslation } from "@/hooks/useTranslation";
import { GoOnlineButton } from './GoOnlineButton';
import { DriverStatsRow } from './DriverStatsRow';
import { MiniMap } from './MiniMap';
import { RideRequestCard } from './RideRequestCard';
import { Car, Zap, AlertCircle } from 'lucide-react';
import { DriverTutorial } from '@/components/taxi-moto/DriverTutorial';
import { DriverDiagnostic } from '@/components/taxi-moto/DriverDiagnostic';
import { DriverVehicleInfo } from './DriverVehicleInfo';
import { UserTrackerButton } from '@/components/taxi-moto/UserTrackerButton';
import { cn } from '@/lib/utils';

interface RideRequest {
  id: string;
  customerName: string;
  pickupAddress: string;
  destinationAddress: string;
  distance: number;
  estimatedEarnings: number;
  estimatedDuration: number;
  requestTime: string;
}

interface DriverMainDashboardProps {
  isOnline: boolean;
  isLoading: boolean;
  hasSubscription: boolean;

  /**
   * ID technique du conducteur (UUID taxi_drivers.id) utilisé pour les opérations (SOS, DB, etc.)
   */
  driverId: string | null;

  /**
   * ID “métier” affichable (ex: custom_id / public_id). Si absent, on retombe sur driverId.
   */
  driverDisplayId?: string | null;

  userId: string | undefined;
  location: { latitude: number; longitude: number } | null;
  stats: {
    todayEarnings: number;
    todayRides: number;
    rating: number;
    onlineTime: string;
    vehiclePlate?: string;
    giletNumber?: string;
    serialNumber?: string;
  };
  rideRequests: RideRequest[];
  acceptingRideId: string | null;
  error: { type: string; message: string } | null;
  hasAccess: boolean;
  onToggleOnline: () => void;
  onAcceptRide: (request: RideRequest) => void;
  onDeclineRide: (requestId: string) => void;
  onClearError: () => void;
  onExpandMap: () => void;
  onStatClick?: (statId: string) => void;
  onGoToMarketplace?: () => void;
}

export function DriverMainDashboard({
  isOnline,
  isLoading,
  hasSubscription,
  driverId,
  driverDisplayId,
  userId,
  location,
  stats,
  rideRequests,
  acceptingRideId,
  error,
  hasAccess,
  onToggleOnline,
  onAcceptRide,
  onDeclineRide,
  onClearError,
  onExpandMap,
  onStatClick,
  onGoToMarketplace
}: DriverMainDashboardProps) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gray-950 pb-24 overflow-x-hidden w-full max-w-full">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gray-950 pointer-events-none overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Accent glow when online */}
        {isOnline && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#ff4000]/10 rounded-full blur-3xl" />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Subscription Banner */}
        <DriverSubscriptionBanner />

        {/* Error Banner - compact */}
        {error && (
          <div className="px-2 pt-1">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#ff4000]/10 border border-[#ff4000]/20">
              <AlertCircle className="w-4 h-4 text-[#ff4000] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[#ff4000] text-xs font-medium truncate">
                  {error.type === 'gps' ? 'GPS inactif' :
                   error.type === 'permission' ? 'Permission requise' :
                   'Erreur'}: {error.message}
                </p>
              </div>
              <button
                onClick={onClearError}
                className="text-[#ff4000]/70 hover:text-[#ff4000] text-[10px] underline shrink-0"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <DriverStatsRow
          todayEarnings={stats.todayEarnings || 0}
          todayRides={stats.todayRides || 0}
          rating={stats.rating || 5.0}
          onlineTime={stats.onlineTime || '0m'}
          onStatClick={onStatClick}
          onGoToMarketplace={onGoToMarketplace}
        />

        {/* Suivre un client par ID / lien partagé */}
        <div className="px-2 pt-2">
          <UserTrackerButton prominent driverId={driverId} />
        </div>

        {/* Main Content */}
        <div className="px-2 space-y-3 w-full max-w-full">
          {/* Ride Requests - Priority Display */}
          {rideRequests.length > 0 ? (
            <div className="space-y-3 w-full">
              {/* Header with count */}
              <div className="flex items-center justify-between w-full px-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#ff4000]/20 flex items-center justify-center">
                    <Car className="w-3.5 h-3.5 text-[#ff4000]" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-xs">
                      {rideRequests.length} course{rideRequests.length > 1 ? 's' : ''} disponible{rideRequests.length > 1 ? 's' : ''}
                    </h2>
                    <p className="text-gray-500 text-[10px]">Nouvelles demandes</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ff4000]/10 border border-[#ff4000]/20">
                  <Zap className="w-2.5 h-2.5 text-[#ff4000]" />
                  <span className="text-[#ff4000] text-[10px] font-medium">En direct</span>
                </div>
              </div>

              {/* Request cards */}
              <div className="space-y-2">
                {rideRequests.map((request) => (
                  <RideRequestCard
                    key={request.id}
                    request={request}
                    onAccept={() => onAcceptRide(request)}
                    onDecline={() => onDeclineRide(request.id)}
                    isAccepting={acceptingRideId === request.id}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* GO Button */}
              <GoOnlineButton
                isOnline={isOnline}
                isLoading={isLoading}
                hasSubscription={hasSubscription}
                onToggle={onToggleOnline}
              />

              {/* Mini Map */}
              <MiniMap
                latitude={location?.latitude || null}
                longitude={location?.longitude || null}
                isOnline={isOnline}
                onExpand={onExpandMap}
              />

              {/* Vehicle Information Card */}
              <DriverVehicleInfo
                driverId={driverDisplayId ?? driverId}
                vehiclePlate={stats.vehiclePlate}
                giletNumber={stats.giletNumber}
                serialNumber={stats.serialNumber}
              />

              {/* Status Message when Online - compact */}
              {isOnline && (
                <div className={cn(
                  "relative overflow-hidden",
                  "bg-gray-800/50",
                  "backdrop-blur-sm",
                  "rounded-xl p-3",
                  "border border-gray-700/50"
                )}>
                  {/* Subtle animated gradient */}
                  <div className="absolute inset-0 bg-[#ff4000]/5 via-transparent animate-pulse" />

                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-[#ff4000]/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-[#ff4000] animate-pulse" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-xs">{t('driverMainDashboard.enAttenteDeCourses')}</p>
                        <p className="text-gray-500 text-[10px]">Notification automatique</p>
                      </div>
                    </div>
                    <DriverTutorial />
                  </div>
                </div>
              )}

              {/* Diagnostic when online but no rides */}
              {isOnline && (
                <DriverDiagnostic
                  driverId={driverId}
                  isOnline={isOnline}
                  hasAccess={hasAccess}
                  userId={userId}
                />
              )}

              {/* Offline Message - compact */}
              {!isOnline && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    <p className="text-gray-500 text-xs">
                      Passez en ligne pour recevoir des courses
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

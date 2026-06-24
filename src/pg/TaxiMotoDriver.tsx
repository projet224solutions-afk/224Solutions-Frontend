/**
 * INTERFACE CONDUCTEUR TAXI-MOTO ULTRA PROFESSIONNELLE
 * Dashboard complet pour les conducteurs avec navigation temps réel
 * 224Solutions - Taxi-Moto System
 *
 * REFACTORISÉ - Utilise les hooks modulaires pour une meilleure maintenabilité
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Money } from '@/components/Money';
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useGPSLocation } from "@/hooks/useGPSLocation";
import { useDriverSubscription } from "@/hooks/useDriverSubscription";
import { useTaxiNotifications } from "@/hooks/useTaxiNotifications";
import { useTaxiErrorBoundary } from "@/hooks/useTaxiErrorBoundary";
import { TaxiMotoService } from "@/services/taxi/TaxiMotoService";
import { GeolocationService } from "@/services/taxi/GeolocationService";
import { Car, Star } from "lucide-react";

// Hooks modulaires refactorisés
import { useTaxiDriverProfile } from "@/hooks/useTaxiDriverProfile";
import { useTaxiDriverStats } from "@/hooks/useTaxiDriverStats";
import { useTaxiRideRequests, type RideRequest } from "@/hooks/useTaxiRideRequests";
import { useTaxiActiveRide, type ActiveRide } from "@/hooks/useTaxiActiveRide";

// UI Components - New Uber/Bolt Style
import {
    DriverHeader,
    BottomNavigation,
    DriverMainDashboard,
    ActiveRideNavigationPanel
} from "@/components/taxi-moto/driver";

// Existing components
import { GoogleMapsNavigation } from "@/components/taxi-moto/GoogleMapsNavigation";
import { GPSPermissionHelper } from "@/components/taxi-moto/GPSPermissionHelper";
import { DriverSettings } from "@/components/taxi-moto/DriverSettings";
import { DriverEarnings } from "@/components/taxi-moto/DriverEarnings";
import { DriverNavigation } from "@/components/taxi-moto/DriverNavigation";
import CommunicationWidget from "@/components/communication/CommunicationWidget";
import MyPurchasesOrdersList from "@/components/shared/MyPurchasesOrdersList";

const ONLINE_SINCE_KEY = 'taxi_driver_online_since';

// ✅ Throttle GPS adaptatif — économie batterie (téléphones d'entrée de gamme en Guinée)
const GPS_INTERVAL_ACTIVE = 5_000;    // 5s pendant une course (précision maximale)
const GPS_INTERVAL_IDLE = 30_000;     // 30s en attente (économie batterie ~80%)
const TRACK_INTERVAL_ACTIVE = 10_000; // 10s tracking pendant course
const TRACK_INTERVAL_IDLE = 60_000;   // 60s tracking en attente (minimal)

export default function TaxiMotoDriver() {
    const { t } = useTranslation();
    const { user, profile, signOut } = useAuth();
    const { error, capture, clear } = useTaxiErrorBoundary();
    // GPS unifié avec fallback et error handling
    const {
        location,
        isWatching,
        getCurrentLocation,
        startWatching,
        stopWatching,
    } = useGPSLocation({
        enableHighAccuracy: true,
        watchPosition: true,  // ✅ Suivi GPS continu (throttle 5s/10s géré ci-dessous)
        onLocationChange: (loc) => {
            const now = Date.now();

            // ✅ Interval adaptatif : court si course en cours, long en attente (batterie)
            const hasActiveRide = !!activeRideRef.current &&
                ['accepted', 'arriving', 'picked_up', 'in_progress'].includes(activeRideRef.current.status);
            const locationInterval = hasActiveRide ? GPS_INTERVAL_ACTIVE : GPS_INTERVAL_IDLE;
            const trackingInterval = hasActiveRide ? TRACK_INTERVAL_ACTIVE : TRACK_INTERVAL_IDLE;

            if (driverIdRef.current && isOnlineRef.current) {
                if (now - lastLocationUpdateRef.current >= locationInterval) {
                    lastLocationUpdateRef.current = now;
                    updateDriverLocation(loc.latitude, loc.longitude);
                }
            }
            if (activeRideRef.current) {
                const ride = activeRideRef.current;
                if (['accepted', 'arriving', 'picked_up', 'in_progress'].includes(ride.status)) {
                    if (now - lastTrackingRef.current >= trackingInterval) {
                        lastTrackingRef.current = now;
                        TaxiMotoService.trackPosition(
                            ride.id,
                            driverIdRef.current!,
                            loc.latitude,
                            loc.longitude,
                            undefined,
                            undefined,
                            loc.accuracy || undefined
                        ).catch(err => console.error('✕ Erreur tracking course:', err));
                    }
                }
            }
        },
        onError: (err) => {
            capture('gps', err.userMessage, err);
            toast.error(err.userMessage, { description: err.suggestions[0] });
        }
    });

    const { notifications, unreadCount, markAsRead } = useTaxiNotifications();
    const { hasAccess, loading: subscriptionLoading } = useDriverSubscription();

    // États UI
    const [activeTab, setActiveTab] = useState('dashboard');
    const [onlineSince, setOnlineSince] = useState<Date | null>(null);
    const [sessionOnlineTime, setSessionOnlineTime] = useState('0m');
    const [isTogglingOnline, setIsTogglingOnline] = useState(false);
    const [, setDistanceToDestination] = useState(0);
    const [, setTimeToDestination] = useState(0);
    const [, setNextInstruction] = useState('');

    // ========== HOOKS MODULAIRES ==========

    const {
        driverId,
        driverDisplayId: hookDriverDisplayId,
        loading: driverLoading,
        isOnline,
        setIsOnline,
        updateDriverLocation
    } = useTaxiDriverProfile(user?.id);

    const {
        stats: driverStats,
        rideHistory,
        updateLocalStats
    } = useTaxiDriverStats(driverId);

    // Refs pour éviter les closures périmées dans les callbacks GPS
    const driverIdRef = useRef(driverId);
    const isOnlineRef = useRef(isOnline);
    const activeRideRef = useRef<ActiveRide | null>(null);
    const lastLocationUpdateRef = useRef<number>(0);
    const lastTrackingRef = useRef<number>(0);

    useEffect(() => { driverIdRef.current = driverId; }, [driverId]);
    useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

    const driverDisplayId = hookDriverDisplayId || driverId;

    // Fonction de démarrage de navigation
    const startNavigation = useCallback(async (destination: { latitude: number; longitude: number }) => {
        setNextInstruction('📍 Calcul de l\'itinéraire...');
        if (!location) { toast.error('Position GPS non disponible'); return; }

        const geoService = GeolocationService.getInstance();
        const dist = geoService.calculateDistance(
            { latitude: location.latitude, longitude: location.longitude, accuracy: 0, timestamp: 0 },
            { latitude: destination.latitude, longitude: destination.longitude, accuracy: 0, timestamp: 0 }
        );
        setDistanceToDestination(dist);
        setTimeToDestination(Math.ceil((dist / 1000) / 30 * 60));
        setNextInstruction('Navigation démarrée - Suivez les indications');
        toast.info(t('taxiMotoDriver.navigationActivee'));
    }, [location]);

    // Hook course active
    const {
        activeRide,
        setActiveRide,
        setNavigationActive,
        updateRideStatus,
        cancelActiveRide,
    } = useTaxiActiveRide(driverId, startNavigation, updateLocalStats);

    useEffect(() => { activeRideRef.current = activeRide; }, [activeRide]);

    // Hook demandes de courses
    const {
        rideRequests,
        acceptingRideId,
        loadPendingRides,
        acceptRideRequest,
        declineRideRequest,
        clearRideRequests
    } = useTaxiRideRequests(driverId, isOnline, hasAccess, location);

    // ========== EFFETS ==========

    // Restaurer onlineSince depuis localStorage quand le driver est en ligne
    useEffect(() => {
        if (isOnline && !onlineSince) {
            const saved = localStorage.getItem(ONLINE_SINCE_KEY);
            const ts = saved ? new Date(saved) : new Date();
            if (!saved) localStorage.setItem(ONLINE_SINCE_KEY, ts.toISOString());
            setOnlineSince(ts);
        }
    }, [isOnline, onlineSince]);

    // Compteur temps en ligne — mise à jour toutes les 10s
    useEffect(() => {
        if (!isOnline || !onlineSince) {
            setSessionOnlineTime('0m');
            return;
        }
        const update = () => {
            const totalSeconds = Math.floor((Date.now() - onlineSince.getTime()) / 1000);
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            if (h > 0) setSessionOnlineTime(`${h}h ${m}m`);
            else if (m > 0) setSessionOnlineTime(`${m}m`);
            else setSessionOnlineTime(`${s}s`);
        };
        update();
        const interval = setInterval(update, 10000);
        return () => clearInterval(interval);
    }, [isOnline, onlineSince]);

    // GPS : démarrer quand online, arrêter quand offline
    useEffect(() => {
        if (isOnline && driverId && hasAccess) {
            if (!isWatching) startWatching();
            loadPendingRides();
        } else if (!isOnline && isWatching) {
            stopWatching();
        }
    }, [isOnline, driverId, hasAccess, isWatching, startWatching, stopWatching, loadPendingRides]);

    // Cleanup au démontage
    useEffect(() => {
        return () => { stopWatching(); };
    }, [stopWatching]);

    // ========== FONCTIONS ==========

    const toggleOnlineStatus = async () => {
        if (isTogglingOnline) return;
        const next = !isOnline;

        if (!driverId) { toast.error(t('taxiMotoDriver.profilConducteurNonTrouve')); return; }
        if (next && !hasAccess) {
            toast.error('⚠️ Abonnement requis', {
                description: t('taxiMotoDriver.vousDevezAvoirUnAbonnement')
            });
            return;
        }

        setIsTogglingOnline(true);

        if (next) {
            toast.loading('📍 Activation GPS...', { id: 'gps-loading' });
            try {
                const position = await getCurrentLocation();
                toast.dismiss('gps-loading');

                if (!position || typeof position.latitude !== 'number' || typeof position.longitude !== 'number') {
                    toast.error('Position GPS non disponible');
                    return;
                }

                await TaxiMotoService.updateDriverStatus(driverId, true, true, position.latitude, position.longitude);

                const now = new Date();
                localStorage.setItem(ONLINE_SINCE_KEY, now.toISOString());
                setIsOnline(true);
                setOnlineSince(now);

                toast.success(t('taxiMotoDriver.vousEtesMaintenantEnLigne'), {
                    description: `GPS: ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
                });
            } catch (onlineError: unknown) {
                toast.dismiss('gps-loading');
                const errMsg = onlineError instanceof Error ? onlineError.message: t('taxiMotoDriver.veuillezReessayer');
                capture('network', 'Erreur lors de la mise en ligne', onlineError);
                toast.error(t('taxiMotoDriver.impossibleDePasserEnLigne'), { description: errMsg });
            } finally {
                setIsTogglingOnline(false);
            }
        } else {
            try {
                await TaxiMotoService.updateDriverStatus(driverId, false, false, undefined, undefined);
                localStorage.removeItem(ONLINE_SINCE_KEY);
                setIsOnline(false);
                setOnlineSince(null);
                clearRideRequests();
                toast.info(t('taxiMotoDriver.vousEtesMaintenantHorsLigne'));
            } catch (offlineError: unknown) {
                const errMsg = offlineError instanceof Error ? offlineError.message: t('taxiMotoDriver.veuillezReessayer');
                capture('network', 'Erreur lors du changement de statut', offlineError);
                toast.error(t('taxiMotoDriver.erreurLorsDuChangementDe'), { description: errMsg });
            } finally {
                setIsTogglingOnline(false);
            }
        }
    };

    const handleAcceptRide = async (request: RideRequest) => {
        const result = await acceptRideRequest(request);
        if (result) {
            setActiveRide(result);
            setNavigationActive(true);
            setActiveTab('navigation');
            notifications.filter(n => n.data?.rideId === request.id).forEach(n => markAsRead(n.id));
            startNavigation(request.pickupCoords);
        }
    };

    const handleDeclineRide = async (requestId: string) => {
        await declineRideRequest(requestId);
        notifications.filter(n => n.data?.rideId === requestId).forEach(n => markAsRead(n.id));
    };

    const contactCustomer = (phone: string) => { window.open(`tel:${phone}`); };

    const handleSignOut = async () => {
        if (driverId && isOnline) {
            try {
                stopWatching();
                await TaxiMotoService.updateDriverStatus(driverId, false, false, undefined, undefined);
            } catch (e) {
                console.error('Erreur mise hors ligne avant signout:', e);
            }
        }
        localStorage.removeItem(ONLINE_SINCE_KEY);
        setIsOnline(false);
        setOnlineSince(null);
        await signOut();
        toast.success(t('taxiMotoDriver.deconnexionReussie'));
    };

    // ========== RENDU ==========

    return (
        <div className="min-h-screen bg-gray-950 overflow-x-hidden">
            <DriverHeader
                firstName={profile?.first_name || ''}
                isOnline={isOnline}
                hasLocation={!!location}
                unreadCount={unreadCount}
                driverId={driverId}
                driverName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Conducteur'}
                driverPhone={profile?.phone || ''}
                onSignOut={handleSignOut}
            />

            {/* ✅ Indicateur mode économie batterie GPS */}
            {isOnline && (
                <div className="flex items-center justify-center gap-1.5 text-[9px] text-gray-500 py-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${!activeRide ? 'bg-green-500' : 'bg-[#ff4000] animate-pulse'}`} />
                    {!activeRide
                        ? 'GPS économique (30s) — en attente de course'
                        : 'GPS précis (5s) — course en cours'}
                </div>
            )}

            {activeTab === 'dashboard' && (
                <DriverMainDashboard
                    isOnline={isOnline}
                    isLoading={driverLoading || subscriptionLoading || isTogglingOnline}
                    hasSubscription={hasAccess}
                    driverId={driverId}
                    driverDisplayId={driverDisplayId}
                    userId={user?.id}
                    location={location}
                    stats={{ ...driverStats, onlineTime: isOnline ? sessionOnlineTime : '0m' }}
                    rideRequests={rideRequests}
                    acceptingRideId={acceptingRideId}
                    error={error}
                    hasAccess={hasAccess}
                    onToggleOnline={toggleOnlineStatus}
                    onAcceptRide={handleAcceptRide}
                    onDeclineRide={handleDeclineRide}
                    onClearError={clear}
                    onExpandMap={() => setActiveTab('gps-navigation')}
                    onStatClick={(statId) => {
                        if (statId === 'earnings') setActiveTab('earnings');
                        else if (statId === 'rides') setActiveTab('history');
                        else if (statId === 'history') setActiveTab('history');
                        else if (statId === 'rating') setActiveTab('rating');
                    }}
                    onGoToMarketplace={() => setActiveTab('my-purchases')}
                />
            )}

            {activeTab === 'navigation' && (
                <div className="min-h-screen bg-gray-950 pb-24">
                    {activeRide ? (
                        <ActiveRideNavigationPanel
                            activeRide={{
                                id: activeRide.id,
                                customerName: activeRide.customer.name,
                                customerPhone: activeRide.customer.phone,
                                pickup: activeRide.pickup,
                                destination: activeRide.destination,
                                status: activeRide.status,
                                estimatedPrice: activeRide.estimatedEarnings / 0.85,
                                estimatedEarnings: activeRide.estimatedEarnings
                            }}
                            currentLocation={location}
                            onContactCustomer={contactCustomer}
                            onUpdateStatus={async (status) => {
                                await updateRideStatus(status as ActiveRide['status']);
                            }}
                            onCancelRide={cancelActiveRide}
                        />
                    ) : (
                        <DriverNavigation
                            driverId={driverId || ''}
                            location={location}
                            onContactCustomer={contactCustomer}
                        />
                    )}
                </div>
            )}

            {activeTab === 'gps-navigation' && (
                <div className="min-h-screen bg-gray-950 pb-24">
                    {!location ? (
                        <GPSPermissionHelper
                            onLocationGranted={async () => {
                                toast.loading(t('taxiMotoDriver.recuperationDeLaPosition'), { id: 'gps-load' });
                                try {
                                    await getCurrentLocation();
                                    toast.dismiss('gps-load');
                                    toast.success('Position obtenue !');
                                } catch (err) {
                                    console.error('[TaxiMotoDriver] GPS error:', err);
                                    toast.dismiss('gps-load');
                                    toast.error(t('taxiMotoDriver.erreurGpsVeuillezReessayer'));
                                }
                            }}
                            currentError={null}
                        />
                    ) : (
                        <GoogleMapsNavigation
                            activeRide={activeRide ? {
                                id: activeRide.id,
                                customerId: activeRide.customer.name,
                                customerName: activeRide.customer.name,
                                customerPhone: activeRide.customer.phone,
                                pickup: activeRide.pickup,
                                destination: activeRide.destination,
                                status: activeRide.status,
                                estimatedPrice: activeRide.estimatedEarnings / 0.85,
                                estimatedEarnings: activeRide.estimatedEarnings,
                                requestedAt: activeRide.startTime
                            } : null}
                            currentLocation={location}
                            onContactCustomer={contactCustomer}
                        />
                    )}
                </div>
            )}

            {activeTab === 'earnings' && (
                <div className="min-h-screen bg-gray-950 pb-24">
                    <DriverEarnings driverId={driverId || ''} />
                </div>
            )}

            {activeTab === 'history' && (
                <div className="min-h-screen bg-gray-950 pb-24 pt-4 px-3 sm:px-4">
                    <div className="space-y-4">
                        <h2 className="text-white font-bold text-base sm:text-lg">{t('taxiMotoDriver.historiqueDesCourses')}</h2>
                        {rideHistory.length === 0 ? (
                            <div className="text-center py-12">
                                <Car className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500">{t('taxiMotoDriver.aucuneCourseCompletee')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rideHistory.map((ride: Record<string, unknown>) => (
                                    <div key={ride.id as string} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                                        <div className="flex flex-wrap justify-between items-start mb-2 gap-1">
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                ride.status === 'completed' ? 'bg-[#ff4000]/20 text-[#ff4000]' :
                                                ride.status === 'cancelled' ? 'bg-[#ff4000]/20 text-[#ff4000]' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>
                                                {ride.status === 'completed' ? 'Terminée' :
                                                 ride.status === 'cancelled' ? 'Annulée' : String(ride.status)}
                                            </span>
                                            <span className="text-gray-400 text-xs">
                                                {new Date(ride.created_at as string).toLocaleDateString('fr-FR')}
                                            </span>
                                        </div>
                                        <p className="text-white text-sm mb-1 truncate">{String(ride.pickup_address || 'Adresse départ')}</p>
                                        <p className="text-gray-400 text-xs truncate">→ {String(ride.dropoff_address || 'Destination')}</p>
                                        {ride.driver_share && (
                                            <p className="text-[#ff4000] font-bold mt-2"><Money amount={Number(ride.driver_share)} from="GNF" /></p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'rating' && (
                <div className="min-h-screen bg-gray-950 pb-24 pt-4 px-3 sm:px-4">
                    <div className="space-y-6">
                        <h2 className="text-white font-bold text-base sm:text-lg">{t('taxiMotoDriver.votreNote')}</h2>
                        <div className="bg-[#ff4000]/20 rounded-2xl p-4 sm:p-6 border border-[#ff4000]/30 text-center">
                            <div className="text-4xl sm:text-5xl font-bold text-[#ff4000] mb-2">
                                {driverStats.rating > 0 ? driverStats.rating.toFixed(1) : '-'}
                            </div>
                            <div className="flex justify-center gap-1 mb-3">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star key={star} className={`w-6 h-6 ${
                                        star <= Math.round(driverStats.rating)
                                            ? 'text-[#ff4000] fill-[#ff4000]'
                                            : 'text-gray-600'
                                    }`} />
                                ))}
                            </div>
                            <p className="text-gray-400 text-sm">Basé sur {driverStats.totalRides || 0} courses</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                            <h3 className="text-white font-medium mb-3">{t('taxiMotoDriver.commentAmeliorerVotreNote')}</h3>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li className="flex items-start gap-2"><span className="text-[#ff4000]">✓</span>{t('taxiMotoDriver.soyezPonctuelAuxRendezVous')}</li>
                                <li className="flex items-start gap-2"><span className="text-[#ff4000]">✓</span>{t('taxiMotoDriver.conduisezPrudemmentEtRespectezLe')}</li>
                                <li className="flex items-start gap-2"><span className="text-[#ff4000]">✓</span>{t('taxiMotoDriver.soyezCourtoisAvecLesClients')}</li>
                                <li className="flex items-start gap-2"><span className="text-[#ff4000]">✓</span>{t('taxiMotoDriver.maintenezVotreVehiculePropre')}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="min-h-screen bg-gray-950 pb-24">
                    <DriverSettings driverId={driverId || ''} />
                </div>
            )}

            {activeTab === 'my-purchases' && (
                <div className="min-h-screen bg-gray-950 pb-24 p-3 sm:p-4">
                    <MyPurchasesOrdersList
                        title="Mes Achats Personnels"
                        emptyMessage="Vous n'avez pas encore effectué d'achats sur le marketplace"
                    />
                </div>
            )}

            {user && <CommunicationWidget />}

            <BottomNavigation
                activeTab={activeTab}
                onTabChange={setActiveTab}
                hasActiveRide={!!activeRide}
            />
        </div>
    );
}

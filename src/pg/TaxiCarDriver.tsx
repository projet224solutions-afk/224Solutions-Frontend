import { useTranslation } from "@/hooks/useTranslation";
/**
 * DASHBOARD CHAUFFEUR TAXI VOITURE — Interface Ultra-Professionnelle
 * Style Uber / VTC Premium — Noir, Blanc, Bleu
 * PAS de bouton SOS (différence fondamentale avec Taxi Moto)
 * Réutilise tous les hooks du module taxi-moto
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useGPSLocation } from '@/hooks/useGPSLocation';
import { useDriverSubscription } from '@/hooks/useDriverSubscription';
import { useTaxiDriverProfile } from '@/hooks/useTaxiDriverProfile';
import { useTaxiDriverStats } from '@/hooks/useTaxiDriverStats';
import { useTaxiRideRequests, type RideRequest } from '@/hooks/useTaxiRideRequests';
import { useTaxiActiveRide, type ActiveRide } from '@/hooks/useTaxiActiveRide';
import { useTaxiNotifications } from '@/hooks/useTaxiNotifications';
import { useTaxiErrorBoundary } from '@/hooks/useTaxiErrorBoundary';
import { TaxiMotoService } from '@/services/taxi/TaxiMotoService';
import { GeolocationService } from '@/services/taxi/GeolocationService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Money } from '@/components/Money';
import CommunicationWidget from '@/components/communication/CommunicationWidget';
import MyPurchasesOrdersList from '@/components/shared/MyPurchasesOrdersList';
import { DriverEarnings } from '@/components/taxi-moto/DriverEarnings';
import { DriverSettings } from '@/components/taxi-moto/DriverSettings';
import { GPSPermissionHelper } from '@/components/taxi-moto/GPSPermissionHelper';
import { GoogleMapsNavigation } from '@/components/taxi-moto/GoogleMapsNavigation';
import { ActiveRideNavigationPanel } from '@/components/taxi-moto/driver';
import { DriverSubscriptionBanner } from '@/components/driver/DriverSubscriptionBanner';
import {
  Car, Star, Wifi, WifiOff, LogOut, Bell, Settings,
  ShoppingBag, History, Navigation, DollarSign, ChevronRight, MapPin,
  CheckCircle, XCircle, Loader2, User, LayoutDashboard
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

type TabId = 'dashboard' | 'navigation' | 'gps-navigation' | 'earnings' | 'history' | 'settings' | 'my-purchases' | 'wallet' | 'rating';

// ============================================================
// Composant BottomNav Voiture (bleu, sans SOS)
// ============================================================
function CarBottomNav({ activeTab, onTabChange, hasActiveRide }: {
  activeTab: string;
  onTabChange: (tab: TabId) => void;
  hasActiveRide: boolean;
}) {
  const { t } = useTranslation();
  const tabs = [
    { id: 'dashboard' as TabId, label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'navigation' as TabId, label: 'Course', icon: <Navigation className="w-5 h-5" />, badge: hasActiveRide },
    { id: 'earnings' as TabId, label: 'Revenus', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'my-purchases' as TabId, label: 'Achats', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'settings' as TabId, label: t('taxiCarDriver.reglages'), icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950 border-t border-gray-800">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all"
          >
            <div className={`transition-colors ${activeTab === tab.id ? 'text-blue-400' : 'text-gray-500'}`}>
              {tab.icon}
            </div>
            {tab.badge && (
              <span className="absolute top-0.5 right-1 w-2.5 h-2.5 bg-[#ff4000] rounded-full border border-gray-950" />
            )}
            <span className={`text-[10px] ${activeTab === tab.id ? 'text-blue-400 font-medium' : 'text-gray-600'}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Carte demande de course voiture
// ============================================================
function CarRideRequestCard({ request, accepting, onAccept, onDecline }: {
  request: RideRequest;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-blue-950 rounded-2xl p-4 border border-blue-500/30 shadow-lg shadow-blue-500/10">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{request.customerName || 'Client'}</p>
            <p className="text-blue-400 text-xs">{request.requestTime ? new Date(request.requestTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
          </div>
        </div>
        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
          <Car className="w-3 h-3 mr-1" />
          Taxi Voiture
        </Badge>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-[#ff4000] mt-1.5 shrink-0" />
          <p className="text-gray-300 text-xs leading-relaxed">{request.pickupAddress || 'Adresse de départ'}</p>
        </div>
        <div className="w-0.5 h-3 bg-gray-600 ml-[3px]" />
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-[#ff4000] mt-1.5 shrink-0" />
          <p className="text-gray-300 text-xs leading-relaxed">{request.destinationAddress || 'Destination'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-800/60 rounded-xl p-2 text-center">
          <p className="text-blue-400 font-bold text-sm">{request.distance ? `${request.distance.toFixed(1)} km` : '--'}</p>
          <p className="text-gray-500 text-[10px]">Distance</p>
        </div>
        <div className="bg-gray-800/60 rounded-xl p-2 text-center">
          <p className="text-blue-400 font-bold text-sm">{request.estimatedDuration ? `${request.estimatedDuration} min` : '--'}</p>
          <p className="text-gray-500 text-[10px]">{t('taxiCarDriver.duree')}</p>
        </div>
        <div className="bg-gray-800/60 rounded-xl p-2 text-center">
          <p className="text-[#ff4000] font-bold text-sm">{request.estimatedEarnings ? `${request.estimatedEarnings.toLocaleString()}` : '--'}</p>
          <p className="text-gray-500 text-[10px]">GNF</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onDecline}
          variant="outline"
          className="flex-1 border-gray-700 text-gray-400 hover:text-[#ff4000] hover:border-[#ff4000]/50"
          disabled={accepting}
        >
          <XCircle className="w-4 h-4 mr-1" />
          Refuser
        </Button>
        <Button
          onClick={onAccept}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          disabled={accepting}
        >
          {accepting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
          Accepter
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Dashboard principal voiture
// ============================================================
function CarMainDashboard({
  isOnline, isLoading, hasSubscription, driverId, driverDisplayId,
  userId, location, stats, rideRequests, acceptingRideId, error, hasAccess,
  onToggleOnline, onAcceptRide, onDeclineRide, onClearError, onExpandMap, onStatClick
}: {
  isOnline: boolean;
  isLoading: boolean;
  hasSubscription: boolean;
  driverId: string | null;
  driverDisplayId?: string | null;
  userId: string | undefined;
  location: { latitude: number; longitude: number } | null;
  stats: { todayEarnings: number; todayRides: number; rating: number; onlineTime: string; vehiclePlate?: string };
  rideRequests: RideRequest[];
  acceptingRideId: string | null;
  error: { type: string; message: string } | null;
  hasAccess: boolean;
  onToggleOnline: () => void;
  onAcceptRide: (req: RideRequest) => void;
  onDeclineRide: (id: string) => void;
  onClearError: () => void;
  onExpandMap: () => void;
  onStatClick?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Subscription Banner */}
      {!hasSubscription && driverId && (
        <div className="px-4 pt-4">
          <DriverSubscriptionBanner />
        </div>
      )}

      {/* Statut + Bouton ON/OFF */}
      <div className="px-4 pt-4 space-y-4">
        {/* Error banner */}
        {error && (
          <div className="bg-[#ff4000]/30 border border-[#ff4000]/30 rounded-xl p-3 flex items-center justify-between">
            <p className="text-orange-300 text-sm">{error.message}</p>
            <button onClick={onClearError} className="text-[#ff4000] ml-3"><XCircle className="w-4 h-4" /></button>
          </div>
        )}

        {/* Status card */}
        <div className={`rounded-2xl p-5 border ${
          isOnline
            ? 'bg-blue-600/20 border-blue-500/30'
            : 'bg-gray-900 border-gray-800'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`} />
              <div>
                <p className="text-white font-semibold">{isOnline ? 'En ligne' : 'Hors ligne'}</p>
                <p className="text-gray-400 text-xs">
                  {isOnline ? 'Vous recevez des courses' : 'Activez pour recevoir des courses'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {location ? (
                <Wifi className="w-4 h-4 text-blue-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-gray-600" />
              )}
            </div>
          </div>

          <Button
            onClick={onToggleOnline}
            disabled={isLoading || (!hasAccess && !isOnline)}
            size="lg"
            className={`w-full h-14 rounded-xl font-bold text-base transition-all ${
              isOnline
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isOnline ? (
              <>
                <WifiOff className="w-5 h-5 mr-2" />
                Passer Hors Ligne
              </>
            ) : (
              <>
                <Wifi className="w-5 h-5 mr-2" />
                Passer En Ligne
              </>
            )}
          </Button>

          {!hasAccess && !isOnline && (
            <p className="text-[#ff4000] text-xs text-center mt-2">
              ⚠️ Abonnement requis pour recevoir des courses
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onStatClick?.('earnings')}
            className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center hover:border-blue-500/30 transition-colors"
          >
            <DollarSign className="w-5 h-5 text-[#ff4000] mx-auto mb-1" />
            <p className="text-white font-bold text-base">{stats.todayEarnings.toLocaleString()}</p>
            <p className="text-gray-500 text-[10px]">{t('taxiCarDriver.gainsDuJour')}</p>
          </button>
          <button
            onClick={() => onStatClick?.('history')}
            className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center hover:border-blue-500/30 transition-colors"
          >
            <Car className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-white font-bold text-base">{stats.todayRides}</p>
            <p className="text-gray-500 text-[10px]">Courses</p>
          </button>
          <button
            onClick={() => onStatClick?.('rating')}
            className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center hover:border-blue-500/30 transition-colors"
          >
            <Star className="w-5 h-5 text-[#ff4000] mx-auto mb-1" />
            <p className="text-white font-bold text-base">{stats.rating > 0 ? stats.rating.toFixed(1) : '--'}</p>
            <p className="text-gray-500 text-[10px]">Note</p>
          </button>
        </div>

        {/* Informations véhicule */}
        {stats.vehiclePlate && (
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center gap-3">
            <Car className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Plaque d'immatriculation</p>
              <p className="text-white font-semibold">{stats.vehiclePlate}</p>
            </div>
          </div>
        )}

        {/* GPS Status */}
        <button
          onClick={onExpandMap}
          className="w-full bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between hover:border-blue-500/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <MapPin className={`w-5 h-5 ${location ? 'text-blue-400' : 'text-gray-600'}`} />
            <div className="text-left">
              <p className="text-white text-sm font-medium">Position GPS</p>
              <p className="text-gray-500 text-xs">
                {location
                  ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                  : 'GPS non disponible'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        {/* Demandes de courses */}
        {rideRequests.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-400" />
              {rideRequests.length} nouvelle{rideRequests.length > 1 ? 's' : ''} demande{rideRequests.length > 1 ? 's' : ''}
            </h3>
            {rideRequests.map((req) => (
              <CarRideRequestCard
                key={req.id}
                request={req}
                accepting={acceptingRideId === req.id}
                onAccept={() => onAcceptRide(req)}
                onDecline={() => onDeclineRide(req.id)}
              />
            ))}
          </div>
        )}

        {/* Mode hors ligne + en attente */}
        {isOnline && rideRequests.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
              <Car className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-gray-400 text-sm">{t('taxiCarDriver.enAttenteDeDemandes')}</p>
            <p className="text-gray-600 text-xs mt-1">{t('taxiCarDriver.vousRecevrezUneNotificationA')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Composant principal TaxiCarDriver
// ============================================================
export default function TaxiCarDriver() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { error, capture, clear } = useTaxiErrorBoundary();
  const navigate = useNavigate();

  const {
    location,
    loading: _gpsLoading,
    error: _gpsError,
    isWatching,
    getCurrentLocation,
    startWatching,
    stopWatching,
  } = useGPSLocation({
    enableHighAccuracy: true,
    watchPosition: false,
    onLocationChange: (loc) => {
      const now = Date.now();
      if (driverIdRef.current && isOnlineRef.current) {
        if (now - lastLocationUpdateRef.current >= 5000) {
          lastLocationUpdateRef.current = now;
          updateDriverLocation(loc.latitude, loc.longitude);
        }
      }
      if (activeRideRef.current) {
        const ride = activeRideRef.current;
        if (['accepted', 'arriving', 'picked_up', 'in_progress'].includes(ride.status)) {
          if (now - lastTrackingRef.current >= 10000) {
            lastTrackingRef.current = now;
            TaxiMotoService.trackPosition(
              ride.id, driverIdRef.current!, loc.latitude, loc.longitude,
              undefined, undefined, loc.accuracy || undefined
            ).catch(() => {});
          }
        }
      }
    },
    onError: (err) => {
      capture('gps', err.userMessage, err);
    }
  });

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useTaxiNotifications();
  const { hasAccess, subscription, loading: _subscriptionLoading } = useDriverSubscription();

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [_onlineSince, setOnlineSince] = useState<Date | null>(null);
  const [_distanceToDestination, setDistanceToDestination] = useState(0);
  const [_timeToDestination, setTimeToDestination] = useState(0);
  const [_nextInstruction, setNextInstruction] = useState('');

  const { driverId, driverDisplayId: hookDriverDisplayId, loading: driverLoading, isOnline, setIsOnline, updateDriverLocation } = useTaxiDriverProfile(user?.id);
  const { stats: driverStats, rideHistory, updateLocalStats } = useTaxiDriverStats(driverId);

  const driverIdRef = useRef(driverId);
  const isOnlineRef = useRef(isOnline);
  const activeRideRef = useRef<ActiveRide | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);
  const lastTrackingRef = useRef<number>(0);

  useEffect(() => { driverIdRef.current = driverId; }, [driverId]);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  const driverDisplayId = hookDriverDisplayId || driverId;

  const startNavigation = useCallback(async (destination: { latitude: number; longitude: number }) => {
    setNextInstruction('📍 Calcul de l\'itinéraire...');
    if (!location) return;
    const geoService = GeolocationService.getInstance();
    const dist = geoService.calculateDistance(
      { latitude: location.latitude, longitude: location.longitude, accuracy: 0, timestamp: 0 },
      { latitude: destination.latitude, longitude: destination.longitude, accuracy: 0, timestamp: 0 }
    );
    setDistanceToDestination(dist);
    setTimeToDestination(Math.ceil((dist / 1000) / 40 * 60));
    setNextInstruction('Navigation démarrée');
    toast.info(t('taxiCarDriver.navigationActivee'));
  }, [location]);

  const { activeRide, setActiveRide, setNavigationActive, updateRideStatus, cancelActiveRide } = useTaxiActiveRide(driverId, startNavigation, updateLocalStats);
  useEffect(() => { activeRideRef.current = activeRide; }, [activeRide]);

  const { rideRequests, acceptingRideId, loadPendingRides, acceptRideRequest, declineRideRequest, clearRideRequests } = useTaxiRideRequests(driverId, isOnline, hasAccess, location);

  useEffect(() => {
    if (isOnline && driverId && hasAccess) {
      if (!isWatching) startWatching();
      const interval = setInterval(() => loadPendingRides(), 15000);
      return () => clearInterval(interval);
    } else if (!isOnline && isWatching) {
      stopWatching();
    }
  }, [isOnline, driverId, hasAccess, isWatching, startWatching, stopWatching, loadPendingRides]);

  useEffect(() => () => { stopWatching(); }, [stopWatching]);

  const toggleOnlineStatus = async () => {
    const next = !isOnline;
    if (!driverId) { toast.error(t('taxiCarDriver.profilConducteurNonTrouve')); return; }
    if (next && !hasAccess) {
      toast.error('⚠️ Abonnement requis', { description: t('taxiCarDriver.vousDevezAvoirUnAbonnement') });
      return;
    }
    if (next) {
      toast.loading('📍 Activation GPS...', { id: 'gps-car' });
      try {
        const position = await getCurrentLocation();
        toast.dismiss('gps-car');
        if (!position) { toast.error('Position GPS non disponible'); return; }
        await TaxiMotoService.updateDriverStatus(driverId, true, true, position.latitude, position.longitude);
        setIsOnline(true);
        setOnlineSince(new Date());
        toast.success('🟢 En ligne — Taxi Voiture', { description: `GPS: ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}` });
      } catch (err: unknown) {
        toast.dismiss('gps-car');
        capture('network', 'Erreur activation', err);
        toast.error(t('taxiCarDriver.impossibleDePasserEnLigne'));
      }
    } else {
      try {
        await TaxiMotoService.updateDriverStatus(driverId, false, false, undefined, undefined);
        setIsOnline(false);
        setOnlineSince(null);
        clearRideRequests();
        toast.info('🔴 Hors ligne');
      } catch (err: unknown) {
        capture('network', 'Erreur changement statut', err);
        toast.error(t('taxiCarDriver.erreurLorsDuChangementDe'));
      }
    }
  };

  const handleAcceptRide = async (request: RideRequest) => {
    const result = await acceptRideRequest(request);
    if (result) {
      setActiveRide(result);
      setNavigationActive(true);
      setActiveTab('navigation');
      const relatedNotifs = notifications.filter(n => n.data?.rideId === request.id);
      relatedNotifs.forEach(n => markAsRead(n.id));
      startNavigation(request.pickupCoords);
    }
  };

  const handleDeclineRide = async (requestId: string) => {
    await declineRideRequest(requestId);
    const relatedNotifs = notifications.filter(n => n.data?.rideId === requestId);
    relatedNotifs.forEach(n => markAsRead(n.id));
  };

  const contactCustomer = (phone: string) => { window.open(`tel:${phone}`); };

  const handleSignOut = async () => {
    if (driverId && isOnline) {
      try {
        stopWatching();
        await TaxiMotoService.updateDriverStatus(driverId, false, false, undefined, undefined);
      } catch {}
    }
    setIsOnline(false);
    await signOut();
    toast.success(t('taxiCarDriver.deconnexionReussie'));
    navigate('/');
  };

  // ============================================================
  // Rendu
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-950 overflow-x-hidden">

      {/* Header Taxi Voiture — Style VTC */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/80">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-bold text-sm">Taxi Voiture</h1>
                <Badge className={`text-[10px] px-1.5 py-0 ${isOnline ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </Badge>
              </div>
              <p className="text-gray-500 text-xs">
                {driverDisplayId ? `ID: ${driverDisplayId}` : `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Chauffeur'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-blue-400" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Contenu selon l'onglet */}
      {activeTab === 'dashboard' && (
        <CarMainDashboard
          isOnline={isOnline}
          isLoading={driverLoading}
          hasSubscription={hasAccess}
          driverId={driverId}
          driverDisplayId={driverDisplayId}
          userId={user?.id}
          location={location}
          stats={{
            todayEarnings: driverStats.todayEarnings || 0,
            todayRides: driverStats.todayRides || 0,
            rating: driverStats.rating || 0,
            onlineTime: driverStats.onlineTime || '0h',
            vehiclePlate: driverStats.vehiclePlate,
          }}
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
            else if (statId === 'history') setActiveTab('history');
            else if (statId === 'rating') setActiveTab('rating');
          }}
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
                estimatedEarnings: activeRide.estimatedEarnings,
              }}
              currentLocation={location}
              onContactCustomer={contactCustomer}
              onUpdateStatus={async (status) => { await updateRideStatus(status as ActiveRide['status']); }}
              onCancelRide={cancelActiveRide}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Car className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-500">{t('taxiCarDriver.aucuneCourseActive')}</p>
              <p className="text-gray-600 text-sm mt-1">{t('taxiCarDriver.acceptezUneDemandeDepuisLe')}</p>
              <Button
                onClick={() => setActiveTab('dashboard')}
                variant="outline"
                className="mt-4 border-gray-700 text-gray-400"
              >
                Aller au Dashboard
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'gps-navigation' && (
        <div className="min-h-screen bg-gray-950 pb-24">
          {!location ? (
            <GPSPermissionHelper
              onLocationGranted={async () => {
                try {
                  await getCurrentLocation();
                  toast.success('Position obtenue !');
                } catch {}
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
                requestedAt: activeRide.startTime,
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
        <div className="min-h-screen bg-gray-950 pb-24 pt-4 px-4">
          <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Historique des courses
          </h2>
          {rideHistory.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">{t('taxiCarDriver.aucuneCourseCompletee')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rideHistory.map((ride: Record<string, unknown>) => (
                <Card key={ride.id as string} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        ride.status === 'completed' ? 'bg-[#ff4000]/20 text-[#ff4000]' :
                        ride.status === 'cancelled' ? 'bg-[#ff4000]/20 text-[#ff4000]' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {ride.status === 'completed' ? 'Terminée' : ride.status === 'cancelled' ? 'Annulée' : String(ride.status)}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {new Date(ride.created_at as string).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-white text-sm truncate">{String(ride.pickup_address || 'Adresse départ')}</p>
                    <p className="text-gray-400 text-xs truncate mt-0.5">→ {String(ride.dropoff_address || 'Destination')}</p>
                    {ride.driver_share && (
                      <p className="text-[#ff4000] font-bold mt-2 text-sm"><Money amount={Number(ride.driver_share)} from="GNF" /></p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rating' && (
        <div className="min-h-screen bg-gray-950 pb-24 pt-4 px-4">
          <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-[#ff4000]" />
            Votre note chauffeur
          </h2>
          <div className="bg-[#ff4000]/20 rounded-2xl p-6 border border-[#ff4000]/30 text-center">
            <div className="text-5xl font-bold text-[#ff4000] mb-2">
              {driverStats.rating > 0 ? driverStats.rating.toFixed(1) : '--'}
            </div>
            <div className="flex justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={`w-6 h-6 ${star <= Math.round(driverStats.rating) ? 'text-[#ff4000] fill-[#ff4000]' : 'text-gray-600'}`} />
              ))}
            </div>
            <p className="text-gray-400 text-sm">Basé sur {driverStats.totalRides || 0} courses</p>
          </div>
          <div className="mt-4 bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-2">
            <h3 className="text-white font-medium text-sm">{t('taxiCarDriver.conseilsPourAmeliorerVotreNote')}</h3>
            {['Soyez ponctuel aux rendez-vous', 'Conduisez prudemment et respectez le code', 'Soyez courtois avec les clients', 'Maintenez votre véhicule propre et climatisé', 'Proposez de l\'eau aux clients si possible'].map((tip) => (
              <div key={tip} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-gray-400 text-xs">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="min-h-screen bg-gray-950 pb-24">
          <DriverSettings driverId={driverId || ''} />
        </div>
      )}

      {activeTab === 'my-purchases' && (
        <div className="min-h-screen bg-gray-950 pb-24 p-4">
          <MyPurchasesOrdersList
            title="Mes Achats Personnels"
            emptyMessage="Vous n'avez pas encore effectué d'achats sur le marketplace"
          />
        </div>
      )}

      {/* Communication */}
      {user && <CommunicationWidget />}

      {/* Navigation bottom — sans SOS */}
      <CarBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActiveRide={!!activeRide}
      />
    </div>
  );
}

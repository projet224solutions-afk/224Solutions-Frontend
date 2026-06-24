/**
 * PAGE CLIENT TAXI-MOTO COMPLÈTE
 * Interface unifiée pour réserver, suivre et consulter l'historique des courses
 * 224Solutions - Taxi-Moto System
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Navigation,
  Clock,
  History,
  LogOut,
  MapPin,
  User
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import useCurrentLocation from "@/hooks/useGeolocation";
import { calculateDistance } from '@/hooks/useGeoDistance';
import TaxiMotoBooking from "@/components/taxi-moto/TaxiMotoBooking";
import { ShareLocationButton } from "@/components/taxi-moto/ShareLocationButton";
import TaxiMotoTracking from "@/components/taxi-moto/TaxiMotoTracking";
import TaxiMotoHistory from "@/components/taxi-moto/TaxiMotoHistory";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useTaxiErrorBoundary } from "@/hooks/useTaxiErrorBoundary";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRideNotifications } from "@/hooks/useRideNotifications";
import { UserIdDisplay } from "@/components/UserIdDisplay";
import { InstallPromptBanner } from "@/components/pwa/InstallPromptBanner";
import { useResponsive } from "@/hooks/useResponsive";
import CommunicationWidget from "@/components/communication/CommunicationWidget";
import { ShoppingBag } from "lucide-react";
import { lazy, Suspense } from 'react';
const MyPurchasesOrdersList = lazy(() => import('@/components/shared/MyPurchasesOrdersList'));

interface Driver {
  id: string;
  name: string;
  rating: number;
  distance: number;
  vehicleType: string;
  eta: string;
  rides: number;
}

interface CurrentRide {
  id: string;
  status: 'pending' | 'accepted' | 'driver_arriving' | 'in_progress' | 'completed' | 'cancelled';
  pickupAddress: string;
  destinationAddress: string;
  estimatedPrice: number;
  driver?: {
    id: string;
    name: string;
    rating: number;
    phone: string;
    vehicleType: string;
    vehicleNumber: string;
    photo?: string;
  };
  estimatedArrival?: string;
  actualArrival?: string;
  createdAt: string;
}

// Statuts pour lesquels on restaure la course au chargement ET on force l'onglet Suivi.
// IMPORTANT : on ne restaure QUE les courses avec un chauffeur assigné. Une course en
// simple attente ('requested'/'pending') ne doit PAS rediriger le client vers le suivi —
// il doit pouvoir réserver normalement (saisir position + destination).
const RESTORE_TRIP_STATUSES = ['accepted', 'arriving', 'started', 'in_progress'] as const;

/** Mappe le statut DB (taxi_trips) vers le statut d'affichage de l'interface client. */
function mapTripStatus(dbStatus?: string): CurrentRide['status'] {
  switch (dbStatus) {
    case 'requested':
    case 'pending':
      return 'pending';
    case 'accepted':
      return 'accepted';
    case 'arriving':
    case 'driver_arriving':
      return 'driver_arriving';
    case 'started':
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    default:
      return (dbStatus || '').includes('cancel') ? 'cancelled' : 'pending';
  }
}

export default function TaxiMotoClient() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { location, getCurrentLocation } = useCurrentLocation();
  const responsive = useResponsive();
  const { error, _capture, clear } = useTaxiErrorBoundary();

  // On démarre TOUJOURS sur l'onglet "Réserver".
  // L'onglet "Suivi" n'est activé que si une course réellement active est retrouvée
  // en base (cf. restoreActiveRide). Ceci évite d'atterrir directement sur le suivi
  // à cause d'un identifiant périmé dans localStorage (course fantôme), bug qui
  // empêchait le client de réserver après avoir cliqué sur "Commander".
  const [activeTab, setActiveTab] = useState<string>('booking');
  const [nearbyDrivers, setNearbyDrivers] = useState<Driver[]>([]);
  const [currentRide, setCurrentRide] = useState<CurrentRide | null>(null);
  const [restorationDone, setRestorationDone] = useState(false);

  // Synchroniser localStorage avec l'état de la course
  useEffect(() => {
    try {
      if (currentRide?.id) {
        localStorage.setItem('taxi_active_ride_id', currentRide.id);
      } else {
        localStorage.removeItem('taxi_active_ride_id');
      }
    } catch { /* ignore */ }
  }, [currentRide?.id]);

  // Forcer l'onglet suivi dès qu'une course devient active
  useEffect(() => {
    if (currentRide) {
      setActiveTab('tracking');
    } else if (restorationDone && !currentRide) {
      // Restauration terminée et aucune course → revenir à la réservation si on était sur tracking
      setActiveTab(prev => prev === 'tracking' ? 'booking' : prev);
    }
  }, [currentRide, restorationDone]);

  // Intercepteur de changement d'onglet — bloque si course en cours
  const handleTabChange = (tab: string) => {
    if (currentRide && tab !== 'tracking') {
      toast.warning('Course en cours', {
        description: t('taxiMotoClient.terminezOuAnnulezVotreCourse'),
        duration: 3000,
      });
      return;
    }
    setActiveTab(tab);
  };

  // Hook de notifications temps réel
  useRideNotifications(user?.id, (notification) => {
    console.log('[TaxiMotoClient] Notification received:', notification);

    // Mettre à jour currentRide si nécessaire
    if (notification.type === 'ride_completed' || notification.type === 'ride_cancelled') {
      setCurrentRide(null);
      if (notification.type === 'ride_completed') {
        setActiveTab('history');
      }
    }
  });

  // Restaurer la course active au montage (persistance inter-sessions)
  useEffect(() => {
    if (!user?.id) return;

    const restoreActiveRide = async () => {
      try {
        const { data } = await supabase
          .from('taxi_trips')
          .select('id, status, pickup_address, dropoff_address, price_total, requested_at, driver_id')
          .eq('customer_id', user.id)
          .in('status', RESTORE_TRIP_STATUSES as unknown as string[])
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Filet de sécurité : ne pas restaurer une course "fantôme" trop ancienne
        // (chauffeur bloqué / course jamais clôturée) qui piégerait le client.
        const isStale = data?.requested_at &&
          (Date.now() - new Date(data.requested_at).getTime()) > 3 * 60 * 60 * 1000;

        if (data && !isStale) {
          let driverInfo = undefined;
          if (data.driver_id) {
            const { data: driverData } = await supabase
              .from('taxi_drivers')
              .select('vehicle_type, vehicle_plate, rating, user_id')
              .eq('id', data.driver_id)
              .maybeSingle();
            if (driverData) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name, phone, avatar_url')
                .eq('id', driverData.user_id)
                .maybeSingle();
              driverInfo = {
                id: data.driver_id,
                name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Chauffeur' : 'Chauffeur',
                rating: driverData.rating || 5,
                phone: profile?.phone || '',
                vehicleType: driverData.vehicle_type,
                vehicleNumber: driverData.vehicle_plate || '',
                photo: profile?.avatar_url || undefined,
              };
            }
          }
          setCurrentRide({
            id: data.id,
            status: mapTripStatus(data.status),
            pickupAddress: data.pickup_address || '',
            destinationAddress: data.dropoff_address || '',
            estimatedPrice: data.price_total || 0,
            driver: driverInfo,
            createdAt: data.requested_at || '',
          });
          // activeTab sera forcé à 'tracking' par l'useEffect sur currentRide
        } else {
          // Aucune course active — nettoyer le localStorage pour éviter un flash au prochain chargement
          try { localStorage.removeItem('taxi_active_ride_id'); } catch { /* ignore */ }
        }
        setRestorationDone(true);
      } catch (err) {
        console.error('[TaxiMotoClient] Error restoring active ride:', err);
        setRestorationDone(true);
      }
    };

    restoreActiveRide();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Demander automatiquement la position GPS au chargement
  useEffect(() => {
    const initGPS = async () => {
      try {
        console.log('[TaxiMotoClient] 📍 Demande automatique de position GPS...');
        await getCurrentLocation();
        console.log('[TaxiMotoClient] ✓ Position GPS obtenue');
      } catch (error) {
        console.error('[TaxiMotoClient] ✕ Erreur GPS:', error);
        toast.error(t('taxiMotoClient.activezVotreGpsPourUne'));
      }
    };

    void initGPS();
  }, [getCurrentLocation]);

  useEffect(() => {
    if (location?.latitude && location?.longitude) {
      void loadNearbyDrivers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  // Écouter les mises à jour de course
  useEffect(() => {
    if (!currentRide?.id) return;

    const subscription = supabase
      .channel(`ride_updates_${currentRide.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'taxi_trips',
        filter: `id=eq.${currentRide.id}`
      }, (payload) => {
        if (payload.new) {
          updateCurrentRide(payload.new);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentRide?.id]);

  const updateCurrentRide = (trip: any) => {
    const status: string = trip.status;

    // Course terminée
    if (status === 'completed') {
      toast.success(t('taxiMotoClient.courseTerminee'));
      setCurrentRide(null);
      setActiveTab('history');
      return;
    }

    // Course annulée (par le chauffeur ou le système) → libérer le client
    if (status?.includes('cancel')) {
      toast.warning(t('taxiMotoClient.courseAnnulee'), {
        description: trip.cancel_reason || 'La course a été annulée.',
      });
      setCurrentRide(null);
      setActiveTab('booking');
      return;
    }

    // Notifications de progression
    if (status === 'accepted') {
      toast.success(t('taxiMotoClient.chauffeurTrouveIlArriveVers'));
    } else if (status === 'arriving' || status === 'driver_arriving') {
      toast.info(t('taxiMotoClient.votreChauffeurArrive'));
    } else if (status === 'started' || status === 'in_progress') {
      toast.info(t('taxiMotoClient.courseDemarree'));
    }

    // Mise à jour du statut affiché (avec récupération du chauffeur si nécessaire)
    setCurrentRide(prev => (prev ? { ...prev, status: mapTripStatus(status) } : null));

    // Si un chauffeur vient d'être assigné et qu'on ne l'a pas encore, le charger
    if (trip.driver_id && status === 'accepted') {
      void loadDriverInfo(trip.driver_id);
    }
  };

  /** Charge les infos du chauffeur assigné et les fusionne dans currentRide. */
  const loadDriverInfo = async (driverId: string) => {
    try {
      const { data: driverData } = await supabase
        .from('taxi_drivers')
        .select('vehicle_type, vehicle_plate, rating, user_id')
        .eq('id', driverId)
        .maybeSingle();
      if (!driverData) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, avatar_url')
        .eq('id', driverData.user_id)
        .maybeSingle();
      setCurrentRide(prev => prev ? {
        ...prev,
        driver: {
          id: driverId,
          name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Chauffeur' : 'Chauffeur',
          rating: driverData.rating || 5,
          phone: profile?.phone || '',
          vehicleType: driverData.vehicle_type,
          vehicleNumber: driverData.vehicle_plate || '',
          photo: profile?.avatar_url || undefined,
        },
      } : null);
    } catch (err) {
      console.warn('[TaxiMotoClient] Impossible de charger le chauffeur:', err);
    }
  };

  /**
   * Charge les conducteurs disponibles à proximité
   */
  const loadNearbyDrivers = async () => {
    try {
      if (!location?.latitude || !location?.longitude) {
        setNearbyDrivers([]);
        return;
      }

      const { data: drivers, error } = await supabase
        .from('taxi_drivers')
        .select('id, user_id, vehicle_type, rating, total_rides, last_lat, last_lng, profiles:user_id(first_name, last_name)')
        .in('status', ['available', 'online'])
        .eq('is_online', true)
        .not('last_lat', 'is', null)
        .not('last_lng', 'is', null)
        .limit(10);

      if (error) throw error;

      const formattedDrivers: Driver[] = (drivers || [])
        .map((d: any, index) => {
          const lat = Number(d.last_lat);
          const lng = Number(d.last_lng);

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
          }

          const distanceKm = calculateDistance(location.latitude, location.longitude, lat, lng);
          if (!Number.isFinite(distanceKm)) {
            return null;
          }

          const roundedDistance = Number(distanceKm.toFixed(1));
          const etaMinutes = Math.max(2, Math.min(30, Math.round(distanceKm * 3 + 2)));
          const firstName = d.profiles?.first_name?.trim?.() || '';
          const lastInitial = d.profiles?.last_name ? ` ${String(d.profiles.last_name).trim().charAt(0)}.` : '';
          const displayName = firstName ? `${firstName}${lastInitial}` : `Conducteur ${index + 1}`;

          return {
            id: d.id,
            name: displayName,
            rating: d.rating || 4.5,
            distance: roundedDistance,
            vehicleType: d.vehicle_type || 'moto_rapide',
            eta: `${etaMinutes} min`,
            rides: d.total_rides || 0,
          };
        })
        .filter((driver): driver is Driver => Boolean(driver))
        .sort((a, b) => a.distance - b.distance || b.rating - a.rating);

      setNearbyDrivers(formattedDrivers);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  /**
   * Gère la création d'une nouvelle course
   */
  const handleRideCreated = (rideData: any) => {
    const newRide: CurrentRide = {
      id: rideData.id,
      status: 'pending',
      pickupAddress: rideData.pickup_address,
      destinationAddress: rideData.dropoff_address,
      estimatedPrice: rideData.price_total,
      createdAt: rideData.requested_at
    };

    setCurrentRide(newRide);
    setActiveTab('tracking');
    toast.success(t('taxiMotoClient.courseCreeeRechercheDeConducteur'));
  };

  /**
   * Déconnexion
   */
  const handleSignOut = async () => {
    await signOut();
    toast.success(t('taxiMotoClient.deconnexionReussie'));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Responsive */}
      <header className="bg-card border-b sticky top-0 z-40 shadow-sm">
        <div className={responsive.isMobile ? 'px-3 py-3' : 'px-6 py-4'}>
          {/* Bannière d'erreur unifiée */}
          {error && (
            <ErrorBanner
              title={
                error.type === 'gps' ? 'GPS inactif' :
                error.type === 'payment' ? 'Problème de paiement' :
                error.type === 'network' ? 'Erreur réseau' :
                'Erreur'
              }
              message={error.message}
              actionLabel="Masquer"
              onAction={clear}
            />
          )}
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className={`flex items-center ${responsive.isMobile ? 'gap-2' : 'gap-3'} mb-1`}>
                <h1 className={`${responsive.isMobile ? 'text-lg' : 'text-xl'} font-bold text-foreground truncate`}>
                  {responsive.isMobile ? 'Taxi-Moto' : 'Taxi-Moto 224Solutions'}
                </h1>
                {!responsive.isMobile && (
                  <UserIdDisplay layout="horizontal" showBadge={true} className="text-sm" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className={`${responsive.isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground truncate`}>
                  {profile?.first_name || 'Client'}
                </span>
                {location && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <MapPin className="w-3 h-3 text-[#ff4000] flex-shrink-0" />
                    {!responsive.isMobile && (
                      <span className="text-xs text-muted-foreground">GPS actif</span>
                    )}
                  </>
                )}
              </div>
              {responsive.isMobile && (
                <div className="mt-1">
                  <UserIdDisplay layout="horizontal" showBadge={true} className="text-xs" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {currentRide && (
                <Badge variant="default" className={`bg-[#ff4000] ${responsive.isMobile ? 'text-xs px-2' : ''}`}>
                  {responsive.isMobile ? 'Actif' : 'Course active'}
                </Badge>
              )}
              <Button
                onClick={handleSignOut}
                variant="outline"
                size={responsive.isMobile ? 'icon' : 'sm'}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Conducteurs à proximité - Responsive */}
      {location && nearbyDrivers.length > 0 && activeTab === 'booking' && (
        <Card className={`${responsive.isMobile ? 'mx-3 mt-3' : 'mx-4 mt-4'} bg-card border-0 shadow-lg`}>
          <CardContent className={responsive.isMobile ? 'p-3' : 'p-4'}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className={`${responsive.isMobile ? 'text-xs' : 'text-sm'} font-medium text-foreground`}>
                  {nearbyDrivers.length} conducteur{nearbyDrivers.length > 1 ? 's' : ''} {responsive.isMobile ? '' : 'disponibles'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {responsive.isMobile ? `${nearbyDrivers[0].distance}km` : `Le plus proche à ${nearbyDrivers[0].distance}km`}
                </p>
              </div>
              <div className={`flex ${responsive.isMobile ? '-space-x-1' : '-space-x-2'}`}>
                {nearbyDrivers.slice(0, responsive.isMobile ? 2 : 3).map((driver) => (
                  <div
                    key={driver.id}
                    className={`${responsive.isMobile ? 'w-7 h-7' : 'w-8 h-8'} rounded-full bg-primary/10 border-2 border-card flex items-center justify-center`}
                  >
                    <User className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-primary`} />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bandeau "Course active" — visible uniquement quand une course est en cours */}
      {currentRide && (
        <div className={`${responsive.isMobile ? 'mx-3 mt-3' : 'mx-4 mt-4'} rounded-xl bg-[#ff4000] text-white px-4 py-2.5 flex items-center justify-between shadow-md`}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse flex-shrink-0" />
            <span className={`${responsive.isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>
              Course en cours — suivi activé
            </span>
          </div>
          <Badge className="bg-white/20 text-white border-white/30 text-xs font-medium">
            {currentRide.status === 'pending' ? 'Recherche chauffeur' :
             currentRide.status === 'accepted' ? 'Chauffeur assigné' :
             currentRide.status === 'driver_arriving' ? 'Chauffeur en approche' :
             currentRide.status === 'in_progress' ? 'En route' : 'En cours'}
          </Badge>
        </div>
      )}

      {/* Navigation par onglets - Responsive */}
      <div className={responsive.isMobile ? 'px-3 mt-3' : 'px-4 mt-4'}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={`grid w-full grid-cols-4 bg-card ${responsive.isMobile ? 'h-12' : ''}`}>
            <TabsTrigger
              value="booking"
              disabled={!!currentRide}
              className={`${responsive.isMobile ? 'text-xs' : ''} ${currentRide ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Navigation className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} ${responsive.isMobile ? '' : 'mr-1'}`} />
              {!responsive.isMobile && 'Réserver'}
              {responsive.isMobile && <span className="ml-1">{t('taxiMotoClient.reserver')}</span>}
            </TabsTrigger>
            <TabsTrigger value="tracking" disabled={!currentRide} className={responsive.isMobile ? 'text-xs' : ''}>
              <Clock className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} ${responsive.isMobile ? '' : 'mr-1'}`} />
              {!responsive.isMobile && 'Suivi'}
              {responsive.isMobile && <span className="ml-1">Suivi</span>}
              {currentRide && (
                <span className="ml-1 w-2 h-2 bg-[#ff4000] rounded-full animate-pulse"></span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              disabled={!!currentRide}
              className={`${responsive.isMobile ? 'text-xs' : ''} ${currentRide ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <History className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} ${responsive.isMobile ? '' : 'mr-1'}`} />
              {!responsive.isMobile && 'Historique'}
              {responsive.isMobile && <span className="ml-1">Histo</span>}
            </TabsTrigger>
            <TabsTrigger
              value="my-purchases"
              disabled={!!currentRide}
              className={`${responsive.isMobile ? 'text-xs' : ''} ${currentRide ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <ShoppingBag className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} ${responsive.isMobile ? '' : 'mr-1'}`} />
              {!responsive.isMobile && 'Mes Achats'}
              {responsive.isMobile && <span className="ml-1">Achats</span>}
            </TabsTrigger>
          </TabsList>

          {/* Réservation */}
          <TabsContent value="booking" className="mt-4 space-y-4">
            {/* Partage de position : le client donne son ID/lien au chauffeur */}
            <Card className="bg-card border-0 shadow-lg">
              <CardContent className={`${responsive.isMobile ? 'p-3' : 'p-4'} flex items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Partager ma position</p>
                  <p className="text-xs text-muted-foreground">
                    Aidez le chauffeur à vous localiser avec précision
                  </p>
                </div>
                <ShareLocationButton
                  userId={user?.id}
                  userName={profile?.first_name || 'Client'}
                  variant="compact"
                  className="shrink-0"
                />
              </CardContent>
            </Card>

            <TaxiMotoBooking
              userLocation={location}
              nearbyDrivers={nearbyDrivers}
              onRideCreated={handleRideCreated}
            />
          </TabsContent>

          {/* Suivi en temps réel */}
          <TabsContent value="tracking" className="mt-4">
            <TaxiMotoTracking
              currentRide={currentRide}
              userLocation={location}
            />
          </TabsContent>

          {/* Historique */}
          <TabsContent value="history" className="mt-4">
            <TaxiMotoHistory userId={user?.id} />
          </TabsContent>

          {/* Mes Achats */}
          <TabsContent value="my-purchases" className="mt-4">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <MyPurchasesOrdersList
                title="Mes Achats Personnels"
                emptyMessage="Vous n'avez pas encore effectué d'achats sur le marketplace"
              />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      {/* Statistiques rapides - Responsive */}
      {activeTab === 'booking' && (
        <Card className={`${responsive.isMobile ? 'mx-3 mt-3' : 'mx-4 mt-4'} bg-card border-0 shadow-lg`}>
          <CardContent className={responsive.isMobile ? 'p-3' : 'p-4'}>
            <div className={`grid grid-cols-3 ${responsive.isMobile ? 'gap-2' : 'gap-4'} text-center`}>
              <div>
                <div className={`${responsive.isMobile ? 'text-xl' : 'text-2xl'} font-bold text-primary`}>4.8</div>
                <div className="text-xs text-muted-foreground">{responsive.isMobile ? 'Note' : 'Note moyenne'}</div>
              </div>
              <div>
                <div className={`${responsive.isMobile ? 'text-xl' : 'text-2xl'} font-bold text-[#ff4000]`}>2 min</div>
                <div className="text-xs text-muted-foreground">{responsive.isMobile ? 'Attente' : 'Temps d\'attente'}</div>
              </div>
              <div>
                <div className={`${responsive.isMobile ? 'text-xl' : 'text-2xl'} font-bold text-blue-600`}>24/7</div>
                <div className="text-xs text-muted-foreground">Dispo.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bannière d'installation PWA */}
      <InstallPromptBanner />

      {/* Widget de communication flottant */}
      <CommunicationWidget position="bottom-right" showNotifications={true} />
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TaxiMotoService } from '@/services/taxi/TaxiMotoService';
import { formatCurrency } from '@/lib/formatters';

export interface RideRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerRating: number;
  pickupAddress: string;
  destinationAddress: string;
  distance: number;
  estimatedEarnings: number;
  estimatedDuration: number;
  pickupCoords: { latitude: number; longitude: number };
  destinationCoords: { latitude: number; longitude: number };
  requestTime: string;
}

interface UseTaxiRideRequestsReturn {
  rideRequests: RideRequest[];
  acceptingRideId: string | null;
  loadPendingRides: () => Promise<void>;
  acceptRideRequest: (request: RideRequest) => Promise<any>;
  declineRideRequest: (requestId: string) => Promise<void>;
  clearRideRequests: () => void;
}

// Calcul de distance entre deux points GPS (Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function useTaxiRideRequests(
  driverId: string | null,
  isOnline: boolean,
  hasAccess: boolean,
  location: { latitude: number; longitude: number } | null
): UseTaxiRideRequestsReturn {
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fonction pour ajouter une demande de course depuis la DB
  const addRideRequestFromDB = useCallback(async (ride: any) => {
    // Charger les données du client
    let customerName = 'Client';
    let customerPhone = '+224 600 00 00 00';
    let customerRating = 4.5;

    try {
      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone')
        .eq('id', ride.customer_id as string)
        .single();

      if (customerProfile) {
        customerName = `${customerProfile.first_name || ''} ${customerProfile.last_name || ''}`.trim() || 'Client';
        customerPhone = customerProfile.phone || customerPhone;
      }

      // Charger les notes - bypass type checking pour taxi_ratings
      const { data: ratingsData } = await (supabase as any)
        .from('taxi_ratings')
        .select('stars')
        .eq('customer_id', String(ride.customer_id));

      if (ratingsData && Array.isArray(ratingsData) && ratingsData.length > 0) {
        customerRating = ratingsData.reduce((sum: number, r: any) => sum + (r.stars || 0), 0) / ratingsData.length;
      }
    } catch (error) {
      console.error('Error loading customer:', error);
    }

    const request: RideRequest = {
      id: ride.id,
      customerId: ride.customer_id,
      customerName,
      customerPhone,
      customerRating: Math.round(customerRating * 10) / 10,
      pickupAddress: ride.pickup_address,
      destinationAddress: ride.dropoff_address,
      distance: ride.distance_km || 0,
      estimatedEarnings: ride.driver_share || Math.round((ride.price_total || 0) * 0.85),
      estimatedDuration: ride.duration_min || 0,
      pickupCoords: {
        latitude: ride.pickup_lat || 0,
        longitude: ride.pickup_lng || 0
      },
      destinationCoords: {
        latitude: ride.dropoff_lat || 0,
        longitude: ride.dropoff_lng || 0
      },
      requestTime: ride.created_at
    };

    setRideRequests(prev => {
      // Éviter les doublons
      if (prev.some(r => r.id === request.id)) return prev;
      return [...prev, request];
    });
  }, []);

  // Charger les courses en attente depuis la DB
  const loadPendingRides = useCallback(async () => {
    if (!driverId || !hasAccess) return;

    try {
      // Charger toutes les courses "requested" à proximité
      const { data: rides, error } = await supabase
        .from('taxi_trips')
        .select('*')
        .eq('status', 'requested')
        .is('driver_id', null);

      if (error) throw error;
      if (!rides || rides.length === 0) return;

      // Filtrer les courses déjà refusées par ce conducteur
      const availableRides = rides.filter(ride => {
        const declinedDrivers = ride.declined_drivers || [];
        return !declinedDrivers.includes(driverId);
      });

      // Filtrer par distance et ajouter à la liste (rayon 15km)
      const nearbyRides = availableRides.filter(ride => {
        if (!ride.pickup_lat || !ride.pickup_lng) return true;
        if (!location) return true;
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          ride.pickup_lat,
          ride.pickup_lng
        );
        return distance <= 15;
      });

      // Charger les détails pour chaque course
      for (const ride of nearbyRides) {
        await addRideRequestFromDB(ride);
      }

      if (nearbyRides.length > 0) {
        toast.success(`${nearbyRides.length} course(s) disponible(s)!`);
      }
    } catch (error) {
      console.error('Error loading pending rides:', error);
    }
  }, [driverId, hasAccess, location, addRideRequestFromDB]);

  // Accepter une demande de course
  const acceptRideRequest = useCallback(async (request: RideRequest) => {
    console.log('🎯 Tentative d\'acceptation de course:', request.id);

    if (acceptingRideId) {
      console.log('⏳ Une acceptation est déjà en cours:', acceptingRideId);
      toast.info('Veuillez patienter, une course est en cours d\'acceptation...');
      return null;
    }

    if (!driverId) {
      console.error('❌ Pas de driverId disponible');
      toast.error('Profil conducteur non trouvé');
      return null;
    }

    console.log('✅ DriverId trouvé:', driverId);
    setAcceptingRideId(request.id);

    try {
      console.log('📞 Appel de TaxiMotoService.acceptRide...');
      await TaxiMotoService.acceptRide(request.id, driverId);
      console.log('✅ Course acceptée avec succès dans la DB');

      // Charger le téléphone réel du client
      let customerPhone = '+224 600 00 00 00';
      try {
        const { data: customerProfile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', request.customerId)
          .single();

        if (customerProfile?.phone) {
          customerPhone = customerProfile.phone;
          console.log('📱 Téléphone client chargé:', customerPhone);
        }
      } catch (error) {
        console.error('Error loading customer phone:', error);
      }

      // Vider les demandes de courses
      setRideRequests([]);

      toast.success('✅ Course acceptée ! Navigation vers le client...');

      return {
        id: request.id,
        customer: {
          name: request.customerName,
          phone: customerPhone,
          rating: request.customerRating
        },
        pickup: {
          address: request.pickupAddress,
          coords: request.pickupCoords
        },
        destination: {
          address: request.destinationAddress,
          coords: request.destinationCoords
        },
        status: 'accepted' as const,
        startTime: new Date().toISOString(),
        estimatedEarnings: request.estimatedEarnings
      };
    } catch (error: any) {
      console.error('❌ Erreur acceptation course:', error);

      if (error.message?.includes('LOCKED') || error.message?.includes('déjà en cours')) {
        toast.warning('⏳ Cette course est déjà en cours d\'attribution par un autre conducteur.');
      } else if (error.message?.includes('ALREADY_ASSIGNED') || error.message?.includes('déjà attribuée')) {
        toast.info('ℹ️ Cette course a déjà été attribuée à un autre conducteur.');
      } else {
        toast.error(`Erreur: ${error.message || 'Impossible d\'accepter la course'}`);
      }
      return null;
    } finally {
      setAcceptingRideId(null);
    }
  }, [driverId, acceptingRideId]);

  // Refuser une demande de course
  const declineRideRequest = useCallback(async (requestId: string) => {
    if (!driverId) return;

    try {
      await TaxiMotoService.refuseRide(requestId, driverId);
      setRideRequests(prev => prev.filter(req => req.id !== requestId));
      toast.info('❌ Demande refusée');
    } catch (error) {
      console.error('Error declining ride:', error);
      toast.error('Erreur lors du refus');
    }
  }, [driverId]);

  const clearRideRequests = useCallback(() => {
    setRideRequests([]);
  }, []);

  // S'abonner aux demandes de courses temps réel
  useEffect(() => {
    if (!driverId || !isOnline || !hasAccess) {
      console.log('⚠️ [useTaxiRideRequests] Subscription NON activée:', { driverId, isOnline, hasAccess });
      return;
    }

    console.log('🔔 [useTaxiRideRequests] Subscription aux courses activée pour driver:', driverId);

    const channel = supabase
      .channel('driver-ride-requests-v2')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'taxi_trips'
        },
        async (payload) => {
          console.log('📲 [useTaxiRideRequests] Nouvelle entrée taxi_trips détectée:', payload);
          const ride = payload.new as any;

          if (ride.status !== 'requested') {
            console.log('⚠️ Course ignorée, status:', ride.status);
            return;
          }

          if (ride.driver_id) {
            console.log('⚠️ Course déjà assignée à un driver:', ride.driver_id);
            return;
          }

          const declinedDrivers = ride.declined_drivers || [];
          if (declinedDrivers.includes(driverId)) {
            console.log('⚠️ Course déjà refusée par ce conducteur, ignorée');
            return;
          }

          console.log('🔊 Affichage notification + son pour course:', ride.id);
          const priceDisplay = typeof ride.price_total === 'number' && !isNaN(ride.price_total)
            ? formatCurrency(ride.price_total)
            : '0';
          toast.success('🚗 Nouvelle course disponible!', {
            description: `De ${ride.pickup_address || 'Adresse inconnue'} - ${priceDisplay}`,
            duration: 10000
          });

          // Audio notification
          try {
            if (!audioRef.current) {
              audioRef.current = new Audio('/notification.mp3');
              audioRef.current.volume = 0.8;
            }
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          } catch (_e) {}

          console.log('✅ Ajout course à la liste des demandes');
          await addRideRequestFromDB(ride);

          if (location && ride.pickup_lat && ride.pickup_lng) {
            const distance = calculateDistance(
              location.latitude,
              location.longitude,
              ride.pickup_lat,
              ride.pickup_lng
            );
            console.log(`📍 Distance au point de ramassage: ${distance.toFixed(2)}km`);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [useTaxiRideRequests] ABONNÉ avec succès aux courses');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [useTaxiRideRequests] ERREUR subscription Realtime!');
          toast.error('Erreur de connexion temps réel. Rechargez la page.');
        }
      });

    return () => {
      console.log('🔕 Unsubscribe des courses');
      supabase.removeChannel(channel);
    };
  }, [driverId, isOnline, hasAccess, location, addRideRequestFromDB]);

  return {
    rideRequests,
    acceptingRideId,
    loadPendingRides,
    acceptRideRequest,
    declineRideRequest,
    clearRideRequests
  };
}

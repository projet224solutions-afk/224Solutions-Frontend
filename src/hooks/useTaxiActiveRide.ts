import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { supabase } from '@/integrations/supabase/client';
import { TaxiMotoService } from '@/services/taxi/TaxiMotoService';

export interface ActiveRide {
  id: string;
  customer: {
    name: string;
    phone: string;
    rating: number;
  };
  pickup: {
    address: string;
    coords: { latitude: number; longitude: number };
  };
  destination: {
    address: string;
    coords: { latitude: number; longitude: number };
  };
  status: 'accepted' | 'arriving' | 'picked_up' | 'in_progress';
  startTime: string;
  estimatedEarnings: number;
}

interface UseTaxiActiveRideReturn {
  activeRide: ActiveRide | null;
  setActiveRide: (ride: ActiveRide | null) => void;
  navigationActive: boolean;
  setNavigationActive: (active: boolean) => void;
  loadActiveRide: () => Promise<void>;
  updateRideStatus: (newStatus: ActiveRide['status']) => Promise<void>;
  cancelActiveRide: () => Promise<void>;
  completeRide: () => Promise<void>;
}

export function useTaxiActiveRide(
  driverId: string | null,
  onStartNavigation: (coords: { latitude: number; longitude: number }) => void,
  onStatsUpdate?: (earnings: number) => void
): UseTaxiActiveRideReturn {
  const fc = useFormatCurrency();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [navigationActive, setNavigationActive] = useState(false);

  const loadActiveRide = useCallback(async () => {
    if (!driverId) return;

    try {
      const { data: rides, error } = await supabase
        .from('taxi_trips')
        .select('*')
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'started', 'arriving', 'in_progress'])
        .order('requested_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading active ride:', error);
        return;
      }

      if (!rides || rides.length === 0) {
        setActiveRide(null);
        setNavigationActive(false);
        return;
      }

      const ride = rides[0];

      // Charger les infos du client
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
      } catch (e) {
        console.error('Error loading customer info:', e);
      }

      // Mapper les statuts DB vers les statuts frontend
      let frontendStatus: ActiveRide['status'] = 'accepted';
      if (ride.status === 'arriving') {
        frontendStatus = 'arriving';
      } else if (ride.status === 'started') {
        frontendStatus = 'picked_up';
      } else if (ride.status === 'in_progress') {
        frontendStatus = 'in_progress';
      } else if (ride.status === 'accepted') {
        frontendStatus = 'accepted';
      }

      const activeRideData: ActiveRide = {
        id: ride.id,
        customer: {
          name: customerName,
          phone: customerPhone,
          rating: Math.round(customerRating * 10) / 10
        },
        pickup: {
          address: ride.pickup_address,
          coords: { latitude: ride.pickup_lat || 0, longitude: ride.pickup_lng || 0 }
        },
        destination: {
          address: ride.dropoff_address,
          coords: { latitude: ride.dropoff_lat || 0, longitude: ride.dropoff_lng || 0 }
        },
        status: frontendStatus,
        startTime: ride.accepted_at || ride.updated_at,
        estimatedEarnings: ride.driver_share || Math.round((ride.price_total || 0) * 0.85)
      };

      setActiveRide(activeRideData);
      setNavigationActive(true);

      // Si course démarrée, lancer navigation vers destination
      if (frontendStatus === 'picked_up' || frontendStatus === 'in_progress') {
        onStartNavigation(activeRideData.destination.coords);
      } else {
        onStartNavigation(activeRideData.pickup.coords);
      }

      console.log('✅ Course active chargée:', activeRideData);
    } catch (error) {
      console.error('Error loading active ride:', error);
    }
  }, [driverId, onStartNavigation]);

  const updateRideStatus = useCallback(async (newStatus: ActiveRide['status']) => {
    if (!activeRide) {
      console.warn('[ActiveRide] Pas de course active pour mise à jour');
      return;
    }

    try {
      // Mapper les statuts frontend vers les statuts DB
      let dbStatus: string;

      if (newStatus === 'arriving') {
        dbStatus = 'arriving';
      } else if (newStatus === 'picked_up') {
        dbStatus = 'started';
      } else if (newStatus === 'in_progress') {
        dbStatus = 'in_progress';
      } else {
        dbStatus = newStatus;
      }

      console.log(`[ActiveRide] Mise à jour statut: ${activeRide.status} -> ${newStatus} (DB: ${dbStatus})`);

      // Mise à jour directe dans Supabase pour plus de robustesse
      const { error } = await supabase
        .from('taxi_trips')
        .update({
          status: dbStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeRide.id);

      if (error) {
        console.error('[ActiveRide] Erreur DB:', error);
        throw error;
      }

      // Mise à jour locale immédiate
      setActiveRide(prev => prev ? { ...prev, status: newStatus } : null);

      switch (newStatus) {
        case 'arriving':
          toast.success('🎯 Vous êtes arrivé au point de rendez-vous');
          break;
        case 'picked_up':
          toast.success('🚗 Client à bord, navigation vers la destination...');
          if (activeRide) {
            onStartNavigation(activeRide.destination.coords);
          }
          break;
        case 'in_progress':
          toast.success('🏁 Arrivé à destination !');
          break;
      }

      console.log(`[ActiveRide] Statut mis à jour avec succès: ${newStatus}`);
    } catch (error: any) {
      console.error('[ActiveRide] Erreur mise à jour statut:', error);
      toast.error('Erreur lors de la mise à jour', {
        description: error?.message || 'Veuillez réessayer'
      });
    }
  }, [activeRide, onStartNavigation]);

  const cancelActiveRide = useCallback(async () => {
    if (!activeRide || !driverId) return;

    const confirmed = window.confirm(
      '⚠️ Êtes-vous sûr de vouloir annuler cette course ?\n\n' +
      'Le client sera notifié et vous pourriez recevoir une pénalité.'
    );

    if (!confirmed) return;

    try {
      console.log('❌ Annulation de la course:', activeRide.id);

      await TaxiMotoService.updateRideStatus(activeRide.id, 'cancelled', 'driver', {
        cancel_reason: 'Annulée par le conducteur',
        cancelled_at: new Date().toISOString()
      });

      setActiveRide(null);
      setNavigationActive(false);

      toast.success('✅ Course annulée avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de l\'annulation:', error);
      toast.error('Impossible d\'annuler la course');
    }
  }, [activeRide, driverId]);

  const completeRide = useCallback(async () => {
    if (!activeRide || !driverId) return;

    try {
      console.log('🏁 Finalisation de la course:', activeRide.id);

      await TaxiMotoService.updateRideStatus(activeRide.id, 'completed', 'driver', {
        completed_at: new Date().toISOString()
      });

      // Mettre à jour les statistiques du conducteur dans la DB
      const { data: currentDriver, error: driverError } = await supabase
        .from('taxi_drivers')
        .select('total_rides, total_earnings')
        .eq('id', driverId)
        .single();

      if (!driverError && currentDriver) {
        const newTotalRides = (currentDriver.total_rides || 0) + 1;
        const newTotalEarnings = (currentDriver.total_earnings || 0) + activeRide.estimatedEarnings;

        await supabase
          .from('taxi_drivers')
          .update({
            total_rides: newTotalRides,
            total_earnings: newTotalEarnings,
            status: 'available',
            is_available: true
          })
          .eq('id', driverId);
      }

      // Callback pour mettre à jour les stats locales
      if (onStatsUpdate) {
        onStatsUpdate(activeRide.estimatedEarnings);
      }

      toast.success(`💰 Course terminée ! +${fc(activeRide.estimatedEarnings)}`);

      setActiveRide(null);
      setNavigationActive(false);

      console.log('✅ Course finalisée avec succès');
    } catch (error) {
      console.error('Error completing ride:', error);
      toast.error('Erreur lors de la finalisation de la course');
    }
  }, [activeRide, driverId, onStatsUpdate]);

  // S'abonner aux mises à jour de la course active
  useEffect(() => {
    if (!activeRide) return;

    const unsubscribe = TaxiMotoService.subscribeToRide(activeRide.id, (updatedRide) => {
      console.log('📍 Mise à jour course:', updatedRide);

      if (updatedRide.status === 'cancelled' || updatedRide.status === 'completed') {
        setActiveRide(null);
        setNavigationActive(false);
        if (updatedRide.status === 'cancelled') {
          toast.error('❌ La course a été annulée');
        }
      }
    });

    return unsubscribe;
  }, [activeRide]);

  return {
    activeRide,
    setActiveRide,
    navigationActive,
    setNavigationActive,
    loadActiveRide,
    updateRideStatus,
    cancelActiveRide,
    completeRide
  };
}

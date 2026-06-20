import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TaxiMotoService } from '@/services/taxi/TaxiMotoService';

export interface DriverStats {
  todayEarnings: number;
  todayRides: number;
  rating: number;
  totalRides: number;
  onlineTime: string;
  vehiclePlate?: string;
  giletNumber?: string;
  serialNumber?: string;
}

interface UseTaxiDriverStatsReturn {
  stats: DriverStats;
  rideHistory: any[];
  loadDriverStats: () => Promise<void>;
  loadRideHistory: () => Promise<void>;
  updateLocalStats: (earnings: number) => void;
}

export function useTaxiDriverStats(driverId: string | null): UseTaxiDriverStatsReturn {
  const [stats, setStats] = useState<DriverStats>({
    todayEarnings: 0,
    todayRides: 0,
    rating: 0,
    totalRides: 0,
    onlineTime: '0h 0m'
  });
  const [rideHistory, setRideHistory] = useState<any[]>([]);

  const loadDriverStats = useCallback(async () => {
    if (!driverId) return;

    try {
      // Charger le profil conducteur complet
      const { data: driverData } = await supabase
        .from('taxi_drivers')
        .select('rating, total_rides, total_earnings, is_online, last_seen, created_at, user_id, vehicle')
        .eq('id', driverId)
        .single();

      // Extraire les infos du véhicule depuis le JSON vehicle
      let vehiclePlate = '';
      let giletNumber = '';
      let serialNumber = '';

      if (driverData?.vehicle) {
        try {
          const vehicleData = typeof driverData.vehicle === 'string'
            ? JSON.parse(driverData.vehicle)
            : driverData.vehicle;
          vehiclePlate = vehicleData.vehicle_plate || '';
          giletNumber = vehicleData.gilet_number || '';
          serialNumber = vehicleData.moto_serial_number || '';
        } catch (e) {
          console.warn('⚠️ Erreur parsing vehicle JSON:', e);
        }
      }

      // Charger toutes les courses du conducteur
      const rides = await TaxiMotoService.getDriverRides(driverId, 100);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayRides = rides.filter((r: any) => {
        const rideDate = new Date(r.requested_at || r.updated_at);
        return rideDate >= today && r.status === 'completed';
      });

      // Calculer les gains du jour depuis driver_share
      const todayEarnings = todayRides.reduce((sum, r) => {
        return sum + (r.driver_share || 0);
      }, 0);

      // Calculer le temps en ligne aujourd'hui
      let onlineMinutes = 0;
      todayRides.forEach(ride => {
        if (ride.completed_at && ride.accepted_at) {
          const start = new Date(ride.accepted_at);
          const end = new Date(ride.completed_at);
          onlineMinutes += Math.floor((end.getTime() - start.getTime()) / 60000);
        }
      });

      const hours = Math.floor(onlineMinutes / 60);
      const mins = onlineMinutes % 60;

      setStats({
        todayEarnings: Math.round(todayEarnings),
        todayRides: todayRides.length,
        rating: Number(driverData?.rating) || 5.0,
        totalRides: driverData?.total_rides || 0,
        onlineTime: `${hours}h ${mins}m`,
        vehiclePlate,
        giletNumber,
        serialNumber
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Erreur de chargement des statistiques');
    }
  }, [driverId]);

  const loadRideHistory = useCallback(async () => {
    if (!driverId) return;

    try {
      const rides = await TaxiMotoService.getDriverRides(driverId, 50);
      const completedRides = rides.filter(r => r.status === 'completed');
      setRideHistory(completedRides);
      console.log(`✅ Historique chargé: ${completedRides.length} courses`);
    } catch (error) {
      console.error('Error loading ride history:', error);
    }
  }, [driverId]);

  const updateLocalStats = useCallback((earnings: number) => {
    setStats(prev => ({
      ...prev,
      todayEarnings: prev.todayEarnings + earnings,
      todayRides: prev.todayRides + 1,
      totalRides: prev.totalRides + 1
    }));
  }, []);

  // Charger les stats et l'historique au montage
  useEffect(() => {
    if (driverId) {
      loadDriverStats();
      loadRideHistory();

      // Recharger les stats toutes les 30 secondes
      const statsInterval = setInterval(() => {
        loadDriverStats();
      }, 30000);

      // S'abonner aux changements de courses pour rafraîchir immédiatement
      const channel = supabase
        .channel('driver-stats-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'taxi_trips',
            filter: `driver_id=eq.${driverId}`
          },
          () => {
            console.log('📊 Course updated, refreshing data...');
            loadDriverStats();
            loadRideHistory();
          }
        )
        .subscribe();

      return () => {
        clearInterval(statsInterval);
        supabase.removeChannel(channel);
      };
    }
  }, [driverId, loadDriverStats, loadRideHistory]);

  return {
    stats,
    rideHistory,
    loadDriverStats,
    loadRideHistory,
    updateLocalStats
  };
}

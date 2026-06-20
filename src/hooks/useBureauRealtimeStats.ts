/**
 * Hook pour les statistiques temps réel du bureau/syndicat
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { bureauFetch } from '@/lib/bureauApi';

export interface RealtimeStats {
  total_drivers: number;
  online_drivers: number;
  on_trip_drivers: number;
  today_rides: number;
  today_earnings: number;
  active_sos: number;
}

export interface OnlineDriver {
  id: string;
  user_id: string;
  status: string;
  is_online: boolean;
  last_lat: number | null;
  last_lng: number | null;
  vehicle_plate: string | null;
  vehicle_type: string | null;
  rating: number | null;
}

export interface RecentActivity {
  id: string;
  type: 'trip' | 'sos' | 'driver_online' | 'driver_offline';
  message: string;
  timestamp: string;
  driver_name?: string;
}

export function useBureauRealtimeStats(bureauId: string | null) {
  const [stats, setStats] = useState<RealtimeStats>({
    total_drivers: 0,
    online_drivers: 0,
    on_trip_drivers: 0,
    today_rides: 0,
    today_earnings: 0,
    active_sos: 0
  });
  const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!bureauId) return;

    try {
      // Stats via le BACKEND (JWT bureau) — le bureau_id vient du token, jamais du client.
      const res = await bureauFetch<any>('/api/v2/bureau/stats');
      const s = res.success ? (res as any).stats : null;
      if (s) {
        setStats({
          total_drivers: Number(s.total_drivers) || 0,
          online_drivers: Number(s.online_drivers) || 0,
          on_trip_drivers: Number(s.on_trip_drivers) || 0,
          today_rides: Number(s.today_rides) || 0,
          today_earnings: Number(s.today_earnings) || 0,
          active_sos: Number(s.active_sos) || 0
        });
      }

      // Fetch online drivers
      const { data: driversData, error: driversError } = await supabase
        .from('taxi_drivers')
        .select('id, user_id, status, is_online, last_lat, last_lng, vehicle_plate, vehicle_type, rating')
        .eq('bureau_id', bureauId)
        .eq('is_online', true)
        .order('created_at', { ascending: false });

      if (driversError) throw driversError;
      setOnlineDrivers(driversData || []);

      // Fetch recent trips for activity
      const { data: tripsData } = await supabase
        .from('taxi_trips')
        .select(`
          id,
          status,
          requested_at,
          driver_id,
          taxi_drivers!inner(full_name, bureau_id)
        `)
        .eq('taxi_drivers.bureau_id', bureauId)
        .order('requested_at', { ascending: false })
        .limit(10);

      const activities: RecentActivity[] = (tripsData || []).map(trip => ({
        id: trip.id,
        type: 'trip' as const,
        message: `Course ${trip.status === 'completed' ? 'terminée' : trip.status === 'in_progress' ? 'en cours' : 'demandée'}`,
        timestamp: trip.requested_at,
        driver_name: (trip.taxi_drivers as any)?.full_name
      }));

      setRecentActivity(activities);
      setError(null);
    } catch (err) {
      console.error('Error fetching realtime stats:', err);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [bureauId]);

  useEffect(() => {
    fetchStats();

    if (!bureauId) return;

    // Subscribe to real-time changes
    const driversChannel = supabase
      .channel('bureau-drivers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'taxi_drivers',
          filter: `bureau_id=eq.${bureauId}`
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    const tripsChannel = supabase
      .channel('bureau-trips-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'taxi_trips'
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    const sosChannel = supabase
      .channel('bureau-sos-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sos_alerts'
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    // Refresh every 30 seconds as backup
    const interval = setInterval(fetchStats, 30000);

    return () => {
      supabase.removeChannel(driversChannel);
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(sosChannel);
      clearInterval(interval);
    };
  }, [bureauId, fetchStats]);

  return {
    stats,
    onlineDrivers,
    recentActivity,
    loading,
    error,
    refresh: fetchStats
  };
}

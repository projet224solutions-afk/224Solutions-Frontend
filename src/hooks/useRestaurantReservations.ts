/**
 * Hook: Gestion des réservations restaurant
 * Système professionnel inspiré des grands restaurants (OpenTable, TheFork, Michelin)
 * Gère les créneaux, disponibilités, confirmations et rappels
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RestaurantReservation {
  id: string;
  professional_service_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  table_number: string | null;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  special_requests: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  tables_available: number;
}

export interface ReservationFormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  special_requests?: string;
}

export function useRestaurantReservations(serviceId: string) {
  const [reservations, setReservations] = useState<RestaurantReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les réservations
  const loadReservations = useCallback(async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('restaurant_reservations')
        .select('*')
        .eq('professional_service_id', serviceId)
        .order('reservation_date', { ascending: true })
        .order('reservation_time', { ascending: true });

      if (fetchError) throw fetchError;
      setReservations((data as RestaurantReservation[]) || []);

    } catch (err: any) {
      console.error('Erreur chargement réservations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  // Créer une nouvelle réservation
  const createReservation = async (data: ReservationFormData): Promise<RestaurantReservation | null> => {
    try {
      const { data: newReservation, error } = await supabase
        .from('restaurant_reservations')
        .insert([{
          professional_service_id: serviceId,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone || null,
          customer_email: data.customer_email || null,
          party_size: data.party_size,
          reservation_date: data.reservation_date,
          reservation_time: data.reservation_time,
          special_requests: data.special_requests || null,
          status: 'confirmed', // Auto-confirmé pour les réservations en ligne
        }])
        .select()
        .single();

      if (error) throw error;

      setReservations(prev => [...prev, newReservation as RestaurantReservation]);
      return newReservation as RestaurantReservation;

    } catch (err: any) {
      console.error('Erreur création réservation:', err);
      throw err;
    }
  };

  // Mettre à jour le statut
  const updateReservationStatus = async (
    id: string,
    status: RestaurantReservation['status']
  ) => {
    const { data: updated, error } = await supabase
      .from('restaurant_reservations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    setReservations(prev =>
      prev.map(r => r.id === id ? updated as RestaurantReservation : r)
    );
    return updated;
  };

  // Annuler une réservation
  const cancelReservation = async (id: string) => {
    return updateReservationStatus(id, 'cancelled');
  };

  // Vérifier la disponibilité pour une date et un créneau
  const checkAvailability = async (
    date: string,
    partySize: number
  ): Promise<TimeSlot[]> => {
    // Créneaux standards (repli si le restaurant n'a pas défini d'horaires).
    const standardSlots = [
      '12:00', '12:30', '13:00', '13:30', '14:00',
      '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
    ];

    // Génère des créneaux de 30 min entre l'ouverture et la fermeture, en s'arrêtant 1 h avant
    // la fermeture (dernier service). Gère les horaires passant minuit (ex. 19:00 → 02:00).
    const slotsFromHours = (open: string, close: string): string[] => {
      const toMin = (s: string) => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
      const start = toMin(open);
      let end = toMin(close);
      if (end <= start) end += 24 * 60; // fermeture après minuit
      const out: string[] = [];
      for (let mins = start; mins <= end - 60; mins += 30) {
        const h = Math.floor((mins % (24 * 60)) / 60);
        const m = mins % 60;
        out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
      return out;
    };

    try {
      // Horaires d'ouverture du restaurant pour le JOUR de la date demandée.
      const { data: svc } = await supabase
        .from('professional_services')
        .select('opening_hours')
        .eq('id', serviceId)
        .single();
      const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayKey = dayKeys[new Date(`${date}T00:00:00`).getDay()];
      const hours = (svc?.opening_hours as any)?.[dayKey];
      // Fermé ce jour-là → aucun créneau réservable.
      if (hours && hours.closed === true) return [];
      const slots = (hours && hours.open && hours.close)
        ? slotsFromHours(hours.open, hours.close)
        : standardSlots;

      // Récupérer les réservations existantes pour cette date
      const { data: existingReservations } = await supabase
        .from('restaurant_reservations')
        .select('reservation_time, party_size')
        .eq('professional_service_id', serviceId)
        .eq('reservation_date', date)
        .in('status', ['confirmed', 'pending', 'seated']);

      // Récupérer les tables disponibles
      const { data: tables } = await supabase
        .from('restaurant_tables')
        .select('capacity')
        .eq('professional_service_id', serviceId)
        .eq('is_active', true);

      const totalCapacity = tables?.reduce((sum, t) => sum + t.capacity, 0) || 50;
      const reservationsPerSlot: Record<string, number> = {};

      existingReservations?.forEach(r => {
        const time = r.reservation_time.substring(0, 5);
        reservationsPerSlot[time] = (reservationsPerSlot[time] || 0) + r.party_size;
      });

      // Calculer la disponibilité pour chaque créneau (issus des horaires réels)
      return slots.map(time => {
        const bookedCapacity = reservationsPerSlot[time] || 0;
        const remainingCapacity = totalCapacity - bookedCapacity;
        const available = remainingCapacity >= partySize;

        return {
          time,
          available,
          tables_available: Math.floor(remainingCapacity / 2), // Estimation
        };
      });

    } catch (err) {
      console.error('Erreur vérification disponibilité:', err);
      return standardSlots.map(time => ({ time, available: true, tables_available: 5 }));
    }
  };

  // Obtenir les réservations du jour
  const getTodayReservations = () => {
    const today = new Date().toISOString().split('T')[0];
    return reservations.filter(r => r.reservation_date === today);
  };

  // Obtenir les réservations à venir
  const getUpcomingReservations = () => {
    const now = new Date();
    return reservations.filter(r => {
      const reservationDateTime = new Date(`${r.reservation_date}T${r.reservation_time}`);
      return reservationDateTime > now && !['cancelled', 'no_show', 'completed'].includes(r.status);
    });
  };

  // Statistiques
  const getReservationStats = () => {
    const _today = new Date().toISOString().split('T')[0];
    const todayReservations = getTodayReservations();

    return {
      total: reservations.length,
      today: todayReservations.length,
      todayGuests: todayReservations.reduce((sum, r) => sum + r.party_size, 0),
      pending: reservations.filter(r => r.status === 'pending').length,
      confirmed: reservations.filter(r => r.status === 'confirmed').length,
      seated: reservations.filter(r => r.status === 'seated').length,
      completed: reservations.filter(r => r.status === 'completed').length,
      cancelled: reservations.filter(r => r.status === 'cancelled').length,
      noShow: reservations.filter(r => r.status === 'no_show').length,
    };
  };

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  return {
    reservations,
    loading,
    error,
    refresh: loadReservations,
    createReservation,
    updateReservationStatus,
    cancelReservation,
    checkAvailability,
    getTodayReservations,
    getUpcomingReservations,
    getReservationStats,
  };
}

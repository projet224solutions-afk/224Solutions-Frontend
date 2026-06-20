/**
 * Hook: Gestion des tables restaurant
 * Plan de salle et statuts en temps réel
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RestaurantTable {
  id: string;
  professional_service_id: string;
  table_number: string;
  capacity: number;
  location: string | null;
  shape: string;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  current_order_id: string | null;
  position_x: number;
  position_y: number;
  is_active: boolean;
  qr_code_url: string | null;
  created_at: string;
}

export function useRestaurantTables(serviceId: string) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('professional_service_id', serviceId)
        .eq('is_active', true)
        .order('table_number', { ascending: true });

      if (fetchError) throw fetchError;
      setTables((data as RestaurantTable[]) || []);

    } catch (err: any) {
      console.error('Erreur chargement tables:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  const createTable = async (data: { table_number: string } & Partial<Omit<RestaurantTable, 'table_number'>>) => {
    const { data: newTable, error } = await supabase
      .from('restaurant_tables')
      .insert([{
        table_number: data.table_number,
        capacity: data.capacity ?? 4,
        location: data.location,
        shape: data.shape ?? 'rectangle',
        status: data.status ?? 'available',
        position_x: data.position_x ?? 0,
        position_y: data.position_y ?? 0,
        is_active: data.is_active ?? true,
        professional_service_id: serviceId
      }])
      .select()
      .single();

    if (error) throw error;
    setTables(prev => [...prev, newTable as RestaurantTable]);
    return newTable;
  };

  const updateTable = async (id: string, data: Partial<RestaurantTable>) => {
    const { data: updated, error } = await supabase
      .from('restaurant_tables')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setTables(prev => prev.map(t => t.id === id ? updated as RestaurantTable : t));
    return updated;
  };

  const updateTableStatus = async (id: string, status: RestaurantTable['status']) => {
    return updateTable(id, { status });
  };

  const deleteTable = async (id: string) => {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    setTables(prev => prev.filter(t => t.id !== id));
  };

  const getTableStats = () => {
    return {
      total: tables.length,
      available: tables.filter(t => t.status === 'available').length,
      occupied: tables.filter(t => t.status === 'occupied').length,
      reserved: tables.filter(t => t.status === 'reserved').length,
      cleaning: tables.filter(t => t.status === 'cleaning').length,
      totalCapacity: tables.reduce((sum, t) => sum + t.capacity, 0),
      occupiedCapacity: tables
        .filter(t => t.status === 'occupied')
        .reduce((sum, t) => sum + t.capacity, 0),
    };
  };

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  return {
    tables,
    loading,
    error,
    refresh: loadTables,
    createTable,
    updateTable,
    updateTableStatus,
    deleteTable,
    getTableStats,
  };
}

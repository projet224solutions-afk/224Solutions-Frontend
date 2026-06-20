/**
 * SERVICE DRIVER - 224SOLUTIONS
 * API complète pour gérer toutes les fonctionnalités du livreur
 */

import { supabase } from '@/integrations/supabase/client';

export interface DriverData {
  id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  status: 'offline' | 'online' | 'on_delivery' | 'paused';
  rating: number;
  earnings_total: number;
  commission_rate: number;
  last_location?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  total_deliveries: number;
  is_verified: boolean;
  is_online: boolean;
}

export class DriverService {
  /**
   * Passer le livreur en ligne (disponible pour missions)
   */
  static async goOnline(driverId: string, location: { lat: number; lng: number }): Promise<void> {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          status: 'online',
          is_online: true,
          last_location: `POINT(${location.lng} ${location.lat})`,
        })
        .eq('id', driverId);

      if (error) throw error;
      console.log('[DriverService] Driver is now ONLINE');
    } catch (error) {
      console.error('[DriverService] Error going online:', error);
      throw error;
    }
  }

  /**
   * Passer le livreur hors ligne
   */
  static async goOffline(driverId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          status: 'offline',
          is_online: false,
        })
        .eq('id', driverId);

      if (error) throw error;
      console.log('[DriverService] Driver is now OFFLINE');
    } catch (error) {
      console.error('[DriverService] Error going offline:', error);
      throw error;
    }
  }

  /**
   * Mettre en pause (pause repas, pause technique, etc.)
   */
  static async pause(driverId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'paused' })
        .eq('id', driverId);

      if (error) throw error;
    } catch (error) {
      console.error('[DriverService] Error pausing:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour la position GPS en temps réel
   */
  static async updateLocation(driverId: string, coords: { lat: number; lng: number }): Promise<void> {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          last_location: `POINT(${coords.lng} ${coords.lat})`,
        })
        .eq('id', driverId);

      if (error) throw error;
    } catch (error) {
      // Ne pas bloquer l'app si le tracking échoue
      console.error('[DriverService] Error updating location:', error);
    }
  }

  /**
   * Accepter une livraison
   */
  static async acceptDelivery(driverId: string, deliveryId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          status: 'picked_up',
          driver_id: driverId,
          accepted_at: new Date().toISOString(),
          start_time: new Date().toISOString(),
        })
        .eq('id', deliveryId);

      if (error) throw error;

      // Mettre à jour le statut du driver
      await supabase
        .from('drivers')
        .update({ status: 'on_delivery' })
        .eq('id', driverId);

      console.log('[DriverService] Delivery accepted');
    } catch (error) {
      console.error('[DriverService] Error accepting delivery:', error);
      throw error;
    }
  }

  /**
   * Terminer une livraison avec photo et signature
   */
  static async completeDelivery(
    deliveryId: string,
    photoUrl?: string,
    signature?: string
  ): Promise<void> {
    try {
      const { data: delivery, error: fetchError } = await supabase
        .from('deliveries')
        .select('driver_id, driver_earning, delivery_fee')
        .eq('id', deliveryId)
        .single();

      if (fetchError) throw fetchError;

      // Marquer la livraison comme terminée
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          end_time: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          proof_photo_url: photoUrl || null,
          client_signature: signature || null,
        })
        .eq('id', deliveryId);

      if (updateError) throw updateError;

      // Mettre à jour les gains totaux du driver
      if (delivery?.driver_id && delivery?.driver_earning) {
        // Récupérer les gains actuels
        const { data: currentDriver } = await supabase
          .from('drivers')
          .select('earnings_total, total_deliveries')
          .eq('id', delivery.driver_id)
          .single();

        // Calculer les nouveaux totaux
        const newEarnings = (currentDriver?.earnings_total || 0) + delivery.driver_earning;
        const newTotal = (currentDriver?.total_deliveries || 0) + 1;

        // Mettre à jour
        await supabase
          .from('drivers')
          .update({
            earnings_total: newEarnings,
            total_deliveries: newTotal,
            status: 'online',
          })
          .eq('id', delivery.driver_id);
      }

      console.log('[DriverService] Delivery completed successfully');
    } catch (error) {
      console.error('[DriverService] Error completing delivery:', error);
      throw error;
    }
  }

  /**
   * Récupérer le profil complet du driver
   */
  static async getDriverProfile(driverId: string): Promise<DriverData | null> {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', driverId)
        .single();

      if (error) throw error;
      return data as DriverData;
    } catch (error) {
      console.error('[DriverService] Error fetching driver profile:', error);
      return null;
    }
  }

  /**
   * Récupérer le profil du driver par user_id
   */
  static async getDriverByUserId(userId: string): Promise<DriverData | null> {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data as DriverData;
    } catch (error) {
      console.error('[DriverService] Error fetching driver by user ID:', error);
      return null;
    }
  }

  /**
   * S'abonner aux changements du profil driver (temps réel)
   */
  static subscribeToDriver(driverId: string, callback: (driver: DriverData) => void) {
    const channel = supabase
      .channel(`driver:${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drivers',
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          console.log('[DriverService] Driver profile updated:', payload);
          callback(payload.new as DriverData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Uploader une photo de preuve de livraison
   */
  static async uploadProofPhoto(deliveryId: string, file: File): Promise<string> {
    try {
      const fileName = `delivery-${deliveryId}-${Date.now()}.${file.name.split('.').pop()}`;
      const filePath = `delivery-proofs/${fileName}`;

      const { data, error } = await supabase.storage
        .from('deliveries')
        .upload(filePath, file);

      if (error) throw error;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('deliveries')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('[DriverService] Error uploading proof photo:', error);
      throw error;
    }
  }

  /**
   * Calculer les statistiques du driver
   */
  static async getDriverStats(driverId: string): Promise<{
    todayEarnings: number;
    todayDeliveries: number;
    weekEarnings: number;
    weekDeliveries: number;
    monthEarnings: number;
    monthDeliveries: number;
  }> {
    try {
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const weekStart = new Date(now.setDate(now.getDate() - 7)).toISOString();
      const monthStart = new Date(now.setDate(now.getDate() - 30)).toISOString();

      // Livraisons aujourd'hui
      const { data: todayData } = await supabase
        .from('deliveries')
        .select('driver_earning')
        .eq('driver_id', driverId)
        .eq('status', 'delivered')
        .gte('completed_at', todayStart);

      // Livraisons cette semaine
      const { data: weekData } = await supabase
        .from('deliveries')
        .select('driver_earning')
        .eq('driver_id', driverId)
        .eq('status', 'delivered')
        .gte('completed_at', weekStart);

      // Livraisons ce mois
      const { data: monthData } = await supabase
        .from('deliveries')
        .select('driver_earning')
        .eq('driver_id', driverId)
        .eq('status', 'delivered')
        .gte('completed_at', monthStart);

      return {
        todayEarnings: todayData?.reduce((sum, d) => sum + (d.driver_earning || 0), 0) || 0,
        todayDeliveries: todayData?.length || 0,
        weekEarnings: weekData?.reduce((sum, d) => sum + (d.driver_earning || 0), 0) || 0,
        weekDeliveries: weekData?.length || 0,
        monthEarnings: monthData?.reduce((sum, d) => sum + (d.driver_earning || 0), 0) || 0,
        monthDeliveries: monthData?.length || 0,
      };
    } catch (error) {
      console.error('[DriverService] Error fetching driver stats:', error);
      return {
        todayEarnings: 0,
        todayDeliveries: 0,
        weekEarnings: 0,
        weekDeliveries: 0,
        monthEarnings: 0,
        monthDeliveries: 0,
      };
    }
  }
}

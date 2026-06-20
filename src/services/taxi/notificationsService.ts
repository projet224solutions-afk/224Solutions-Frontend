/**
 * SERVICE TAXI-MOTO: Notifications temps réel
 * Gère les notifications push et temps réel pour conducteurs et clients
 */

import { supabase } from "@/integrations/supabase/client";

export interface TaxiNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: any;
  is_read: boolean;
  ride_id?: string;
  created_at: string;
  read_at?: string;
}

export class NotificationsService {
  /**
   * Récupère les notifications non lues
   */
  static async getUnreadNotifications(userId: string): Promise<TaxiNotification[]> {
    const { data, error } = await supabase
      .from('taxi_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[NotificationsService] Error fetching notifications:', error);
      return [];
    }

    return (data || []) as unknown as TaxiNotification[];
  }

  /**
   * Marque une notification comme lue
   */
  static async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('taxi_notifications')
      .update({
        payload: { is_read: true, read_at: new Date().toISOString() } as any
      })
      .eq('id', notificationId);

    if (error) {
      console.error('[NotificationsService] Error marking as read:', error);
    }
  }

  /**
   * Marque toutes les notifications comme lues
   */
  static async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('taxi_notifications')
      .update({
        payload: { is_read: true, read_at: new Date().toISOString() } as any
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[NotificationsService] Error marking all as read:', error);
    }
  }

  /**
   * Subscribe to realtime notifications
   */
  static subscribeToNotifications(
    userId: string,
    onNotification: (notification: TaxiNotification) => void
  ) {
    console.log('[NotificationsService] Subscribing to notifications', { userId });

    const channel = supabase
      .channel(`taxi-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'taxi_notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[NotificationsService] New notification received', payload);
          onNotification(payload.new as TaxiNotification);
        }
      )
      .subscribe();

    return () => {
      console.log('[NotificationsService] Unsubscribing');
      supabase.removeChannel(channel);
    };
  }

  /**
   * Envoie une notification (via edge function pour être sûr que les policies passent)
   */
  static async sendNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: any,
    rideId?: string
  ) {
    const { error } = await supabase.rpc('create_taxi_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: body,
      p_data: (data || {}) as any,
      p_ride_id: rideId
    });

    if (error) {
      console.error('[NotificationsService] Error sending notification:', error);
    }
  }

  /**
   * Récupère les notifications pour une course spécifique
   */
  static async getRideNotifications(_rideId: string): Promise<TaxiNotification[]> {
    const { data, error } = await supabase
      .from('taxi_notifications')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[NotificationsService] Error fetching ride notifications:', error);
      return [];
    }

    return (data || []) as unknown as TaxiNotification[];
  }
}
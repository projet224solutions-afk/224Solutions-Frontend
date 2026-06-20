import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface VendorNotification {
  id: string;
  type: 'order' | 'payment' | 'message' | 'security' | 'stock';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
}

export const useVendorNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped: VendorNotification[] = (data || []).map((n: any) => ({
        id: n.id,
        type: (n.type || 'message') as VendorNotification['type'],
        title: n.title || 'Notification',
        message: n.message || '',
        data: n.metadata,
        read: n.read ?? false,
        created_at: n.created_at,
      }));

      setNotifications(mapped);
      setUnreadCount(mapped.filter((n) => !n.read).length);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erreur marquage notification:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('Toutes les notifications marquées comme lues');
    } catch (error) {
      console.error('Erreur marquage toutes notifications:', error);
    }
  };

  // Source unifiée: synchroniser en temps réel avec la table `notifications`
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadNotifications();

    const channel = supabase
      .channel(`vendor-notifications-unified:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as any;
            toast.info(newNotification.title || 'Notification', {
              description: newNotification.message || ''
            });
          }
          // Toujours recharger pour garder un état cohérent (insert/update/delete)
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    reload: loadNotifications
  };
};

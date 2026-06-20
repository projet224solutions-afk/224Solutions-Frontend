/**
 * HOOK: useUserNotifications
 * Source of truth: `notifications` table
 * Handles: load, realtime INSERT/UPDATE/DELETE, mark read, delete
 * Used by: Notifications page + any component needing notification data
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface UserNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export const useUserNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) {
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

      const mapped: UserNotification[] = (data || []).map((n: any) => ({
        id: n.id,
        type: n.type || 'system',
        title: n.title || 'Notification',
        message: n.message || '',
        read: n.read ?? false,
        created_at: n.created_at,
        metadata: n.metadata,
      }));

      setNotifications(mapped);
      setUnreadCount(mapped.filter(n => !n.read).length);
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

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => {
        const target = prev.find(n => n.id === notificationId);
        if (target && !target.read) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n.id !== notificationId);
      });
      toast.success('Notification supprimée');
    } catch (error) {
      console.error('Erreur suppression notification:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    if (!user) return;

    loadNotifications();

    // Listen to ALL events (INSERT, UPDATE, DELETE) for full sync
    const channel = supabase
      .channel(`user-notifications-page:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const n = payload.new as any;
          const mapped: UserNotification = {
            id: n.id,
            type: n.type || 'system',
            title: n.title || 'Notification',
            message: n.message || '',
            read: n.read ?? false,
            created_at: n.created_at,
            metadata: n.metadata,
          };
          setNotifications(prev => {
            // Deduplicate: don't add if already present
            if (prev.some(existing => existing.id === mapped.id)) return prev;
            return [mapped, ...prev];
          });
          if (!mapped.read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updated = payload.new as any;
          setNotifications(prev => {
            const newList = prev.map(n =>
              n.id === updated.id
                ? { ...n, read: updated.read ?? n.read, title: updated.title || n.title, message: updated.message || n.message }
                : n
            );
            setUnreadCount(newList.filter(n => !n.read).length);
            return newList;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) return;
          setNotifications(prev => {
            const newList = prev.filter(n => n.id !== deletedId);
            setUnreadCount(newList.filter(n => !n.read).length);
            return newList;
          });
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
    deleteNotification,
    reload: loadNotifications
  };
};
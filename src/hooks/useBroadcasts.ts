/**
 * HOOK - SYSTÈME DE RÉCEPTION DES BROADCASTS
 * Gère la réception et l'affichage des messages de diffusion
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export interface Broadcast {
  broadcast_id: string;
  title: string;
  content: string;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  priority: 'normal' | 'high' | 'urgent';
  message_type: string;
  sender_name: string;
  sent_at: string;
  read_at: string | null;
  is_read: boolean;
}

export interface BroadcastStats {
  total: number;
  unread: number;
  urgent: number;
}

export function useBroadcasts() {
  const { user, profile } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [stats, setStats] = useState<BroadcastStats>({ total: 0, unread: 0, urgent: 0 });
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Charger les broadcasts
  const loadBroadcasts = useCallback(async (unreadOnly = false) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_broadcasts', {
        p_user_id: user.id,
        p_unread_only: unreadOnly,
        p_limit: 50
      });

      if (error) throw error;

      const broadcastList = (data || []) as Broadcast[];
      setBroadcasts(broadcastList);

      // Calculer les stats
      const unreadCount = broadcastList.filter(b => !b.is_read).length;
      const urgentCount = broadcastList.filter(b => b.priority === 'urgent' && !b.is_read).length;

      setStats({
        total: broadcastList.length,
        unread: unreadCount,
        urgent: urgentCount
      });

    } catch (error: any) {
      console.error('Erreur chargement broadcasts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Marquer comme lu
  const markAsRead = useCallback(async (broadcastId: string) => {
    if (!user?.id) return false;

    try {
      const { data, error } = await supabase.rpc('mark_broadcast_read', {
        p_broadcast_id: broadcastId
      });

      if (error) throw error;

      // Mettre à jour localement
      setBroadcasts(prev =>
        prev.map(b =>
          b.broadcast_id === broadcastId
            ? { ...b, is_read: true, read_at: new Date().toISOString() }
            : b
        )
      );

      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        urgent: broadcasts.find(b => b.broadcast_id === broadcastId)?.priority === 'urgent'
          ? Math.max(0, prev.urgent - 1)
          : prev.urgent
      }));

      return true;
    } catch (error: any) {
      console.error('Erreur mark as read:', error);
      return false;
    }
  }, [user?.id, broadcasts]);

  // Marquer tous comme lus
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const unreadIds = broadcasts.filter(b => !b.is_read).map(b => b.broadcast_id);

      for (const id of unreadIds) {
        await supabase.rpc('mark_broadcast_read', { p_broadcast_id: id });
      }

      setBroadcasts(prev =>
        prev.map(b => ({ ...b, is_read: true, read_at: new Date().toISOString() }))
      );

      setStats(prev => ({ ...prev, unread: 0, urgent: 0 }));

      toast.success('Tous les messages marqués comme lus');
    } catch (error: any) {
      console.error('Erreur mark all as read:', error);
      toast.error('Erreur lors du marquage');
    }
  }, [user?.id, broadcasts]);

  // S'abonner aux nouveaux broadcasts en temps réel
  useEffect(() => {
    if (!user?.id) return;

    // Charger les données initiales
    loadBroadcasts();

    // Souscrire aux changements en temps réel
    const channel = supabase
      .channel(`broadcasts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'broadcast_recipients',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('📢 Nouveau broadcast reçu:', payload);

          // Recharger les broadcasts
          await loadBroadcasts();

          // Récupérer les détails du broadcast
          const { data: broadcastData } = await supabase
            .from('broadcast_messages')
            .select('title, priority, message_type')
            .eq('id', payload.new.broadcast_id)
            .single();

          if (broadcastData) {
            // Afficher une notification toast
            const toastOptions = {
              duration: broadcastData.priority === 'urgent' ? 10000 : 5000,
            };

            if (broadcastData.priority === 'urgent') {
              toast.error(`🚨 ${broadcastData.title}`, {
                ...toastOptions,
                description: 'Message urgent - Cliquez pour voir',
              });
            } else if (broadcastData.priority === 'high') {
              toast.warning(`📢 ${broadcastData.title}`, {
                ...toastOptions,
                description: 'Nouveau message important',
              });
            } else {
              toast.info(`📬 ${broadcastData.title}`, {
                ...toastOptions,
                description: 'Nouveau message',
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Broadcast subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadBroadcasts]);

  // Obtenir le dernier broadcast non lu urgent
  const getUrgentBroadcast = useCallback(() => {
    return broadcasts.find(b => b.priority === 'urgent' && !b.is_read);
  }, [broadcasts]);

  // Obtenir les broadcasts non lus
  const getUnreadBroadcasts = useCallback(() => {
    return broadcasts.filter(b => !b.is_read);
  }, [broadcasts]);

  return {
    broadcasts,
    stats,
    loading,
    isConnected,
    loadBroadcasts,
    markAsRead,
    markAllAsRead,
    getUrgentBroadcast,
    getUnreadBroadcasts
  };
}

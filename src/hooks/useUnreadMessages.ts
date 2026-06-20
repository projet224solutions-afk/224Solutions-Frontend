/**
 * Hook pour gérer les messages non lus
 * Compte les messages non lus pour l'utilisateur connecté
 * en utilisant Supabase Realtime pour les mises à jour en temps réel
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UnreadMessagesState {
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useUnreadMessages(): UnreadMessagesState {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      // Compter les messages non lus où l'utilisateur est le destinataire
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null);

      if (error) {
        console.error('[useUnreadMessages] Erreur comptage:', error);
        setUnreadCount(0);
      } else {
        setUnreadCount(count || 0);
      }
    } catch (err) {
      console.error('[useUnreadMessages] Erreur inattendue:', err);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    fetchUnreadCount();

    // Écouter les changements messages en temps réel (un seul .on avec event '*')
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      const channelName = `unread-messages-badge-${user.id}-${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${user.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setUnreadCount(prev => prev + 1);
            } else if (payload.eventType === 'UPDATE') {
              const newRecord = payload.new as any;
              const oldRecord = payload.old as any;
              if (!oldRecord.read_at && newRecord.read_at) {
                fetchUnreadCount();
              }
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[useUnreadMessages] Realtime subscription failed:', err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    refresh: fetchUnreadCount
  };
}

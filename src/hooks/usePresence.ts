/**
 * Hook pour gérer la présence utilisateur en temps réel
 * Indicateur en ligne/hors ligne et "en train d'écrire"
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { UserPresence, TypingIndicator, PresenceStatus } from '@/types/communication.types';

interface UsePresenceOptions {
  /** Intervalle de heartbeat en ms (défaut: 30000 = 30s) */
  heartbeatInterval?: number;
  /** Délai avant de marquer comme away en ms (défaut: 300000 = 5min) */
  awayTimeout?: number;
}

interface UsePresenceReturn {
  /** Statut de présence de l'utilisateur actuel */
  myPresence: UserPresence | null;
  /** Mettre à jour son propre statut */
  updatePresence: (status: PresenceStatus, customStatus?: string) => Promise<void>;
  /** Obtenir la présence d'un utilisateur */
  getUserPresence: (userId: string) => Promise<UserPresence | null>;
  /** Obtenir les présences de plusieurs utilisateurs */
  getMultiplePresences: (userIds: string[]) => Promise<Map<string, UserPresence>>;
  /** S'abonner aux changements de présence d'un utilisateur */
  subscribeToPresence: (userId: string, callback: (presence: UserPresence) => void) => () => void;
  /** Indicateur de frappe */
  setTyping: (conversationId: string, isTyping: boolean) => Promise<void>;
  /** S'abonner aux indicateurs de frappe d'une conversation */
  subscribeToTyping: (conversationId: string, callback: (indicators: TypingIndicator[]) => void) => () => void;
  /** Liste des utilisateurs en train d'écrire dans la conversation active */
  typingUsers: TypingIndicator[];
  /** Vérifier si un utilisateur est en ligne */
  isUserOnline: (userId: string) => boolean;
  /** Cache des présences */
  presenceCache: Map<string, UserPresence>;
}

export function usePresence(options: UsePresenceOptions = {}): UsePresenceReturn {
  const { user } = useAuth();
  const {
    heartbeatInterval = 30000,
    awayTimeout = 300000,
  } = options;

  const [myPresence, setMyPresence] = useState<UserPresence | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [presenceCache, setPresenceCache] = useState<Map<string, UserPresence>>(new Map());

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const awayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const _channelRef = useRef<any>(null);

  // Détecter l'activité utilisateur
  const resetAwayTimeout = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (awayTimeoutRef.current) {
      clearTimeout(awayTimeoutRef.current);
    }

    // Si l'utilisateur était away, le remettre online
    if (myPresence?.status === 'away' && user?.id) {
      updatePresenceInternal('online');
    }

    awayTimeoutRef.current = setTimeout(() => {
      if (user?.id && myPresence?.status === 'online') {
        updatePresenceInternal('away');
      }
    }, awayTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPresence?.status, user?.id, awayTimeout]);

  // Fonction interne pour mettre à jour la présence
  const updatePresenceInternal = useCallback(async (
    status: PresenceStatus,
    customStatus?: string
  ) => {
    if (!user?.id) return;

    try {
      const device = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'web';

      console.log('[Presence] 📡 Mise à jour présence:', { userId: user.id, status, device });

      // Utiliser la fonction RPC optimisée si disponible
      const { error: rpcError } = await (supabase.rpc as any)('update_user_presence', {
        p_user_id: user.id,
        p_status: status,
        p_device: device,
        p_custom_status: customStatus || null
      });

      if (rpcError) {
        console.log('[Presence] RPC non disponible, utilisation fallback');
        // Fallback vers upsert direct
        const { error } = await supabase
          .from('user_presence' as any)
          .upsert({
            user_id: user.id,
            status,
            current_device: device,
            custom_status: customStatus || null,
            last_seen: status === 'offline' ? new Date().toISOString() : undefined,
            last_active: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (error) {
          console.warn('[Presence] Error updating:', error);
          return;
        }
      }

      console.log('[Presence] ✅ Présence mise à jour:', status);

      setMyPresence(prev => ({
        ...prev!,
        user_id: user.id,
        status,
        current_device: device as any,
        custom_status: customStatus,
        last_active: new Date().toISOString(),
        is_online: status === 'online' || status === 'busy' || status === 'away',
      }));

    } catch (error) {
      console.warn('[Presence] Exception:', error);
    }
  }, [user?.id]);

  // Mettre à jour la présence (fonction publique)
  const updatePresence = useCallback(async (
    status: PresenceStatus,
    customStatus?: string
  ) => {
    await updatePresenceInternal(status, customStatus);
    resetAwayTimeout();
  }, [updatePresenceInternal, resetAwayTimeout]);

  // Obtenir la présence d'un utilisateur
  const getUserPresence = useCallback(async (userId: string): Promise<UserPresence | null> => {
    try {
      console.log('[Presence] 🔍 Récupération présence pour:', userId);

      const { data, error } = await supabase
        .from('user_presence' as any)
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn('[Presence] Erreur ou pas de données:', error.message);
        // Si la table n'existe pas ou pas de données, retourner offline
        return {
          user_id: userId,
          status: 'offline',
          last_seen: new Date().toISOString(),
          is_online: false,
        };
      }

      const row = data as any;
      console.log('[Presence] 📊 Données reçues:', row);

      const presence: UserPresence = {
        user_id: userId,
        status: row?.status || 'offline',
        last_seen: row?.last_seen || new Date().toISOString(),
        current_device: row?.current_device,
        custom_status: row?.custom_status,
        is_online: ['online', 'busy', 'away'].includes(row?.status),
      };

      console.log('[Presence] ✅ Présence récupérée:', presence.status, '- En ligne:', presence.is_online);

      // Mettre en cache
      setPresenceCache(prev => new Map(prev).set(userId, presence));

      return presence;
    } catch (error) {
      console.warn('[Presence] Error getting user presence:', error);
      return {
        user_id: userId,
        status: 'offline',
        last_seen: new Date().toISOString(),
        is_online: false,
      };
    }
  }, []);

  // Obtenir plusieurs présences
  const getMultiplePresences = useCallback(async (userIds: string[]): Promise<Map<string, UserPresence>> => {
    const result = new Map<string, UserPresence>();

    try {
      const { data, error } = await supabase
        .from('user_presence' as any)
        .select('*')
        .in('user_id', userIds);

      if (error) {
        console.warn('[Presence] Error getting multiple presences:', error);
        return result;
      }

      for (const row of (data || []) as any[]) {
        const presence: UserPresence = {
          user_id: row.user_id,
          status: row.status,
          last_seen: row.last_seen,
          last_active: row.last_active,
          current_device: row.current_device,
          custom_status: row.custom_status,
          is_typing_in: row.is_typing_in,
          is_online: ['online', 'busy', 'away'].includes(row.status),
        };
        result.set(row.user_id, presence);
      }

      // Mettre en cache
      setPresenceCache(prev => {
        const newCache = new Map(prev);
        result.forEach((presence, id) => newCache.set(id, presence));
        return newCache;
      });

    } catch (error) {
      console.warn('[Presence] Error getting multiple presences:', error);
    }

    return result;
  }, []);

  // S'abonner aux changements de présence
  const subscribeToPresence = useCallback((
    userId: string,
    callback: (presence: UserPresence) => void
  ): (() => void) => {
    const channel = supabase
      .channel(`presence:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row) {
            const presence: UserPresence = {
              user_id: row.user_id,
              status: row.status,
              last_seen: row.last_seen,
              last_active: row.last_active,
              current_device: row.current_device,
              custom_status: row.custom_status,
              is_typing_in: row.is_typing_in,
              is_online: ['online', 'busy', 'away'].includes(row.status),
            };

            setPresenceCache(prev => new Map(prev).set(userId, presence));
            callback(presence);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Indiquer que l'utilisateur tape
  const setTyping = useCallback(async (conversationId: string, isTyping: boolean) => {
    if (!user?.id) return;

    try {
      if (isTyping) {
        await supabase
          .from('typing_indicators' as any)
          .upsert({
            conversation_id: conversationId,
            user_id: user.id,
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10000).toISOString(),
          }, { onConflict: 'conversation_id,user_id' });
      } else {
        await supabase
          .from('typing_indicators' as any)
          .delete()
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.warn('[Presence] Error setting typing:', error);
    }
  }, [user?.id]);

  // S'abonner aux indicateurs de frappe
  const subscribeToTyping = useCallback((
    conversationId: string,
    callback: (indicators: TypingIndicator[]) => void
  ): (() => void) => {
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          // Récupérer tous les indicateurs actuels
          try {
            const { data } = await supabase
              .from('typing_indicators' as any)
              .select('*')
              .eq('conversation_id', conversationId)
              .gt('expires_at', new Date().toISOString());

            const indicators: TypingIndicator[] = ((data || []) as any[])
              .filter(row => row.user_id !== user?.id)
              .map(row => ({
                conversation_id: row.conversation_id,
                user_id: row.user_id,
                user_name: 'Utilisateur',
                started_at: row.started_at,
                expires_at: row.expires_at,
              }));

            setTypingUsers(indicators);
            callback(indicators);
          } catch (error) {
            console.warn('[Presence] Error fetching typing indicators:', error);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  // Vérifier si un utilisateur est en ligne
  const isUserOnline = useCallback((userId: string): boolean => {
    const presence = presenceCache.get(userId);
    return presence?.is_online ?? false;
  }, [presenceCache]);

  // Initialisation: configurer la présence et les listeners
  useEffect(() => {
    if (!user?.id) return;

    // Mettre en ligne
    updatePresenceInternal('online');

    // Heartbeat périodique
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresenceInternal(myPresence?.status || 'online');
      }
    }, heartbeatInterval);

    // Écouter les événements d'activité
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetAwayTimeout, { passive: true });
    });

    // Écouter la visibilité de la page
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresenceInternal('online');
        resetAwayTimeout();
      } else {
        updatePresenceInternal('away');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Écouter la fermeture de la page
    const handleBeforeUnload = () => {
      // Marquer comme offline
      updatePresenceInternal('offline');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (awayTimeoutRef.current) {
        clearTimeout(awayTimeoutRef.current);
      }

      activityEvents.forEach(event => {
        window.removeEventListener(event, resetAwayTimeout);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Marquer comme offline
      updatePresenceInternal('offline');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, heartbeatInterval, resetAwayTimeout, updatePresenceInternal]);

  return {
    myPresence,
    updatePresence,
    getUserPresence,
    getMultiplePresences,
    subscribeToPresence,
    setTyping,
    subscribeToTyping,
    typingUsers,
    isUserOnline,
    presenceCache,
  };
}

export default usePresence;

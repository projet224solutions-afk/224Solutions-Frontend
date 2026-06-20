/**
 * Hook pour gérer la présence en temps réel des conversations
 * Affiche les indicateurs en ligne/hors ligne pour chaque contact
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { PresenceStatus } from '@/types/communication.types';

export interface ContactPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: string | null;
  isOnline: boolean;
  device?: 'mobile' | 'web' | 'desktop';
}

interface UseConversationPresenceReturn {
  /** Map des présences par userId */
  presences: Map<string, ContactPresence>;
  /** Vérifier si un utilisateur est en ligne */
  isOnline: (userId: string) => boolean;
  /** Obtenir le statut d'un utilisateur */
  getStatus: (userId: string) => PresenceStatus;
  /** Obtenir la dernière connexion formatée */
  getLastSeenText: (userId: string) => string;
  /** Charger les présences pour une liste d'utilisateurs */
  loadPresences: (userIds: string[]) => Promise<void>;
  /** État de chargement */
  loading: boolean;
}

// Seuil pour considérer un utilisateur comme hors ligne (45 secondes)
const OFFLINE_THRESHOLD_MS = 45000;

export function useConversationPresence(): UseConversationPresenceReturn {
  const { user } = useAuth();
  const [presences, setPresences] = useState<Map<string, ContactPresence>>(new Map());
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const trackedUsersRef = useRef<Set<string>>(new Set());

  // Formater la dernière connexion
  const formatLastSeen = useCallback((dateStr: string | null): string => {
    if (!dateStr) return 'Inconnu';

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }, []);

  // Charger les présences depuis la base de données
  const loadPresences = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;

    setLoading(true);
    try {
      // Stocker les IDs qu'on suit
      userIds.forEach(id => trackedUsersRef.current.add(id));

      const { data, error } = await supabase
        .from('user_presence' as any)
        .select('user_id, status, last_seen, last_active, current_device')
        .in('user_id', userIds);

      if (error) {
        console.warn('[ConversationPresence] Erreur chargement:', error);
        // En cas d'erreur, marquer tous comme offline
        const offlinePresences = new Map<string, ContactPresence>();
        userIds.forEach(userId => {
          offlinePresences.set(userId, {
            userId,
            status: 'offline',
            lastSeen: null,
            isOnline: false,
          });
        });
        setPresences(prev => new Map([...prev, ...offlinePresences]));
        return;
      }

      const now = Date.now();
      const newPresences = new Map<string, ContactPresence>();

      // Traiter les données reçues
      for (const row of (data || []) as any[]) {
        const lastActive = row.last_active ? new Date(row.last_active).getTime() : 0;
        const timeSinceActive = now - lastActive;

        // Déterminer si vraiment en ligne (actif dans les 45 dernières secondes)
        const isReallyOnline = timeSinceActive < OFFLINE_THRESHOLD_MS &&
          ['online', 'away', 'busy'].includes(row.status);

        newPresences.set(row.user_id, {
          userId: row.user_id,
          status: isReallyOnline ? row.status : 'offline',
          lastSeen: row.last_seen || row.last_active,
          isOnline: isReallyOnline,
          device: row.current_device,
        });
      }

      // Ajouter les utilisateurs non trouvés comme offline
      userIds.forEach(userId => {
        if (!newPresences.has(userId)) {
          newPresences.set(userId, {
            userId,
            status: 'offline',
            lastSeen: null,
            isOnline: false,
          });
        }
      });

      setPresences(prev => new Map([...prev, ...newPresences]));
    } catch (err) {
      console.error('[ConversationPresence] Exception:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Vérifier si un utilisateur est en ligne
  const isOnline = useCallback((userId: string): boolean => {
    const presence = presences.get(userId);
    return presence?.isOnline ?? false;
  }, [presences]);

  // Obtenir le statut d'un utilisateur
  const getStatus = useCallback((userId: string): PresenceStatus => {
    const presence = presences.get(userId);
    return presence?.status ?? 'offline';
  }, [presences]);

  // Obtenir le texte de dernière connexion
  const getLastSeenText = useCallback((userId: string): string => {
    const presence = presences.get(userId);
    if (presence?.isOnline) return 'En ligne';
    return formatLastSeen(presence?.lastSeen || null);
  }, [presences, formatLastSeen]);

  // S'abonner aux changements de présence en temps réel (avec debounce)
  useEffect(() => {
    if (!user?.id) return;

    // Debounce map: accumulate updates per user, apply after delay
    const pendingUpdates = new Map<string, any>();
    let debounceTimer: NodeJS.Timeout | null = null;

    const flushUpdates = () => {
      if (pendingUpdates.size === 0) return;
      const updates = new Map(pendingUpdates);
      pendingUpdates.clear();

      setPresences(prev => {
        const updated = new Map(prev);
        const now = Date.now();
        updates.forEach((row, userId) => {
          const lastActive = row.last_active ? new Date(row.last_active).getTime() : 0;
          const timeSinceActive = now - lastActive;
          const isReallyOnline = timeSinceActive < OFFLINE_THRESHOLD_MS &&
            ['online', 'away', 'busy'].includes(row.status);

          const existing = updated.get(userId);
          // Only update if state actually changed
          if (!existing || existing.isOnline !== isReallyOnline || existing.status !== (isReallyOnline ? row.status : 'offline')) {
            updated.set(userId, {
              userId,
              status: isReallyOnline ? row.status : 'offline',
              lastSeen: row.last_seen || row.last_active,
              isOnline: isReallyOnline,
              device: row.current_device,
            });
          }
        });
        return updated;
      });
    };

    const channel = supabase
      .channel('conversation-presence-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        (payload) => {
          const row = payload.new as any;
          if (!row?.user_id || !trackedUsersRef.current.has(row.user_id)) return;

          pendingUpdates.set(row.user_id, row);

          // Debounce: apply after 2s of quiet
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(flushUpdates, 2000);
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Rafraîchir périodiquement (toutes les 45 secondes)
    const refreshInterval = setInterval(() => {
      const userIds = Array.from(trackedUsersRef.current);
      if (userIds.length > 0) loadPresences(userIds);
    }, 45000);

    return () => {
      clearInterval(refreshInterval);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user?.id, loadPresences]);

  return {
    presences,
    isOnline,
    getStatus,
    getLastSeenText,
    loadPresences,
    loading,
  };
}

export default useConversationPresence;

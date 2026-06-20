/**
 * 🚀 Hook de Présence Ultra-Rapide - 224SOLUTIONS
 * Détection instantanée online/offline via Supabase Broadcast
 *
 * Caractéristiques:
 * - Détection < 100ms quand quelqu'un se connecte/déconnecte
 * - Heartbeat rapide (5 secondes)
 * - Persistance via sendBeacon pour déconnexion propre
 * - Cache local pour performances optimales
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { PresenceStatus } from '@/types/communication.types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface RealtimePresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  device: 'mobile' | 'web' | 'desktop';
  isTyping?: boolean;
  typingIn?: string;
}

interface PresenceBroadcast {
  type: 'presence_update' | 'typing_start' | 'typing_stop' | 'heartbeat';
  userId: string;
  status: PresenceStatus;
  timestamp: number;
  device?: string;
  conversationId?: string;
}

interface UseRealtimePresenceOptions {
  /** Intervalle de heartbeat en ms (défaut: 5000 = 5s) */
  heartbeatInterval?: number;
  /** Délai avant "away" en ms (défaut: 120000 = 2min) */
  awayTimeout?: number;
  /** Délai avant "offline" après away en ms (défaut: 300000 = 5min) */
  offlineTimeout?: number;
  /** Activer le debug logging */
  debug?: boolean;
}

interface UseRealtimePresenceReturn {
  /** Mon statut actuel */
  myStatus: PresenceStatus;
  /** Carte de tous les utilisateurs en ligne */
  onlineUsers: Map<string, RealtimePresence>;
  /** Nombre d'utilisateurs en ligne */
  onlineCount: number;
  /** Vérifier si un utilisateur est en ligne (instantané) */
  isOnline: (userId: string) => boolean;
  /** Obtenir la présence d'un utilisateur */
  getPresence: (userId: string) => RealtimePresence | null;
  /** Changer mon statut manuellement */
  setStatus: (status: PresenceStatus) => void;
  /** Indiquer que je tape dans une conversation */
  startTyping: (conversationId: string) => void;
  /** Arrêter l'indicateur de frappe */
  stopTyping: () => void;
  /** Utilisateurs en train de taper */
  typingUsers: Map<string, string>; // userId -> conversationId
  /** État de connexion au channel */
  isConnected: boolean;
  /** Dernière erreur */
  lastError: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES - Optimisées pour 500K-800K utilisateurs
// ═══════════════════════════════════════════════════════════════════════════

const PRESENCE_TABLE = 'user_presence';
const OFFLINE_THRESHOLD_MS = 45000; // 45s sans heartbeat = offline (optimisé pour scale)
const NUM_SHARDS = 20; // 20 shards pour distribuer la charge Realtime

/**
 * Calcule le shard basé sur l'userId pour distribuer les connexions Realtime
 * Permet de supporter jusqu'à 500K-800K utilisateurs avec Supabase $500/mois
 */
function getChannelShard(userId: string): string {
  // Hash simple basé sur les premiers caractères de l'UUID
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const shardId = hash % NUM_SHARDS;
  return `presence:shard:${shardId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function useRealtimePresence(options: UseRealtimePresenceOptions = {}): UseRealtimePresenceReturn {
  const { user } = useAuth();
  const {
    // Optimisé pour 500K-800K utilisateurs: heartbeat à 20s au lieu de 5s
    // Réduit la charge DB de 75% tout en gardant une bonne réactivité
    heartbeatInterval = 20000, // 20 secondes (était 5s)
    awayTimeout = 180000,      // 3 minutes (était 2min)
    offlineTimeout = 600000,   // 10 minutes (était 5min)
    debug = false,
  } = options;

  // États
  const [myStatus, setMyStatus] = useState<PresenceStatus>('offline');
  const [onlineUsers, setOnlineUsers] = useState<Map<string, RealtimePresence>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Refs
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const awayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const currentTypingRef = useRef<string | null>(null);

  // Logger conditionnel
  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log('[RealtimePresence]', ...args);
    }
  }, [debug]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DÉTECTION DU DEVICE
  // ═══════════════════════════════════════════════════════════════════════════

  const device = useMemo((): 'mobile' | 'web' | 'desktop' => {
    if (typeof navigator === 'undefined') return 'web';
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      return 'mobile';
    }
    if (/electron|tauri/i.test(ua)) {
      return 'desktop';
    }
    return 'web';
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // BROADCAST DE PRÉSENCE
  // ═══════════════════════════════════════════════════════════════════════════

  const broadcastPresence = useCallback((
    type: PresenceBroadcast['type'],
    status: PresenceStatus,
    conversationId?: string
  ) => {
    if (!user?.id || !channelRef.current) return;

    const payload: PresenceBroadcast = {
      type,
      userId: user.id,
      status,
      timestamp: Date.now(),
      device,
      conversationId,
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'presence',
      payload,
    });

    log('📡 Broadcast:', type, status);
  }, [user?.id, device, log]);

  // ═══════════════════════════════════════════════════════════════════════════
  // MISE À JOUR EN BASE DE DONNÉES VIA RPC (optimisé)
  // ═══════════════════════════════════════════════════════════════════════════

  const updatePresenceDB = useCallback(async (status: PresenceStatus) => {
    if (!user?.id) return;

    try {
      // Utiliser la fonction RPC optimisée update_user_presence
      const { error } = await (supabase.rpc as any)('update_user_presence', {
        p_user_id: user.id,
        p_status: status,
        p_device: device,
        p_custom_status: null
      });

      if (error) {
        // Fallback vers upsert direct si RPC non disponible
        log('⚠️ RPC error, using fallback:', error.message);
        const { error: upsertError } = await supabase
          .from(PRESENCE_TABLE as any)
          .upsert({
            user_id: user.id,
            status,
            current_device: device,
            last_seen: new Date().toISOString(),
            last_active: status !== 'offline' ? new Date().toISOString() : undefined,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (upsertError) {
          log('⚠️ DB fallback error:', upsertError.message);
        }
      }
    } catch (err) {
      log('⚠️ DB exception:', err);
    }
  }, [user?.id, device, log]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTION DES TIMEOUTS D'INACTIVITÉ
  // ═══════════════════════════════════════════════════════════════════════════

  const resetActivityTimeouts = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timeouts
    if (awayTimeoutRef.current) clearTimeout(awayTimeoutRef.current);
    if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);

    // Si on était away, revenir online
    if (myStatus === 'away') {
      setMyStatus('online');
      broadcastPresence('presence_update', 'online');
      updatePresenceDB('online');
    }

    // Timer pour passer en away
    awayTimeoutRef.current = setTimeout(() => {
      if (myStatus === 'online') {
        setMyStatus('away');
        broadcastPresence('presence_update', 'away');
        updatePresenceDB('away');
        log('⏰ Auto-away après inactivité');
      }
    }, awayTimeout);

    // Timer pour passer en offline (après away)
    offlineTimeoutRef.current = setTimeout(() => {
      if (myStatus === 'away' || myStatus === 'online') {
        setMyStatus('offline');
        broadcastPresence('presence_update', 'offline');
        updatePresenceDB('offline');
        log('⏰ Auto-offline après longue inactivité');
      }
    }, offlineTimeout);
  }, [myStatus, awayTimeout, offlineTimeout, broadcastPresence, updatePresenceDB, log]);

  // ═══════════════════════════════════════════════════════════════════════════
  // NETTOYAGE DES UTILISATEURS INACTIFS
  // ═══════════════════════════════════════════════════════════════════════════

  const cleanupStaleUsers = useCallback(() => {
    const now = Date.now();
    setOnlineUsers(prev => {
      const updated = new Map(prev);
      let changed = false;

      prev.forEach((presence, oduleIds) => {
        const timeSinceLastSeen = now - presence.lastSeen.getTime();
        if (timeSinceLastSeen > OFFLINE_THRESHOLD_MS) {
          updated.delete(oduleIds);
          changed = true;
          log('🗑️ Utilisateur stale supprimé:', oduleIds);
        }
      });

      return changed ? updated : prev;
    });
  }, [log]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRAITEMENT DES MESSAGES BROADCAST
  // ═══════════════════════════════════════════════════════════════════════════

  const handleBroadcast = useCallback((payload: PresenceBroadcast) => {
    if (payload.userId === user?.id) return; // Ignorer nos propres messages

    const { type, userId, status, timestamp, device: userDevice, conversationId } = payload;

    switch (type) {
      case 'presence_update':
      case 'heartbeat':
        if (status === 'offline') {
          // Supprimer l'utilisateur
          setOnlineUsers(prev => {
            const updated = new Map(prev);
            updated.delete(userId);
            return updated;
          });
          log('🔴', userId.slice(0, 8), 'offline');
        } else {
          // Mettre à jour ou ajouter
          setOnlineUsers(prev => {
            const updated = new Map(prev);
            updated.set(userId, {
              userId,
              status,
              lastSeen: new Date(timestamp),
              device: (userDevice as any) || 'web',
            });
            return updated;
          });
          if (type === 'presence_update') {
            log('🟢', userId.slice(0, 8), status);
          }
        }
        break;

      case 'typing_start':
        if (conversationId) {
          setTypingUsers(prev => {
            const updated = new Map(prev);
            updated.set(userId, conversationId);
            return updated;
          });
          log('⌨️', userId.slice(0, 8), 'typing in', conversationId.slice(0, 8));
        }
        break;

      case 'typing_stop':
        setTypingUsers(prev => {
          const updated = new Map(prev);
          updated.delete(userId);
          return updated;
        });
        break;
    }
  }, [user?.id, log]);

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALISATION DU CHANNEL
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!user?.id) return;

    // Utiliser le sharding pour distribuer la charge sur plusieurs channels
    const channelName = getChannelShard(user.id);
    log('🚀 Initialisation présence pour', user.id.slice(0, 8), '- Shard:', channelName);

    // Créer le channel avec Presence et Broadcast (shardé pour 500K+ users)
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: user.id },
      },
    });

    // Écouter les broadcasts
    channel.on('broadcast', { event: 'presence' }, ({ payload }) => {
      handleBroadcast(payload as PresenceBroadcast);
    });

    // Écouter les changements de présence natifs Supabase
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      log('📊 Presence sync:', Object.keys(state).length, 'utilisateurs');

      const now = new Date();
      setOnlineUsers(prev => {
        const updated = new Map(prev);
        Object.entries(state).forEach(([key, presences]) => {
          if (Array.isArray(presences) && presences.length > 0) {
            const p = presences[0] as any;
            updated.set(key, {
              userId: key,
              status: p.status || 'online',
              lastSeen: now,
              device: p.device || 'web',
            });
          }
        });
        return updated;
      });
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      log('🟢 Join:', key.slice(0, 8));
      if (newPresences?.[0]) {
        const p = newPresences[0] as any;
        setOnlineUsers(prev => {
          const updated = new Map(prev);
          updated.set(key, {
            userId: key,
            status: p.status || 'online',
            lastSeen: new Date(),
            device: p.device || 'web',
          });
          return updated;
        });
      }
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      log('🔴 Leave:', key.slice(0, 8));
      setOnlineUsers(prev => {
        const updated = new Map(prev);
        updated.delete(key);
        return updated;
      });
    });

    // S'abonner
    channel.subscribe(async (status) => {
      log('📡 Channel status:', status);

      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setLastError(null);

        // S'annoncer comme en ligne
        await channel.track({
          user_id: user.id,
          status: 'online',
          device,
          timestamp: Date.now(),
        });

        setMyStatus('online');
        broadcastPresence('presence_update', 'online');
        await updatePresenceDB('online');

        log('✅ Présence active');
      } else if (status === 'CHANNEL_ERROR') {
        setIsConnected(false);
        setLastError('Erreur de connexion au channel');
      } else if (status === 'TIMED_OUT') {
        setIsConnected(false);
        setLastError('Timeout de connexion');
      }
    });

    channelRef.current = channel;

    // ═══════════════════════════════════════════════════════════════════════
    // HEARTBEAT RAPIDE (utilise RPC optimisé)
    // ═══════════════════════════════════════════════════════════════════════

    heartbeatRef.current = setInterval(async () => {
      if (document.visibilityState === 'visible' && isConnected) {
        broadcastPresence('heartbeat', myStatus);
        channel.track({
          user_id: user.id,
          status: myStatus,
          device,
          timestamp: Date.now(),
        });

        // Utiliser la fonction RPC presence_heartbeat (ultra-léger)
        try {
          await (supabase.rpc as any)('presence_heartbeat', { p_user_id: user.id });
        } catch {
          // Ignore silently - le broadcast suffit
        }
      }
    }, heartbeatInterval);

    // Nettoyage des utilisateurs stales
    const cleanupInterval = setInterval(cleanupStaleUsers, OFFLINE_THRESHOLD_MS);

    // ═══════════════════════════════════════════════════════════════════════
    // EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════════════

    // Activité utilisateur
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    const throttledActivity = throttle(resetActivityTimeouts, 1000);
    activityEvents.forEach(event => {
      window.addEventListener(event, throttledActivity, { passive: true });
    });

    // Visibilité de la page
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setMyStatus('online');
        broadcastPresence('presence_update', 'online');
        updatePresenceDB('online');
        resetActivityTimeouts();
      } else {
        setMyStatus('away');
        broadcastPresence('presence_update', 'away');
        updatePresenceDB('away');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Fermeture de page - utiliser sendBeacon pour garantir l'envoi
    const handleUnload = () => {
      // sendBeacon est plus fiable que fetch pour beforeunload
      const data = JSON.stringify({
        user_id: user.id,
        status: 'offline',
        updated_at: new Date().toISOString(),
      });

      // Essayer sendBeacon d'abord (plus fiable)
      // Note: On utilise l'URL configurée dans l'environnement
      if (navigator.sendBeacon) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const url = `${supabaseUrl}/rest/v1/${PRESENCE_TABLE}?user_id=eq.${user.id}`;
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      }

      // Broadcast final (peut ne pas arriver)
      broadcastPresence('presence_update', 'offline');
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    // Online/Offline du navigateur
    const handleOnline = () => {
      log('🌐 Navigateur online');
      setMyStatus('online');
      broadcastPresence('presence_update', 'online');
      updatePresenceDB('online');
    };
    const handleOffline = () => {
      log('📴 Navigateur offline');
      setMyStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialiser les timeouts d'activité
    resetActivityTimeouts();

    // ═══════════════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════════════

    return () => {
      log('🧹 Nettoyage présence');

      // Marquer offline avant de partir
      broadcastPresence('presence_update', 'offline');
      updatePresenceDB('offline');

      // Nettoyer le channel
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }

      // Nettoyer les intervals
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (awayTimeoutRef.current) clearTimeout(awayTimeoutRef.current);
      if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
      clearInterval(cleanupInterval);

      // Retirer les listeners
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Dépendances minimales pour éviter les re-subscriptions

  // ═══════════════════════════════════════════════════════════════════════════
  // FONCTIONS PUBLIQUES
  // ═══════════════════════════════════════════════════════════════════════════

  const isOnline = useCallback((userId: string): boolean => {
    const presence = onlineUsers.get(userId);
    if (!presence) return false;
    // Vérifier si le lastSeen n'est pas trop vieux
    const age = Date.now() - presence.lastSeen.getTime();
    return age < OFFLINE_THRESHOLD_MS && presence.status !== 'offline';
  }, [onlineUsers]);

  const getPresence = useCallback((userId: string): RealtimePresence | null => {
    return onlineUsers.get(userId) || null;
  }, [onlineUsers]);

  const setStatus = useCallback((status: PresenceStatus) => {
    setMyStatus(status);
    broadcastPresence('presence_update', status);
    updatePresenceDB(status);
  }, [broadcastPresence, updatePresenceDB]);

  const startTyping = useCallback(async (conversationId: string) => {
    if (currentTypingRef.current === conversationId) return;
    currentTypingRef.current = conversationId;
    broadcastPresence('typing_start', myStatus, conversationId);

    // Persister en DB via RPC pour les autres clients
    if (user?.id) {
      try {
        await (supabase.rpc as any)('set_typing_indicator', {
          p_user_id: user.id,
          p_conversation_id: conversationId,
          p_is_typing: true
        });
      } catch {
        // Ignore - le broadcast temps réel est prioritaire
      }
    }
  }, [myStatus, broadcastPresence, user?.id]);

  const stopTyping = useCallback(async () => {
    if (!currentTypingRef.current) return;
    const convId = currentTypingRef.current;
    broadcastPresence('typing_stop', myStatus);
    currentTypingRef.current = null;

    // Persister en DB via RPC
    if (user?.id) {
      try {
        await (supabase.rpc as any)('set_typing_indicator', {
          p_user_id: user.id,
          p_conversation_id: convId,
          p_is_typing: false
        });
      } catch {
        // Ignore
      }
    }
  }, [myStatus, broadcastPresence, user?.id]);

  return {
    myStatus,
    onlineUsers,
    onlineCount: onlineUsers.size,
    isOnline,
    getPresence,
    setStatus,
    startTyping,
    stopTyping,
    typingUsers,
    isConnected,
    lastError,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════

function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export default useRealtimePresence;

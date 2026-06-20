/**
 * 📄 HOOK: PAGINATION MESSAGES - 224SOLUTIONS
 * Pagination infinite scroll avec cursor pour messages
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Message, PaginatedResponse } from '@/types/communication.types';

interface UseMessagePaginationOptions {
  conversationId: string;
  limit?: number;
  autoLoad?: boolean;
}

export function useMessagePagination({
  conversationId,
  limit = 50,
  autoLoad = true,
}: UseMessagePaginationOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [oldestMessageDate, setOldestMessageDate] = useState<string | null>(null);

  /**
   * Charger les messages avec pagination
   */
  const loadMessages = useCallback(async (
    resetList: boolean = false
  ): Promise<Message[]> => {
    if (loading) return messages;

    setLoading(true);
    setError(null);

    try {
      // Si c'est une conversation directe
      const isDirect = conversationId.startsWith('direct_');

      let queryBuilder = supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (
            first_name,
            last_name,
            email,
            avatar_url,
            public_id
          ),
          recipient:profiles!messages_recipient_id_fkey (
            first_name,
            last_name,
            email,
            avatar_url,
            public_id
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (isDirect) {
        const otherUserId = conversationId.replace('direct_', '');
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user) throw new Error('Non authentifié');

        const currentUserId = session.session.user.id;

        queryBuilder = queryBuilder
          .is('conversation_id', null)
          .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`);
      } else {
        queryBuilder = queryBuilder.eq('conversation_id', conversationId);
      }

      // Pagination avec cursor (oldestMessageDate)
      if (!resetList && oldestMessageDate) {
        queryBuilder = queryBuilder.lt('created_at', oldestMessageDate);
      }

      const { data, error: fetchError } = await queryBuilder;

      if (fetchError) throw fetchError;

      const newMessages = ((data as any) || []).reverse();

      if (resetList) {
        setMessages(newMessages);
      } else {
        // Ajouter les messages plus anciens au début
        setMessages((prev) => [...newMessages, ...prev]);
      }

      // Mettre à jour le cursor
      if (newMessages.length > 0) {
        setOldestMessageDate(newMessages[0].created_at);
      }

      // Vérifier s'il y a plus de messages
      setHasMore(newMessages.length === limit);

      return newMessages;
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur chargement messages';
      setError(errorMessage);
      console.error('Erreur pagination messages:', err);

      toast.error('Erreur chargement', {
        description: errorMessage,
      });

      return [];
    } finally {
      setLoading(false);
    }
  }, [conversationId, limit, loading, messages, oldestMessageDate]);

  /**
   * Charger plus de messages (infinite scroll)
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadMessages(false);
  }, [hasMore, loading, loadMessages]);

  /**
   * Réinitialiser et recharger
   */
  const refresh = useCallback(async () => {
    setOldestMessageDate(null);
    setHasMore(true);
    await loadMessages(true);
  }, [loadMessages]);

  /**
   * Ajouter un nouveau message en temps réel
   */
  const addMessage = useCallback((newMessage: Message) => {
    setMessages((prev) => {
      // Éviter les doublons
      if (prev.some(m => m.id === newMessage.id)) {
        return prev;
      }
      return [...prev, newMessage];
    });
  }, []);

  /**
   * Mettre à jour un message existant
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    );
  }, []);

  /**
   * Supprimer un message
   */
  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  }, []);

  /**
   * Charger automatiquement au montage
   */
  useEffect(() => {
    if (autoLoad && conversationId) {
      refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, autoLoad]); // Ne pas inclure refresh pour éviter la boucle

  return {
    messages,
    loading,
    hasMore,
    error,
    loadMore,
    refresh,
    addMessage,
    updateMessage,
    removeMessage,
  };
}

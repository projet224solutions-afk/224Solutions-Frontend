/**
 * 🔍 HOOK: RECHERCHE MESSAGES - 224SOLUTIONS
 * Full-text search avec filtres avancés pour messages
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Message, SearchParams, SearchResult } from '@/types/communication.types';

export function useMessageSearch() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);

  /**
   * Rechercher des messages avec filtres
   */
  const searchMessages = useCallback(async (
    params: SearchParams
  ): Promise<SearchResult> => {
    setLoading(true);

    try {
      const {
        query,
        type,
        conversation_id,
        sender_id,
        date_from,
        date_to,
        limit = 50,
      } = params;

      if (!query || query.trim().length < 2) {
        throw new Error('La recherche doit contenir au moins 2 caractères');
      }

      // Construire la requête de base
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
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filtres optionnels
      if (type && type.length > 0) {
        queryBuilder = queryBuilder.in('type', type as any);
      }

      if (conversation_id) {
        queryBuilder = queryBuilder.eq('conversation_id', conversation_id);
      }

      if (sender_id) {
        queryBuilder = queryBuilder.eq('sender_id', sender_id);
      }

      if (date_from) {
        queryBuilder = queryBuilder.gte('created_at', date_from);
      }

      if (date_to) {
        queryBuilder = queryBuilder.lte('created_at', date_to);
      }

      const { data, error, count } = await queryBuilder;

      if (error) throw error;

      // Générer les highlights (surligner les mots trouvés)
      const highlights: Record<string, string[]> = {};
      const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 0);

      ((data as any) || []).forEach((message: any) => {
        const contentLower = message.content.toLowerCase();
        const foundTerms = searchTerms.filter(term => contentLower.includes(term));
        if (foundTerms.length > 0) {
          highlights[message.id] = foundTerms;
        }
      });

      const result: SearchResult = {
        messages: (data as any) || [],
        total: count || data?.length || 0,
        highlights,
      };

      setResults(result);

      toast.success(`${result.total} message(s) trouvé(s)`, {
        description: query,
      });

      return result;
    } catch (error: any) {
      console.error('Erreur recherche messages:', error);
      toast.error('Recherche échouée', {
        description: error.message,
      });

      const emptyResult: SearchResult = {
        messages: [],
        total: 0,
        highlights: {},
      };

      setResults(emptyResult);
      return emptyResult;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Rechercher dans une conversation spécifique
   */
  const searchInConversation = useCallback(async (
    conversationId: string,
    query: string
  ): Promise<Message[]> => {
    const result = await searchMessages({
      query,
      conversation_id: conversationId,
    });
    return result.messages;
  }, [searchMessages]);

  /**
   * Rechercher par type de message
   */
  const searchByType = useCallback(async (
    query: string,
    types: Message['type'][]
  ): Promise<Message[]> => {
    const result = await searchMessages({
      query,
      type: types,
    });
    return result.messages;
  }, [searchMessages]);

  /**
   * Rechercher les messages d'un expéditeur
   */
  const searchFromSender = useCallback(async (
    senderId: string,
    query: string
  ): Promise<Message[]> => {
    const result = await searchMessages({
      query,
      sender_id: senderId,
    });
    return result.messages;
  }, [searchMessages]);

  /**
   * Recherche avancée avec plage de dates
   */
  const advancedSearch = useCallback(async (
    query: string,
    options: Omit<SearchParams, 'query'>
  ): Promise<SearchResult> => {
    return await searchMessages({
      query,
      ...options,
    });
  }, [searchMessages]);

  /**
   * Nettoyer les résultats
   */
  const clearResults = useCallback(() => {
    setResults(null);
  }, []);

  return {
    searchMessages,
    searchInConversation,
    searchByType,
    searchFromSender,
    advancedSearch,
    clearResults,
    loading,
    results,
  };
}

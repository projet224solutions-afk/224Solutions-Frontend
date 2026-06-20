/**
 * HOOK DONNÉES COMMUNICATION - DONNÉES RÉELLES
 * Gestion des données réelles pour la messagerie
 * 224Solutions - Communication Opérationnelle
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  status: 'online' | 'busy' | 'offline';
  avatar?: string;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
  type: 'text' | 'image' | 'file' | 'voice';
  status: 'sent' | 'delivered' | 'read';
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'online' | 'busy' | 'offline';
  avatar?: string;
  lastSeen?: string;
}

export function useCommunicationData() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les conversations depuis Supabase
  const loadConversations = useCallback(async (userId: string) => {
    try {
      setLoading(true);

      // Récupérer toutes les conversations de l'utilisateur
      const { data: participantsData, error: participantsError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner(
            id,
            name,
            last_message,
            updated_at,
            unread_count
          )
        `)
        .eq('user_id', userId);

      if (participantsError) {
        console.error('❌ Erreur chargement conversations:', participantsError);
        throw participantsError;
      }

      if (!participantsData || participantsData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Pour chaque conversation, récupérer les infos du contact
      const conversationsWithContacts = await Promise.all(
        participantsData.map(async (participant) => {
          const conv = (participant as any).conversations;

          // Récupérer l'autre participant (le contact)
          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select(`
              user_id,
              profiles!inner(
                first_name,
                last_name,
                avatar_url
              )
            `)
            .eq('conversation_id', conv.id)
            .neq('user_id', userId)
            .maybeSingle();

          const profile = otherParticipant ? (otherParticipant as any).profiles : null;

          // ✅ Calculer le nombre réel de messages non lus
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', userId)
            .is('read_at', null);

          return {
            id: conv.id,
            name: conv.name || (profile ? `${profile.first_name} ${profile.last_name}` : 'Conversation'),
            lastMessage: conv.last_message || 'Aucun message',
            timestamp: new Date(conv.updated_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            unreadCount: unreadCount || 0,
            status: 'offline',
            avatar: profile?.avatar_url
          };
        })
      );

      setConversations(conversationsWithContacts);
    } catch (error) {
      console.error('❌ Erreur chargement conversations:', error);
      setError('Erreur lors du chargement des conversations');
      toast.error('Erreur lors du chargement des conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          type,
          status,
          created_at,
          sender_id,
          sender:profiles!messages_sender_id_fkey(
            first_name,
            last_name
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('❌ Erreur chargement messages:', messagesError);
        throw messagesError;
      }

      const formattedMessages: Message[] = messagesData?.map(msg => {
        const sender = msg.sender as any;
        return {
          id: msg.id,
          sender: sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'Utilisateur',
          content: msg.content,
          timestamp: new Date(msg.created_at).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          isOwn: msg.sender_id === currentUser?.id,
          type: msg.type || 'text',
          status: msg.status || 'sent'
        };
      }) || [];

      setMessages(formattedMessages);
    } catch (error) {
      console.error('❌ Erreur chargement messages:', error);
      setError('Erreur lors du chargement des messages');
      toast.error('Impossible de charger les messages');
    }
  }, []);

  // Charger les contacts
  const loadContacts = useCallback(async (userId: string) => {
    try {
      const { data: contactsData, error: contactsError } = await supabase
        .from('user_contacts')
        .select(`
          contact_id,
          profiles!user_contacts_contact_id_fkey(
            id,
            first_name,
            last_name,
            email,
            phone,
            avatar_url,
            updated_at
          )
        `)
        .eq('user_id', userId);

      if (contactsError) {
        console.error('❌ Erreur chargement contacts:', contactsError);
        throw contactsError;
      }

      const formattedContacts: Contact[] = contactsData?.map(contact => {
        const profile = (contact as any).profiles;
        return {
          id: profile.id,
          name: `${profile.first_name} ${profile.last_name}`,
          email: profile.email,
          phone: profile.phone,
          status: 'offline',
          avatar: profile.avatar_url,
          lastSeen: new Date(profile.updated_at).toLocaleString('fr-FR')
        };
      }) || [];

      setContacts(formattedContacts);
    } catch (error) {
      console.error('❌ Erreur chargement contacts:', error);
      setError('Erreur lors du chargement des contacts');
    }
  }, []);

  // Envoyer un message
  const sendMessage = useCallback(async (conversationId: string, content: string, senderId: string) => {
    try {
      // Récupérer l'ID du destinataire (l'autre participant de la conversation)
      const { data: otherParticipant, error: participantError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', senderId)
        .single();

      if (participantError || !otherParticipant) {
        throw new Error('Impossible de trouver le destinataire');
      }

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          recipient_id: otherParticipant.user_id,
          content: content,
          type: 'text',
          status: 'sent'
        })
        .select()
        .single();

      if (messageError) {
        throw messageError;
      }

      // Recharger les messages
      await loadMessages(conversationId);

      toast.success('Message envoyé');
      return messageData;
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    }
  }, [loadMessages]);

  // Créer une nouvelle conversation
  const createConversation = useCallback(async (participantIds: string[], name?: string) => {
    try {
      // Récupérer l'utilisateur actuel
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Non authentifié');

      // Créer la conversation avec creator_id
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          name: name || 'Nouvelle conversation',
          type: participantIds.length > 1 ? 'group' : 'private',
          creator_id: currentUser.id
        })
        .select()
        .single();

      if (conversationError) {
        throw conversationError;
      }

      // Ajouter tous les participants (utilisateur actuel + autres)
      const allParticipantIds = [currentUser.id, ...participantIds];
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert(
          allParticipantIds.map((id, index) => ({
            conversation_id: conversationData.id,
            user_id: id,
            role: index === 0 ? 'admin' : 'member'
          }))
        );

      if (participantsError) {
        throw participantsError;
      }

      toast.success('Conversation créée');
      return conversationData;
    } catch (error) {
      console.error('❌ Erreur création conversation:', error);
      toast.error('Erreur lors de la création de la conversation');
    }
  }, []);

  // Marquer les messages comme lus
  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      if (error) {
        throw error;
      }

      // Recharger les conversations
      // await loadConversations(userId);
    } catch (error) {
      console.error('❌ Erreur marquage lu:', error);
    }
  }, []);

  // Charger toutes les données
  const loadAllData = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        loadConversations(userId),
        loadContacts(userId)
      ]);

      console.log('✅ Données communication chargées avec succès');
    } catch (error) {
      console.error('❌ Erreur chargement données communication:', error);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [loadConversations, loadContacts]);

  // Charger les données au montage
  useEffect(() => {
    // loadAllData sera appelé avec l'userId depuis le composant parent
  }, []);

  /**
   * Rechercher des utilisateurs
   */
  const searchUsers = useCallback(async (query: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          avatar_url,
          updated_at
        `)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      const searchResults = data?.map(profile => ({
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        phone: profile.phone,
        status: profile.status || 'offline',
        avatar_url: profile.avatar_url,
        last_seen: profile.updated_at
      })) || [];

      return searchResults;
    } catch (error) {
      console.error('❌ Erreur recherche utilisateurs:', error);
      setError('Erreur lors de la recherche');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Ajouter un contact
   */
  const addContact = useCallback(async (contactId: string) => {
    try {
      // Get current user from auth
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('user_contacts')
        .insert({
          user_id: currentUser.id,
          contact_id: contactId
        });

      if (error) throw error;
    } catch (error) {
      console.error('❌ Erreur ajout contact:', error);
      throw error;
    }
  }, []);

  return {
    conversations,
    messages,
    contacts,
    activeConversation,
    loading,
    error,
    loadConversations,
    loadMessages,
    loadContacts,
    sendMessage,
    createConversation,
    markAsRead,
    setActiveConversation,
    loadAllData,
    refetch: loadAllData,
    searchUsers,
    addContact
  };
}

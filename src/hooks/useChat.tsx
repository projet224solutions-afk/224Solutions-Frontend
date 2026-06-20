import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { playNotificationSound } from '@/services/notificationSoundService';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  type?: 'text' | 'image' | 'file' | 'call' | 'location';
  file_url?: string;
  read_at?: string;
  created_at: string;
}

interface Call {
  id: string;
  caller_id: string;
  receiver_id: string;
  status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';
  call_type: string;
  started_at: string;
  ended_at?: string;
}

interface ChatUser {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  email: string;
}

export const useChat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesSubscription = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Récupérer les utilisateurs avec qui on a déjà chatté
  const fetchChatUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          sender_id,
          recipient_id,
          profiles!messages_sender_id_fkey (id, first_name, last_name, avatar_url, email),
          profiles!messages_recipient_id_fkey (id, first_name, last_name, avatar_url, email)
        `)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const users = new Map<string, ChatUser>();

      data?.forEach((msg: unknown) => {
        const otherUser = msg.sender_id === user.id
          ? msg.profiles_recipient
          : msg.profiles_sender;

        if (otherUser && otherUser.id !== user.id) {
          users.set(otherUser.id, otherUser);
        }
      });

      setChatUsers(Array.from(users.values()));
    } catch (err) {
      console.error('Error fetching chat users:', err);
    }
  };

  // Récupérer les messages pour une conversation
  const fetchMessages = async (recipientId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (first_name, last_name, avatar_url),
          recipient:profiles!messages_recipient_id_fkey (first_name, last_name, avatar_url)
        `)
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  // Envoyer un message
  const sendMessage = async (
    recipientId: string,
    content: string,
    type: 'text' | 'image' | 'file' | 'location' = 'text',
    fileUrl?: string
  ) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          content,
          type,
          file_url: fileUrl
        })
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (first_name, last_name, avatar_url),
          recipient:profiles!messages_recipient_id_fkey (first_name, last_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
      return data;
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message",
        variant: "destructive",
      });
      console.error('Error sending message:', err);
      return null;
    }
  };

  // Initier un appel
  const initiateCall = async (receiverId: string, callType: 'audio' | 'video' = 'audio') => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('calls')
        .insert({
          caller_id: user.id,
          receiver_id: receiverId,
          call_type: callType,
          status: 'ringing'
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentCall(data);

      toast({
        title: "Appel en cours",
        description: `Appel ${callType === 'video' ? 'vidéo' : 'audio'} en cours...`,
      });

      return data;
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible d'initier l'appel",
        variant: "destructive",
      });
      console.error('Error initiating call:', err);
      return null;
    }
  };

  // Accepter un appel
  const acceptCall = async (callId: string) => {
    try {
      const { error } = await supabase
        .from('calls')
        .update({ status: 'accepted' })
        .eq('id', callId);

      if (error) throw error;

      toast({
        title: "Appel accepté",
        description: "L'appel a été accepté",
      });
    } catch (err) {
      console.error('Error accepting call:', err);
    }
  };

  // Rejeter un appel
  const rejectCall = async (callId: string) => {
    try {
      const { error } = await supabase
        .from('calls')
        .update({
          status: 'rejected',
          ended_at: new Date().toISOString()
        })
        .eq('id', callId);

      if (error) throw error;
      setCurrentCall(null);
    } catch (err) {
      console.error('Error rejecting call:', err);
    }
  };

  // Terminer un appel
  const endCall = async (callId: string) => {
    try {
      const { error } = await supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', callId);

      if (error) throw error;
      setCurrentCall(null);
    } catch (err) {
      console.error('Error ending call:', err);
    }
  };

  // Marquer les messages comme lus
  const markAsRead = async (senderId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', senderId)
        .eq('recipient_id', user.id)
        .is('read_at', null);

      if (error) throw error;
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Souscrire aux nouveaux messages en temps réel
  const subscribeToMessages = (recipientId: string) => {
    if (!user) return;

    // Nettoyer l'ancien abonnement
    if (messagesSubscription.current) {
      messagesSubscription.current.unsubscribe();
    }

    messagesSubscription.current = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id}))`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.sender_id !== user.id) {
            setMessages(prev => [...prev, newMessage]);
            // Jouer le son de notification
            playNotificationSound();
            // Marquer comme lu automatiquement
            markAsRead(newMessage.sender_id);
          }
        }
      )
      .subscribe();
  };

  // Ouvrir une conversation
  const openChat = (recipientId: string) => {
    setActiveChat(recipientId);
    fetchMessages(recipientId);
    subscribeToMessages(recipientId);
  };

  // Fermer la conversation
  const closeChat = () => {
    setActiveChat(null);
    setMessages([]);
    if (messagesSubscription.current) {
      messagesSubscription.current.unsubscribe();
      messagesSubscription.current = null;
    }
  };

  useEffect(() => {
    if (user) {
      fetchChatUsers();
    }

    return () => {
      if (messagesSubscription.current) {
        messagesSubscription.current.unsubscribe();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    messages,
    activeChat,
    chatUsers,
    currentCall,
    loading,
    sendMessage,
    openChat,
    closeChat,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    markAsRead,
    fetchChatUsers
  };
};
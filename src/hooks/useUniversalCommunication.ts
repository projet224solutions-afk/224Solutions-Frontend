/**
 * Hook pour la Communication Universelle 224SOLUTIONS
 * Simplifie l'usage du système de communication
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  universalCommunicationService,
  type Conversation,
  type CommunicationNotification
} from '@/services/UniversalCommunicationService';

export const useUniversalCommunication = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<CommunicationNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await universalCommunicationService.getConversations(user.id);
      setConversations(data);
    } catch (err: any) {
      const errorMsg = err?.message || 'Erreur lors du chargement des conversations';
      setError(errorMsg);
      toast({
        title: 'Erreur de chargement',
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  // Charger les notifications
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const data = await universalCommunicationService.getUnreadNotifications(user.id);
      setNotifications(data);
    } catch (err) {
      console.error('Erreur chargement notifications:', err);
    }
  }, [user?.id]);

  // Envoyer un message
  const sendMessage = useCallback(async (
    conversationId: string,
    content: string
  ) => {
    if (!user?.id) throw new Error('Non authentifié');

    try {
      const message = await universalCommunicationService.sendTextMessage(
        conversationId,
        user.id,
        content
      );
      return message;
    } catch (err: any) {
      toast({
        title: 'Erreur d\'envoi',
        description: err.message || 'Impossible d\'envoyer le message',
        variant: 'destructive'
      });
      throw err;
    }
  }, [user?.id, toast]);

  // Envoyer un fichier
  const sendFile = useCallback(async (
    conversationId: string,
    file: File,
    type: 'image' | 'video' | 'file' | 'audio' = 'file'
  ) => {
    if (!user?.id) throw new Error('Non authentifié');

    try {
      const message = await universalCommunicationService.sendFileMessage(
        conversationId,
        user.id,
        file,
        type
      );

      toast({
        title: 'Fichier envoyé',
        description: 'Votre fichier a été envoyé avec succès'
      });

      return message;
    } catch (err: any) {
      toast({
        title: 'Erreur d\'upload',
        description: err.message || 'Impossible d\'envoyer le fichier',
        variant: 'destructive'
      });
      throw err;
    }
  }, [user?.id, toast]);

  // Créer une conversation
  const createConversation = useCallback(async (
    participantIds: string[],
    name?: string
  ) => {
    if (!user?.id) throw new Error('Non authentifié');

    try {
      const conversation = await universalCommunicationService.createConversation(
        participantIds,
        user.id,
        name
      );

      setConversations(prev => [conversation, ...prev]);

      toast({
        title: 'Conversation créée',
        description: 'Vous pouvez maintenant discuter'
      });

      return conversation;
    } catch (err: any) {
      toast({
        title: 'Erreur de création',
        description: err.message || 'Impossible de créer la conversation',
        variant: 'destructive'
      });
      throw err;
    }
  }, [user?.id, toast]);

  // Marquer les messages comme lus
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user?.id) return;

    try {
      await universalCommunicationService.markMessagesAsRead(conversationId, user.id);
      await loadConversations(); // Recharger pour mettre à jour les compteurs
    } catch (err) {
      console.error('Erreur marquage lu:', err);
    }
  }, [user?.id, loadConversations]);

  // Rechercher des utilisateurs
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) return [];

    try {
      const results = await universalCommunicationService.searchUsers(query);
      return results;
    } catch (err) {
      console.error('Erreur recherche:', err);
      return [];
    }
  }, []);

  // Marquer une notification comme lue
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      await universalCommunicationService.markNotificationAsRead(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Erreur marquage notification:', err);
    }
  }, []);

  // Initialisation
  useEffect(() => {
    if (user?.id) {
      loadConversations();
      loadNotifications();
    }
  }, [user?.id, loadConversations, loadNotifications]);

  // Statistiques
  const stats = {
    totalConversations: conversations.length,
    unreadCount: conversations.reduce((acc, conv) => acc + conv.unread_count, 0),
    notificationCount: notifications.length
  };

  return {
    // États
    conversations,
    notifications,
    loading,
    error,
    stats,

    // Actions
    sendMessage,
    sendFile,
    createConversation,
    markAsRead,
    searchUsers,
    markNotificationAsRead,
    loadConversations,
    loadNotifications
  };
};
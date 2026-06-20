/**
 * Hub de Communication Universel pour 224SOLUTIONS
 * Interface mobile-first optimisée
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';
import {
  MessageSquare,
  Phone,
  Video,
  Search,
  Users,
  Hash,
  Plus,
  ArrowLeft,
  Paperclip,
  CheckCheck,
} from 'lucide-react';
import {
  universalCommunicationService,
  type Conversation,
  type Message,
  type CommunicationNotification
} from '@/services/UniversalCommunicationService';
const AgoraVideoCall = React.lazy(() => import('./AgoraVideoCall'));
const AgoraAudioCall = React.lazy(() => import('./AgoraAudioCall'));
import ImprovedMessageInput from './ImprovedMessageInput';
import ContactUserById from './ContactUserById';
import { useSearchUserId } from '@/hooks/useSearchUserId';
import { useUserPresence } from '@/hooks/useUserPresence';
import { useAutoTranslation } from '@/hooks/useAutoTranslation';
import { AutoTranslatedMessageBubble } from '@/components/messaging/AutoTranslatedMessageBubble';
import { ChatLanguageSelector } from '@/components/messaging/ChatLanguageSelector';
import type { UserProfile } from '@/types/communication.types';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UniversalCommunicationHubProps {
  className?: string;
  selectedConversationId?: string | null;
  refreshTrigger?: number;
}

export default function UniversalCommunicationHub({
  className,
  selectedConversationId,
  refreshTrigger
}: UniversalCommunicationHubProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isMobile } = useResponsive();
  const { searchById, loading: searchLoading } = useSearchUserId();
  const { isUserOnline, getUserStatus } = useUserPresence();
  const { userLanguage, isLoading: _isTranslating } = useAutoTranslation({ autoTranslate: true });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showSearchById, setShowSearchById] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userIdSearch, setUserIdSearch] = useState('');
  const [notifications, setNotifications] = useState<CommunicationNotification[]>([]);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Charger les conversations
  useEffect(() => {
    if (user?.id) {
      loadConversations();
      loadNotifications();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshTrigger]);

  // 🔔 Real-time subscription pour synchroniser les badges
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('hub-unread-sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          console.log('[Hub] 📩 Nouveau message - rechargement conversations');
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        },
        () => {
          console.log('[Hub] ✅ Message mis à jour - rechargement conversations');
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Sélectionner automatiquement une conversation
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === selectedConversationId);
      if (conv) {
        handleSelectConversation(conv);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId, conversations]);

  // S'abonner aux notifications avec cleanup proper
  useEffect(() => {
    if (!user?.id) return;

    console.log('[Hub] 🔔 Subscription notifications pour:', user.id);

    const channel = universalCommunicationService.subscribeToNotifications(
      user.id,
      (notification) => {
        setNotifications(prev => [notification, ...prev]);
        toast({
          title: notification.title,
          description: notification.body
        });

        // Son de notification avec fallback
        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(err => {
            console.warn('[Hub] ⚠️ Impossible de jouer le son:', err);
          });
        } catch (err) {
          console.warn('[Hub] ⚠️ Audio non disponible:', err);
        }
      }
    );

    return () => {
      console.log('[Hub] 🔌 Cleanup subscription notifications');
      try {
        channel.unsubscribe();
      } catch (err) {
        console.error('[Hub] ❌ Erreur cleanup notifications:', err);
      }
    };
  }, [user?.id, toast]);

  // S'abonner aux messages de la conversation active avec cleanup proper
  useEffect(() => {
    if (!selectedConversation?.id) return;
    if (!user?.id) return;

    console.log('[Hub] 🔔 Subscription messages pour:', selectedConversation.id);

    const channel = universalCommunicationService.subscribeToMessages(
      selectedConversation.id,
      (message) => {
        console.log('[Hub] 📨 Nouveau message:', message.id);

        setMessages(prev => {
          // Éviter les doublons
          if (prev.some(m => m.id === message.id)) {
            console.warn('[Hub] ⚠️ Message déjà présent:', message.id);
            return prev;
          }
          return [...prev, message];
        });

        // Scroll automatique avec délai pour le rendu
        setTimeout(() => scrollToBottom(), 100);

        // Si message d'un autre utilisateur: son + marquer comme lu
        if (message.sender_id !== user.id) {
          // Jouer le son de notification
          import('@/services/notificationSoundService').then(({ playNotificationSound }) => {
            playNotificationSound();
          });

          universalCommunicationService.markMessagesAsRead(
            selectedConversation.id,
            user.id
          ).catch(err => {
            console.warn('[Hub] ⚠️ Erreur mark as read:', err);
          });
        }
      }
    );

    return () => {
      console.log('[Hub] 🔌 Cleanup subscription messages:', selectedConversation.id);
      try {
        channel.unsubscribe();
      } catch (err) {
        console.error('[Hub] ❌ Erreur cleanup messages:', err);
      }
    };
  }, [selectedConversation?.id, user?.id]);

  const loadConversations = async () => {
    try {
      if (!user?.id) return;
      const data = await universalCommunicationService.getConversations(user.id);
      setConversations(data);
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    if (!conversationId) {
      console.error('[Hub] ❌ Impossible de charger: conversationId manquant');
      return;
    }

    try {
      console.log('[Hub] 📥 Chargement messages pour:', conversationId);

      const data = await universalCommunicationService.getMessages(conversationId);

      setMessages(data);
      console.log('[Hub] ✅ Messages chargés:', data.length);

      // Scroll avec délai pour le rendu
      setTimeout(() => scrollToBottom(), 150);

      // Marquer comme lus
      if (user?.id) {
        await universalCommunicationService.markMessagesAsRead(conversationId, user.id)
          .catch(err => {
            console.warn('[Hub] ⚠️ Erreur mark as read (non-bloquant):', err);
          });

        // Recharger conversations pour mettre à jour le compteur
        loadConversations().catch(err => {
          console.warn('[Hub] ⚠️ Erreur reload conversations (non-bloquant):', err);
        });
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Erreur inconnue';
      console.error('[Hub] ❌ Erreur chargement messages:', {
        error: errorMessage,
        conversationId,
        stack: error?.stack
      });

      toast({
        title: 'Erreur de chargement',
        description: errorMessage.includes('timeout')
          ? 'Temps d\'attente dépassé. Vérifiez votre connexion.'
          : `Impossible de charger les messages: ${errorMessage}`,
        variant: 'destructive'
      });
    }
  };

  const loadNotifications = async () => {
    try {
      if (!user?.id) return;
      const data = await universalCommunicationService.getUnreadNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
    setShowMobileChat(true);
  };

  const handleSendMessage = async (message: string, attachments?: File[]) => {
    if (!selectedConversation || !user?.id) {
      console.error('[Hub] ❌ Impossible d\'envoyer: pas de conversation ou utilisateur');
      toast({
        title: 'Erreur',
        description: 'Sélectionnez une conversation et connectez-vous',
        variant: 'destructive'
      });
      return;
    }

    // Validation: au moins un message ou fichier
    const hasMessage = message?.trim().length > 0;
    const hasAttachments = attachments && attachments.length > 0;

    if (!hasMessage && !hasAttachments) {
      console.warn('[Hub] ⚠️ Message et pièces jointes vides');
      return;
    }

    try {
      // Envoyer les fichiers avec timeout et validation
      if (hasAttachments) {
        for (const file of attachments) {
          // Validation taille (50MB max)
          if (file.size > 50 * 1024 * 1024) {
            toast({
              title: 'Fichier trop volumineux',
              description: `${file.name} dépasse 50MB`,
              variant: 'destructive'
            });
            continue;
          }

          try {
            let fileType: 'image' | 'video' | 'file' | 'audio' = 'file';
            if (file.type.startsWith('image/')) fileType = 'image';
            else if (file.type.startsWith('video/')) fileType = 'video';
            else if (file.type.startsWith('audio/') || file.name.startsWith('audio_')) fileType = 'audio';

            console.log('[Hub] 📤 Envoi fichier:', { name: file.name, type: fileType, size: file.size });

            await universalCommunicationService.sendFileMessage(
              selectedConversation.id,
              user.id,
              file,
              fileType
            );

            console.log('[Hub] ✅ Fichier envoyé:', file.name);
          } catch (fileError: any) {
            console.error('[Hub] ❌ Erreur envoi fichier:', fileError);
            toast({
              title: 'Erreur fichier',
              description: `Impossible d'envoyer ${file.name}: ${fileError.message}`,
              variant: 'destructive'
            });
          }
        }
      }

      // Envoyer le message texte
      if (hasMessage) {
        const trimmedMessage = message.trim();

        // Validation longueur (5000 chars max)
        if (trimmedMessage.length > 5000) {
          toast({
            title: 'Message trop long',
            description: `Le message ne peut pas dépasser 5000 caractères (actuellement: ${trimmedMessage.length})`,
            variant: 'destructive'
          });
          return;
        }

        console.log('[Hub] 📤 Envoi message texte:', { length: trimmedMessage.length });

        await universalCommunicationService.sendTextMessage(
          selectedConversation.id,
          user.id,
          trimmedMessage
        );

        console.log('[Hub] ✅ Message texte envoyé');
      }

    } catch (error: any) {
      const errorMessage = error?.message || 'Erreur inconnue';
      console.error('[Hub] ❌ Erreur lors de l\'envoi:', {
        error: errorMessage,
        stack: error?.stack,
        conversationId: selectedConversation?.id,
        userId: user?.id
      });

      toast({
        title: 'Erreur d\'envoi',
        description: errorMessage.includes('timeout')
          ? 'Temps d\'attente dépassé. Vérifiez votre connexion.'
          : `Impossible d'envoyer le message: ${errorMessage}`,
        variant: 'destructive'
      });
    }
  };

  const handleStartCall = async (type: 'audio' | 'video') => {
    console.log('📞 handleStartCall appelé:', { type, selectedConversation, userId: user?.id });

    if (!selectedConversation) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une conversation',
        variant: 'destructive'
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: 'Erreur',
        description: 'Vous devez être connecté pour passer un appel',
        variant: 'destructive'
      });
      return;
    }

    const otherParticipant = selectedConversation.participants.find(
      p => p.user_id !== user.id
    );

    console.log('📞 Autre participant:', otherParticipant);

    if (!otherParticipant) {
      toast({
        title: 'Erreur',
        description: 'Aucun participant trouvé dans cette conversation',
        variant: 'destructive'
      });
      return;
    }

    try {
      console.log('📞 Création de l\'appel...');
      const call = await universalCommunicationService.startCall(
        user.id,
        otherParticipant.user_id,
        type
      );
      console.log('📞 Appel créé:', call);
      setActiveCall(call);
      setCallType(type);
      toast({
        title: type === 'video' ? '📹 Appel vidéo' : '📞 Appel audio',
        description: 'Connexion en cours...'
      });
    } catch (error) {
      console.error('📞 Erreur startCall:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de démarrer l\'appel',
        variant: 'destructive'
      });
    }
  };

  const handleEndCall = async () => {
    if (!activeCall) return;
    const duration = Math.floor(
      (Date.now() - new Date(activeCall.started_at).getTime()) / 1000
    );
    await universalCommunicationService.endCall(activeCall.id, duration);
    setActiveCall(null);
  };

  const handleSearchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await universalCommunicationService.searchUsers(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Erreur recherche:', error);
    }
  };

  const handleSearchById = async () => {
    const customId = userIdSearch.trim().toUpperCase();
    if (!customId) {
      toast({ title: "Erreur", description: "Veuillez entrer un ID", variant: "destructive" });
      return;
    }

    try {
      // Utiliser le hook useSearchUserId pour la recherche
      const profile = await searchById(customId);

      if (!profile) {
        // Le hook affiche déjà un toast d'erreur
        return;
      }

      if (profile.id === user?.id) {
        toast({ title: "Erreur", description: "Vous ne pouvez pas vous contacter", variant: "destructive" });
        return;
      }

      await handleCreateConversation(profile.id);
      setShowNewConversation(false);
      setUserIdSearch('');
    } catch (error) {
      console.error('Erreur recherche par ID:', error);
      toast({ title: "Erreur", description: "Impossible de contacter cet utilisateur", variant: "destructive" });
    }
  };

  const handleCreateConversation = async (participantId: string) => {
    if (!user?.id) return;

    try {
      const conversation = await universalCommunicationService.createConversation(
        [user.id, participantId],
        user.id
      );
      setConversations(prev => [conversation, ...prev]);
      setSelectedConversation(conversation);
      setShowNewConversation(false);
      setShowMobileChat(true);
      toast({ title: 'Conversation créée', description: 'Vous pouvez maintenant discuter' });
    } catch (_error) {
      toast({ title: 'Erreur', description: 'Impossible de créer la conversation', variant: 'destructive' });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participants.find(p => p.user_id !== user?.id);
  };

  const handleUserSelectedById = async (selectedUser: UserProfile) => {
    try {
      const directConvId = `direct_${selectedUser.id}`;
      const existingConv = conversations.find(c => c.id === directConvId);

      if (existingConv) {
        setSelectedConversation(existingConv);
        loadMessages(existingConv.id);
      } else {
        const newConv: Conversation = {
          id: directConvId,
          type: 'private',
          creator_id: user?.id || '',
          unread_count: 0,
          participants: [
            { user_id: user?.id || '', conversation_id: directConvId },
            { user_id: selectedUser.id, conversation_id: directConvId, user: selectedUser }
          ],
          created_at: new Date().toISOString()
        };
        setConversations(prev => [newConv, ...prev]);
        setSelectedConversation(newConv);
      }

      setShowSearchById(false);
      setShowMobileChat(true);
      toast({ title: 'Conversation ouverte', description: `Avec ${selectedUser.first_name} ${selectedUser.last_name}` });
    } catch (error) {
      console.error('Erreur ouverture conversation:', error);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Hier';
    return format(date, 'dd/MM', { locale: fr });
  };

  const _unreadCount = notifications.length;
  const filteredConversations = searchQuery
    ? conversations.filter(c => {
        const other = getOtherParticipant(c);
        const name = `${other?.user?.first_name || ''} ${other?.user?.last_name || ''}`;
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : conversations;

  // Sur mobile, on affiche soit la liste soit le chat, pas les deux
  const showConversationList = isMobile ? !showMobileChat : true;
  const showChatPanel = isMobile ? showMobileChat : true;

  return (
    <div className={cn("flex h-full bg-background overflow-hidden", className)}>
      {/* Liste des conversations */}
      {showConversationList && (
        <div className={cn(
          "flex flex-col border-r border-border bg-card h-full",
          isMobile ? "w-full" : "w-80 lg:w-96 flex-shrink-0"
        )}>
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Messages
              </h1>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowSearchById(true)}
                  className="h-8 w-8"
                >
                  <Hash className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowNewConversation(true)}
                  className="h-8 w-8"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('universalCommunicationHub.rechercher')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50 border-0 h-9"
              />
            </div>
          </div>

          {/* Liste */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">{t('universalCommunicationHub.aucuneConversation')}</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const other = getOtherParticipant(conv);
                  const name = `${other?.user?.first_name || ''} ${other?.user?.last_name || ''}`.trim() || 'Conversation';
                  const otherUserId = other?.user_id;
                  const isOnline = otherUserId ? isUserOnline(otherUserId) : false;
                  const presenceStatus = otherUserId ? getUserStatus(otherUserId) : null;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
                        "hover:bg-accent/50 active:scale-[0.98]",
                        selectedConversation?.id === conv.id && "bg-accent"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="w-11 h-11 flex-shrink-0">
                          <AvatarImage src={other?.user?.avatar_url} />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                            {other?.user?.first_name?.[0]}{other?.user?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        {/* Indicateur de présence */}
                        <span className={cn(
                          "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
                          isOnline ? "bg-[#ff4000]" :
                          presenceStatus?.status === 'away' ? "bg-[#ff4000]" : "bg-gray-400"
                        )} />
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium truncate text-sm">{name}</span>
                            {(conv.unread_count ?? 0) > 0 && (
                              <span className="bg-destructive text-destructive-foreground rounded-full min-w-5 h-5 flex items-center justify-center text-xs font-bold px-1 animate-pulse shadow-sm flex-shrink-0">
                                {(conv.unread_count ?? 0) > 99 ? '99+' : conv.unread_count}
                              </span>
                            )}
                            {isOnline && (
                              <span className="text-[10px] text-[#ff4000] font-medium flex-shrink-0">En ligne</span>
                            )}
                          </div>
                          {conv.last_message_at && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatTime(conv.last_message_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.last_message_preview || 'Aucun message'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Zone de chat */}
      {showChatPanel && (
        <div className="flex-1 flex flex-col bg-background h-full min-w-0">
        {selectedConversation ? (
          <>
            {/* Header chat */}
            <div className="flex items-center gap-3 p-3 border-b border-border bg-card">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileChat(false)}
                className="md:hidden h-9 w-9"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={getOtherParticipant(selectedConversation)?.user?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getOtherParticipant(selectedConversation)?.user?.first_name?.[0]}
                    {getOtherParticipant(selectedConversation)?.user?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className={cn(
                  "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
                  isUserOnline(getOtherParticipant(selectedConversation)?.user_id || '') ? "bg-[#ff4000]" : "bg-gray-400"
                )} />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="font-semibold truncate">
                  {getOtherParticipant(selectedConversation)?.user?.first_name}{' '}
                  {getOtherParticipant(selectedConversation)?.user?.last_name}
                </h2>
                <p className="text-xs text-muted-foreground truncate">
                  {isUserOnline(getOtherParticipant(selectedConversation)?.user_id || '')
                    ? '🟢 En ligne'
                    : 'Hors ligne'}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <ChatLanguageSelector />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleStartCall('audio')}
                  className="h-9 w-9"
                >
                  <Phone className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleStartCall('video')}
                  className="h-9 w-9"
                >
                  <Video className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                  <p>{t('universalCommunicationHub.aucunMessage')}</p>
                  <p className="text-sm">{t('universalCommunicationHub.commencezLaConversation')}</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex mb-3", isOwn ? "justify-end" : "justify-start")}
                      >
                        <div className={cn(
                          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm min-w-0",
                          isOwn
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}>
                          {msg.file_url && msg.type === 'image' && (
                            <img loading="lazy" src={msg.file_url} alt="Image" className="rounded-lg w-full max-w-[250px] mb-2" />
                          )}
                          {msg.file_url && (msg.type === 'video' || msg.file_url?.match(/\.(mp4|webm|mov)$/i)) && (
                            <video controls src={msg.file_url} className="rounded-lg w-full max-w-[250px] mb-2" />
                          )}
                          {msg.file_url && msg.type === 'audio' && (
                            <audio controls src={msg.file_url} className="w-full max-w-[220px] mb-2" />
                          )}
                          {msg.file_url && msg.type === 'file' && (
                            <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm underline mb-2">
                              <Paperclip className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{msg.file_name || 'Fichier'}</span>
                            </a>
                          )}
                          {msg.content && msg.type === 'text' && (
                            <AutoTranslatedMessageBubble
                              message={msg}
                              userLanguage={userLanguage}
                              isOwn={isOwn}
                            />
                          )}
                          {msg.content && msg.type !== 'text' && (
                            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap" style={{ wordBreak: 'break-word' }}>{msg.content}</p>
                          )}
                          <div className={cn(
                            "flex items-center justify-end gap-1 mt-1",
                            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            <span className="text-[10px]">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </span>
                            {isOwn && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border bg-card">
              <ImprovedMessageInput
                onSendMessage={handleSendMessage}
                placeholder={t('universalCommunicationHub.ecrivezVotreMessage')}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-20 h-20 mb-4 opacity-20" />
            <p className="text-lg">{t('universalCommunicationHub.selectionnezUneConversation')}</p>
          </div>
        )}
      </div>
      )}

      {/* Dialog nouvelle conversation */}
      <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('universalCommunicationHub.nouvelleConversation')}</DialogTitle>
            <DialogDescription>
              Recherchez un utilisateur pour démarrer une conversation
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="search" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">Par nom</TabsTrigger>
              <TabsTrigger value="id">Par ID</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Search className="h-5 w-5 mt-2" />
                <Input
                  placeholder={t('universalCommunicationHub.rechercher')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchUsers(e.target.value);
                  }}
                />
              </div>
              <ScrollArea className="h-[300px]">
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 mb-2 border rounded-lg cursor-pointer hover:bg-muted"
                    onClick={() => handleCreateConversation(u.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback>{u.first_name?.[0]}{u.last_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.first_name} {u.last_name}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="id" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Input
                  placeholder={t('universalCommunicationHub.usr0001Ou224123456')}
                  className="font-mono uppercase"
                  value={userIdSearch}
                  onChange={(e) => setUserIdSearch(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && !searchLoading && handleSearchById()}
                />
                <Button
                  onClick={handleSearchById}
                  disabled={!userIdSearch.trim() || searchLoading}
                >
                  {searchLoading ? (
                    <span className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Formats acceptés: USR0001 (3 lettres + 4 chiffres) ou 224-123-456
              </p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog appel */}
      {activeCall && (
        <Dialog open={!!activeCall} onOpenChange={() => handleEndCall()}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {callType === 'video' ? (
              <AgoraVideoCall
                channel={activeCall.agora_channel || `call_${activeCall.id}`}
                isIncoming={false}
                onCallEnd={handleEndCall}
              />
            ) : (
              <AgoraAudioCall
                channel={activeCall.agora_channel || `call_${activeCall.id}`}
                isIncoming={false}
                onCallEnd={handleEndCall}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog Recherche par ID */}
      <Dialog open={showSearchById} onOpenChange={setShowSearchById}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              Rechercher par ID
            </DialogTitle>
            <DialogDescription>
              Trouvez un utilisateur par son ID
            </DialogDescription>
          </DialogHeader>
          <ContactUserById onUserSelected={handleUserSelectedById} showNavigation={false} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

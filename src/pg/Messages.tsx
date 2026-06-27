import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft, User, Search, MessageCircle, Phone, Video, Shield, UserPlus, Loader2, Reply, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChatLanguageSelector } from "@/components/messaging/ChatLanguageSelector";
import { useChatLanguage } from "@/hooks/useChatLanguage";
import { TranslatedMessageItem } from "@/components/messaging/TranslatedMessageItem";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import QuickFooter from "@/components/QuickFooter";
import { universalCommunicationService } from "@/services/UniversalCommunicationService";
import { signMessagesFileUrls } from "@/lib/communication/fileUrls";
import { useWebRTCCallContext } from "@/components/communication/WebRTCCallProvider";
import CallDiagnostics from "@/components/communication/CallDiagnostics";
const AgoraVideoCall = React.lazy(() => import("@/components/communication/AgoraVideoCall"));
const AgoraAudioCall = React.lazy(() => import("@/components/communication/AgoraAudioCall"));
import MessageInput from "@/components/communication/MessageInput";
import { PresenceIndicator, PresenceBadge, TypingIndicator, MessageStatusBadge } from "@/components/communication/PresenceIndicator";
import { ReplyBar } from "@/components/communication/EnhancedMessageBubble";
import { usePresence } from "@/hooks/usePresence";
import { useConversationPresence } from "@/hooks/useConversationPresence";
import { playNotificationSound } from "@/services/notificationSoundService";
import type { PresenceStatus } from "@/types/communication.types";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  read_at: string | null;
  delivered_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  deleted_for?: string[];
  reply_to_id?: string | null;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  type?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'call';
  file_url?: string;
  file_url_ios?: string;  // URL du fichier audio converti pour iOS
  file_name?: string;
  file_size?: number;
  file_type?: string;
  audio_format?: string;  // Format audio original
  audio_format_ios?: string;  // Format audio converti pour iOS
  conversation_id?: string;
  public_id?: string;
  metadata?: any;
  reply_to?: Message | null;
  sender?: {
    id: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface Conversation {
  id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_email?: string;
  other_user_avatar?: string;
  other_user_public_id?: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_vendor?: boolean;
  is_certified?: boolean;
  vendor_phone?: string;
  vendor_shop_slug?: string;
  vendor_id?: string;
  user_role?: string | null;
  service_type_name?: string | null;
  service_type_code?: string | null;
}

export default function Messages() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recipientIdParam = searchParams.get('recipientId');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [availableContacts, setAvailableContacts] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showAudioCall, setShowAudioCall] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // États pour les nouvelles fonctionnalités
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [otherUserPresence, setOtherUserPresence] = useState<PresenceStatus>('offline');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hook de présence
  const { setTyping, subscribeToTyping } = usePresence();

  // Appels WebRTC (audio + vidéo) — overlay global géré par WebRTCCallProvider
  const { startCall: startWebRTCCall } = useWebRTCCallContext();
  const { chatLanguage } = useChatLanguage();

  const launchCall = useCallback((mode: 'audio' | 'video') => {
    if (!selectedConversation) return;
    startWebRTCCall(
      selectedConversation,
      {
        name: selectedConvData?.other_user_name || 'Utilisateur',
        avatar: selectedConvData?.other_user_avatar,
      },
      mode
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation, startWebRTCCall]);

  // 🟢 Hook de présence pour la liste des conversations
  const {
    isOnline: isContactOnline,
    getStatus: getContactStatus,
    getLastSeenText,
    loadPresences,
  } = useConversationPresence();

  const typingActiveRef = useRef(false);
  const lastTypingSyncRef = useRef(0);

  useEffect(() => {
    loadCurrentUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadConversations();
      loadAvailableContacts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Charger les présences quand les conversations changent
  useEffect(() => {
    if (conversations.length > 0) {
      const userIds = conversations.map(c => c.other_user_id);
      loadPresences(userIds);
    }
  }, [conversations, loadPresences]);

  useEffect(() => {
    if (selectedConversation && currentUser) {
      loadMessages(selectedConversation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation, currentUser]);

  useEffect(() => {
    if (recipientIdParam && currentUser) {
      setSelectedConversation(recipientIdParam);
      setShowChat(true);
    }
  }, [recipientIdParam, currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!selectedConversation || !currentUser) return;

    const channel = supabase
      .channel(`messages-${selectedConversation}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMsg = payload.new as any;
          const me = currentUser.id;
          const other = selectedConversation;

          // ✅ Le message concerne cette conversation UNIQUEMENT si les deux
          // participants sont exactement sender+recipient (dans un sens ou l'autre).
          // Avant : sender_id === me rechargeait CETTE conversation même quand
          // j'écrivais à quelqu'un d'autre → données erronées.
          const isThisConversation =
            (newMsg.sender_id === me && newMsg.recipient_id === other) ||
            (newMsg.sender_id === other && newMsg.recipient_id === me);

          if (isThisConversation) {
            loadMessages(selectedConversation);

            // Son uniquement pour les messages reçus (pas les nôtres)
            if (newMsg.sender_id !== me) {
              playNotificationSound();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation, currentUser]);

  // 🔔 Real-time subscription for unread count synchronization
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('unread-sync-conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${currentUser.id}`
        },
        () => {
          console.log('[Messages] 📨 Nouveau message reçu - rechargement conversations');
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${currentUser.id}`
        },
        () => {
          console.log('[Messages] ✓ Message mis à jour - rechargement conversations');
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Synchroniser présence du contact sélectionné (source unique stable)
  useEffect(() => {
    if (!selectedConversation) {
      setOtherUserPresence('offline');
      return;
    }

    loadPresences([selectedConversation]);
    setOtherUserPresence(getContactStatus(selectedConversation));
  }, [selectedConversation, loadPresences, getContactStatus]);

  // Subscription aux indicateurs de frappe (sans polling)
  useEffect(() => {
    if (!selectedConversation) {
      setIsTyping(false);
      return;
    }

    const unsubscribe = subscribeToTyping(selectedConversation, (indicators) => {
      const otherUserTyping = indicators.some((indicator) => indicator.user_id !== currentUser?.id);
      setIsTyping(otherUserTyping);
    });

    return () => unsubscribe();
  }, [selectedConversation, subscribeToTyping, currentUser?.id]);

  const _stopTypingIndicator = useCallback(() => {
    if (!selectedConversation) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      setTyping(selectedConversation, false);
    }
  }, [selectedConversation, setTyping]);

  // Gérer l'indicateur de frappe lors de la saisie (throttle anti-spam)
  const handleTyping = useCallback(() => {
    if (!selectedConversation) return;

    const now = Date.now();

    if (!typingActiveRef.current || now - lastTypingSyncRef.current > 5000) {
      typingActiveRef.current = true;
      lastTypingSyncRef.current = now;
      setTyping(selectedConversation, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      setTyping(selectedConversation, false);
    }, 3500);
  }, [selectedConversation, setTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('messages.veuillezVousConnecter'));
        navigate('/auth');
        return;
      }
      setCurrentUser(user);
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
    }
  };

  const loadConversations = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // ✓ Source de vérité: table messages
      // On liste uniquement les contacts qui ont déjà échangé au moins 1 message avec l'utilisateur.
      const { data: recentMessages, error: msgError } = await supabase
        .from('messages')
        .select('sender_id, recipient_id, content, created_at')
        .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (msgError) {
        console.error('Erreur chargement messages (conversations):', msgError);
        setConversations([]);
        return;
      }

      if (!recentMessages || recentMessages.length === 0) {
        setConversations([]);
        return;
      }

      // Construire une liste unique de contacts (dernier message conservé)
      const conversationMap = new Map<string, { other_user_id: string; last_message: string; last_message_time: string }>();

      for (const msg of recentMessages as any[]) {
        const otherUserId = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
        if (!otherUserId) continue;
        if (otherUserId === currentUser.id) continue;

        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            other_user_id: otherUserId,
            last_message: msg.content || 'Nouvelle conversation',
            last_message_time: msg.created_at
          });
        }
      }

      const enrichedConversations = await Promise.all(
        Array.from(conversationMap.values()).map(async (conv) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email, avatar_url, public_id, role')
            .eq('id', conv.other_user_id)
            .single();

          // Vérifier si c'est un vendeur
          const { data: vendor } = await supabase
            .from('vendors')
            .select('id, business_name, shop_slug, phone')
            .eq('user_id', conv.other_user_id)
            .maybeSingle();

          // Vérifier certification
          const { data: cert } = await supabase
            .from('vendor_certifications')
            .select('status')
            .eq('vendor_id', conv.other_user_id)
            .maybeSingle();

          // Récupérer le type de service pro (restaurant, coiffure, etc.)
          const { data: proService } = await supabase
            .from('professional_services')
            .select(`
              service_type:service_types (
                code,
                name
              )
            `)
            .eq('user_id', conv.other_user_id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();

          const serviceType = Array.isArray((proService as any)?.service_type)
            ? (proService as any).service_type[0]
            : (proService as any)?.service_type;

          // ✓ Calculer le nombre de messages non lus pour cette conversation
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', conv.other_user_id)
            .eq('recipient_id', currentUser.id)
            .is('read_at', null);

          const isVendor = !!vendor;
          const isCertified = cert?.status === 'CERTIFIE';
          const userName = vendor?.business_name ||
            (profile?.first_name && profile?.last_name
              ? `${profile.first_name} ${profile.last_name}`
              : profile?.email || 'Utilisateur');

          return {
            id: conv.other_user_id,
            other_user_id: conv.other_user_id,
            other_user_name: userName,
            other_user_email: profile?.email || '',
            other_user_avatar: profile?.avatar_url,
            other_user_public_id: (profile as any)?.public_id || null,
            last_message: conv.last_message || 'Nouvelle conversation',
            last_message_time: conv.last_message_time,
            unread_count: unreadCount || 0,
            is_vendor: isVendor,
            is_certified: isCertified,
            vendor_phone: vendor?.phone,
            vendor_shop_slug: vendor?.shop_slug,
            vendor_id: vendor?.id,
            user_role: (profile as any)?.role || null,
            service_type_name: serviceType?.name || null,
            service_type_code: serviceType?.code || null,
          };
        })
      );

      // ✓ Trier: messages non lus en premier (par nombre décroissant), puis par date
      const sortedConversations = enrichedConversations.sort((a, b) => {
        // D'abord, ceux avec des messages non lus
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;

        // Si les deux ont des messages non lus, trier par nombre décroissant
        if (a.unread_count > 0 && b.unread_count > 0) {
          return b.unread_count - a.unread_count;
        }

        // Sinon, trier par date du dernier message (plus récent en premier)
        return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
      });

      setConversations(sortedConversations);
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
      toast.error(t('messages.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  // Charger les contacts disponibles (vendeurs) pour démarrer une nouvelle conversation
  const loadAvailableContacts = async () => {
    if (!currentUser) return;

    try {
      setLoadingContacts(true);

      // Les contacts disponibles sont maintenant gérés via les conversations existantes
      // Cette fonction n'affiche plus tous les utilisateurs, seulement ceux avec qui on a déjà conversé
      // Les nouveaux contacts sont ajoutés via la recherche d'utilisateurs
      setAvailableContacts([]);
    } catch (error) {
      console.error('Erreur chargement contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Rechercher des utilisateurs par nom, email, public_id, UUID ou telephone
  const searchUsers = async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    try {
      setSearchingUsers(true);
      const searchTerm = query.trim();

      console.log('[Messages] Recherche utilisateurs:', { searchTerm });

      const profiles = (await universalCommunicationService.searchUsers(searchTerm))
        .filter((profile) => profile.id !== currentUser?.id);

      console.log('[Messages] Resultats recherche:', { profiles: profiles.length });

      // Enrichir avec infos vendeur
      const enrichedResults = await Promise.all(
        profiles.map(async (profile) => {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('business_name, phone')
            .eq('user_id', profile.id)
            .maybeSingle();

          const { data: cert } = await supabase
            .from('vendor_certifications')
            .select('status')
            .eq('vendor_id', profile.id)
            .maybeSingle();

          return {
            id: profile.id,
            name: vendor?.business_name ||
              (profile.first_name && profile.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : profile.email || 'Utilisateur'),
            email: profile.email,
            avatar_url: profile.avatar_url,
            public_id: profile.public_id,
            phone: profile.phone || vendor?.phone,
            is_vendor: !!vendor,
            is_certified: cert?.status === 'CERTIFIE',
            vendor_phone: vendor?.phone
          };
        })
      );

      setSearchResults(enrichedResults);
    } catch (error) {
      console.error('Erreur recherche:', error);
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Sélectionner un utilisateur depuis la recherche et ouvrir la conversation
  const handleSelectSearchResult = (user: any) => {
    setShowSearchDialog(false);
    setUserSearchQuery("");
    setSearchResults([]);
    handleSelectConversation(user.id);
  };

  const loadMessages = async (otherUserId: string) => {
    if (!currentUser) return;

    try {
      // Charger les messages directement via sender_id et recipient_id
      // Essayer d'inclure les messages de réponse (reply_to)
      const query = supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Erreur requête messages:', error);
        setMessages([]);
        return;
      }

      // ✅ Anti-N+1 : charger TOUS les messages de réponse en UNE requête batch
      // (avant : 1 requête Supabase par message ayant un reply_to_id).
      const allReplyIds = Array.from(
        new Set((data || []).map((m: any) => m.reply_to_id).filter(Boolean))
      ) as string[];

      let replyMap: Record<string, { id: string; content: string; sender_id: string }> = {};
      if (allReplyIds.length > 0) {
        const { data: replyData } = await supabase
          .from('messages')
          .select('id, content, sender_id')
          .in('id', allReplyIds);
        replyMap = Object.fromEntries((replyData || []).map((r: any) => [r.id, r]));
      }

      const messagesWithReplies = (data || []).map((msg: any) => ({
        ...msg,
        status: msg.status as 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | undefined,
        type: msg.type as 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'call' | undefined,
        reply_to: msg.reply_to_id ? ((replyMap[msg.reply_to_id] as Message) || null) : null,
      }));

      // 🔐 Signer les pièces jointes (bucket privé) avant affichage
      const signedMessages = await signMessagesFileUrls(messagesWithReplies);
      setMessages(signedMessages);

      // Marquer les messages reçus comme lus immédiatement
      const unreadMessages = messagesWithReplies.filter(
        msg => msg.sender_id === otherUserId && !msg.read_at
      );

      if (unreadMessages.length > 0) {
        console.log('[Messages] 📖 Marquage de', unreadMessages.length, 'messages comme lus');

        // Marquer tous les messages non lus de cette conversation
        const { error: readError } = await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString(), status: 'read' })
          .eq('sender_id', otherUserId)
          .eq('recipient_id', currentUser.id)
          .is('read_at', null);

        if (readError) {
          console.warn('[Messages] Erreur marquage lu:', readError);
        } else {
          console.log('[Messages] ✓ Messages marqués comme lus');
          // Recharger pour mettre à jour l'affichage
          const { data: updatedData } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

          if (updatedData) {
            const updatedMessages = updatedData.map(msg => ({
              ...msg,
              status: msg.status as 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | undefined,
              type: msg.type as 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'call' | undefined,
            }));
            setMessages(updatedMessages);
          }

          // ✓ Forcer le rechargement des conversations pour mettre à jour les badges
          loadConversations();
        }
      }

    } catch (error) {
      console.error('Erreur chargement messages:', error);
      toast.error(t('messages.erreurLorsDuChargementDes2'));
    }
  };

  const _sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    try {
      // Arrêter l'indicateur de frappe
      setTyping(selectedConversation, false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Construire le message
      const messageData: any = {
        sender_id: currentUser.id,
        recipient_id: selectedConversation,
        content: newMessage.trim(),
        type: 'text',
        status: 'sent'
      };

      // Ajouter la référence au message de réponse si présent
      if (replyToMessage) {
        messageData.reply_to_id = replyToMessage.id;
      }

      // Insérer le message directement avec sender_id et recipient_id
      const { error } = await supabase
        .from('messages')
        .insert(messageData);

      if (error) throw error;

      setNewMessage("");
      setReplyToMessage(null); // Réinitialiser la réponse
      loadMessages(selectedConversation);
      loadConversations();
      scrollToBottom();
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error(t('messages.erreurLorsDeLEnvoi'));
    }
  };

  // Gérer la réponse à un message
  const handleReplyToMessage = useCallback((message: Message) => {
    setReplyToMessage(message);
    inputRef.current?.focus();
  }, []);

  // Annuler la réponse
  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  // Supprimer un message
  const handleDeleteMessage = useCallback(async (messageId: string, deleteForEveryone: boolean) => {
    if (!currentUser) return;

    try {
      await universalCommunicationService.softDeleteMessage(messageId, currentUser.id, deleteForEveryone);
      toast.success(t('messages.messageSupprime'));
      if (selectedConversation) {
        loadMessages(selectedConversation);
      }
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, selectedConversation]);

  const handleSendFile = async (file: File) => {
    if (!selectedConversation || !currentUser) {
      toast.error(t('messages.impossibleDEnvoyerLeFichier'));
      return;
    }

    try {
      // Déterminer le type de fichier - types acceptés par la DB: text, image, file, audio, video
      let fileType: 'image' | 'file' | 'audio' | 'video' = 'file';
      if (file.type.startsWith('image/')) {
        fileType = 'image';
      } else if (file.type.startsWith('audio/') || file.name.includes('vocal_') || file.name.includes('audio_')) {
        fileType = 'audio';
      } else if (file.type.startsWith('video/')) {
        fileType = 'video';
      }

      console.log('[Messages] Sending file via UniversalCommunicationService:', {
        type: fileType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      });

      await universalCommunicationService.sendFileMessage(
        `direct_${selectedConversation}`,
        currentUser.id,
        file,
        fileType
      );

      loadMessages(selectedConversation);
      loadConversations();
      scrollToBottom();
      toast.success(fileType === 'audio' ? 'Message vocal envoye' : 'Fichier envoye');
    } catch (error: any) {
      console.error('Erreur envoi fichier:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi');
      throw error;
    }
  };

  const handleSelectConversation = (convId: string) => {
    setSelectedConversation(convId);
    setShowChat(true);
  };

  const handleBackToList = () => {
    setShowChat(false);
    setSelectedConversation(null);
  };

  const filteredConversations = conversations.filter(conv => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      conv.other_user_name.toLowerCase().includes(query) ||
      (conv.other_user_email && conv.other_user_email.toLowerCase().includes(query)) ||
      conv.last_message.toLowerCase().includes(query)
    );
  });

  const selectedConvData = conversations.find(c => c.id === selectedConversation);

  // Helper pour le label du rôle utilisateur
  const getRoleLabel = (conv: { is_vendor?: boolean; user_role?: string | null; service_type_name?: string | null; service_type_code?: string | null }) => {
    if (conv.is_vendor) return 'Vendeur';

    if (conv.service_type_name?.trim()) {
      if ((conv.service_type_code || '').toLowerCase() === 'restaurant') return 'Restaurant';
      return conv.service_type_name;
    }

    const role = conv.user_role?.toLowerCase();
    if (role === 'prestataire') return 'Service';
    if (role === 'taxi' || role === 'taxi_moto') return 'Taxi Moto';
    if (role === 'livreur' || role === 'delivery') return 'Livreur';
    if (role === 'transitaire') return 'Transitaire';
    if (role === 'agent') return 'Agent';
    if (role === 'admin') return 'Admin';
    return 'Utilisateur';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Hier';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    }
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const formatDetailedTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Liste des conversations - visible quand showChat est false sur mobile */}
      <div className={cn(
        "h-screen flex flex-col",
        showChat ? "hidden md:flex" : "flex"
      )}>
        {/* Header liste */}
        <header className="bg-card border-b border-border sticky top-0 z-40 px-4 py-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-foreground">Messages</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSearchDialog(true)}
              className="gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Nouveau
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('messages.rechercher')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50"
            />
          </div>
        </header>

        {/* Liste des conversations */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">{t('messages.chargementDesConversations')}</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="animate-in fade-in duration-500">
              {/* Section contacts disponibles */}
              {availableContacts.length > 0 ? (
                <>
                  <div className="p-4 border-b border-border">
                    <p className="text-sm font-medium text-muted-foreground">Contacts disponibles</p>
                  </div>
                  <div className="divide-y divide-border">
                    {availableContacts.map((contact, index) => (
                      <button
                        key={contact.id}
                        onClick={() => handleSelectConversation(contact.id)}
                        className={cn(
                          "w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-all duration-200 text-left animate-in fade-in slide-in-from-left-3 border-l-4",
                          selectedConversation === contact.id && "bg-accent shadow-sm",
                          contact.is_vendor ? "border-l-emerald-500" : "border-l-blue-500"
                        )}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <div className="relative">
                          <Avatar className="w-12 h-12 flex-shrink-0">
                            <AvatarImage src={contact.other_user_avatar} />
                            <AvatarFallback className={cn(
                              "text-white",
                              contact.is_vendor ? "bg-[#ff4000]" : "bg-blue-500"
                            )}>
                              {contact.other_user_name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {contact.is_certified && (
                            <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                              <Shield className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {contact.other_user_public_id && (
                              <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {contact.other_user_public_id}
                              </span>
                            )}
                            <p className="font-medium text-foreground truncate">
                              {contact.other_user_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                contact.is_vendor
                                  ? "bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20"
                                  : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              )}
                            >
                              {getRoleLabel(contact)}
                            </Badge>
                            {contact.is_certified && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Shield className="w-3 h-3" />
                                Certifié
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : loadingContacts ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-sm">{t('messages.chargementDesContacts')}</p>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="bg-primary/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">{t('messages.aucunContact')}</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Visitez le marketplace pour découvrir des vendeurs
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map((conv, index) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    "w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-all duration-200 text-left animate-in fade-in slide-in-from-left-3 border-l-4",
                    selectedConversation === conv.id && "bg-accent shadow-sm",
                    conv.is_vendor ? "border-l-emerald-500" : "border-l-blue-500"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12 flex-shrink-0">
                      <AvatarImage src={conv.other_user_avatar} />
                      <AvatarFallback className={cn(
                        "text-white",
                        conv.is_vendor ? "bg-[#ff4000]" : "bg-blue-500"
                      )}>
                        {conv.other_user_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Indicateur de présence en ligne */}
                    {isContactOnline(conv.other_user_id) && (
                      <PresenceBadge
                        status={getContactStatus(conv.other_user_id)}
                        size="md"
                        position="bottom-right"
                      />
                    )}
                    {conv.is_certified && !isContactOnline(conv.other_user_id) && (
                      <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                        <Shield className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {conv.other_user_public_id && (
                          <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
                            {conv.other_user_public_id}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">
                            {conv.other_user_name}
                          </p>
                          {conv.unread_count > 0 && (
                            <span className="bg-destructive text-destructive-foreground rounded-full min-w-5 h-5 flex items-center justify-center text-xs font-bold px-1 animate-pulse shadow-sm">
                              {conv.unread_count > 99 ? '99+' : conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span
                          className="text-xs text-muted-foreground cursor-help"
                          title={formatDetailedTime(conv.last_message_time)}
                        >
                          {formatTime(conv.last_message_time)}
                        </span>
                        {/* Statut en ligne ou dernière connexion */}
                        <span className={cn(
                          "text-[10px]",
                          isContactOnline(conv.other_user_id)
                            ? "text-[#ff4000] dark:text-[#ff4000] font-medium"
                            : "text-muted-foreground"
                        )}>
                          {getLastSeenText(conv.other_user_id)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          conv.is_vendor
                            ? "bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20"
                            : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                        )}
                      >
                        {getRoleLabel(conv)}
                      </Badge>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Zone de chat - visible quand showChat est true sur mobile ou toujours visible sur desktop */}
      <div className={cn(
        "h-screen flex flex-col bg-background",
        showChat ? "flex" : "hidden md:flex md:absolute md:right-0 md:top-0 md:w-[calc(100%-320px)]"
      )}>
        {selectedConversation ? (
          <>
            {/* Header conversation */}
            <header className="bg-card border-b border-border px-3 py-3 flex items-center gap-3 sticky top-0 z-40 shadow-sm backdrop-blur-sm">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToList}
                className="md:hidden flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  if (selectedConvData?.is_vendor && selectedConvData?.vendor_id) {
                    navigate(`/boutique/${selectedConvData.vendor_id}`);
                  } else if (selectedConversation) {
                    navigate(`/profile/${selectedConversation}`);
                  }
                }}
              >
                <Avatar className="w-10 h-10 flex-shrink-0 relative">
                  <AvatarImage src={selectedConvData?.other_user_avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedConvData?.other_user_name?.substring(0, 2).toUpperCase() || 'U'}
                  </AvatarFallback>
                  {/* Indicateur de présence */}
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <PresenceIndicator status={otherUserPresence} size="sm" />
                  </div>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground truncate">
                      {selectedConvData?.other_user_public_id && (
                        <span className="text-primary font-mono text-sm mr-1.5">
                          {selectedConvData.other_user_public_id}
                        </span>
                      )}
                      {selectedConvData?.other_user_name}
                    </p>
                    {selectedConvData?.is_certified && (
                      <Badge variant="default" className="gap-1 flex-shrink-0">
                        <Shield className="w-3 h-3" />
                        Certifié
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedConvData?.is_vendor ? (
                      <Badge variant="secondary" className="text-xs bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">
                        {getRoleLabel(selectedConvData)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {getRoleLabel(selectedConvData || {})}
                      </Badge>
                    )}
                    {/* Indicateur de présence visuel */}
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        otherUserPresence === 'online' && "bg-[#ff4000] animate-pulse",
                        otherUserPresence === 'away' && "bg-[#ff4000]",
                        otherUserPresence === 'busy' && "bg-[#ff4000]",
                        otherUserPresence === 'in_call' && "bg-[#04439e] animate-pulse",
                        otherUserPresence === 'offline' && "bg-gray-400"
                      )} />
                      <span className="text-xs text-muted-foreground">
                        {otherUserPresence === 'online' && 'En ligne'}
                        {otherUserPresence === 'away' && 'Absent'}
                        {otherUserPresence === 'busy' && 'Occupé'}
                        {otherUserPresence === 'in_call' && 'En appel'}
                        {otherUserPresence === 'offline' && 'Hors ligne'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Langue de réception des messages (changeable à tout moment) */}
                <ChatLanguageSelector />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => launchCall('audio')}
                  title="Appel audio"
                >
                  <Phone className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => launchCall('video')}
                  title={t('messages.appelVideo')}
                >
                  <Video className="w-5 h-5" />
                </Button>
                <CallDiagnostics />
              </div>
            </header>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-2">
              <div className="space-y-2 pb-2">
                {messages.length === 0 ? (
                  <div className="text-center py-8 animate-in fade-in duration-500">
                    <div className="bg-primary/5 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                      <MessageCircle className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-base font-medium text-foreground mb-1">
                      Démarrez la conversation
                    </p>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Envoyez votre premier message à {selectedConvData?.other_user_name}
                    </p>
                  </div>
                ) : (
                  messages
                    // Filtrer les messages supprimés pour l'utilisateur courant
                    .filter(message => {
                      const deletedFor = message.deleted_for || [];
                      return !deletedFor.includes(currentUser?.id);
                    })
                    .map((message) => {
                      const isOwnMessage = message.sender_id === currentUser?.id;

                      // Calculer le statut correctement
                      let messageStatus: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' = 'sent';
                      if (message.status) {
                        messageStatus = message.status;
                      } else if (message.read_at) {
                        messageStatus = 'read';
                      } else if (message.delivered_at) {
                        messageStatus = 'delivered';
                      } else {
                        messageStatus = 'sent';
                      }

                      const safeType: 'text' | 'image' | 'video' | 'audio' | 'file' =
                        message.type === 'call' || message.type === 'location'
                          ? 'text'
                          : (message.type as any) || 'text';

                      // Vérifier si le message est supprimé pour tout le monde
                      if (message.deleted_at) {
                        return (
                          <div key={message.id} className={cn(
                            "flex mb-3",
                            isOwnMessage ? "justify-end" : "justify-start"
                          )}>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 text-muted-foreground italic text-sm">
                              <X className="w-4 h-4" />
                              <span>{t('messages.ceMessageAEteSupprime')}</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={message.id} className="mb-3">
                          {/* Afficher le message de réponse s'il existe */}
                          {message.reply_to_id && message.reply_to && (
                            <div className={cn(
                              "flex mb-1",
                              isOwnMessage ? "justify-end" : "justify-start"
                            )}>
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 text-xs max-w-[70%]">
                                <Reply className="w-3 h-3 flex-shrink-0 rotate-180" />
                                <span className="truncate opacity-75">
                                  {message.reply_to.content || 'Message'}
                                </span>
                              </div>
                            </div>
                          )}
                          <TranslatedMessageItem
                            message={{
                              id: message.id,
                              content: safeType !== 'text' ? '' : message.content,
                              timestamp: new Date(message.created_at).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              }),
                              isOwn: isOwnMessage,
                              type: safeType,
                              file_url: message.file_url,
                              file_url_ios: message.file_url_ios,
                              file_name: message.file_name,
                              file_size: message.file_size,
                              audio_format: message.audio_format,
                              audio_format_ios: message.audio_format_ios
                            }}
                            rawContent={safeType !== 'text' ? '' : message.content}
                            isOwn={isOwnMessage}
                            messageId={message.id}
                            targetLanguage={chatLanguage}
                            onReply={() => handleReplyToMessage(message)}
                            onDelete={(msgId, deleteForEveryone) => handleDeleteMessage(msgId, deleteForEveryone)}
                          />
                          {/* Indicateur de statut pour les messages envoyés */}
                          {isOwnMessage && (
                            <div className="flex justify-end mt-0.5 pr-2">
                              <MessageStatusBadge
                                status={messageStatus as any}
                                readAt={message.read_at || undefined}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Indicateur de frappe */}
            {isTyping && (
              <div className="px-4 py-2 bg-muted/30">
                <TypingIndicator
                  userNames={[selectedConvData?.other_user_name || 'Utilisateur']}
                />
              </div>
            )}

            {/* Barre de réponse */}
            {replyToMessage && (
              <ReplyBar
                message={replyToMessage as any}
                onCancel={cancelReply}
                className="mx-3 mt-2"
              />
            )}

            {/* Zone de saisie avec MessageInput */}
            <MessageInput
              onSendText={async (text) => {
                if (!currentUser || !selectedConversation) return;

                // Arrêter l'indicateur de frappe
                setTyping(selectedConversation, false);

                // Si c'est une réponse
                if (replyToMessage) {
                  await universalCommunicationService.sendReplyMessage(
                    `direct_${selectedConversation}`,
                    currentUser.id,
                    text,
                    replyToMessage.id
                  );
                  setReplyToMessage(null);
                } else {
                  const conversationId = `direct_${selectedConversation}`;
                  await universalCommunicationService.sendTextMessage(
                    conversationId,
                    currentUser.id,
                    text
                  );
                }
                loadMessages(selectedConversation);
                loadConversations();
              }}
              onSendFile={handleSendFile}
              disabled={!selectedConversation}
              placeholder={replyToMessage ? "Répondre..." : "Écrivez votre message..."}
              className="sticky bottom-0 z-50"
              onInputChange={handleTyping}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center p-8">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <p className="font-medium">{t('messages.selectionnezUneConversation')}</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Choisissez un contact pour commencer à discuter
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation - caché quand le chat est ouvert sur mobile */}
      <div className={cn(showChat ? "hidden" : "block")}>
        <QuickFooter />
      </div>

      {/* Dialogs Appels Agora */}
      {showAudioCall && selectedConversation && (
        <Dialog open={showAudioCall} onOpenChange={setShowAudioCall}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Appel Audio</DialogTitle>
            </DialogHeader>
            <AgoraAudioCall
              channel={`audio_${selectedConversation}_${currentUser?.id}`}
              callerInfo={{
                name: selectedConvData?.other_user_name || 'Utilisateur',
                avatar: selectedConvData?.other_user_avatar,
                userId: selectedConversation
              }}
              onCallEnd={() => setShowAudioCall(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {showVideoCall && selectedConversation && (
        <Dialog open={showVideoCall} onOpenChange={setShowVideoCall}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{t('messages.appelVideo2')}</DialogTitle>
            </DialogHeader>
            <AgoraVideoCall
              channel={`video_${selectedConversation}_${currentUser?.id}`}
              callerInfo={{
                name: selectedConvData?.other_user_name || 'Utilisateur',
                avatar: selectedConvData?.other_user_avatar,
                userId: selectedConversation
              }}
              onCallEnd={() => setShowVideoCall(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de recherche d'utilisateurs */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Nouvelle conversation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('messages.nomEmailIdVnd0001Ou')}
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="h-64">
              {searchingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="divide-y divide-border">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectSearchResult(user)}
                      className={cn(
                        "w-full p-3 flex items-center gap-3 hover:bg-accent/50 transition-all text-left border-l-4",
                        user.is_vendor ? "border-l-emerald-500" : "border-l-blue-500"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback className={cn(
                            "text-white text-sm",
                            user.is_vendor ? "bg-[#ff4000]" : "bg-blue-500"
                          )}>
                            {user.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {user.is_certified && (
                          <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                            <Shield className="w-2.5 h-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {user.public_id && (
                            <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {user.public_id}
                            </span>
                          )}
                          <p className="font-medium text-foreground truncate text-sm">
                            {user.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              user.is_vendor
                                ? "bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20"
                                : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            )}
                          >
                            {getRoleLabel(user)}
                          </Badge>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {user.email}
                          </p>
                        </div>
                        {user.phone && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ☎️ {user.phone}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : userSearchQuery.trim().length >= 2 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('messages.aucunUtilisateurTrouve')}</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('messages.tapezAuMoins2Caracteres')}</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

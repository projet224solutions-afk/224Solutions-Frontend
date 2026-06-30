/**
 * Messagerie Professionnelle - Interface Mobile-First
 * Composant moderne avec Supabase Realtime
 * Upload vers Google Cloud Storage
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAgora } from '@/hooks/useAgora';
import { useAutoTranslation } from '@/hooks/useAutoTranslation';
import { useStorageUpload, StorageFolder } from '@/hooks/useStorageUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
const AgoraVideoCall = React.lazy(() => import('@/components/communication/AgoraVideoCall'));
const AgoraAudioCall = React.lazy(() => import('@/components/communication/AgoraAudioCall'));
import { AutoTranslatedMessageBubble } from '@/components/messaging/AutoTranslatedMessageBubble';
import { ChatLanguageSelector } from '@/components/messaging/ChatLanguageSelector';
import { Message as CommunicationMessage } from '@/types/communication.types';
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  Paperclip,
  Phone,
  Video,
  MoreVertical,
  CheckCheck,
  ArrowLeft,
  Loader2,
  X,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  type: 'text' | 'image' | 'file';
  file_url?: string;
  file_name?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'received';
  created_at: string;
  isOwn: boolean;
}

interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isOnline: boolean;
  participantId?: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
}

export default function ProfessionalMessaging() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { endCall } = useAgora();
  const { userLanguage } = useAutoTranslation({ autoTranslate: true });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchContacts, setSearchContacts] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hook pour upload vers GCS
  const { uploadFile: uploadToGCS } = useStorageUpload();

  const handleStartCall = (type: 'audio' | 'video') => {
    if (!activeConversation?.participantId || !user?.id) {
      toast.error(t('professionalMessaging.impossibleDeDemarrerLAppel'));
      return;
    }
    setCallType(type);
    setShowCallDialog(true);
  };

  const handleEndCall = () => {
    endCall();
    setShowCallDialog(false);
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: participantsData, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner(id, name, last_message, last_message_at, type)
        `)
        .eq('user_id', user.id)
        .order('conversations(last_message_at)', { ascending: false });

      if (error) throw error;

      const convs: Conversation[] = await Promise.all(
        (participantsData || []).map(async (p: any) => {
          const conv = p.conversations;

          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select(`user_id, profiles!inner(first_name, last_name, avatar_url)`)
            .eq('conversation_id', conv.id)
            .neq('user_id', user.id)
            .maybeSingle();

          const otherProfile = otherParticipant?.profiles as any;

          // ✅ Calculer le nombre réel de messages non lus
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .is('read_at', null);

          return {
            id: conv.id,
            name: conv.name || (otherProfile
              ? `${otherProfile.first_name} ${otherProfile.last_name}`
              : 'Conversation'),
            avatar: otherProfile?.avatar_url,
            lastMessage: conv.last_message || '',
            lastMessageTime: conv.last_message_at,
            unreadCount: unreadCount || 0,
            isOnline: false,
            participantId: otherParticipant?.user_id
          };
        })
      );

      setConversations(convs);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`id, content, sender_id, type, file_url, file_name, status, created_at,
          profiles!messages_sender_id_fkey(first_name, last_name, avatar_url)`)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const msgs: Message[] = (data || []).map((m: any) => ({
        id: m.id,
        content: m.content,
        sender_id: m.sender_id,
        sender_name: m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : '',
        sender_avatar: m.profiles?.avatar_url,
        type: m.type || 'text',
        file_url: m.file_url,
        file_name: m.file_name,
        status: m.status || 'sent',
        created_at: m.created_at,
        isOwn: m.sender_id === user.id
      }));

      setMessages(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [user?.id]);

  const searchForContacts = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setContacts([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url')
        .neq('id', user?.id)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error searching contacts:', error);
    }
  }, [user?.id]);

  const createConversation = async (contact: Contact) => {
    if (!user?.id) return;

    try {
      const { data: existingConv } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (existingConv) {
        for (const cp of existingConv) {
          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', cp.conversation_id)
            .eq('user_id', contact.id)
            .single();

          if (otherParticipant) {
            const conv = conversations.find(c => c.id === cp.conversation_id);
            if (conv) {
              setActiveConversation(conv);
              setShowNewChat(false);
              setShowMobileChat(true);
              return;
            }
          }
        }
      }

      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ name: `${contact.first_name} ${contact.last_name}`, type: 'private', creator_id: user.id })
        .select()
        .single();

      if (convError) throw convError;

      await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id, role: 'admin' },
          { conversation_id: newConv.id, user_id: contact.id, role: 'member' }
        ]);

      const newConversation: Conversation = {
        id: newConv.id,
        name: `${contact.first_name} ${contact.last_name}`,
        avatar: contact.avatar_url,
        lastMessage: '',
        unreadCount: 0,
        isOnline: false,
        participantId: contact.id
      };

      setConversations(prev => [newConversation, ...prev]);
      setActiveConversation(newConversation);
      setShowNewChat(false);
      setShowMobileChat(true);
      toast.success(t('professionalMessaging.conversationCreee'));
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error(t('professionalMessaging.erreurLorsDeLaCreation'));
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !activeConversation || !user?.id) return;

    setIsSending(true);
    let fileUrl = '';
    let fileName = '';
    let messageType: 'text' | 'image' | 'file' = 'text';

    try {
      if (selectedFile) {
        // Déterminer le folder GCS basé sur le type MIME
        let folder: StorageFolder = 'documents';
        if (selectedFile.type.startsWith('image/')) folder = 'products';
        else if (selectedFile.type.startsWith('video/')) folder = 'videos';
        else if (selectedFile.type.startsWith('audio/')) folder = 'audio';

        console.log(`[ProfessionalMessaging] Uploading file to GCS folder: ${folder}`);

        // Upload vers GCS via useStorageUpload
        const uploadResult = await uploadToGCS(selectedFile, {
          folder,
          subfolder: user.id,
        });

        if (!uploadResult.success || !uploadResult.publicUrl) {
          throw new Error(uploadResult.error || 'Upload échoué');
        }

        console.log(`[ProfessionalMessaging] ✅ File uploaded via ${uploadResult.provider}: ${uploadResult.publicUrl}`);

        fileUrl = uploadResult.publicUrl;
        fileName = selectedFile.name;
        messageType = selectedFile.type.startsWith('image/') ? 'image' : 'file';
      }

      const { data: recipient } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', activeConversation.id)
        .neq('user_id', user.id)
        .single();

      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          recipient_id: recipient?.user_id,
          content: newMessage.trim() || fileName,
          type: messageType,
          file_url: fileUrl || null,
          file_name: fileName || null,
          status: 'sent'
        })
        .select()
        .single();

      if (msgError) throw msgError;

      await supabase
        .from('conversations')
        .update({
          last_message: newMessage.trim() || `📎 ${fileName}`,
          last_message_at: new Date().toISOString()
        })
        .eq('id', activeConversation.id);

      const newMsg: Message = {
        id: msgData.id,
        content: newMessage.trim() || fileName,
        sender_id: user.id,
        sender_name: `${profile?.first_name} ${profile?.last_name}`,
        type: messageType,
        file_url: fileUrl,
        file_name: fileName,
        status: 'sent',
        created_at: new Date().toISOString(),
        isOwn: true
      };

      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      setSelectedFile(null);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('professionalMessaging.erreurLorsDeLEnvoi'));
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('professionalMessaging.leFichierNeDoitPas'));
        return;
      }
      setSelectedFile(file);
    }
  };

  const formatConversationTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Hier';
    return format(date, 'dd/MM');
  };

  useEffect(() => {
    if (!activeConversation?.id) return;

    const channel = supabase
      .channel(`messages:${activeConversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversation.id}` },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.sender_id !== user?.id) {
            setMessages(prev => [...prev, {
              id: newMsg.id,
              content: newMsg.content,
              sender_id: newMsg.sender_id,
              type: newMsg.type || 'text',
              file_url: newMsg.file_url,
              file_name: newMsg.file_name,
              status: 'received',
              created_at: newMsg.created_at,
              isOwn: false
            }]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 🔔 Real-time subscription pour synchroniser les badges
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('professional-messaging-unread-sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          console.log('[ProfessionalMessaging] 📩 Nouveau message - rechargement conversations');
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
          console.log('[ProfessionalMessaging] ✅ Message mis à jour - rechargement conversations');
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadConversations]);

  useEffect(() => {
    if (activeConversation?.id) {
      loadMessages(activeConversation.id);
    }
  }, [activeConversation?.id, loadMessages]);

  const filteredConversations = searchQuery
    ? conversations.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  return (
    <div className="flex h-full bg-background">
      {/* Liste des conversations */}
      <div className={cn(
        "flex flex-col border-r border-border bg-card",
        "w-full md:w-80 lg:w-96",
        showMobileChat && activeConversation ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Messages</h1>
            <Button size="icon" variant="ghost" onClick={() => setShowNewChat(true)} className="h-9 w-9">
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('professionalMessaging.rechercher')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-0"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">{t('professionalMessaging.aucuneConversation')}</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => { setActiveConversation(conv); setShowMobileChat(true); }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
                    "hover:bg-accent/50 active:scale-[0.98]",
                    activeConversation?.id === conv.id && "bg-accent"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={conv.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {conv.name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    {conv.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#ff4000] rounded-full border-2 border-background" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{conv.name}</span>
                        {conv.unreadCount > 0 && (
                          <span className="bg-destructive text-destructive-foreground rounded-full min-w-5 h-5 flex items-center justify-center text-xs font-bold px-1 animate-pulse shadow-sm flex-shrink-0">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      {conv.lastMessageTime && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatConversationTime(conv.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {conv.lastMessage || 'Aucun message'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Zone de chat */}
      <div className={cn(
        "flex-1 flex flex-col bg-background",
        !showMobileChat && !activeConversation ? "hidden md:flex" : "flex"
      )}>
        {activeConversation ? (
          <>
            <div className="flex items-center gap-3 p-3 border-b border-border bg-card">
              <Button variant="ghost" size="icon" onClick={() => setShowMobileChat(false)} className="md:hidden h-9 w-9">
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <Avatar className="w-10 h-10">
                <AvatarImage src={activeConversation.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {activeConversation.name?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h2 className="font-semibold truncate">{activeConversation.name}</h2>
                {activeConversation.isOnline && <p className="text-xs text-[#ff4000]">En ligne</p>}
              </div>

              <div className="flex items-center gap-1">
                <ChatLanguageSelector />
                <Button variant="ghost" size="icon" onClick={() => handleStartCall('audio')} className="h-9 w-9">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleStartCall('video')} className="h-9 w-9">
                  <Video className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                  <p>{t('professionalMessaging.aucunMessage')}</p>
                  <p className="text-sm">{t('professionalMessaging.commencezLaConversation')}</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    // Convertir le message local vers le type CommunicationMessage pour la traduction
                    const communicationMsg: CommunicationMessage = {
                      id: msg.id,
                      content: msg.content,
                      sender_id: msg.sender_id,
                      recipient_id: '', // Non utilisé pour la traduction
                      type: msg.type || 'text',
                      status: msg.status as any,
                      created_at: msg.created_at,
                      file_url: msg.file_url,
                      file_name: msg.file_name
                    };

                    return (
                      <div key={msg.id} className={cn("flex mb-3", msg.isOwn ? "justify-end" : "justify-start")}>
                        {!msg.isOwn && msg.sender_avatar && (
                          <Avatar className="w-8 h-8 mr-2 flex-shrink-0">
                            <AvatarImage src={msg.sender_avatar} />
                            <AvatarFallback className="text-xs">{msg.sender_name?.charAt(0) || '?'}</AvatarFallback>
                          </Avatar>
                        )}

                        <div className={cn(
                          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm min-w-0",
                          msg.isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"
                        )}>
                          {msg.type === 'image' && msg.file_url && (
                            <img loading="lazy" src={msg.file_url} alt="Image" className="rounded-lg max-w-full mb-2" />
                          )}
                          {msg.type === 'file' && msg.file_url && (
                            <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm underline mb-2">
                              <Paperclip className="w-4 h-4" />
                              {msg.file_name || 'Fichier'}
                            </a>
                          )}
                          {msg.content && msg.type === 'text' && (
                            <AutoTranslatedMessageBubble
                              message={communicationMsg}
                              userLanguage={userLanguage}
                              isOwn={msg.isOwn}
                            />
                          )}
                          {msg.content && msg.type !== 'text' && (
                            <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                          )}
                          <div className={cn(
                            "flex items-center justify-end gap-1 mt-1",
                            msg.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            <span className="text-[10px]">{format(new Date(msg.created_at), 'HH:mm', { locale: fr })}</span>
                            {msg.isOwn && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </ScrollArea>

            <div className="p-3 border-t border-border bg-card">
              {selectedFile && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg">
                  <Paperclip className="w-4 h-4" />
                  <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedFile(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx" />
                <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 flex-shrink-0">
                  <Paperclip className="w-5 h-5" />
                </Button>

                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t('professionalMessaging.ecrivezVotreMessage')}
                  className="flex-1 bg-muted/50 border-0"
                  disabled={isSending}
                />

                <Button type="submit" size="icon" disabled={(!newMessage.trim() && !selectedFile) || isSending} className="h-10 w-10 flex-shrink-0 rounded-full">
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-20 h-20 mb-4 opacity-20" />
            <p className="text-lg">{t('professionalMessaging.selectionnezUneConversation')}</p>
          </div>
        )}
      </div>

      {/* Dialog nouvelle conversation */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('professionalMessaging.nouvelleConversation')}</DialogTitle>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('professionalMessaging.rechercherUnContact')}
              value={searchContacts}
              onChange={(e) => { setSearchContacts(e.target.value); searchForContacts(e.target.value); }}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[300px]">
            {contacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => createConversation(contact)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Avatar>
                  <AvatarImage src={contact.avatar_url} />
                  <AvatarFallback>{contact.first_name?.[0]}{contact.last_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                  <p className="text-sm text-muted-foreground">{contact.email}</p>
                </div>
              </button>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog appel */}
      <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {callType === 'video' ? (
            <AgoraVideoCall channel={activeConversation?.id || ''} isIncoming={false} onCallEnd={handleEndCall} />
          ) : (
            <AgoraAudioCall channel={activeConversation?.id || ''} isIncoming={false} onCallEnd={handleEndCall} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

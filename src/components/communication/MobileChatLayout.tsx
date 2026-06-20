/**
 * Layout de Chat Mobile-First Réutilisable
 * Composant optimisé pour toutes les interfaces de messagerie
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Send,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Image as _ImageIcon,
  Mic,
  Check,
  CheckCheck,
  Clock,
  Search,
  Plus,
  MessageSquare
} from 'lucide-react';
import { format, isToday, isYesterday, type Locale } from 'date-fns';
import { fr, enUS, es, ar, pt, de, it, ru, ja, ko, zhCN } from 'date-fns/locale';
import { useTranslation } from '@/hooks/useTranslation';

// Mapping des locales date-fns
const dateLocales: Record<string, Locale> = {
  fr, en: enUS, es, ar, pt, de, it, ru, zh: zhCN, ja, ko
};

// Types
export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  type?: 'text' | 'image' | 'file' | 'audio' | 'video';
  file_url?: string;
  file_name?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  created_at: string;
  isOwn: boolean;
}

export interface ChatConversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
  participantId?: string;
  subtitle?: string;
}

interface MobileChatLayoutProps {
  // Données
  conversations: ChatConversation[];
  messages: ChatMessage[];
  currentUserId?: string;

  // État
  selectedConversation: ChatConversation | null;
  isLoading?: boolean;
  isSending?: boolean;

  // Callbacks
  onSelectConversation: (conversation: ChatConversation) => void;
  onSendMessage: (message: string, attachments?: File[]) => void;
  onBack?: () => void;
  onStartCall?: (type: 'audio' | 'video') => void;
  onNewConversation?: () => void;
  onSearch?: (query: string) => void;

  // Options
  showConversationList?: boolean;
  showHeader?: boolean;
  showCallButtons?: boolean;
  title?: string;
  emptyStateMessage?: string;
  placeholder?: string;
  className?: string;
}

// Composant Message Bubble
function MessageBubble({ message, isOwn, locale }: { message: ChatMessage; isOwn: boolean; locale: Locale }) {
  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm', { locale });
  };

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending': return <Clock className="w-3 h-3 text-muted-foreground" />;
      case 'sent': return <Check className="w-3 h-3 text-muted-foreground" />;
      case 'delivered': return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
      case 'read': return <CheckCheck className="w-3 h-3 text-primary" />;
      default: return null;
    }
  };

  return (
    <div className={cn("flex mb-3", isOwn ? "justify-end" : "justify-start")}>
      {!isOwn && message.sender_avatar && (
        <Avatar className="w-8 h-8 mr-2 flex-shrink-0">
          <AvatarImage src={message.sender_avatar} />
          <AvatarFallback className="text-xs">
            {message.sender_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn(
        "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm min-w-0",
        isOwn
          ? "bg-primary text-primary-foreground rounded-br-md"
          : "bg-muted rounded-bl-md"
      )}>
        {!isOwn && message.sender_name && (
          <p className="text-xs font-medium mb-1 opacity-70">
            {message.sender_name}
          </p>
        )}

        {message.type === 'image' && message.file_url && (
          <img
            src={message.file_url}
            alt="Image"
            className="rounded-lg max-w-full mb-2"
          />
        )}

        {message.type === 'file' && message.file_url && (
          <a
            href={message.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm underline mb-2"
          >
            <Paperclip className="w-4 h-4" />
            {message.file_name || 'Fichier'}
          </a>
        )}

        {message.content && (
          <p className="text-sm leading-relaxed break-words">{message.content}</p>
        )}

        <div className={cn(
          "flex items-center justify-end gap-1 mt-1",
          isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          <span className="text-[10px]">{formatTime(message.created_at)}</span>
          {isOwn && getStatusIcon()}
        </div>
      </div>
    </div>
  );
}

// Composant Conversation Item
function ConversationItem({
  conversation,
  isSelected,
  onClick,
  t,
  locale
}: {
  conversation: ChatConversation;
  isSelected: boolean;
  onClick: () => void;
  t: (key: string) => string;
  locale: Locale;
}) {
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm', { locale });
    if (isYesterday(date)) return t('messaging.yesterday') || 'Yesterday';
    return format(date, 'dd/MM', { locale });
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
        "hover:bg-accent/50 active:scale-[0.98]",
        isSelected && "bg-accent"
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="w-12 h-12">
          <AvatarImage src={conversation.avatar} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {conversation.name?.charAt(0)?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        {conversation.isOnline && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#ff4000] rounded-full border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">{conversation.name}</span>
          {conversation.lastMessageTime && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatTime(conversation.lastMessageTime)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-sm text-muted-foreground truncate">
            {conversation.lastMessage || conversation.subtitle || t('messaging.noMessages') || 'No messages'}
          </span>
          {(conversation.unreadCount ?? 0) > 0 && (
            <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs flex-shrink-0">
              {conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// Composant Principal
export default function MobileChatLayout({
  conversations,
  messages,
  currentUserId,
  selectedConversation,
  isLoading = false,
  isSending = false,
  onSelectConversation,
  onSendMessage,
  onBack,
  onStartCall,
  onNewConversation,
  onSearch,
  showConversationList = true,
  showHeader = true,
  showCallButtons = true,
  title = 'Messages',
  emptyStateMessage,
  placeholder,
  className
}: MobileChatLayoutProps) {
  const { t, language } = useTranslation();
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Locale pour date-fns basée sur la langue globale
  const currentLocale = dateLocales[language] || enUS;

  // Valeurs par défaut traduites
  const defaultEmptyMessage = emptyStateMessage || t('messaging.selectConversation') || 'Select a conversation';
  const defaultPlaceholder = placeholder || t('messaging.placeholder') || 'Type your message...';

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle conversation selection on mobile
  const handleSelectConversation = (conv: ChatConversation) => {
    onSelectConversation(conv);
    setShowMobileChat(true);
  };

  // Handle back on mobile
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setShowMobileChat(false);
    }
  };

  // Handle send
  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message.trim());
    setMessage('');
    inputRef.current?.focus();
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  // Filter conversations
  const filteredConversations = searchQuery
    ? conversations.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return (
    <div className={cn("flex h-full bg-background", className)}>
      {/* Liste des conversations */}
      <div className={cn(
        "flex flex-col border-r border-border bg-card",
        "w-full md:w-80 lg:w-96",
        showMobileChat && selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {/* Header liste */}
        {showHeader && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">{title}</h1>
              {onNewConversation && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onNewConversation}
                  className="h-9 w-9"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('mobileChatLayout.rechercher')}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 bg-muted/50 border-0"
              />
            </div>
          </div>
        )}

        {/* Liste */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">{t('messaging.noConversations') || 'No conversations'}</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={selectedConversation?.id === conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  t={t}
                  locale={currentLocale}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Zone de chat */}
      <div className={cn(
        "flex-1 flex flex-col bg-background",
        !showMobileChat && !selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {selectedConversation ? (
          <>
            {/* Header chat */}
            <div className="flex items-center gap-3 p-3 border-b border-border bg-card">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="md:hidden h-9 w-9"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <Avatar className="w-10 h-10">
                <AvatarImage src={selectedConversation.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedConversation.name?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h2 className="font-semibold truncate">{selectedConversation.name}</h2>
                {selectedConversation.isOnline && (
                  <p className="text-xs text-[#ff4000]">En ligne</p>
                )}
              </div>

              {showCallButtons && onStartCall && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onStartCall('audio')}
                    className="h-9 w-9"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onStartCall('video')}
                    className="h-9 w-9"
                  >
                    <Video className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                  <p>{t('messaging.noMessages') || 'No messages'}</p>
                  <p className="text-sm">{t('messaging.startConversation') || 'Start the conversation'}</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.sender_id === currentUserId || msg.isOwn}
                      locale={currentLocale}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border bg-card">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-2"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 flex-shrink-0"
                >
                  <Paperclip className="w-5 h-5" />
                </Button>

                <Input
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={defaultPlaceholder}
                  className="flex-1 bg-muted/50 border-0"
                  disabled={isSending}
                />

                <Button
                  type="submit"
                  size="icon"
                  disabled={!message.trim() || isSending}
                  className="h-10 w-10 flex-shrink-0 rounded-full"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          // État vide
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-20 h-20 mb-4 opacity-20" />
            <p className="text-lg">{defaultEmptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Page de Conversation Directe - Interface Mobile-First
 * Avec présence en ligne, indicateur de frappe, horodatage complet
 * Boutons d'appel audio réellement branchés via WebRTC
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Phone, MoreVertical, Paperclip, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTCCallContext } from "@/components/communication/WebRTCCallProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { signMessagesFileUrls, resolveCommunicationFileUrl } from "@/lib/communication/fileUrls";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslation } from "@/hooks/useTranslation";
import { AutoTranslatedMessageBubble } from "@/components/messaging/AutoTranslatedMessageBubble";
import { useChatLanguage } from "@/hooks/useChatLanguage";
import { ChatLanguageSelector } from "@/components/messaging/ChatLanguageSelector";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  type?: string;
  file_url?: string;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  email?: string;
}

/** Format date separator */
function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return "Hier";
  return format(date, "EEEE d MMMM yyyy", { locale: fr });
}

/** Group messages by date */
function groupMessagesByDate(messages: Message[]): { date: string; messages: Message[] }[] {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const msgDate = format(new Date(msg.created_at), "yyyy-MM-dd");
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({ date: msg.created_at, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

export default function DirectConversation() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { chatLanguage } = useChatLanguage();
  const { callState, startCall } = useWebRTCCallContext();

  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRecipientOnline, setIsRecipientOnline] = useState(false);
  const [recipientLastSeen, setRecipientLastSeen] = useState<string | null>(null);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const presenceDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastPresenceRef = useRef<{ online: boolean; lastSeen: string | null }>({ online: false, lastSeen: null });
  // Set pour anti-doublon realtime
  const messageIdsRef = useRef<Set<string>>(new Set());

  // --- Load recipient profile ---
  useEffect(() => {
    const loadRecipient = async () => {
      if (!userId) {
        toast.error("ID utilisateur manquant");
        navigate("/messages");
        return;
      }
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, email')
          .eq('id', userId)
          .maybeSingle();

        setRecipient(
          profile ?? {
            id: userId,
            first_name: 'Utilisateur',
            last_name: '',
            avatar_url: undefined,
            email: undefined,
          }
        );
      } catch (error) {
        console.error('Erreur chargement profil:', error);
        toast.error(t('directConversation.erreurLorsDuChargement'));
        navigate("/messages");
      } finally {
        setLoading(false);
      }
    };
    loadRecipient();
  }, [userId, navigate]);

  // --- Stabilized presence check ---
  const applyPresence = useCallback((d: any) => {
    if (!d) return;
    const lastActive = d.last_active || d.last_seen || d.updated_at;
    const statusOnline = d.status === 'online' || d.status === 'busy' || d.status === 'in_call';
    const recentlyActive = lastActive && (Date.now() - new Date(lastActive).getTime()) < 90000;
    const isOnline = statusOnline && recentlyActive;
    const lastSeen = d.last_seen || d.last_active || null;

    if (lastPresenceRef.current.online !== isOnline || lastPresenceRef.current.lastSeen !== lastSeen) {
      lastPresenceRef.current = { online: isOnline, lastSeen };
      setIsRecipientOnline(isOnline);
      setRecipientLastSeen(lastSeen);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchPresence = async () => {
      const { data } = await supabase
        .from('user_presence' as any)
        .select('status, last_seen, last_active, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      applyPresence(data);
    };

    fetchPresence();

    const channel = supabase
      .channel(`presence-watch-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
          presenceDebounceRef.current = setTimeout(() => {
            applyPresence(payload.new);
          }, 1500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
    };
  }, [userId, applyPresence]);

  // --- Typing indicator (broadcast) ---
  useEffect(() => {
    if (!userId || !user?.id) return;

    const channelName = [user.id, userId].sort().join('-');
    const typingChannel = supabase.channel(`typing:${channelName}`);

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.user_id === userId) {
          setIsRecipientTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsRecipientTyping(false), 3000);
        }
      })
      .on('broadcast', { event: 'stop_typing' }, (payload) => {
        if (payload.payload?.user_id === userId) {
          setIsRecipientTyping(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [userId, user?.id]);

  const sendTypingIndicator = useCallback(() => {
    if (!userId || !user?.id) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;

    const channelName = [user.id, userId].sort().join('-');
    supabase.channel(`typing:${channelName}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id }
    });
  }, [userId, user?.id]);

  const sendStopTyping = useCallback(() => {
    if (!userId || !user?.id) return;
    const channelName = [user.id, userId].sort().join('-');
    supabase.channel(`typing:${channelName}`).send({
      type: 'broadcast',
      event: 'stop_typing',
      payload: { user_id: user.id }
    });
  }, [userId, user?.id]);

  // --- Load messages + realtime avec ANTI-DOUBLON ---
  useEffect(() => {
    if (!userId || !user?.id) return;

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, content, sender_id, created_at, type, file_url, translated_text, original_language, target_language')
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        const msgs = data || [];
        // Initialiser le set anti-doublon
        messageIdsRef.current = new Set(msgs.map(m => m.id));
        // 🔐 Signer les pièces jointes (bucket privé)
        setMessages(await signMessagesFileUrls(msgs));
      } catch (error) {
        console.error('Erreur chargement messages:', error);
      }
    };

    loadMessages();

    // Filtre strict : seulement les messages de cette conversation
    const channel = supabase
      .channel(`direct-msg-${[user.id, userId].sort().join('-')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          // Vérifier que c'est bien cette conversation
          const isRelevant = (
            (msg.sender_id === user.id && (payload.new as any).recipient_id === userId) ||
            (msg.sender_id === userId && (payload.new as any).recipient_id === user.id)
          );
          if (!isRelevant) return;

          // Anti-doublon
          if (messageIdsRef.current.has(msg.id)) return;
          messageIdsRef.current.add(msg.id);

          // 🔐 Signer la pièce jointe éventuelle (bucket privé)
          if (msg.file_url) {
            resolveCommunicationFileUrl(msg.file_url).then((signed) => {
              setMessages(prev => [...prev, { ...msg, file_url: signed || msg.file_url }]);
            });
          } else {
            setMessages(prev => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, user?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!loading && recipient) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [loading, recipient]);

  // --- Handle input change ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      sendTypingIndicator();
    }
  };

  // --- Send message ---
  const handleSend = async () => {
    if (!newMessage.trim() || !user?.id || !userId) return;

    sendStopTyping();
    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: newMessage.trim(),
          sender_id: user.id,
          recipient_id: userId,
          type: 'text',
          status: 'sent'
        });

      if (error) throw error;
      setNewMessage("");
      inputRef.current?.focus();
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error(t('directConversation.erreurLorsDeLEnvoi'));
    } finally {
      setSending(false);
    }
  };

  // --- Appel audio ---
  const handleAudioCall = useCallback(async () => {
    if (!recipient || !userId) return;
    await startCall(userId, {
      name: `${recipient.first_name} ${recipient.last_name}`.trim(),
      avatar: recipient.avatar_url,
    });
  }, [recipient, userId, startCall]);

  const isInCall = callState.isInCall || callState.isCalling || callState.isReceivingCall;

  // --- Format last seen ---
  const formatLastSeen = (dateStr: string | null): string => {
    if (!dateStr) return "Hors ligne";
    const date = new Date(dateStr);
    if (isToday(date)) return `Vu à ${format(date, 'HH:mm')}`;
    if (isYesterday(date)) return `Vu hier à ${format(date, 'HH:mm')}`;
    return `Vu le ${format(date, 'd MMM à HH:mm', { locale: fr })}`;
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">{t('directConversation.veuillezVousConnecterPourEnvoyer')}</p>
        <Button onClick={() => navigate('/auth')}>Se connecter</Button>
      </div>
    );
  }

  if (!recipient) return null;

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-[200]">
      {/* --- Header --- */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card/95 backdrop-blur-sm shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-10 w-10 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="relative">
          <Avatar className="w-11 h-11 ring-2 ring-primary/20">
            <AvatarImage src={recipient.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
              {recipient.first_name?.[0]?.toUpperCase()}{recipient.last_name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isRecipientOnline && (
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#ff4000] border-2 border-card" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg truncate">
            {recipient.first_name} {recipient.last_name}
          </h1>
          <div className="flex items-center gap-1.5">
            {isRecipientTyping ? (
              <span className="text-xs text-primary font-medium animate-pulse">
                écrit un message...
              </span>
            ) : isRecipientOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#ff4000]" />
                <span className="text-xs text-[#ff4000] font-medium">En ligne</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                {formatLastSeen(recipientLastSeen)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Choix de la langue de réception des messages (changeable à tout moment) */}
          <ChatLanguageSelector />
          {/* Bouton d'appel RÉELLEMENT branché */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary",
              isInCall && "opacity-50 cursor-not-allowed"
            )}
            onClick={handleAudioCall}
            disabled={isInCall}
            title={isInCall ? "Appel en cours" : "Appel audio"}
          >
            <Phone className="w-5 h-5" />
          </Button>
          {/* Vidéo masquée - non implémentée en WebRTC natif */}
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-muted">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* --- Messages --- */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
            <Avatar className="w-24 h-24 mb-6 ring-4 ring-primary/10">
              <AvatarImage src={recipient.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-3xl font-bold">
                {recipient.first_name?.[0]?.toUpperCase()}{recipient.last_name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="font-semibold text-lg text-foreground mb-1">
              {recipient.first_name} {recipient.last_name}
            </p>
            <p className="text-sm text-muted-foreground">{t('directConversation.commencezLaConversation')}</p>
          </div>
        ) : (
          <>
            {messageGroups.map((group, gi) => (
              <div key={gi}>
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium shadow-sm">
                    {formatDateSeparator(group.date)}
                  </span>
                </div>

                {group.messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn("flex mb-3", isOwn ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm transition-all",
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}>
                        {msg.file_url && msg.type === 'image' && (
                          <img loading="lazy" src={msg.file_url} alt="Image" className="rounded-lg max-w-full mb-2" />
                        )}
                        {msg.content && (
                          <AutoTranslatedMessageBubble
                            message={msg as any}
                            userLanguage={chatLanguage as any}
                            isOwn={isOwn}
                          />
                        )}
                        <div className={cn(
                          "flex items-center justify-end gap-1 mt-1",
                          isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          <span className="text-[10px]">
                            {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                          </span>
                          {isOwn && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {isRecipientTyping && (
              <div className="flex justify-start mb-3">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </ScrollArea>

      {/* --- Input bar --- */}
      <div className="p-3 border-t border-border bg-card/95 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 flex-shrink-0 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
            <Paperclip className="w-5 h-5" />
          </Button>

          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              onBlur={sendStopTyping}
              placeholder={t('messaging.placeholder') || "Tapez votre message..."}
              className="w-full h-11 bg-muted/60 border border-border/50 rounded-full px-5 pr-4
                         focus:bg-background focus:border-primary/30 focus:ring-2 focus:ring-primary/10
                         placeholder:text-muted-foreground/60 transition-all"
              disabled={sending}
            />
          </div>

          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim() || sending}
            className={cn(
              "h-11 w-11 flex-shrink-0 rounded-full transition-all duration-200",
              newMessage.trim()
                ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send className={cn("w-5 h-5 transition-transform", sending && "animate-pulse")} />
          </Button>
        </form>
        <div className="h-safe-area-inset-bottom" />
      </div>
    </div>
  );
}

/**
 * Chat de Livraison - Interface Mobile-First
 * Communication Client ↔ Livreur
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Phone, MapPin, ArrowLeft, MoreVertical, CheckCheck, Package } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DeliveryChatProps {
  deliveryId: string;
  recipientId: string;
  recipientName: string;
  recipientRole: 'client' | 'livreur' | 'vendeur';
  recipientAvatar?: string;
  onBack?: () => void;
  className?: string;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function DeliveryChat({
  deliveryId,
  recipientId,
  recipientName,
  recipientRole,
  recipientAvatar,
  onBack,
  className
}: DeliveryChatProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger les messages
  const loadMessages = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('delivery_messages')
        .select('*')
        .eq('delivery_id', deliveryId)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Marquer comme lu
      await supabase
        .from('delivery_messages')
        .update({ is_read: true })
        .eq('delivery_id', deliveryId)
        .eq('recipient_id', user.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
  };

  // Envoyer un message
  const sendMessage = async () => {
    if (!user || !newMessage.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('delivery_messages')
        .insert({
          delivery_id: deliveryId,
          sender_id: user.id,
          recipient_id: recipientId,
          content: newMessage.trim(),
          message_type: 'text'
        });

      if (error) throw error;

      setNewMessage('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error(t('deliveryChat.erreurLorsDeLEnvoi'));
    } finally {
      setLoading(false);
    }
  };

  // Écouter les nouveaux messages
  useEffect(() => {
    if (!user) return;

    loadMessages();

    const channel = supabase
      .channel(`delivery_chat_${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_messages',
          filter: `delivery_id=eq.${deliveryId}`
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, deliveryId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!user) return null;

  const getRoleBadge = () => {
    switch (recipientRole) {
      case 'livreur': return { icon: '🚴', label: 'Livreur', variant: 'default' as const };
      case 'vendeur': return { icon: '🏪', label: t('deliveryChat.vendeur'), variant: 'secondary' as const };
      default: return { icon: '👤', label: t('deliveryChat.client'), variant: 'outline' as const };
    }
  };

  const badge = getRoleBadge();

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}

        <Avatar className="w-10 h-10">
          <AvatarImage src={recipientAvatar} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {recipientName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold truncate">{recipientName}</h2>
            <Badge variant={badge.variant} className="text-xs h-5">
              {badge.icon} {badge.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Livraison #{deliveryId.slice(0, 8)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Phone className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MapPin className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
            <Package className="w-16 h-16 mb-4 opacity-30" />
            <p className="font-medium text-foreground">{t('deliveryChat.aucunMessage')}</p>
            <p className="text-sm">{t('deliveryChat.commencezLaConversationPourCette')}</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isOwn = message.sender_id === user.id;
              return (
                <div
                  key={message.id}
                  className={cn("flex mb-3", isOwn ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}
                  >
                    <p className="text-sm leading-relaxed break-words">{message.content}</p>
                    <div className={cn(
                      "flex items-center justify-end gap-1 mt-1",
                      isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      <span className="text-[10px]">
                        {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
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
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('deliveryChat.ecrivezVotreMessage')}
            className="flex-1 bg-muted/50 border-0"
            disabled={loading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !newMessage.trim()}
            className="h-10 w-10 flex-shrink-0 rounded-full"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/**
 * 🚖 Chat Taxi - Communication Client ↔ Chauffeur
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Phone, MapPin, Navigation } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TaxiChatProps {
  rideId: string;
  recipientId: string;
  recipientName: string;
  recipientRole: 'client' | 'taxi';
  currentStatus?: string;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function TaxiChat({
  rideId,
  recipientId,
  recipientName,
  recipientRole,
  currentStatus
}: TaxiChatProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Charger les messages
  const loadMessages = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('taxi_messages')
        .select('*')
        .eq('ride_id', rideId)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Marquer comme lu
      await supabase
        .from('taxi_messages')
        .update({ is_read: true })
        .eq('ride_id', rideId)
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
        .from('taxi_messages')
        .insert({
          ride_id: rideId,
          sender_id: user.id,
          recipient_id: recipientId,
          content: newMessage.trim(),
          message_type: 'text'
        });

      if (error) throw error;

      setNewMessage('');
      loadMessages();
      toast.success(t('taxiChat.messageEnvoye'));
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error(t('taxiChat.erreurLorsDeLEnvoi'));
    } finally {
      setLoading(false);
    }
  };

  // Messages pré-définis
  const quickMessages = [
    "Je suis arrivé",
    "J'arrive dans 2 minutes",
    "Où êtes-vous exactement ?",
    "Merci pour la course"
  ];

  const sendQuickMessage = (message: string) => {
    setNewMessage(message);
  };

  // Écouter les nouveaux messages en temps réel
  useEffect(() => {
    if (!user) return;

    loadMessages();

    const channel = supabase
      .channel(`taxi_chat_${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'taxi_messages',
          filter: `ride_id=eq.${rideId}`
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
  }, [user, rideId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!user) return null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-[#ff4000] text-white">
                {recipientName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{recipientName}</CardTitle>
              <div className="flex gap-2 items-center">
                <Badge variant="outline" className="text-xs">
                  {recipientRole === 'taxi' ? '🚖 Chauffeur' : '👤 Client'}
                </Badge>
                {currentStatus && (
                  <Badge className="text-xs">
                    {currentStatus}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Phone className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline">
              <Navigation className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Messages rapides */}
        <div className="flex flex-wrap gap-2 pb-2 border-b">
          {quickMessages.map((msg, idx) => (
            <Button
              key={idx}
              size="sm"
              variant="outline"
              onClick={() => sendQuickMessage(msg)}
              className="text-xs"
            >
              {msg}
            </Button>
          ))}
        </div>

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Navigation className="h-12 w-12 mb-2 opacity-50" />
            <p>{t('taxiChat.aucunMessagePourCetteCourse')}</p>
            <p className="text-sm">{t('taxiChat.utilisezLesMessagesRapidesCi')}</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === user.id;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isOwn
                      ? 'bg-[#ff4000] text-white'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('taxiChat.ecrivezVotreMessage')}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
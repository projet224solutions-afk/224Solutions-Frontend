import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useVendorSubscription } from '@/hooks/useVendorSubscription';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Plus,
  Clock,
  Send,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SupportTicket {
  id: string;
  ticket_number: string;
  user_plan: string;
  priority: string;
  status: string;
  category: string;
  subject: string;
  description: string;
  created_at: string;
  response_time_minutes: number | null;
  first_response_at: string | null;
}

interface TicketMessage {
  id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

const priorityConfig = {
  low: { label: 'Faible', color: 'bg-gray-500' },
  normal: { label: 'Normal', color: 'bg-blue-500' },
  high: { label: "Élevée", color: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'bg-[#ff4000]' },
  critical: { label: 'Critique', color: 'bg-[#ff4000]' }
};

const statusConfig = {
  open: { label: 'Ouvert', color: 'bg-blue-500' },
  in_progress: { label: 'En cours', color: 'bg-[#ff4000]' },
  waiting_response: { label: 'En attente', color: 'bg-[#04439e]' },
  resolved: { label: "Résolu", color: 'bg-[#ff4000]' },
  closed: { label: "Fermé", color: 'bg-gray-500' }
};

export function SupportTicketSystem() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscription } = useVendorSubscription();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Formulaire nouveau ticket
  const [newTicket, setNewTicket] = useState({
    category: 'technical',
    subject: '',
    description: ''
  });

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets' as any)
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data as any) || []);
    } catch (error) {
      console.error('Erreur chargement tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { data, error} = await supabase
        .from('support_messages' as any)
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as any) || []);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
  };

  const createTicket = async () => {
    if (!user || !subscription) return;

    if (!newTicket.subject || !newTicket.description) {
      toast({
        title: 'Erreur',
        description: t('supportTicketSystem.veuillezRemplirTousLesChamps'),
        variant: 'destructive'
      });
      return;
    }

    try {
      // Déterminer la priorité selon le plan
      let priority = 'normal';
      const planName = subscription.plan_name?.toLowerCase();

      if (planName === 'business' || planName === 'premium') {
        priority = 'high';
      } else if (planName === 'pro') {
        priority = 'normal';
      }

      const { error } = await supabase
        .from('support_tickets' as any)
        .insert({
          user_id: user.id,
          user_plan: subscription.plan_name || 'free',
          priority,
          category: newTicket.category,
          subject: newTicket.subject,
          description: newTicket.description
        });

      if (error) throw error;

      toast({
        title: t('supportTicketSystem.ticketCree'),
        description: t('supportTicketSystem.votreTicketDeSupportA')
      });

      setNewTicket({ category: 'technical', subject: '', description: '' });
      loadTickets();
    } catch (error) {
      console.error('Erreur création ticket:', error);
      toast({
        title: 'Erreur',
        description: t('supportTicketSystem.impossibleDeCreerLeTicket'),
        variant: 'destructive'
      });
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedTicket || !newMessage.trim()) return;

    try {
      setSending(true);
      const { error } = await supabase
        .from('support_messages' as any)
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          sender_type: 'user',
          message: newMessage
        });

      if (error) throw error;

      setNewMessage('');
      loadMessages(selectedTicket.id);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast({
        title: 'Erreur',
        description: t('supportTicketSystem.impossibleDEnvoyerLeMessage'),
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const config = priorityConfig[priority as keyof typeof priorityConfig];
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Support {subscription?.plan_name ? `- Plan ${subscription.plan_name}` : ''}</h2>
          <p className="text-muted-foreground">
            {subscription?.plan_name === 'business' || subscription?.plan_name === 'premium'
              ? '🚀 Support prioritaire activé - Réponse garantie sous 2h'
              : 'Support standard - Réponse sous 24h'}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('supportTicketSystem.creerUnTicketDeSupport')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('supportTicketSystem.categorie')}</label>
                <Select
                  value={newTicket.category}
                  onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technique</SelectItem>
                    <SelectItem value="billing">Facturation</SelectItem>
                    <SelectItem value="feature_request">{t('supportTicketSystem.demandeDeFonctionnalite')}</SelectItem>
                    <SelectItem value="bug_report">{t('supportTicketSystem.signalerUnBug')}</SelectItem>
                    <SelectItem value="account">Compte</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Sujet</label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder={t('supportTicketSystem.resumeDuProbleme')}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder={t('supportTicketSystem.decrivezVotreProblemeEnDetail')}
                  rows={6}
                />
              </div>

              <Button onClick={createTicket} className="w-full">
                Créer le ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="tickets" className="w-full">
        <TabsList>
          <TabsTrigger value="tickets">Mes tickets</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">
                  Aucun ticket de support pour le moment
                </p>
              </CardContent>
            </Card>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedTicket(ticket)}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {ticket.subject}
                        <span className="text-sm font-normal text-muted-foreground">#{ticket.ticket_number}</span>
                      </CardTitle>
                      <CardDescription>
                        Créé {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: fr })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {getPriorityBadge(ticket.priority)}
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                  {ticket.first_response_at && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Première réponse: {ticket.response_time_minutes} min
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tickets ouverts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('supportTicketSystem.ticketsResolus')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#ff4000]">
                  {tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('supportTicketSystem.tempsDeReponseMoyen')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {tickets.filter(t => t.response_time_minutes).length > 0
                    ? Math.round(tickets.reduce((acc, t) => acc + (t.response_time_minutes || 0), 0) / tickets.filter(t => t.response_time_minutes).length)
                    : 0} min
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog pour voir les messages d'un ticket */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket?.subject} - #{selectedTicket?.ticket_number}
            </DialogTitle>
            <div className="flex gap-2 mt-2">
              {selectedTicket && getPriorityBadge(selectedTicket.priority)}
              {selectedTicket && getStatusBadge(selectedTicket.status)}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-muted/10 rounded-lg">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.sender_type === 'user'
                    ? 'bg-primary text-primary-foreground ml-8'
                    : 'bg-background border mr-8'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm">
                    {msg.sender_type === 'user' ? 'Vous' : 'Support'}
                  </span>
                  <span className="text-xs opacity-70">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('supportTicketSystem.votreMessage')}
              rows={3}
            />
            <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

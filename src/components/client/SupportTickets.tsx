import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Send } from 'lucide-react';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  requester_id: string;
  vendor_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

const statusColors = {
  open: 'bg-blue-500',
  in_progress: 'bg-[#ff4000]',
  resolved: 'bg-[#ff4000]',
  closed: 'bg-gray-500',
};

const priorityColors = {
  low: 'bg-gray-500',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-[#ff4000]',
};

export function SupportTickets() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');

  // Form state for new ticket
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium' as TicketPriority,
  });

  // Fetch tickets created by current user
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets', user?.id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select('*')
        .eq('requester_id', user!.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user,
  });

  // Fetch messages for selected ticket
  const { data: messages } = useQuery({
    queryKey: ['ticket-messages', selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', selectedTicket!.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as TicketMessage[];
    },
    enabled: !!selectedTicket,
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: typeof newTicket) => {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          subject: ticketData.subject,
          description: ticketData.description,
          category: ticketData.category,
          priority: ticketData.priority,
          requester_id: user!.id,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setShowNewTicketForm(false);
      setNewTicket({
        subject: '',
        description: '',
        category: 'technique',
        priority: 'medium',
      });
      toast({
        title: 'Ticket créé',
        description: 'Votre demande de support a été créée avec succès.',
      });
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le ticket.',
        variant: 'destructive',
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: selectedTicket!.id,
          sender_id: user!.id,
          message,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-messages'] });
      setNewMessage('');
      toast({
        title: 'Message envoyé',
        description: 'Votre message a été envoyé avec succès.',
      });
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer le message.',
        variant: 'destructive',
      });
    },
  });

  const handleCreateTicket = () => {
    if (!newTicket.subject || !newTicket.description) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs requis.',
        variant: 'destructive',
      });
      return;
    }
    createTicketMutation.mutate(newTicket);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Tickets List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mes Tickets</CardTitle>
                <CardDescription>{t('supportTickets.supportClient')}</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowNewTicketForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('supportTickets.tous')}</SelectItem>
                <SelectItem value="open">Ouverts</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="resolved">{t('supportTickets.resolus')}</SelectItem>
                <SelectItem value="closed">{t('supportTickets.fermes')}</SelectItem>
              </SelectContent>
            </Select>

            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {tickets?.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className={`cursor-pointer hover:bg-accent transition-colors ${
                      selectedTicket?.id === ticket.id ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground">#{ticket.ticket_number}</p>
                        </div>
                        <Badge className={priorityColors[ticket.priority]}>
                          {ticket.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={statusColors[ticket.status]}>
                          {ticket.status}
                        </Badge>
                        <Badge variant="outline">{ticket.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Details / New Ticket Form */}
      <div className="lg:col-span-2">
        {showNewTicketForm ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('supportTickets.nouveauTicketDeSupport')}</CardTitle>
              <CardDescription>{t('supportTickets.decrivezVotreProblemeOuVotre')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Sujet *</label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder={t('supportTickets.resumeDeVotreDemande')}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description *</label>
                <Textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder={t('supportTickets.decrivezVotreProblemeEnDetail')}
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('supportTickets.categorie')}</label>
                  <Select
                    value={newTicket.category}
                    onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technique">Technique</SelectItem>
                      <SelectItem value="facturation">Facturation</SelectItem>
                      <SelectItem value="produit">Produit</SelectItem>
                      <SelectItem value="livraison">Livraison</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t('supportTickets.priorite')}</label>
                  <Select
                    value={newTicket.priority}
                    onValueChange={(value) => setNewTicket({ ...newTicket, priority: value as TicketPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Basse</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="high">Haute</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateTicket} disabled={createTicketMutation.isPending}>
                  {createTicketMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Créer le ticket
                </Button>
                <Button variant="outline" onClick={() => setShowNewTicketForm(false)}>
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : selectedTicket ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedTicket.subject}</CardTitle>
                  <CardDescription>Ticket #{selectedTicket.ticket_number}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge className={statusColors[selectedTicket.status]}>
                    {selectedTicket.status}
                  </Badge>
                  <Badge className={priorityColors[selectedTicket.priority]}>
                    {selectedTicket.priority}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Description</p>
                <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Messages</p>
                <ScrollArea className="h-[400px] border rounded-md p-4">
                  <div className="space-y-4">
                    {messages?.map((message) => (
                      <div
                        key={message.id}
                        className={`p-3 rounded-lg ${
                          message.sender_id === user?.id
                            ? 'bg-primary text-primary-foreground ml-8'
                            : 'bg-muted mr-8'
                        }`}
                      >
                        <p className="text-sm">{message.message}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {new Date(message.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t('supportTickets.votreMessage')}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} disabled={sendMessageMutation.isPending}>
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-[600px]">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">{t('supportTickets.selectionnezUnTicketOuCreez')}</p>
                <Button onClick={() => setShowNewTicketForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Ticket
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

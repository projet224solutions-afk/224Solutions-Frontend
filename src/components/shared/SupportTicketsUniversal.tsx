import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Headphones, Loader2, Lock, Plus, Send, TicketIcon } from 'lucide-react';

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
  created_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

const statusLabels: Record<TicketStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

const statusColors: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-orange-100 text-[#ff4000] border-orange-200',
  resolved: 'bg-orange-100 text-[#ff4000] border-orange-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const priorityLabels: Record<TicketPriority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-orange-100 text-[#ff4000]',
};

export function SupportTicketsUniversal() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');

  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium' as TicketPriority,
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets-universal', user?.id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select('*')
        .eq('requester_id', user!.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user,
  });

  const { data: messages } = useQuery({
    queryKey: ['ticket-messages-universal', selectedTicket?.id],
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
    refetchInterval: 8000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          subject: form.subject,
          description: form.description,
          category: form.category,
          priority: form.priority,
          requester_id: user!.id,
          status: 'open',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets-universal'] });
      setShowForm(false);
      setForm({ subject: '', description: '', category: 'general', priority: 'medium' });
      toast({ title: t('supportTicketsUniversal.ticketCree'), description: t('supportTicketsUniversal.votreDemandeAEteTransmise') });
    },
    onError: () => {
      toast({ title: 'Erreur', description: t('supportTicketsUniversal.impossibleDeCreerLeTicket'), variant: 'destructive' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase
        .from('support_ticket_messages')
        .insert({ ticket_id: selectedTicket!.id, sender_id: user!.id, message });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-messages-universal'] });
      setNewMessage('');
    },
    onError: () => {
      toast({ title: 'Erreur', description: t('supportTicketsUniversal.impossibleDEnvoyerLeMessage'), variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast({ title: 'Champs requis', description: t('supportTicketsUniversal.sujetEtDescriptionSontObligatoires'), variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage);
  };

  const isClosed = selectedTicket?.status === 'closed' || selectedTicket?.status === 'resolved';

  if (!user) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center gap-3">
          <Headphones className="w-10 h-10 text-muted-foreground opacity-50" />
          <div>
            <p className="font-medium">Support Technique</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connectez-vous à votre compte pour accéder au support.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Support Technique</h2>
            <p className="text-sm text-muted-foreground">{t('supportTicketsUniversal.contactezNotreEquipeDAssistance')}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setShowForm(true); setSelectedTicket(null); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau ticket
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Liste des tickets */}
        <div className="lg:col-span-1 space-y-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('supportTicketsUniversal.tousLesTickets')}</SelectItem>
              <SelectItem value="open">Ouverts</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="resolved">{t('supportTicketsUniversal.resolus')}</SelectItem>
              <SelectItem value="closed">{t('supportTicketsUniversal.fermes')}</SelectItem>
            </SelectContent>
          </Select>

          <ScrollArea className="h-[500px]">
            <div className="space-y-2 pr-2">
              {tickets?.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <TicketIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('supportTicketsUniversal.aucunTicketTrouve')}</p>
                </div>
              )}
              {tickets?.map((ticket) => (
                <Card
                  key={ticket.id}
                  className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${
                    selectedTicket?.id === ticket.id
                      ? 'border-l-primary ring-1 ring-primary/30'
                      : ticket.status === 'open'
                      ? 'border-l-blue-500'
                      : ticket.status === 'in_progress'
                      ? 'border-l-yellow-500'
                      : ticket.status === 'resolved'
                      ? 'border-l-green-500'
                      : 'border-l-gray-300'
                  }`}
                  onClick={() => { setSelectedTicket(ticket); setShowForm(false); }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="font-medium text-sm leading-tight line-clamp-2">{ticket.subject}</p>
                      <Badge className={`text-[10px] shrink-0 ${priorityColors[ticket.priority]}`}>
                        {priorityLabels[ticket.priority]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${statusColors[ticket.status]}`}>
                        {statusLabels[ticket.status]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">#{ticket.ticket_number}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Détail / Formulaire */}
        <div className="lg:col-span-2">
          {showForm ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('supportTicketsUniversal.nouveauTicketDeSupport')}</CardTitle>
                <CardDescription>{t('supportTicketsUniversal.decrivezVotreProblemeNotreEquipe')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sujet *</label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder={t('supportTicketsUniversal.resumeDeVotreDemande')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description *</label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={t('supportTicketsUniversal.decrivezVotreProblemeEnDetail')}
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('supportTicketsUniversal.categorie')}</label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">{t('supportTicketsUniversal.general')}</SelectItem>
                        <SelectItem value="technical">Technique</SelectItem>
                        <SelectItem value="billing">Facturation</SelectItem>
                        <SelectItem value="account">Compte</SelectItem>
                        <SelectItem value="payment">{t('supportTicketsUniversal.paiement')}</SelectItem>
                        <SelectItem value="delivery">{t('supportTicketsUniversal.livraison')}</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('supportTicketsUniversal.priorite')}</label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Envoyer la demande
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>{t('supportTicketsUniversal.annuler')}</Button>
                </div>
              </CardContent>
            </Card>
          ) : selectedTicket ? (
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                    <CardDescription>Ticket #{selectedTicket.ticket_number}</CardDescription>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Badge variant="outline" className={statusColors[selectedTicket.status]}>
                      {statusLabels[selectedTicket.status]}
                    </Badge>
                    <Badge className={priorityColors[selectedTicket.priority]}>
                      {priorityLabels[selectedTicket.priority]}
                    </Badge>
                  </div>
                </div>
                {selectedTicket.description && (
                  <p className="text-sm text-muted-foreground mt-2 bg-muted/50 rounded p-2.5">
                    {selectedTicket.description}
                  </p>
                )}
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conversation</p>

                <ScrollArea className="h-[320px] border rounded-lg bg-muted/20 p-3">
                  <div className="space-y-3">
                    {messages?.length === 0 && (
                      <p className="text-sm text-center text-muted-foreground py-8">
                        Aucun message — l'équipe support vous répondra ici
                      </p>
                    )}
                    {messages?.map((msg) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                              isMe
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-white border text-foreground rounded-bl-sm'
                            }`}
                          >
                            {!isMe && (
                              <p className="text-[10px] font-semibold text-orange-600 mb-0.5">Support 224Solutions</p>
                            )}
                            <p className="leading-relaxed">{msg.message}</p>
                            <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {new Date(msg.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {isClosed ? (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-dashed">
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Ce ticket est {selectedTicket.status === 'resolved' ? 'résolu' : 'fermé'} — vous ne pouvez plus envoyer de messages.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t('supportTicketsUniversal.votreMessage')}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      className="flex-1"
                    />
                    <Button onClick={handleSend} disabled={sendMutation.isPending || !newMessage.trim()}>
                      {sendMutation.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-[460px] text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Headphones className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Centre d'assistance</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sélectionnez un ticket existant ou créez une nouvelle demande
                  </p>
                </div>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau ticket
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupportTicketsUniversal;

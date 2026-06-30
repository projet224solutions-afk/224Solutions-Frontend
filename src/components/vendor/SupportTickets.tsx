import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MessageSquare, Clock, Search, Filter, Plus, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface TicketMessage {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
  is_internal: boolean;
}

const statusColors = {
  open: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  in_progress: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
  waiting_response: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  resolved: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
  closed: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const priorityColors = {
  low: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  medium: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  urgent: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
};

const categoryLabels = {
  technique: 'Technique',
  facturation: 'Facturation',
  produit: 'Produit',
  livraison: 'Livraison',
  autre: 'Autre',
};

const statusLabels = {
  open: 'Ouvert',
  in_progress: 'En cours',
  waiting_response: 'En attente',
  resolved: 'Résolu',
  closed: 'Fermé',
};

const priorityLabels = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

export default function SupportTickets() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isMessagesDialogOpen, setIsMessagesDialogOpen] = useState(false);

  // Form states
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'technique',
    priority: 'medium',
  });

  useEffect(() => {
    if (!vendorLoading && (user || vendorId)) {
      loadTickets();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, vendorId, vendorLoading]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      } else {
        query = query.eq('requester_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      console.error('Erreur chargement tickets:', error);
      toast.error(t('supportTickets.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async () => {
    if (!newTicket.subject || !newTicket.description) {
      toast.error(t('supportTickets.veuillezRemplirTousLesChamps'));
      return;
    }

    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert([{
          requester_id: user?.id,
          vendor_id: vendorId || null,
          subject: newTicket.subject,
          description: newTicket.description,
          category: newTicket.category,
          priority: newTicket.priority,
        }]);

      if (error) throw error;

      toast.success(t('supportTickets.ticketCreeAvecSucces'));
      setIsCreateDialogOpen(false);
      setNewTicket({
        subject: '',
        description: '',
        category: 'technique',
        priority: 'medium',
      });
      loadTickets();
    } catch (error: any) {
      console.error('Erreur création ticket:', error);
      toast.error(t('supportTickets.erreurLorsDeLaCreation'));
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('Erreur chargement messages:', error);
      toast.error(t('supportTickets.erreurLorsDuChargementDes2'));
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      const { error } = await supabase
        .from('support_ticket_messages')
        .insert([{
          ticket_id: selectedTicket.id,
          sender_id: user?.id,
          message: newMessage,
        }]);

      if (error) throw error;

      setNewMessage('');
      loadMessages(selectedTicket.id);
      toast.success(t('supportTickets.messageEnvoye'));
    } catch (error: any) {
      console.error('Erreur envoi message:', error);
      toast.error(t('supportTickets.erreurLorsDeL'));
    }
  };

  const openTicketMessages = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    loadMessages(ticket.id);
    setIsMessagesDialogOpen(true);
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 animate-spin" />
            <span>{t('supportTickets.chargementDesTickets')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Gestion des Tickets
            </CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('supportTickets.creerUnNouveauTicket')}</DialogTitle>
                  <DialogDescription>
                    Décrivez votre problème ou votre demande
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="subject">Sujet *</Label>
                    <Input
                      id="subject"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                      placeholder={t('supportTickets.resumeDuProbleme')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">{t('supportTickets.categorie')}</Label>
                    <Select value={newTicket.category} onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">{t('supportTickets.priorite')}</Label>
                    <Select value={newTicket.priority} onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                      placeholder={t('supportTickets.decrivezVotreProblemeEnDetail')}
                      rows={6}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={createTicket}>
                      Créer le ticket
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('supportTickets.rechercherParSujetOuNumero')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('supportTickets.tousLesStatuts')}</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('supportTickets.aucunTicket')}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Aucun ticket ne correspond à vos critères'
                : 'Vous n\'avez pas encore créé de ticket de support'
              }
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Créer un ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openTicketMessages(ticket)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{ticket.subject}</h3>
                      <Badge variant="outline" className={statusColors[ticket.status as keyof typeof statusColors]}>
                        {statusLabels[ticket.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {ticket.description}
                    </p>
                  </div>
                  <Badge variant="outline" className={priorityColors[ticket.priority as keyof typeof priorityColors]}>
                    {priorityLabels[ticket.priority as keyof typeof priorityLabels]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="font-mono">{ticket.ticket_number}</span>
                    <span>{categoryLabels[ticket.category as keyof typeof categoryLabels]}</span>
                  </div>
                  <span>{format(new Date(ticket.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Messages Dialog */}
      <Dialog open={isMessagesDialogOpen} onOpenChange={setIsMessagesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTicket?.ticket_number} - {selectedTicket?.subject}
            </DialogTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className={statusColors[selectedTicket?.status as keyof typeof statusColors || 'open']}>
                {statusLabels[selectedTicket?.status as keyof typeof statusLabels || 'open']}
              </Badge>
              <Badge variant="outline" className={priorityColors[selectedTicket?.priority as keyof typeof priorityColors || 'medium']}>
                {priorityLabels[selectedTicket?.priority as keyof typeof priorityLabels || 'medium']}
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex flex-col h-[500px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 p-4 border rounded-lg bg-muted/20 mb-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>{t('supportTickets.aucunMessagePourLeMoment')}</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {format(new Date(message.created_at), 'dd MMM à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Send Message */}
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t('supportTickets.votreMessage')}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button onClick={sendMessage} disabled={!newMessage.trim()} size="icon" className="h-auto">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

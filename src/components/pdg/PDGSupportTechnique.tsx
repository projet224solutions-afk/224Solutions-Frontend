import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Headphones, Search, Filter, Send, Clock, CheckCircle2,
  AlertTriangle, XCircle, MessageSquare, User, RefreshCw,
  Store, Mail, Phone, MapPin, ShieldCheck, CalendarDays, Lock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Ticket {
  id: string;
  ticket_number: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  requester_id: string;
  vendor_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
  is_internal: boolean;
}

interface RequesterInfo {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  role: string;
  custom_id: string | null;
}

interface VendorInfo {
  business_name: string;
  business_type: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  neighborhood: string | null;
  description: string | null;
  logo_url: string | null;
  is_verified: boolean | null;
  kyc_status: string | null;
  created_at: string | null;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  in_progress: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
  waiting_response: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  resolved: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
  closed: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  medium: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  urgent: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
};

const statusLabels: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  waiting_response: 'En attente',
  resolved: 'Résolu',
  closed: 'Fermé',
};

const priorityLabels: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

const categoryLabels: Record<string, string> = {
  technique: 'Technique',
  facturation: 'Facturation',
  produit: 'Produit',
  livraison: 'Livraison',
  autre: 'Autre',
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'open') return <AlertTriangle className="w-4 h-4 text-blue-500" />;
  if (status === 'in_progress') return <Clock className="w-4 h-4 text-[#ff4000]" />;
  if (status === 'resolved') return <CheckCircle2 className="w-4 h-4 text-[#ff4000]" />;
  if (status === 'closed') return <XCircle className="w-4 h-4 text-gray-400" />;
  return <Clock className="w-4 h-4 text-orange-500" />;
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <span className="text-muted-foreground min-w-[70px]">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}

export default function PDGSupportTechnique() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [requester, setRequester] = useState<RequesterInfo | null>(null);
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err: any) {
      toast.error('Impossible de charger les tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const loadMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const loadTicketInfo = async (ticket: Ticket) => {
    setLoadingInfo(true);
    setRequester(null);
    setVendor(null);
    try {
      const [profileRes, vendorRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, email, phone, avatar_url, city, country, role, custom_id')
          .eq('id', ticket.requester_id)
          .maybeSingle(),
        ticket.vendor_id
          ? supabase
              .from('vendors')
              .select('business_name, business_type, email, phone, city, country, address, neighborhood, description, logo_url, is_verified, kyc_status, created_at')
              .eq('id', ticket.vendor_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setRequester(profileRes.data as RequesterInfo | null);
      setVendor(vendorRes.data as VendorInfo | null);
    } finally {
      setLoadingInfo(false);
    }
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setMessages([]);
    setReply('');
    loadMessages(ticket.id);
    loadTicketInfo(ticket);
    setDialogOpen(true);
  };

  const sendReply = async () => {
    if (!reply.trim() || !selectedTicket || !user) return;
    setSendingReply(true);
    try {
      const { error } = await supabase
        .from('support_ticket_messages')
        .insert({ ticket_id: selectedTicket.id, sender_id: user.id, message: reply.trim(), is_internal: false });
      if (error) throw error;

      if (selectedTicket.status === 'open') {
        await supabase
          .from('support_tickets')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', selectedTicket.id);
        const updated = { ...selectedTicket, status: 'in_progress' };
        setSelectedTicket(updated);
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t));
      }
      setReply('');
      loadMessages(selectedTicket.id);
      toast.success('Réponse envoyée');
    } catch {
      toast.error('Erreur envoi réponse');
    } finally {
      setSendingReply(false);
    }
  };

  const changeStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    try {
      const extra: Record<string, string> = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'resolved') extra.resolved_at = new Date().toISOString();
      if (newStatus === 'closed') extra.closed_at = new Date().toISOString();
      const { error } = await supabase.from('support_tickets').update(extra).eq('id', selectedTicket.id);
      if (error) throw error;
      const updated = { ...selectedTicket, ...extra };
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, ...extra } : t));
      toast.success(`Statut mis à jour : ${statusLabels[newStatus]}`);
    } catch {
      toast.error('Erreur mise à jour statut');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filtered = tickets.filter(t => {
    const matchSearch = t.subject.toLowerCase().includes(search.toLowerCase()) ||
      (t.ticket_number || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const counts = {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    waiting: tickets.filter(t => t.status === 'waiting_response').length,
    urgent: tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length,
  };

  const isClosed = selectedTicket?.status === 'closed' || selectedTicket?.status === 'resolved';

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <Card className="border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-[#ff4000]/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Headphones className="w-6 h-6 text-orange-500" />
              </div>
              Centre d'Assistance Technique
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadTickets} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-blue-500/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{counts.open}</p>
              <p className="text-xs text-blue-600/70 font-medium">Ouverts</p>
            </div>
            <div className="bg-[#ff4000]/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-[#ff4000]">{counts.in_progress}</p>
              <p className="text-xs text-[#ff4000]/70 font-medium">En cours</p>
            </div>
            <div className="bg-orange-500/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{counts.waiting}</p>
              <p className="text-xs text-orange-600/70 font-medium">En attente</p>
            </div>
            <div className="bg-[#ff4000]/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-[#ff4000]">{counts.urgent}</p>
              <p className="text-xs text-[#ff4000]/70 font-medium">Urgents</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher par sujet ou numéro..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(statusLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorités</SelectItem>
                {Object.entries(priorityLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Liste tickets */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-muted-foreground" />
          <span className="text-muted-foreground">Chargement des tickets...</span>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Headphones className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">Aucun ticket trouvé</p>
          <p className="text-muted-foreground text-sm">
            {tickets.length === 0 ? 'Aucun ticket créé pour le moment' : 'Modifiez vos filtres'}
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(ticket => (
            <Card
              key={ticket.id}
              className={cn(
                'cursor-pointer hover:shadow-md transition-all duration-200 border',
                ticket.priority === 'urgent' && ticket.status !== 'closed' && ticket.status !== 'resolved'
                  ? 'border-[#ff4000]/40 bg-[#ff4000]/5' : 'hover:border-primary/30'
              )}
              onClick={() => openTicket(ticket)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <StatusIcon status={ticket.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold truncate">{ticket.subject}</span>
                      <Badge variant="outline" className={statusColors[ticket.status]}>{statusLabels[ticket.status]}</Badge>
                      <Badge variant="outline" className={priorityColors[ticket.priority]}>{priorityLabels[ticket.priority]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{ticket.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="font-mono">{ticket.ticket_number || '—'}</span>
                      <span>{categoryLabels[ticket.category] || ticket.category}</span>
                      <span>{format(new Date(ticket.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                    </div>
                  </div>
                  <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog détail ticket */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Headphones className="w-5 h-5 text-orange-500" />
              <span>{selectedTicket?.ticket_number} — {selectedTicket?.subject}</span>
            </DialogTitle>
            {selectedTicket && (
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <Badge variant="outline" className={statusColors[selectedTicket.status]}>{statusLabels[selectedTicket.status]}</Badge>
                <Badge variant="outline" className={priorityColors[selectedTicket.priority]}>{priorityLabels[selectedTicket.priority]}</Badge>
                <Badge variant="outline">{categoryLabels[selectedTicket.category] || selectedTicket.category}</Badge>
                <span className="text-xs text-muted-foreground ml-1">
                  Créé le {selectedTicket && format(new Date(selectedTicket.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </span>
              </div>
            )}
          </DialogHeader>

          {selectedTicket && (
            <div className="flex flex-1 overflow-hidden">

              {/* ── Colonne gauche : infos vendeur/demandeur ── */}
              <div className="w-64 flex-shrink-0 border-r overflow-y-auto bg-muted/20 p-4 space-y-4">

                {loadingInfo ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Chargement...
                  </div>
                ) : (
                  <>
                    {/* Demandeur */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <User className="w-3 h-3" /> Demandeur
                      </p>
                      <div className="space-y-1.5">
                        {requester?.avatar_url && (
                          <img src={requester.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover mb-2" />
                        )}
                        <InfoRow icon={User} label="Nom" value={requester?.full_name} />
                        <InfoRow icon={Mail} label="Email" value={requester?.email} />
                        <InfoRow icon={Phone} label="Téléphone" value={requester?.phone} />
                        <InfoRow icon={MapPin} label="Ville" value={requester?.city} />
                        <InfoRow icon={MapPin} label="Pays" value={requester?.country} />
                        {requester?.custom_id && (
                          <InfoRow icon={User} label="ID" value={requester.custom_id} />
                        )}
                        {requester?.role && (
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="secondary" className="text-xs">{requester.role}</Badge>
                          </div>
                        )}
                        {!requester && (
                          <p className="text-xs text-muted-foreground italic">Infos indisponibles</p>
                        )}
                      </div>
                    </div>

                    {/* Boutique vendeur */}
                    {vendor && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Store className="w-3 h-3" /> Boutique
                          </p>
                          <div className="space-y-1.5">
                            {vendor.logo_url && (
                              <img src={vendor.logo_url} alt="logo" className="w-10 h-10 rounded-lg object-cover mb-2" />
                            )}
                            <InfoRow icon={Store} label="Nom" value={vendor.business_name} />
                            <InfoRow icon={Store} label="Type" value={vendor.business_type} />
                            <InfoRow icon={Mail} label="Email" value={vendor.email} />
                            <InfoRow icon={Phone} label="Tél" value={vendor.phone} />
                            <InfoRow icon={MapPin} label="Ville" value={vendor.city} />
                            <InfoRow icon={MapPin} label="Pays" value={vendor.country} />
                            <InfoRow icon={MapPin} label="Adresse" value={vendor.address} />
                            <InfoRow icon={MapPin} label="Quartier" value={vendor.neighborhood} />
                            {vendor.created_at && (
                              <InfoRow icon={CalendarDays} label="Inscrit" value={format(new Date(vendor.created_at), 'dd MMM yyyy', { locale: fr })} />
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {vendor.is_verified && (
                                <Badge className="text-xs bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20" variant="outline">
                                  <ShieldCheck className="w-3 h-3 mr-1" /> Vérifié
                                </Badge>
                              )}
                              {vendor.kyc_status && (
                                <Badge variant="secondary" className="text-xs">KYC: {vendor.kyc_status}</Badge>
                              )}
                            </div>
                            {vendor.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{vendor.description}</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* ── Colonne droite : conversation ── */}
              <div className="flex-1 flex flex-col overflow-hidden">

                {/* Description du ticket */}
                <div className="px-4 pt-3 pb-2 bg-muted/10 border-b">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm">{selectedTicket.description}</p>
                </div>

                {/* Changement de statut */}
                <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap bg-muted/5">
                  <span className="text-xs text-muted-foreground font-medium">Statut :</span>
                  {Object.entries(statusLabels)
                    .filter(([v]) => v !== selectedTicket.status)
                    .map(([v, l]) => (
                      <Button key={v} size="sm" variant="outline" className={cn('text-xs h-7', statusColors[v])}
                        onClick={() => changeStatus(v)} disabled={updatingStatus}>
                        {l}
                      </Button>
                    ))}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Aucun message pour ce ticket
                    </div>
                  ) : messages.map(msg => (
                    <div key={msg.id} className={cn('flex', msg.sender_id === user?.id ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[78%] rounded-xl px-4 py-2.5 text-sm shadow-sm',
                        msg.sender_id === user?.id
                          ? 'bg-orange-500 text-white rounded-tr-none'
                          : 'bg-background border rounded-tl-none'
                      )}>
                        <p className="leading-relaxed">{msg.message}</p>
                        <p className={cn('text-xs mt-1', msg.sender_id === user?.id ? 'text-orange-100' : 'text-muted-foreground')}>
                          {format(new Date(msg.created_at), 'dd MMM à HH:mm', { locale: fr })}
                          {msg.sender_id === user?.id && ' · PDG'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Champ de saisie — bloqué si ticket fermé ou résolu */}
                {isClosed ? (
                  <div className="px-4 py-3 border-t bg-muted/20 flex items-center gap-2 text-muted-foreground text-sm">
                    <Lock className="w-4 h-4" />
                    <span>Ce ticket est <strong>{statusLabels[selectedTicket.status]}</strong> — les réponses sont désactivées.</span>
                  </div>
                ) : (
                  <div className="px-4 py-3 border-t bg-background flex gap-2">
                    <Textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Votre réponse au vendeur... (Entrée pour envoyer)"
                      rows={3}
                      className="flex-1 resize-none"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    />
                    <Button
                      onClick={sendReply}
                      disabled={!reply.trim() || sendingReply}
                      className="h-auto bg-orange-500 hover:bg-orange-600 px-4"
                    >
                      {sendingReply ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

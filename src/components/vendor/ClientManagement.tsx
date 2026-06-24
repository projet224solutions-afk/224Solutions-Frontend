import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useToast } from "@/hooks/use-toast";
import { listVendorClients, broadcastToClients, type VendorCustomerLink, type BroadcastResult } from '@/services/campaignBackendService';
import {
  Users, Search, Filter, Eye, Star, ShoppingCart,
  CreditCard, Calendar, Mail, Phone, MapPin,
  TrendingUp, Award, Clock, MessageSquare, Send, Loader2
} from "lucide-react";

interface Client {
  id: string;
  user_id?: string | null;
  source_type: 'digital' | 'physical' | 'both';
  linked_via: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  total_orders: number;
  total_spent: number;
  last_purchase_at?: string | null;
  created_at: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    email?: string | null;
    phone?: string;
  };
  orders: {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
  }[];
}

interface ClientStats {
  totalClients: number;
  newClientsThisMonth: number;
  vipClients: number;
  activeClients: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export default function ClientManagement() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const {
    vendorId: currentVendorId,
    loading: vendorContextLoading,
  } = useCurrentVendor();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientStats>({
    totalClients: 0,
    newClientsThisMonth: 0,
    vipClients: 0,
    activeClients: 0,
    totalRevenue: 0,
    averageOrderValue: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState<'all' | 'vip' | 'regular' | 'new'>('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [showContactsDialog, setShowContactsDialog] = useState(false);
  // Diffusion « Message à tous »
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  const [bcChannel, setBcChannel] = useState<'email' | 'sms' | 'both'>('both');
  const [bcSubject, setBcSubject] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState<BroadcastResult | null>(null);
  const [bcIdemKey, setBcIdemKey] = useState<string>('');

  useEffect(() => {
    if (!currentVendorId || vendorContextLoading) return;
    fetchClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVendorId, vendorContextLoading]);

  const getClientDisplayName = (client: Client) => {
    if (client.profile?.first_name && client.profile?.last_name) {
      return `${client.profile.first_name} ${client.profile.last_name}`;
    }

    return client.full_name || client.email?.split('@')[0] || client.phone || 'Client anonyme';
  };

  const mapContactToClient = (contact: VendorCustomerLink): Client => {
    const baseName = contact.full_name || contact.email?.split('@')[0] || contact.phone || 'Client';
    const [firstName, ...lastNameParts] = baseName.split(' ');

    return {
      id: contact.id,
      user_id: contact.customer_user_id || null,
      source_type: contact.source_type,
      linked_via: contact.linked_via,
      full_name: contact.full_name,
      email: contact.email,
      phone: contact.phone,
      total_orders: Number(contact.total_orders || 0),
      total_spent: Number(contact.total_spent || 0),
      last_purchase_at: contact.last_purchase_at,
      created_at: contact.created_at,
      profile: {
        first_name: firstName || undefined,
        last_name: lastNameParts.join(' ') || undefined,
        email: contact.email,
        phone: contact.phone || undefined,
      },
      orders: [],
    };
  };

  const fetchClients = async () => {
    if (!currentVendorId) return;
    try {
      const contacts = await listVendorClients();
      const processedClients = contacts.map(mapContactToClient);

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalOrders = processedClients.reduce((sum, client) => sum + client.total_orders, 0);
      const totalRevenue = processedClients.reduce((sum, client) => sum + client.total_spent, 0);

      const newClientsThisMonth = processedClients.filter(client =>
        new Date(client.created_at) >= thisMonthStart).length;

      const vipClients = processedClients.filter(client => {
        return client.total_spent > 500000 || client.total_orders > 10;
      }).length;

      const activeClients = processedClients.filter(client => {
        const lastOrderDate = client.last_purchase_at ? new Date(client.last_purchase_at) : null;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return lastOrderDate && lastOrderDate >= thirtyDaysAgo;
      }).length;

      setStats({
        totalClients: processedClients.length,
        newClientsThisMonth,
        vipClients,
        activeClients,
        totalRevenue,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
      });

      setClients(processedClients);
    } catch (_error) {
      toast({
        title: "Erreur",
        description: t('clientManagement.impossibleDeChargerLesDonnees'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getClientType = (client: Client) => {
    const clientRevenue = client.total_spent;
    const orderCount = client.total_orders;
    const isNew = new Date(client.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (clientRevenue > 500000 || orderCount > 10) return 'vip';
    if (isNew) return 'new';
    return 'regular';
  };

  const getClientTypeLabel = (type: string) => {
    switch (type) {
      case 'vip': return 'VIP';
      case 'new': return 'Nouveau';
      case 'regular': return 'Régulier';
      default: return 'Régulier';
    }
  };

  const getClientTypeColor = (type: string) => {
    switch (type) {
      case 'vip': return 'bg-orange-100 text-[#ff4000]';
      case 'new': return 'bg-orange-100 text-[#ff4000]';
      case 'regular': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getClientSourceLabel = (client: Client) => {
    switch (client.linked_via) {
      case 'pos_order':
        return 'Contact POS';
      case 'marketplace_order':
        return 'Commande en ligne';
      case 'manual':
        return 'Ajout manuel';
      case 'campaign_import':
        return 'Import campagne';
      default:
        return client.source_type === 'physical' ? 'Client boutique' : client.source_type === 'digital' ? 'Client en ligne' : 'Client mixte';
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = !searchTerm ||
      getClientDisplayName(client).toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.profile?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.profile?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone?.toLowerCase().includes(searchTerm.toLowerCase());

    const clientType = getClientType(client);
    const matchesType = clientTypeFilter === 'all' || clientType === clientTypeFilter;

    return matchesSearch && matchesType;
  });

  const clientsWithContacts = clients.filter(client => (client.email || client.profile?.email || client.phone || client.profile?.phone));
  const clientsWithEmails = clients.filter(client => Boolean(client.email || client.profile?.email));
  const clientsWithPhones = clients.filter(client => Boolean(client.phone || client.profile?.phone));

  if (loading) return <div className="p-4">{t('clientManagement.chargementDesClients')}</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile optimized */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-bold truncate">{t('clientManagement.gestionDesClients')}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{t('clientManagement.gerezVosRelationsClients')}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
            Cette section affiche les contacts saisis au POS et ceux issus des commandes en ligne.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm" onClick={() => {
            if (clientsWithContacts.length === 0) {
              toast({
                title: t('clientManagement.aucunContactDisponible'),
                description: t('clientManagement.aucunEmailOuNumeroN'),
              });
              return;
            }

            setShowContactsDialog(true);
          }}>
            <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span>{t('clientManagement.contactClient')}</span>
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm" onClick={() => {
            if (clientsWithContacts.length === 0) {
              toast({
                title: t('clientManagement.aucunContactDisponible'),
                description: t('clientManagement.aucunEmailOuNumeroN2'),
              });
              return;
            }
            setBcResult(null);
            // Nouvelle clé d'idempotence par ouverture (anti double-envoi)
            setBcIdemKey(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bc-${Date.now()}-${Math.random()}`);
            setShowBroadcastDialog(true);
          }}>
            <Send className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span>{t('clientManagement.envoyerUnMessage')}</span>
          </Button>
        </div>
      </div>

      {/* Statistiques clients - Grid 2x3 on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total clients</p>
                <p className="text-lg sm:text-2xl font-bold">{stats.totalClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff4000] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Nouveaux (30j)</p>
                <p className="text-lg sm:text-2xl font-bold text-[#ff4000]">{stats.newClientsThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff4000] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Clients VIP</p>
                <p className="text-lg sm:text-2xl font-bold text-[#ff4000]">{stats.vipClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#04439e] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Actifs (30j)</p>
                <p className="text-lg sm:text-2xl font-bold text-[#04439e]">{stats.activeClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff4000] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">CA total</p>
                <p className="text-base sm:text-xl font-bold truncate">{stats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Panier moyen</p>
                <p className="text-base sm:text-xl font-bold truncate">{stats.averageOrderValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('clientManagement.rechercherUnClient')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={clientTypeFilter}
              onChange={(e) => setClientTypeFilter(e.target.value as "all" | "new" | "regular" | "vip")}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">{t('clientManagement.tousLesClients')}</option>
              <option value="vip">Clients VIP</option>
              <option value="regular">{t('clientManagement.clientsReguliers')}</option>
              <option value="new">Nouveaux clients</option>
            </select>
            <Filter className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Liste des clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const clientRevenue = client.total_spent;
          const orderCount = client.total_orders;
          const lastOrder = client.last_purchase_at ? new Date(client.last_purchase_at) : null;
          const clientType = getClientType(client);

          return (
            <Card key={client.id} className="hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">
                          {getClientDisplayName(client)}
                      </h3>
                      <Badge className={getClientTypeColor(clientType)}>
                        {getClientTypeLabel(clientType)}
                      </Badge>
                      <Badge variant="outline">
                        {getClientSourceLabel(client)}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                        {(client.email || client.profile?.email) && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                            {client.email || client.profile?.email}
                        </div>
                      )}
                        {(client.phone || client.profile?.phone) && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                            {client.phone || client.profile?.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedClient(client);
                      setShowClientDialog(true);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('clientManagement.commandes')}</span>
                    <span className="font-semibold">{orderCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('clientManagement.totalDepense')}</span>
                    <span className="font-semibold text-vendeur-primary">
                      {fc(clientRevenue)}
                    </span>
                  </div>
                  {lastOrder && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('clientManagement.derniereCommande')}</span>
                      <span className="text-sm">
                        {lastOrder.toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                  {clientRevenue > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Panier moyen:</span>
                      <span className="text-sm font-medium">
                        {fc(Math.round(clientRevenue / orderCount))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-4 border-t">
                  <Button size="sm" variant="outline" onClick={() => {
                    const email = client.email || client.profile?.email;
                    if (email) {
                      const mailtoLink = document.createElement('a');
                      mailtoLink.href = `mailto:${email}`;
                      mailtoLink.click();
                      return;
                    }

                    toast({
                      title: "Email non disponible",
                      description: t('clientManagement.lAdresseEmailDeCe')
                    });
                  }}>
                    <Mail className="w-4 h-4 mr-1" />
                    Mail
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const phone = client.phone || client.profile?.phone;
                    if (phone) {
                      const phoneLink = document.createElement('a');
                      phoneLink.href = `tel:${phone}`;
                      phoneLink.click();
                      return;
                    }

                    toast({
                      title: t('clientManagement.numeroNonDisponible'),
                      description: t('clientManagement.leNumeroDeTelephoneDe')
                    });
                  }}>
                    <Phone className="w-4 h-4 mr-1" />
                    Numéro
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    toast({
                      title: t('clientManagement.commandesDuClient'),
                      description: t('clientManagement.affichageDesCommandesDeCe')
                    });
                  }}>
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    Commandes
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('clientManagement.aucunClientTrouve')}</h3>
              <p className="text-muted-foreground">
                {searchTerm || clientTypeFilter !== 'all'
                  ? 'Aucun client ne correspond aux critères de recherche.'
                  : 'Vous n\'avez pas encore de clients.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog des détails client */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('clientManagement.profilClientDetaille')}</DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-6">
              {/* Informations personnelles */}
              <div>
                <h4 className="font-semibold mb-4">Informations personnelles</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nom complet</label>
                    <p className="font-medium">
                      {getClientDisplayName(selectedClient)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="font-medium">{selectedClient.email || selectedClient.profile?.email || 'Non renseigné'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t('clientManagement.telephone')}</label>
                    <p className="font-medium">{selectedClient.phone || selectedClient.profile?.phone || 'Non renseigné'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Membre depuis</label>
                    <p className="font-medium">
                      {new Date(selectedClient.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t('clientManagement.origineDuContact')}</label>
                    <p className="font-medium">{getClientSourceLabel(selectedClient)}</p>
                  </div>
                </div>
              </div>

              {/* Statistiques */}
              <div>
                <h4 className="font-semibold mb-4">Statistiques</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-accent rounded-lg">
                    <p className="text-2xl font-bold text-vendeur-primary">
                      {selectedClient.total_orders}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('clientManagement.commandes2')}</p>
                  </div>
                  <div className="text-center p-4 bg-accent rounded-lg">
                    <p className="text-2xl font-bold text-[#ff4000]">
                      {selectedClient.total_spent.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('clientManagement.gnfDepenses')}</p>
                  </div>
                  <div className="text-center p-4 bg-accent rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {selectedClient.total_orders > 0
                        ? Math.round(selectedClient.total_spent / selectedClient.total_orders).toLocaleString()
                        : 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Panier moyen</p>
                  </div>
                </div>
              </div>

              {/* Historique des commandes */}
              <div>
                <h4 className="font-semibold mb-4">{t('clientManagement.historiqueDesCommandes')}</h4>
                <div className="space-y-2">
                  {selectedClient.orders.length > 0 ? selectedClient.orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                      <div>
                        <p className="font-medium">Commande #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{fc(order.total_amount)}</p>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                    </div>
                  )) : (
                    <div className="p-3 bg-accent rounded-lg text-sm text-muted-foreground">
                      Ce contact provient de la base client fusionnée. Les commandes détaillées ne sont pas encore affichées ici pour les contacts POS et les contacts externes.
                    </div>
                  )}
                  {selectedClient.orders.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      ... et {selectedClient.orders.length - 5} autres commandes
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showContactsDialog} onOpenChange={setShowContactsDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('clientManagement.contactsClientsCollectes')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Contacts disponibles</p>
                  <p className="text-2xl font-bold">{clientsWithContacts.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{t('clientManagement.emailsCollectes')}</p>
                  <p className="text-2xl font-bold">{clientsWithEmails.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{t('clientManagement.numerosCollectes')}</p>
                  <p className="text-2xl font-bold">{clientsWithPhones.length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              {clientsWithContacts.map((client) => {
                const email = client.email || client.profile?.email;
                const phone = client.phone || client.profile?.phone;

                return (
                  <div key={client.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{getClientDisplayName(client)}</p>
                        <p className="text-sm text-muted-foreground">{getClientSourceLabel(client)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{client.total_orders} commande{client.total_orders > 1 ? 's' : ''}</Badge>
                        <Badge variant="outline">{fc(client.total_spent)}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground mb-1">Email</p>
                        <p className="font-medium break-all">{email || 'Non renseigné'}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground mb-1">{t('clientManagement.numero')}</p>
                        <p className="font-medium break-all">{phone || 'Non renseigné'}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={!email} onClick={() => {
                        if (!email) return;
                        const mailtoLink = document.createElement('a');
                        mailtoLink.href = `mailto:${email}`;
                        mailtoLink.click();
                      }}>
                        <Mail className="w-4 h-4 mr-1" />
                        Envoyer un mail
                      </Button>
                      <Button size="sm" variant="outline" disabled={!phone} onClick={() => {
                        if (!phone) return;
                        const phoneLink = document.createElement('a');
                        phoneLink.href = `tel:${phone}`;
                        phoneLink.click();
                      }}>
                        <Phone className="w-4 h-4 mr-1" />
                        Appeler le numéro
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diffusion : Envoyer un message à TOUS les contacts (email / SMS) */}
      <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> {t('clientManagement.envoyerUnMessageATous')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bc-msg">{t('clientManagement.votreMessage')}</Label>
              <Textarea id="bc-msg" autoFocus rows={5} maxLength={2000}
                value={bcMessage} onChange={(e) => setBcMessage(e.target.value)}
                placeholder={t('clientManagement.tapezLeTexteAEnvoyer')} />
              <p className="text-xs text-muted-foreground">{bcMessage.length}/2000 — SMS tronqué à 140 caractères.</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('clientManagement.envoyerA')}</Label>
              <div className="flex gap-2">
                {([
                  ['email', 'Tous les emails', `${clientsWithEmails.length}`, <Mail key="m" className="h-4 w-4" />],
                  ['sms', 'Tous les numéros', `${clientsWithPhones.length}`, <Phone key="p" className="h-4 w-4" />],
                  ['both', 'Les deux', 'email + SMS', <Send key="s" className="h-4 w-4" />],
                ] as const).map(([val, label, sub, icon]) => (
                  <button key={val} type="button" onClick={() => setBcChannel(val as 'email' | 'sms' | 'both')}
                    className={`flex-1 rounded-lg border p-2.5 text-left transition ${bcChannel === val ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}`}>
                    <span className="flex items-center gap-1.5 text-sm font-medium">{icon}{label}</span>
                    <span className="text-[11px] text-muted-foreground">{sub} contact(s)</span>
                  </button>
                ))}
              </div>
            </div>

            {(bcChannel === 'email' || bcChannel === 'both') && (
              <div className="space-y-1.5">
                <Label htmlFor="bc-subj">{t('clientManagement.objetDeLEmail')}</Label>
                <Input id="bc-subj" value={bcSubject} onChange={(e) => setBcSubject(e.target.value)} placeholder={t('clientManagement.exNouvellePromotion')} maxLength={200} />
              </div>
            )}

            <Button className="w-full gap-2" size="lg" disabled={bcSending || !bcMessage.trim()}
              onClick={async () => {
                const target = bcChannel === 'email' ? clientsWithEmails.length : bcChannel === 'sms' ? clientsWithPhones.length : Math.max(clientsWithEmails.length, clientsWithPhones.length);
                if (!bcMessage.trim()) { toast({ title: 'Message vide', description: t('clientManagement.ecrivezUnMessage') }); return; }
                if (target === 0) { toast({ title: t('clientManagement.aucunContact'), description: t('clientManagement.aucunContactPourCeCanal') }); return; }
                setBcSending(true); setBcResult(null);
                try {
                  const r = await broadcastToClients({ channel: bcChannel, subject: bcSubject.trim() || undefined, message: bcMessage.trim() }, bcIdemKey);
                  setBcResult(r);
                  if (r.already_sent) {
                    toast({ title: t('clientManagement.dejaEnvoye'), description: t('clientManagement.cetteDiffusionADejaEte') });
                  } else {
                    toast({ title: t('clientManagement.diffusionEnvoyee'), description: `${r.email_sent} email(s), ${r.sms_sent} SMS` });
                  }
                } catch (e: any) {
                  toast({ title: t('clientManagement.echec'), description: e?.message || 'Diffusion impossible', variant: 'destructive' });
                } finally {
                  setBcSending(false);
                }
              }}>
              {bcSending ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…</> : <><Send className="h-4 w-4" /> Envoyer à {bcChannel === 'email' ? clientsWithEmails.length : bcChannel === 'sms' ? clientsWithPhones.length : Math.max(clientsWithEmails.length, clientsWithPhones.length)} client(s)</>}
            </Button>

            {bcResult && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p className="font-medium">{t('clientManagement.resultat')}</p>
                <p>📧 Email : {bcResult.email_sent} envoyé(s){bcResult.email_failed ? `, ${bcResult.email_failed} échec(s)` : ''} / {bcResult.email_targeted}</p>
                {bcResult.email_error && <p className="text-[11px] text-destructive">⚠️ {bcResult.email_error}</p>}
                <p>📱 SMS : {bcResult.sms_sent} envoyé(s){bcResult.sms_failed ? `, ${bcResult.sms_failed} échec(s)` : ''} / {bcResult.sms_targeted}</p>
                {bcResult.sms_error && <p className="text-[11px] text-destructive">⚠️ SMS : {bcResult.sms_error}</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
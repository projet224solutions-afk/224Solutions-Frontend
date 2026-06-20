/**
 * MODULE COIFFEUR / SALON
 * Inspiré de Booksy, Treatwell, StyleSeat
 * Réservations, services, stylistes, programme fidélité
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Scissors,
  Users,
  Calendar,
  Clock,
  Plus,
  Star,
  TrendingUp,
  User,
  Gift,
  Heart,
  Phone,
  CheckCircle,
  Sparkles,
  Crown
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface HairdresserModuleProps {
  serviceId: string;
  businessName?: string;
}

interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  stylist: string;
  services: string[];
  date: string;
  time: string;
  duration: number;
  totalPrice: number;
  status: 'confirmé' | 'en_attente' | 'en_cours' | 'terminé' | 'annulé';
  notes?: string;
}

interface Stylist {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  clientsServed: number;
  available: boolean;
  todayAppointments: number;
  photo?: string;
}

interface Service {
  id: string;
  name: string;
  category: 'coupe' | 'coloration' | 'coiffure' | 'soin' | 'barbe' | 'enfant';
  duration: number;
  price: number;
  description: string;
  popular: boolean;
}

interface LoyaltyClient {
  id: string;
  name: string;
  phone: string;
  points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  visits: number;
  totalSpent: number;
  lastVisit: string;
  favoriteService: string;
}

export function HairdresserModule({ serviceId, businessName }: HairdresserModuleProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('agenda');
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false);
  const [showNewServiceDialog, setShowNewServiceDialog] = useState(false);

  // Données simulées
  const [appointments] = useState<Appointment[]>([
    {
      id: '1',
      clientName: 'Fatoumata Diallo',
      clientPhone: '+224 620 00 00 00',
      stylist: 'Mariama Sow',
      services: ['Coupe femme', 'Brushing'],
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      duration: 60,
      totalPrice: 150000,
      status: 'confirmé'
    },
    {
      id: '2',
      clientName: 'Aissatou Bah',
      clientPhone: '+224 621 00 00 00',
      stylist: 'Kadiatou Barry',
      services: ['Coloration', 'Soin profond'],
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      duration: 120,
      totalPrice: 350000,
      status: 'en_cours'
    },
    {
      id: '3',
      clientName: 'Mamadou Camara',
      clientPhone: '+224 622 00 00 00',
      stylist: 'Alpha Diallo',
      services: ['Coupe homme', 'Taille barbe'],
      date: new Date().toISOString().split('T')[0],
      time: '11:30',
      duration: 45,
      totalPrice: 80000,
      status: 'confirmé'
    },
    {
      id: '4',
      clientName: 'Hadja Sylla',
      clientPhone: '+224 623 00 00 00',
      stylist: 'Mariama Sow',
      services: ['Tresses africaines'],
      date: new Date().toISOString().split('T')[0],
      time: '14:00',
      duration: 180,
      totalPrice: 250000,
      status: 'en_attente'
    }
  ]);

  const [stylists] = useState<Stylist[]>([
    {
      id: '1',
      name: 'Mariama Sow',
      specialty: 'Coloriste expert',
      rating: 4.9,
      reviews: 156,
      clientsServed: 890,
      available: true,
      todayAppointments: 6
    },
    {
      id: '2',
      name: 'Kadiatou Barry',
      specialty: 'Coiffure mariage',
      rating: 4.8,
      reviews: 98,
      clientsServed: 567,
      available: true,
      todayAppointments: 5
    },
    {
      id: '3',
      name: 'Alpha Diallo',
      specialty: 'Barbier',
      rating: 4.7,
      reviews: 234,
      clientsServed: 1230,
      available: true,
      todayAppointments: 8
    },
    {
      id: '4',
      name: 'Aminata Keita',
      specialty: 'Tresses & Extensions',
      rating: 4.9,
      reviews: 187,
      clientsServed: 678,
      available: false,
      todayAppointments: 0
    }
  ]);

  const [services] = useState<Service[]>([
    { id: '1', name: 'Coupe femme', category: 'coupe', duration: 45, price: 100000, description: 'Coupe personnalisée avec shampoing', popular: true },
    { id: '2', name: 'Coupe homme', category: 'coupe', duration: 30, price: 50000, description: 'Coupe tendance ou classique', popular: true },
    { id: '3', name: 'Coloration complète', category: 'coloration', duration: 90, price: 200000, description: 'Coloration professionnelle', popular: true },
    { id: '4', name: 'Mèches / Balayage', category: 'coloration', duration: 120, price: 300000, description: 'Effet naturel et lumineux', popular: false },
    { id: '5', name: 'Brushing', category: 'coiffure', duration: 30, price: 50000, description: 'Mise en forme au séchoir', popular: true },
    { id: '6', name: 'Chignon mariage', category: 'coiffure', duration: 90, price: 250000, description: 'Coiffure événement spécial', popular: false },
    { id: '7', name: 'Tresses africaines', category: 'coiffure', duration: 180, price: 200000, description: 'Tresses traditionnelles', popular: true },
    { id: '8', name: 'Soin Kératine', category: 'soin', duration: 120, price: 350000, description: 'Lissage et soin profond', popular: false },
    { id: '9', name: 'Taille barbe', category: 'barbe', duration: 20, price: 30000, description: 'Taille et entretien', popular: true },
    { id: '10', name: 'Coupe enfant', category: 'enfant', duration: 25, price: 35000, description: 'Coupe adaptée aux enfants', popular: false }
  ]);

  const [loyaltyClients] = useState<LoyaltyClient[]>([
    { id: '1', name: 'Fatoumata Diallo', phone: '+224 620 00 00 00', points: 2500, tier: 'gold', visits: 45, totalSpent: 4500000, lastVisit: '2024-03-01', favoriteService: 'Coloration' },
    { id: '2', name: 'Aissatou Bah', phone: '+224 621 00 00 00', points: 1200, tier: 'silver', visits: 23, totalSpent: 2100000, lastVisit: '2024-03-05', favoriteService: 'Brushing' },
    { id: '3', name: 'Hadja Sylla', phone: '+224 623 00 00 00', points: 3800, tier: 'platinum', visits: 78, totalSpent: 8900000, lastVisit: '2024-03-10', favoriteService: 'Tresses' }
  ]);

  const formatPrice = useFormatCurrency();

  const getStatusBadge = (status: Appointment['status']) => {
    const styles = {
      confirmé: 'bg-orange-100 text-[#ff4000]',
      en_attente: 'bg-orange-100 text-[#ff4000]',
      en_cours: 'bg-blue-100 text-blue-800',
      terminé: 'bg-gray-100 text-gray-800',
      annulé: 'bg-orange-100 text-[#ff4000]'
    };
    return <Badge className={styles[status]}>{status.replace('_', ' ')}</Badge>;
  };

  const getTierBadge = (tier: LoyaltyClient['tier']) => {
    const styles = {
      bronze: 'bg-[#ff4000] text-white',
      silver: 'bg-gray-400 text-white',
      gold: 'bg-[#ff4000] text-white',
      platinum: 'bg-gradient-to-r from-gray-300 to-gray-500 text-white'
    };
    return <Badge className={styles[tier]}><Crown className="h-3 w-3 mr-1" />{tier}</Badge>;
  };

  const getCategoryBadge = (category: Service['category']) => {
    const colors = {
      coupe: 'bg-blue-100 text-blue-800',
      coloration: 'bg-blue-100 text-[#04439e]',
      coiffure: 'bg-orange-100 text-[#ff4000]',
      soin: 'bg-orange-100 text-[#ff4000]',
      barbe: 'bg-orange-100 text-orange-800',
      enfant: 'bg-blue-100 text-[#04439e]'
    };
    return <Badge className={colors[category]}>{category}</Badge>;
  };

  const handleAddAppointment = () => {
    toast.success(t('hairdresserModule.rendezVousConfirme'));
    setShowNewAppointmentDialog(false);
  };

  const handleAddService = () => {
    toast.success(t('hairdresserModule.serviceAjouteAuCatalogue'));
    setShowNewServiceDialog(false);
  };

  // Statistiques
  const todayAppointments = appointments.length;
  const todayRevenue = appointments.reduce((acc, a) => acc + a.totalPrice, 0);
  const availableStylists = stylists.filter(s => s.available).length;
  const avgRating = (stylists.reduce((acc, s) => acc + s.rating, 0) / stylists.length).toFixed(1);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#ff4000] to-[#ff4000] rounded-xl">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{businessName || 'Salon de Coiffure'}</h2>
            <p className="text-muted-foreground">{t('hairdresserModule.gestionDuSalon')}</p>
          </div>
        </div>
        <Dialog open={showNewAppointmentDialog} onOpenChange={setShowNewAppointmentDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#ff4000] hover:bg-[#ff4000] text-white shadow-lg shadow-[#ff4000]/40">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau RDV
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('hairdresserModule.prendreUnRendezVous')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{t('hairdresserModule.nomDuClient')}</Label>
                <Input placeholder="Nom complet" />
              </div>
              <div className="space-y-2">
                <Label>{t('hairdresserModule.telephone')}</Label>
                <Input placeholder="+224 6XX XX XX XX" />
              </div>
              <div className="space-y-2">
                <Label>Styliste</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {stylists.filter(s => s.available).map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} - {s.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('hairdresserModule.services')}</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder={t('hairdresserModule.selectionnerLesServices')} /></SelectTrigger>
                  <SelectContent>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} - {formatPrice(s.price)} ({s.duration}min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Heure</Label>
                  <Input type="time" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewAppointmentDialog(false)}>{t('hairdresserModule.annuler')}</Button>
              <Button onClick={handleAddAppointment} className="bg-[#ff4000] hover:bg-[#ff4000] shadow-lg shadow-[#ff4000]/40">Confirmer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#ff4000] to-[#ff4000] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 opacity-90">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">RDV aujourd'hui</span>
            </div>
            <p className="text-3xl font-bold mt-1">{todayAppointments}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#ff4000] to-[#ff4000] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 opacity-90">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">{t('hairdresserModule.revenusDuJour')}</span>
            </div>
            <p className="text-xl font-bold mt-1">{formatPrice(todayRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#04439e] to-[#04439e] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 opacity-90">
              <Users className="h-4 w-4" />
              <span className="text-sm">Stylistes dispo</span>
            </div>
            <p className="text-3xl font-bold mt-1">{availableStylists}/{stylists.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#ff4000] to-orange-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 opacity-90">
              <Star className="h-4 w-4" />
              <span className="text-sm">Note moyenne</span>
            </div>
            <p className="text-3xl font-bold mt-1">{avgRating}</p>
          </CardContent>
        </Card>
      </div>

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="equipe">{t('hairdresserModule.equipe')}</TabsTrigger>
          <TabsTrigger value="services">{t('hairdresserModule.services')}</TabsTrigger>
          <TabsTrigger value="fidelite">{t('hairdresserModule.fidelite')}</TabsTrigger>
        </TabsList>

        {/* Agenda */}
        <TabsContent value="agenda" className="space-y-4">
          <h3 className="font-semibold">Planning du jour - {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          <div className="grid gap-3">
            {appointments.map((apt) => (
              <Card key={apt.id} className={apt.status === 'en_cours' ? 'border-blue-500 border-2' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-xl font-bold">{apt.time}</p>
                        <p className="text-xs text-muted-foreground">{apt.duration} min</p>
                      </div>
                      <div className="h-12 w-0.5 bg-gradient-to-b from-[#ff4000] to-[#ff4000]" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{apt.clientName}</h4>
                          {getStatusBadge(apt.status)}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {apt.clientPhone}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-primary">✂️ {apt.stylist}</span>
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{apt.services.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{formatPrice(apt.totalPrice)}</p>
                      {apt.status === 'confirmé' && (
                        <Button size="sm" className="mt-2">{t('hairdresserModule.demarrer')}</Button>
                      )}
                      {apt.status === 'en_cours' && (
                        <Button size="sm" variant="outline" className="mt-2">Terminer</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Équipe */}
        <TabsContent value="equipe" className="space-y-4">
          <h3 className="font-semibold">{t('hairdresserModule.notreEquipe')}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {stylists.map((stylist) => (
              <Card key={stylist.id} className={!stylist.available ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="bg-gradient-to-br from-[#ff4000] to-[#ff4000] text-white text-xl">
                        {stylist.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{stylist.name}</h4>
                        <Badge variant={stylist.available ? 'default' : 'secondary'}>
                          {stylist.available ? 'Disponible' : 'Absent'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{stylist.specialty}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-sm">
                          <Star className="h-4 w-4 text-[#ff4000] fill-[#ff4000]" />
                          {stylist.rating} ({stylist.reviews} avis)
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {stylist.clientsServed} clients
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{stylist.todayAppointments}</p>
                      <p className="text-xs text-muted-foreground">RDV aujourd'hui</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Services */}
        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('hairdresserModule.catalogueDesServices')}</h3>
            <Dialog open={showNewServiceDialog} onOpenChange={setShowNewServiceDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('hairdresserModule.nouveauService')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>{t('hairdresserModule.nomDuService')}</Label>
                    <Input placeholder="Ex: Coloration balayage" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('hairdresserModule.categorie')}</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coupe">Coupe</SelectItem>
                          <SelectItem value="coloration">Coloration</SelectItem>
                          <SelectItem value="coiffure">Coiffure</SelectItem>
                          <SelectItem value="soin">Soin</SelectItem>
                          <SelectItem value="barbe">Barbe</SelectItem>
                          <SelectItem value="enfant">Enfant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('hairdresserModule.dureeMin')}</Label>
                      <Input type="number" placeholder="45" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Prix (GNF)</Label>
                    <Input type="number" placeholder="100000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input placeholder="Description courte" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewServiceDialog(false)}>{t('hairdresserModule.annuler')}</Button>
                  <Button onClick={handleAddService}>{t('hairdresserModule.ajouter')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-3">
            {services.map((service) => (
              <Card key={service.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-100 to-orange-100 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-[#ff4000]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{service.name}</h4>
                        {getCategoryBadge(service.category)}
                        {service.popular && <Badge variant="outline" className="text-[#ff4000] border-[#ff4000]">⭐ Populaire</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{formatPrice(service.price)}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {service.duration} min
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Programme fidélité */}
        <TabsContent value="fidelite" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('hairdresserModule.programmeFidelite')}</h3>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[#ff4000]">🥉 Bronze: 0-1000 pts</Badge>
              <Badge variant="outline" className="text-gray-500">🥈 Silver: 1000-2000 pts</Badge>
              <Badge variant="outline" className="text-[#ff4000]">🥇 Gold: 2000-3000 pts</Badge>
              <Badge variant="outline" className="bg-gradient-to-r from-gray-300 to-gray-400 text-white">💎 Platinum: 3000+ pts</Badge>
            </div>
          </div>

          <Card className="bg-gradient-to-r from-orange-50 to-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Gift className="h-8 w-8 text-[#ff4000]" />
                <div>
                  <h4 className="font-semibold">{t('hairdresserModule.commentCaMarche')}</h4>
                  <p className="text-sm text-muted-foreground">
                    1 000 GNF dépensé = 1 point • 100 points = 10 000 GNF de réduction
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {loyaltyClients.map((client) => (
              <Card key={client.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gradient-to-br from-[#ff4000] to-[#ff4000] text-white">
                          {client.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{client.name}</h4>
                          {getTierBadge(client.tier)}
                        </div>
                        <p className="text-sm text-muted-foreground">{client.phone}</p>
                        <p className="text-xs text-muted-foreground">
                          {client.visits} visites • Préféré: {client.favoriteService}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{client.points}</p>
                      <p className="text-xs text-muted-foreground">points</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total: {formatPrice(client.totalSpent)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progression vers {client.tier === 'platinum' ? 'max' : 'niveau supérieur'}</span>
                      <span>{client.points} / {client.tier === 'bronze' ? 1000 : client.tier === 'silver' ? 2000 : client.tier === 'gold' ? 3000 : 5000}</span>
                    </div>
                    <Progress
                      value={client.tier === 'platinum' ? 100 : (client.points / (client.tier === 'bronze' ? 1000 : client.tier === 'silver' ? 2000 : 3000)) * 100}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default HairdresserModule;

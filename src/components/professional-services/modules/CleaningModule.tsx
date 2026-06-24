/**
 * MODULE NETTOYAGE PROFESSIONNEL
 * Inspiré de: Handy, TaskRabbit, Helpling
 * Gestion complète des services de nettoyage et entretien
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useServiceBookings } from '@/hooks/useServiceBookings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sparkles, Home, Building2, Users, Calendar,
  Clock, CheckCircle2, DollarSign, TrendingUp,
  MapPin, Star, ShoppingBag, Shirt, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { ServiceShowcaseManager } from '@/components/service-common/ServiceShowcaseManager';

interface CleaningModuleProps {
  serviceId: string;
  businessName?: string;
}

interface CleaningService {
  id: string;
  name: string;
  icon: any;
  basePrice: number;
  unit: string;
  description: string;
  duration: number; // en heures
}

interface Booking {
  id: string;
  customerName: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  address: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  recurring?: boolean;
  frequency?: string;
}

const CLEANING_SERVICES: CleaningService[] = [
  {
    id: 'home_basic',
    name: 'Ménage Résidentiel Basique',
    icon: Home,
    basePrice: 50000,
    unit: 'par session',
    description: "Nettoyage standard: dépoussiérage, aspirateur, sols",
    duration: 3
  },
  {
    id: 'home_deep',
    name: 'Grand Nettoyage',
    icon: Sparkles,
    basePrice: 150000,
    unit: 'par session',
    description: "Nettoyage en profondeur de toute la maison",
    duration: 6
  },
  {
    id: 'office',
    name: 'Nettoyage Bureau',
    icon: Building2,
    basePrice: 80000,
    unit: 'par jour',
    description: "Entretien quotidien ou hebdomadaire de bureaux",
    duration: 4
  },
  {
    id: 'laundry',
    name: 'Pressing & Repassage',
    icon: Shirt,
    basePrice: 5000,
    unit: 'par kg',
    description: "Lavage, repassage et pliage du linge",
    duration: 2
  },
  {
    id: 'windows',
    name: 'Nettoyage Vitres',
    icon: Home,
    basePrice: 30000,
    unit: 'par session',
    description: 'Nettoyage complet des vitres intérieur/extérieur',
    duration: 2
  },
  {
    id: 'carpet',
    name: 'Nettoyage Moquette/Tapis',
    icon: Home,
    basePrice: 40000,
    unit: 'par pièce',
    description: 'Nettoyage vapeur professionnel',
    duration: 2
  }
];

export function CleaningModule({ serviceId, businessName }: CleaningModuleProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const { bookings: rawBookings, loading, createBooking, setStatus, stats: bookingStats } = useServiceBookings(serviceId);
  const bookings: Booking[] = rawBookings.map((b) => ({
    id: b.id, customerName: b.customer_name || '—', phone: b.customer_phone || '',
    service: b.service_code || '', date: b.scheduled_date || '', time: b.scheduled_time || '',
    address: b.address || '', status: b.status, price: Number(b.price) || 0,
    recurring: b.recurring, frequency: b.frequency || undefined,
  }));
  const stats = bookingStats;
  const [submitting, setSubmitting] = useState(false);

  const [newBooking, setNewBooking] = useState({
    customerName: '',
    phone: '',
    service: '',
    date: '',
    time: '',
    address: '',
    rooms: '2',
    squareMeters: '',
    recurring: false,
    frequency: 'weekly',
    specialInstructions: ''
  });

  const handleCreateBooking = async () => {
    if (!newBooking.customerName || !newBooking.phone || !newBooking.service || !newBooking.date) {
      toast.error(t('cleaningModule.veuillezRemplirTousLesChamps'));
      return;
    }
    const svc = CLEANING_SERVICES.find(s => s.id === newBooking.service);
    setSubmitting(true);
    const ok = await createBooking({
      service_id: serviceId,
      customer_name: newBooking.customerName,
      customer_phone: newBooking.phone,
      service_code: newBooking.service,
      service_label: svc?.name,
      scheduled_date: newBooking.date,
      scheduled_time: newBooking.time,
      duration_minutes: svc ? svc.duration * 60 : undefined,
      address: newBooking.address,
      price: svc?.basePrice ?? 0,
      recurring: newBooking.recurring,
      frequency: newBooking.recurring ? newBooking.frequency : undefined,
      notes: newBooking.specialInstructions,
    });
    setSubmitting(false);
    if (ok) setNewBooking({
      customerName: '', phone: '', service: '', date: '', time: '', address: '',
      rooms: '2', squareMeters: '', recurring: false, frequency: 'weekly', specialInstructions: ''
    });
  };

  const getStatusBadge = (status: Booking['status']) => {
    const variants = {
      pending: { color: 'bg-amber-100 text-amber-700', label: 'En attente' },
      confirmed: { color: 'bg-[#04439e]/10 text-[#04439e]', label: t('cleaningModule.confirme') },
      in_progress: { color: 'bg-blue-100 text-blue-700', label: 'En cours…' },
      completed: { color: 'bg-[#16a34a]/10 text-[#16a34a]', label: t('cleaningModule.termine') },
      cancelled: { color: 'bg-red-100 text-red-600', label: t('cleaningModule.annule') }
    };
    return variants[status];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            {businessName || 'Service de Nettoyage'}
          </h2>
          <p className="text-muted-foreground">{t('cleaningModule.votrePartenairePourUnEspace')}</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Calendar className="w-3 h-3" />
          {stats.todayBookings} réservations aujourd'hui
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('cleaningModule.reservationsDuJour')}</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayBookings}</div>
            <p className="text-xs text-muted-foreground">{t('cleaningModule.interventionsPlanifiees')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('cleaningModule.completeesCetteSemaine')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedThisWeek}</div>
            <p className="text-xs text-muted-foreground">{t('cleaningModule.t8VsSemaineDerniere')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><Money amount={stats.revenue} from="GNF" /></div>
            <p className="text-xs text-muted-foreground">Ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">{t('cleaningModule.aConfirmer')}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">{t('cleaningModule.nouvelleReservation')}</TabsTrigger>
          <TabsTrigger value="bookings">Planning</TabsTrigger>
          <TabsTrigger value="services">{t('cleaningModule.servicesTarifs')}</TabsTrigger>
          <TabsTrigger value="vitrine">Vitrine</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('cleaningModule.nouvelleReservation')}</CardTitle>
              <CardDescription>{t('cleaningModule.enregistrezUneDemandeDeNettoyage')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">{t('cleaningModule.nomDuClient')}</Label>
                  <Input
                    id="customerName"
                    placeholder="Nom complet"
                    value={newBooking.customerName}
                    onChange={(e) => setNewBooking({ ...newBooking, customerName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t('cleaningModule.telephone')}</Label>
                  <Input
                    id="phone"
                    placeholder="+224 621 00 00 00"
                    value={newBooking.phone}
                    onChange={(e) => setNewBooking({ ...newBooking, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service">{t('cleaningModule.service')}</Label>
                  <Select value={newBooking.service} onValueChange={(value) => setNewBooking({ ...newBooking, service: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('cleaningModule.choisirUnService')} />
                    </SelectTrigger>
                    <SelectContent>
                      {CLEANING_SERVICES.map(service => {
                        const Icon = service.icon;
                        return (
                          <SelectItem key={service.id} value={service.id}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {service.name}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newBooking.date}
                    onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Heure</Label>
                  <Input
                    id="time"
                    type="time"
                    value={newBooking.time}
                    onChange={(e) => setNewBooking({ ...newBooking, time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rooms">{t('cleaningModule.nombreDePieces')}</Label>
                  <Select value={newBooking.rooms} onValueChange={(value) => setNewBooking({ ...newBooking, rooms: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{t('cleaningModule.t1Piece')}</SelectItem>
                      <SelectItem value="2">{t('cleaningModule.t2Pieces')}</SelectItem>
                      <SelectItem value="3">{t('cleaningModule.t3Pieces')}</SelectItem>
                      <SelectItem value="4">{t('cleaningModule.t4Pieces')}</SelectItem>
                      <SelectItem value="5+">{t('cleaningModule.t5Pieces')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="squareMeters">Surface (m²)</Label>
                  <Input
                    id="squareMeters"
                    type="number"
                    placeholder="Ex: 80"
                    value={newBooking.squareMeters}
                    onChange={(e) => setNewBooking({ ...newBooking, squareMeters: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      placeholder="Quartier, commune"
                      value={newBooking.address}
                      onChange={(e) => setNewBooking({ ...newBooking, address: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recurring"
                  checked={newBooking.recurring}
                  onCheckedChange={(checked) => setNewBooking({ ...newBooking, recurring: checked as boolean })}
                />
                <Label htmlFor="recurring" className="cursor-pointer">
                  Service récurrent (économisez jusqu'à 20%)
                </Label>
              </div>

              {newBooking.recurring && (
                <div className="space-y-2">
                  <Label htmlFor="frequency">{t('cleaningModule.frequence')}</Label>
                  <Select value={newBooking.frequency} onValueChange={(value) => setNewBooking({ ...newBooking, frequency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Quotidien (-20%)</SelectItem>
                      <SelectItem value="weekly">Hebdomadaire (-15%)</SelectItem>
                      <SelectItem value="biweekly">Bi-hebdomadaire (-10%)</SelectItem>
                      <SelectItem value="monthly">Mensuel (-5%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="specialInstructions">{t('cleaningModule.instructionsSpeciales')}</Label>
                <Textarea
                  id="specialInstructions"
                  placeholder={t('cleaningModule.exPresenceDAnimauxProduits')}
                  value={newBooking.specialInstructions}
                  onChange={(e) => setNewBooking({ ...newBooking, specialInstructions: e.target.value })}
                  rows={3}
                />
              </div>

              <Button onClick={handleCreateBooking} disabled={submitting} className="w-full" size="lg">
                {submitting ? 'Enregistrement...' : 'Confirmer la réservation'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('cleaningModule.planningDesInterventions')}</CardTitle>
              <CardDescription>{t('cleaningModule.gerezVosReservations')}</CardDescription>
            </CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t('cleaningModule.aucuneReservation')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map(booking => {
                    const statusInfo = getStatusBadge(booking.status);
                    const service = CLEANING_SERVICES.find(s => s.id === booking.service);
                    const Icon = service?.icon || Home;

                    return (
                      <Card key={booking.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4 flex-1">
                              <div className="bg-primary/10 p-3 rounded-lg">
                                <Icon className="w-6 h-6 text-primary" />
                              </div>
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge className={statusInfo.color}>
                                    {statusInfo.label}
                                  </Badge>
                                  {booking.recurring && (
                                    <Badge variant="outline">{t('cleaningModule.recurrent')}</Badge>
                                  )}
                                  {['confirmed', 'completed', 'in_progress'].includes(booking.status) && (
                                    <Badge className="gap-0.5 border-0 bg-[#16a34a]/10 text-[10px] text-[#16a34a]">
                                      <Shield className="h-2.5 w-2.5" /> Agent vérifié
                                    </Badge>
                                  )}
                                </div>
                                <h3 className="font-bold">{booking.customerName}</h3>
                                <p className="text-sm text-muted-foreground">{booking.phone}</p>
                                <p className="text-sm font-medium">{service?.name}</p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(booking.date).toLocaleDateString('fr-FR')}
                                  </span>
                                  {booking.time && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      {booking.time}
                                    </span>
                                  )}
                                  {booking.address && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-4 h-4" />
                                      {booking.address}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary"><Money amount={booking.price} from="GNF" /></p>
                              <div className="mt-2 flex flex-col gap-1">
                                {booking.status === 'pending' && <Button size="sm" onClick={() => setStatus(booking.id, 'confirmed')}>Confirmer</Button>}
                                {booking.status === 'confirmed' && <Button size="sm" onClick={() => setStatus(booking.id, 'in_progress')}>{t('cleaningModule.demarrer')}</Button>}
                                {booking.status === 'in_progress' && <Button size="sm" onClick={() => setStatus(booking.id, 'completed')}>Terminer</Button>}
                                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                                  <Button size="sm" variant="outline" onClick={() => setStatus(booking.id, 'cancelled')}>{t('cleaningModule.annuler')}</Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('cleaningModule.nosServicesTarifs')}</CardTitle>
              <CardDescription>{t('cleaningModule.catalogueCompletDeNosPrestations')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CLEANING_SERVICES.map(service => {
                  const Icon = service.icon;
                  return (
                    <Card key={service.id} className="border-2">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-lg">
                              <Icon className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{service.name}</CardTitle>
                              <p className="text-sm text-muted-foreground">Durée: ~{service.duration}h</p>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm mb-3">{service.description}</p>
                        <div className="flex items-baseline justify-between">
                          <div>
                            <p className="text-2xl font-bold text-primary"><Money amount={service.basePrice} from="GNF" /></p>
                            <p className="text-xs text-muted-foreground">{service.unit}</p>
                          </div>
                          <Button size="sm">{t('cleaningModule.reserver')}</Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className="mt-6 bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-8 h-8 text-primary" />
                    <div>
                      <h3 className="font-bold">{t('cleaningModule.reductionsPourContratsRecurrents')}</h3>
                      <p className="text-sm text-muted-foreground">
                        Quotidien: -20% • Hebdomadaire: -15% • Bi-hebdomadaire: -10% • Mensuel: -5%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vitrine Tab — publier au marketplace (image + vidéo Premium) */}
        <TabsContent value="vitrine" className="space-y-4">
          <ServiceShowcaseManager serviceId={serviceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

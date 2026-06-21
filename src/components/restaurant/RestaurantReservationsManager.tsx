import { useTranslation } from "@/hooks/useTranslation";
/**
 * Gestionnaire de réservations pour le restaurant
 * Permet au propriétaire de voir et gérer toutes les réservations
 * Vue temps réel avec notifications et actions rapides
 */

import { useState } from 'react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar, Clock, Users, Phone, Mail, CheckCircle, XCircle,
  User, RefreshCw, Bell, Eye, MessageSquare, CreditCard,
  CalendarDays, Filter, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRestaurantReservations, RestaurantReservation } from '@/hooks/useRestaurantReservations';

interface RestaurantReservationsManagerProps {
  serviceId: string;
}

export function RestaurantReservationsManager({ serviceId }: RestaurantReservationsManagerProps) {
  const { t } = useTranslation();
  const {
    reservations,
    loading,
    refresh,
    updateReservationStatus,
    cancelReservation,
    getReservationStats
  } = useRestaurantReservations(serviceId);

  const [activeTab, setActiveTab] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReservation, setSelectedReservation] = useState<RestaurantReservation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Statistiques
  const stats = getReservationStats();

  // Filtrer les réservations
  const filterReservations = (reservationList: RestaurantReservation[]) => {
    return reservationList.filter(r => {
      // Filtre par recherche
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!r.customer_name.toLowerCase().includes(search) &&
            !r.customer_phone?.toLowerCase().includes(search) &&
            !r.customer_email?.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Filtre par statut
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      return true;
    });
  };

  // Réservations par période
  const today = new Date().toISOString().split('T')[0];
  const todayReservations = filterReservations(
    reservations.filter(r => r.reservation_date === today)
  );

  const upcomingReservations = filterReservations(
    reservations.filter(r => {
      const date = r.reservation_date;
      return date > today && !['cancelled', 'no_show', 'completed'].includes(r.status);
    })
  );

  const pastReservations = filterReservations(
    reservations.filter(r => {
      const date = r.reservation_date;
      return date < today || ['completed', 'cancelled', 'no_show'].includes(r.status);
    })
  );

  const getStatusConfig = (status: RestaurantReservation['status']) => {
    switch (status) {
      case 'pending':
        return { label: 'En attente', color: 'bg-[#ff4000]', icon: Clock };
      case 'confirmed':
        return { label: 'Confirmée', color: 'bg-blue-500', icon: CheckCircle };
      case 'seated':
        return { label: 'À table', color: 'bg-[#04439e]', icon: Users };
      case 'completed':
        return { label: 'Terminée', color: 'bg-[#ff4000]', icon: CheckCircle };
      case 'cancelled':
        return { label: 'Annulée', color: 'bg-[#ff4000]', icon: XCircle };
      case 'no_show':
        return { label: 'Absent', color: 'bg-gray-500', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-500', icon: Clock };
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Aujourd'hui";
    if (isTomorrow(date)) return "Demain";
    return format(date, 'EEEE d MMMM', { locale: fr });
  };

  const handleStatusChange = async (id: string, newStatus: RestaurantReservation['status']) => {
    try {
      await updateReservationStatus(id, newStatus);
      toast.success(`Réservation ${getStatusConfig(newStatus).label.toLowerCase()}`);
    } catch (_error) {
      toast.error(t('restaurantReservationsManager.erreurLorsDeLaMise'));
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelReservation(id);
      toast.success(t('restaurantReservationsManager.reservationAnnulee'));
      setShowDetailModal(false);
    } catch (_error) {
      toast.error(t('restaurantReservationsManager.erreurLorsDeLAnnulation'));
    }
  };

  const ReservationCard = ({ reservation }: { reservation: RestaurantReservation }) => {
    const statusConfig = getStatusConfig(reservation.status);
    const StatusIcon = statusConfig.icon;

    return (
      <Card className="hover:shadow-lg transition-all cursor-pointer border-l-4"
            style={{ borderLeftColor: `var(--${statusConfig.color.replace('bg-', '')})` }}
            onClick={() => {
              setSelectedReservation(reservation);
              setShowDetailModal(true);
            }}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Info client */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">{reservation.customer_name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span>{reservation.party_size} pers.</span>
                    <Clock className="w-3 h-3 ml-2" />
                    <span>{reservation.reservation_time.substring(0, 5)}</span>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {reservation.customer_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {reservation.customer_phone}
                  </span>
                )}
                {reservation.customer_email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {reservation.customer_email}
                  </span>
                )}
              </div>

              {/* Notes spéciales */}
              {reservation.special_requests && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md line-clamp-1">
                  💬 {reservation.special_requests}
                </p>
              )}
            </div>

            {/* Statut et actions */}
            <div className="flex flex-col items-end gap-2">
              <Badge className={statusConfig.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>

              {reservation.table_number && (
                <Badge variant="outline">Table {reservation.table_number}</Badge>
              )}
            </div>
          </div>

          {/* Actions rapides */}
          {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
            <div className="flex gap-2 mt-3 pt-3 border-t">
              {reservation.status === 'pending' && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(reservation.id, 'confirmed');
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Confirmer
                </Button>
              )}
              {reservation.status === 'confirmed' && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(reservation.id, 'seated');
                  }}
                >
                  <Users className="w-4 h-4 mr-1" />
                  Installer
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReservation(reservation);
                  setShowDetailModal(true);
                }}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const ReservationList = ({ reservations }: { reservations: RestaurantReservation[] }) => {
    if (reservations.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">{t('restaurantReservationsManager.aucuneReservation')}</p>
          </CardContent>
        </Card>
      );
    }

    // Grouper par date
    const grouped = reservations.reduce((acc, r) => {
      const date = r.reservation_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(r);
      return acc;
    }, {} as Record<string, RestaurantReservation[]>);

    return (
      <div className="space-y-6">
        {Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, items]) => (
            <div key={date}>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                {formatDateLabel(date)}
                <Badge variant="secondary">{items.length}</Badge>
              </h3>
              <div className="grid gap-3">
                {items
                  .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
                  .map(r => (
                    <ReservationCard key={r.id} reservation={r} />
                  ))}
              </div>
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Réservations
          </h2>
          <p className="text-muted-foreground text-sm">
            Gérez les réservations de votre restaurant
          </p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
            <div className="text-xs text-blue-600/80">Aujourd'hui</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-[#ff4000]/20 dark:to-[#ff4000]/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#ff4000]">{stats.pending}</div>
            <div className="text-xs text-[#ff4000]/80">En attente</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-[#04439e]/20 dark:to-[#04439e]/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#04439e]">{stats.todayGuests}</div>
            <div className="text-xs text-[#04439e]/80">Couverts</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-[#ff4000]/20 dark:to-[#ff4000]/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#ff4000]">{stats.confirmed}</div>
            <div className="text-xs text-[#ff4000]/80">{t('restaurantReservationsManager.confirmees')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('restaurantReservationsManager.rechercherParNomTelephone')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('restaurantReservationsManager.tousLesStatuts')}</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="confirmed">{t('restaurantReservationsManager.confirmees')}</SelectItem>
            <SelectItem value="seated">{t('restaurantReservationsManager.aTable')}</SelectItem>
            <SelectItem value="completed">{t('restaurantReservationsManager.terminees')}</SelectItem>
            <SelectItem value="cancelled">{t('restaurantReservationsManager.annulees')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">
            Aujourd'hui ({todayReservations.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            À venir ({upcomingReservations.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Historique ({pastReservations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : (
            <ReservationList reservations={todayReservations} />
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <ReservationList reservations={upcomingReservations} />
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          <ReservationList reservations={pastReservations} />
        </TabsContent>
      </Tabs>

      {/* Modal de détail */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('restaurantReservationsManager.detailsDeLaReservation')}</DialogTitle>
          </DialogHeader>

          {selectedReservation && (
            <div className="space-y-4">
              {/* Info client */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedReservation.customer_name}</h3>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {selectedReservation.customer_phone && (
                      <a href={`tel:${selectedReservation.customer_phone}`} className="flex items-center gap-1 hover:text-primary">
                        <Phone className="w-3 h-3" />
                        {selectedReservation.customer_phone}
                      </a>
                    )}
                    {selectedReservation.customer_email && (
                      <a href={`mailto:${selectedReservation.customer_email}`} className="flex items-center gap-1 hover:text-primary">
                        <Mail className="w-3 h-3" />
                        {selectedReservation.customer_email}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Détails réservation */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Date</div>
                  <div className="font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    {format(parseISO(selectedReservation.reservation_date), 'EEEE d MMMM yyyy', { locale: fr })}
                  </div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Heure</div>
                  <div className="font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    {selectedReservation.reservation_time.substring(0, 5)}
                  </div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Personnes</div>
                  <div className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {selectedReservation.party_size} couvert{selectedReservation.party_size > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Statut</div>
                  <Badge className={getStatusConfig(selectedReservation.status).color}>
                    {getStatusConfig(selectedReservation.status).label}
                  </Badge>
                </div>
              </div>

              {/* Notes */}
              {selectedReservation.special_requests && (
                <div className="p-4 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg border border-orange-200">
                  <div className="text-xs font-medium text-[#ff4000] mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    Demandes spéciales
                  </div>
                  <p className="text-sm">{selectedReservation.special_requests}</p>
                </div>
              )}

              {/* Table assignée */}
              {selectedReservation.table_number && (
                <div className="p-3 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg text-center">
                  <span className="text-sm text-[#ff4000]">{t('restaurantReservationsManager.tableAssignee')} </span>
                  <span className="font-bold text-[#ff4000]">{selectedReservation.table_number}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedReservation?.status === 'pending' && (
              <>
                <Button
                  className="flex-1"
                  onClick={() => {
                    handleStatusChange(selectedReservation.id, 'confirmed');
                    setShowDetailModal(false);
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmer
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleCancel(selectedReservation.id)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </>
            )}
            {selectedReservation?.status === 'confirmed' && (
              <>
                <Button
                  className="flex-1"
                  onClick={() => {
                    handleStatusChange(selectedReservation.id, 'seated');
                    setShowDetailModal(false);
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Installer à table
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    handleStatusChange(selectedReservation.id, 'no_show');
                    setShowDetailModal(false);
                  }}
                >
                  Marquer absent
                </Button>
              </>
            )}
            {selectedReservation?.status === 'seated' && (
              <Button
                className="flex-1"
                onClick={() => {
                  handleStatusChange(selectedReservation.id, 'completed');
                  setShowDetailModal(false);
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Terminer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

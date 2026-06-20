/**
 * Suivi des réservations restaurant pour les clients
 * Permet de voir le statut, télécharger le reçu et suivre la confirmation
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar, Clock, Users, Check, X, AlertCircle,
  Download, RefreshCw, MapPin, Phone, Receipt,
  CheckCircle2, Timer, Armchair, XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Reservation {
  id: string;
  professional_service_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  table_number: string | null;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  special_requests: string | null;
  created_at: string;
  updated_at: string;
  payment_status?: string;
  payment_amount?: number;
  restaurant_name?: string;
}

interface CustomerReservationTrackerProps {
  reservationId?: string;
  customerEmail?: string;
  onClose?: () => void;
}

const statusConfig = {
  pending: {
    label: 'En attente',
    icon: Timer,
    color: 'text-[#ff4000] bg-orange-100 dark:bg-[#ff4000]/30',
    description: 'Votre réservation est en attente de confirmation par le restaurant'
  },
  confirmed: {
    label: 'Confirmée',
    icon: CheckCircle2,
    color: 'text-[#ff4000] bg-orange-100 dark:bg-[#ff4000]/30',
    description: 'Le restaurant a confirmé votre réservation'
  },
  seated: {
    label: 'Installé',
    icon: Armchair,
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    description: 'Vous êtes installé à votre table'
  },
  completed: {
    label: 'Terminée',
    icon: Check,
    color: 'text-gray-600 bg-gray-100 dark:bg-gray-800',
    description: 'Merci pour votre visite !'
  },
  cancelled: {
    label: 'Annulée',
    icon: XCircle,
    color: 'text-[#ff4000] bg-orange-100 dark:bg-[#ff4000]/30',
    description: 'Cette réservation a été annulée'
  },
  no_show: {
    label: 'Absent',
    icon: X,
    color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
    description: 'Vous ne vous êtes pas présenté'
  }
};

export function CustomerReservationTracker({
  reservationId,
  customerEmail,
  onClose
}: CustomerReservationTrackerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Annulation par le client (réservation pas encore passée / installée). Met à jour le statut.
  const cancelReservation = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm(t('customerReservationTracker.annulerCetteReservation'))) return;
    setCancellingId(id);
    try {
      const { error } = await supabase
        .from('restaurant_reservations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)));
      toast.success(t('customerReservationTracker.reservationAnnulee'));
    } catch {
      toast.error(t('customerReservationTracker.annulationImpossibleContactezLeRestauran'));
    } finally {
      setCancellingId(null);
    }
  };

  const loadReservations = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('restaurant_reservations')
        .select(`
          *,
          professional_services:professional_service_id (
            business_name
          )
        `)
        .order('reservation_date', { ascending: false })
        .order('reservation_time', { ascending: false });

      if (reservationId) {
        query = query.eq('id', reservationId);
      } else if (customerEmail) {
        query = query.eq('customer_email', customerEmail);
      } else if (user?.email) {
        query = query.eq('customer_email', user.email);
      } else {
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedReservations = (data || []).map((r: any) => ({
        ...r,
        restaurant_name: r.professional_services?.business_name || 'Restaurant'
      }));

      setReservations(formattedReservations);
    } catch (err: any) {
      console.error('Erreur chargement réservations:', err);
      toast.error(t('customerReservationTracker.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReservations();
    setRefreshing(false);
    toast.success(t('customerReservationTracker.statutMisAJour'));
  };

  const generateReceipt = (reservation: Reservation) => {
    // Générer un reçu simple en texte/HTML
    const receiptContent = `
╔═══════════════════════════════════════╗
║          REÇU DE RÉSERVATION          ║
╠═══════════════════════════════════════╣
║                                       ║
║  Restaurant: ${reservation.restaurant_name?.padEnd(22)}║
║  Date: ${format(new Date(reservation.reservation_date), 'dd MMMM yyyy', { locale: fr }).padEnd(28)}║
║  Heure: ${reservation.reservation_time.padEnd(27)}║
║  Convives: ${reservation.party_size.toString().padEnd(24)}║
║  Table: ${(reservation.table_number || 'À définir').padEnd(27)}║
║                                       ║
╠═══════════════════════════════════════╣
║  Réservation au nom de:               ║
║  ${reservation.customer_name.padEnd(36)}║
║                                       ║
╠═══════════════════════════════════════╣
║  Statut: ${statusConfig[reservation.status].label.padEnd(26)}║
║                                       ║
╠═══════════════════════════════════════╣
║  Référence: ${reservation.id.substring(0, 8).toUpperCase().padEnd(23)}║
║  Créée le: ${format(new Date(reservation.created_at), 'dd/MM/yyyy HH:mm').padEnd(24)}║
║                                       ║
╚═══════════════════════════════════════╝

Merci d'avoir réservé avec 224Solutions !
    `;

    // Créer un blob et télécharger
    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recu-reservation-${reservation.id.substring(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t('customerReservationTracker.recuTelecharge'));
  };

  useEffect(() => {
    loadReservations();

    // Écouter les changements en temps réel
    const channel = supabase
      .channel('reservation-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurant_reservations',
          filter: reservationId ? `id=eq.${reservationId}` : undefined
        },
        (payload) => {
          console.log('Réservation mise à jour:', payload);
          loadReservations();
          toast.info(t('customerReservationTracker.statutDeVotreReservationMis'));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, customerEmail, user?.email]);

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground">{t('customerReservationTracker.chargementDeVosReservations')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (reservations.length === 0) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Calendar className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('customerReservationTracker.aucuneReservationTrouvee')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('customerReservationTracker.mesReservations')}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {reservations.map((reservation) => {
        const status = statusConfig[reservation.status];
        const StatusIcon = status.icon;
        const isPast = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`) < new Date();

        return (
          <Card
            key={reservation.id}
            className={cn(
              "transition-all",
              reservation.status === 'confirmed' && "ring-2 ring-[#ff4000]/50",
              reservation.status === 'seated' && "ring-2 ring-blue-500/50"
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{reservation.restaurant_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Réf: #{reservation.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
                <Badge className={cn("gap-1", status.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Info principale */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium text-sm">
                      {format(new Date(reservation.reservation_date), 'd MMM', { locale: fr })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Heure</p>
                    <p className="font-medium text-sm">{reservation.reservation_time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Convives</p>
                    <p className="font-medium text-sm">{reservation.party_size}</p>
                  </div>
                </div>
              </div>

              {/* Table assignée */}
              {reservation.table_number && (
                <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Table {reservation.table_number}</p>
                    <p className="text-xs text-muted-foreground">{t('customerReservationTracker.votreTableEstPrete')}</p>
                  </div>
                </div>
              )}

              {/* Statut description */}
              <div className={cn(
                "rounded-lg p-3 flex items-start gap-3",
                status.color.replace('text-', 'bg-').replace('-600', '-50')
              )}>
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{status.description}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateReceipt(reservation)}
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Télécharger le reçu
                </Button>

                {!isPast && !['cancelled', 'seated', 'completed'].includes(reservation.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancellingId === reservation.id}
                    onClick={() => cancelReservation(reservation.id)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    {cancellingId === reservation.id ? 'Annulation…' : 'Annuler'}
                  </Button>
                )}
              </div>

              {/* Demandes spéciales */}
              {reservation.special_requests && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('customerReservationTracker.demandesSpeciales')}</p>
                    <p className="text-sm">{reservation.special_requests}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

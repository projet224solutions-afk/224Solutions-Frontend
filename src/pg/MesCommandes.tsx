import { useTranslation } from "@/hooks/useTranslation";
﻿/**
 * PAGE MES COMMANDES - Suivi unifié Restaurant + Taxi-Moto
 * Le client voit l'évolution de ses commandes en temps réel
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UtensilsCrossed, Bike, Clock, RefreshCw, ChefHat, Package, CheckCircle2, XCircle, MapPin, Phone, RotateCcw, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ClientDeliveryTracking } from '@/components/delivery/ClientDeliveryTracking';
import QuickFooter from '@/components/QuickFooter';

// Status configs
const restaurantStatusConfig: Record<string, { label: string; color: string; icon: any; step: number }> = {
  pending: { label: 'En attente', color: 'bg-[#ff4000]', icon: Clock, step: 1 },
  confirmed: { label: t('mesCommandes.confirmee'), color: 'bg-blue-500', icon: CheckCircle2, step: 2 },
  preparing: { label: t('mesCommandes.enPreparation'), color: 'bg-orange-500', icon: ChefHat, step: 3 },
  ready: { label: t('mesCommandes.prete'), color: 'bg-[#ff4000]', icon: Package, step: 4 },
  delivered: { label: t('mesCommandes.livree'), color: 'bg-[#ff4000]', icon: CheckCircle2, step: 5 },
  completed: { label: t('mesCommandes.terminee'), color: 'bg-primary', icon: CheckCircle2, step: 6 },
  cancelled: { label: t('mesCommandes.annulee'), color: 'bg-destructive', icon: XCircle, step: 0 },
};

const taxiStatusConfig: Record<string, { label: string; color: string; icon: any; step: number }> = {
  requested: { label: 'Recherche chauffeur', color: 'bg-[#ff4000]', icon: Clock, step: 1 },
  accepted: { label: 'Chauffeur en route', color: 'bg-blue-500', icon: Bike, step: 2 },
  arrived: { label: t('mesCommandes.chauffeurArrive'), color: 'bg-[#04439e]', icon: MapPin, step: 3 },
  picked_up: { label: 'En course', color: 'bg-orange-500', icon: Bike, step: 4 },
  completed: { label: t('mesCommandes.terminee'), color: 'bg-[#ff4000]', icon: CheckCircle2, step: 5 },
  cancelled: { label: t('mesCommandes.annulee'), color: 'bg-destructive', icon: XCircle, step: 0 },
  cancelled_by_customer: { label: t('mesCommandes.annulee'), color: 'bg-destructive', icon: XCircle, step: 0 },
  cancelled_by_driver: { label: t('mesCommandes.annuleeParChauffeur'), color: 'bg-destructive', icon: XCircle, step: 0 },
};

const restaurantSteps = ['En attente', 'Confirmée', 'Préparation', 'Prête', 'Livrée', 'Terminée'];
const taxiSteps = ['Demandée', 'Acceptée', 'Arrivé', 'En course', 'Terminée'];

interface RestaurantOrderTracking {
  id: string;
  order_number: string | null;
  status: string;
  order_type: string | null;
  total: number | null;
  items: any;
  created_at: string | null;
  customer_name: string | null;
  table_number: string | null;
  delivery_address: string | null;
  started_preparing_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_reason: string | null;
  professional_service_id: string;
}

interface TaxiTripTracking {
  id: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  price_total: number | null;
  distance_km: number | null;
  duration_min: number | null;
  requested_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  ride_code: string | null;
  payment_status: string | null;
  driver_id: string | null;
}

function StatusStepper({ steps, currentStep, isCancelled }: { steps: string[]; currentStep: number; isCancelled: boolean }) {
  const { t } = useTranslation();
  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 py-3">
        <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
          <XCircle className="w-4 h-4 text-destructive-foreground" />
        </div>
        <span className="text-sm font-medium text-destructive">{t('mesCommandes.commandeAnnulee')}</span>
      </div>
    );
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between relative">
        {/* Line */}
        <div className="absolute top-3 left-3 right-3 h-0.5 bg-muted" />
        <div
          className="absolute top-3 left-3 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${Math.max(0, ((currentStep - 1) / (steps.length - 1)) * 100)}%`, maxWidth: 'calc(100% - 24px)' }}
        />
        {steps.map((step, index) => {
          const isActive = index + 1 <= currentStep;
          const isCurrent = index + 1 === currentStep;
          return (
            <div key={step} className="flex flex-col items-center z-10 relative">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110'
                    : isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isActive ? '✓' : index + 1}
              </div>
              <span className={`text-[10px] mt-1 text-center max-w-[60px] leading-tight ${isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RestaurantOrderCard({ order }: { order: RestaurantOrderTracking }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const config = restaurantStatusConfig[order.status || 'pending'] || restaurantStatusConfig.pending;
  const StatusIcon = config.icon;
  const isCancelled = order.status === 'cancelled';
  const isHistorical = ['completed', 'delivered', 'cancelled'].includes(order.status || '');
  const canRate = ['completed', 'delivered'].includes(order.status || '');

  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rated, setRated] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackDeliveryId, setTrackDeliveryId] = useState<string | null>(null);

  // SUIVI LIVRAISON : pour une commande en livraison acceptée, on retrouve la course (deliveries)
  // créée par le backend et on ouvre la carte temps réel (livreur en mouvement via Ably).
  const isDelivery = order.order_type === 'delivery';
  const canTrack = isDelivery && ['confirmed', 'preparing', 'ready', 'delivered'].includes(order.status || '');
  const openTracking = async () => {
    const { data } = await supabase.from('deliveries').select('id').eq('restaurant_order_id', order.id).maybeSingle();
    if (!data?.id) { toast.info(t('mesCommandes.leLivreurNAPas')); return; }
    setTrackDeliveryId(data.id); setTrackOpen(true);
  };

  // RECOMMANDER : rouvre le restaurant en re-chargeant exactement les mêmes plats dans le panier.
  const reorder = () => navigate(`/restaurant/${order.professional_service_id}/menu?reorder=${order.id}`);

  // NOTER : avis VÉRIFIÉ via la RPC submit_restaurant_review (le serveur exige une commande
  // terminée/livrée pour ce restaurant + 1 seul avis par client = upsert). Actif après clôture.
  const submitReview = async () => {
    if (!user?.id || stars < 1) { toast.error(t('mesCommandes.choisissezUneNote')); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('submit_restaurant_review', {
        p_service_id: order.professional_service_id,
        p_rating: stars,
        p_comment: comment.trim() || null,
      });
      if (error) throw error;
      toast.success(t('mesCommandes.merciPourVotreAvis'));
      setRated(true); setRateOpen(false);
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast.error(
        /AUCUNE_COMMANDE/.test(msg) ? 'Vous devez avoir une commande terminée pour noter ce restaurant.'
        : /NOTE_INVALIDE/.test(msg) ? 'Note invalide.'
        : 'Impossible d\'enregistrer l\'avis'
      );
    } finally { setSubmitting(false); }
  };

  const orderTypeLabels: Record<string, string> = {
    dine_in: '🍽️ Sur place',
    delivery: '🚚 Livraison',
    takeaway: '📦 À emporter',
  };

  return (
    <Card className="overflow-hidden border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: `var(--${config.color.replace('bg-', '')}, hsl(var(--primary)))` }}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-bold text-sm">
              {order.order_number || `#${order.id.slice(0, 8)}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {order.created_at ? new Date(order.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {orderTypeLabels[order.order_type || ''] || order.order_type}
            </Badge>
            <Badge className={`${config.color} text-white text-xs`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>
        </div>

        {/* Stepper */}
        <StatusStepper steps={restaurantSteps} currentStep={config.step} isCancelled={isCancelled} />

        {/* Details */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {order.table_number && <span>Table {order.table_number}</span>}
            {order.delivery_address && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {order.delivery_address}
              </span>
            )}
          </div>
          <p className="font-bold text-base">
            {order.total ? <Money amount={order.total} from="GNF" /> : '-'}
          </p>
        </div>

        {isCancelled && order.cancelled_reason && (
          <p className="text-xs text-destructive mt-2 italic">Raison: {order.cancelled_reason}</p>
        )}

        {/* Suivi de la livraison (carte temps réel) pour les commandes en livraison en cours */}
        {canTrack && (
          <Button size="sm" className="mt-3 w-full gap-1.5 bg-[#04439e] hover:bg-[#04439e]/90" onClick={openTracking}>
            <MapPin className="h-4 w-4" /> Suivre la livraison
          </Button>
        )}

        {/* Actions historique : RECOMMANDER (1 clic) + NOTER (après livraison) */}
        {isHistorical && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={reorder}>
              <RotateCcw className="h-4 w-4" /> Recommander
            </Button>
            {canRate && (
              <Button size="sm" variant={rated ? 'ghost' : 'default'} className="flex-1 gap-1.5" disabled={rated} onClick={() => setRateOpen(true)}>
                <Star className={`h-4 w-4 ${rated ? 'fill-amber-400 text-amber-400' : ''}`} /> {rated ? 'Noté' : 'Noter'}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Carte de suivi livreur temps réel */}
      <Dialog open={trackOpen} onOpenChange={setTrackOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('mesCommandes.suiviDeLaLivraison')}</DialogTitle></DialogHeader>
          {trackDeliveryId && <ClientDeliveryTracking deliveryId={trackDeliveryId} />}
        </DialogContent>
      </Dialog>

      {/* Dialogue de notation */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('mesCommandes.noterVotreCommande')}</DialogTitle></DialogHeader>
          <div className="flex justify-center gap-1.5 py-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} étoile${n > 1 ? 's' : ''}`}>
                <Star className={`h-8 w-8 transition-colors ${n <= stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
              </button>
            ))}
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('mesCommandes.votreAvisOptionnel')} rows={3} />
          <Button onClick={submitReview} disabled={submitting || stars < 1} className="w-full">
            {submitting ? 'Envoi…' : 'Envoyer mon avis'}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TaxiTripCard({ trip }: { trip: TaxiTripTracking }) {
  const { t } = useTranslation();
  const config = taxiStatusConfig[trip.status || 'requested'] || taxiStatusConfig.requested;
  const StatusIcon = config.icon;
  const isCancelled = ['cancelled', 'cancelled_by_customer', 'cancelled_by_driver'].includes(trip.status || '');

  return (
    <Card className="overflow-hidden border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: `var(--${config.color.replace('bg-', '')}, hsl(var(--primary)))` }}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-bold text-sm">
              Course {trip.ride_code || `#${trip.id.slice(0, 8)}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {trip.requested_at ? new Date(trip.requested_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
            </p>
          </div>
          <Badge className={`${config.color} text-white text-xs`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>

        {/* Stepper */}
        <StatusStepper steps={taxiSteps} currentStep={config.step} isCancelled={isCancelled} />

        {/* Route */}
        <div className="space-y-1.5 mt-2 pt-2 border-t border-border">
          {trip.pickup_address && (
            <div className="flex items-start gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-[#ff4000] mt-1 shrink-0" />
              <span className="text-muted-foreground">{trip.pickup_address}</span>
            </div>
          )}
          {trip.dropoff_address && (
            <div className="flex items-start gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-[#ff4000] mt-1 shrink-0" />
              <span className="text-muted-foreground">{trip.dropoff_address}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <div className="flex gap-3 text-xs text-muted-foreground">
            {trip.distance_km && <span>{trip.distance_km.toFixed(1)} km</span>}
            {trip.duration_min && <span>~{Math.round(trip.duration_min)} min</span>}
          </div>
          <p className="font-bold text-base">
            {trip.price_total ? <Money amount={trip.price_total} from="GNF" /> : '-'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MesCommandes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [restaurantOrders, setRestaurantOrders] = useState<RestaurantOrderTracking[]>([]);
  const [taxiTrips, setTaxiTrips] = useState<TaxiTripTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const [resOrders, resTaxi] = await Promise.all([
      supabase
        .from('restaurant_orders')
        .select('id, order_number, status, order_type, total, items, created_at, customer_name, table_number, delivery_address, started_preparing_at, ready_at, completed_at, cancelled_reason, professional_service_id')
        .eq('customer_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('taxi_trips')
        .select('id, status, pickup_address, dropoff_address, price_total, distance_km, duration_min, requested_at, accepted_at, started_at, completed_at, ride_code, payment_status, driver_id')
        .eq('customer_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(50),
    ]);

    setRestaurantOrders((resOrders.data as RestaurantOrderTracking[]) || []);
    setTaxiTrips((resTaxi.data as TaxiTripTracking[]) || []);
    setLoading(false);
  }, [user?.id]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;
    loadData();

    const restaurantSub = supabase
      .channel('my-restaurant-orders')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'restaurant_orders',
        filter: `customer_user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setRestaurantOrders(prev =>
            prev.map(o => o.id === (payload.new as any).id ? { ...o, ...payload.new } as RestaurantOrderTracking : o)
          );
        } else if (payload.eventType === 'INSERT') {
          setRestaurantOrders(prev => [payload.new as RestaurantOrderTracking, ...prev]);
        }
      })
      .subscribe();

    const taxiSub = supabase
      .channel('my-taxi-trips')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'taxi_trips',
        filter: `customer_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setTaxiTrips(prev =>
            prev.map(t => t.id === (payload.new as any).id ? { ...t, ...payload.new } as TaxiTripTracking : t)
          );
        } else if (payload.eventType === 'INSERT') {
          setTaxiTrips(prev => [payload.new as TaxiTripTracking, ...prev]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(restaurantSub);
      supabase.removeChannel(taxiSub);
    };
  }, [user?.id, loadData]);

  const activeRestaurantOrders = restaurantOrders.filter(o => !['completed', 'cancelled'].includes(o.status || ''));
  const activeTaxiTrips = taxiTrips.filter(t => !['completed', 'cancelled', 'cancelled_by_customer', 'cancelled_by_driver'].includes(t.status || ''));
  const totalActive = activeRestaurantOrders.length + activeTaxiTrips.length;

  const filteredRestaurant = activeTab === 'taxi' ? [] : restaurantOrders;
  const filteredTaxi = activeTab === 'restaurant' ? [] : taxiTrips;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{t('mesCommandes.mesCommandesCourses')}</h1>
              {totalActive > 0 && (
                <p className="text-xs text-primary font-medium">
                  {totalActive} en cours
                </p>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="container max-w-2xl mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              Tout ({restaurantOrders.length + taxiTrips.length})
            </TabsTrigger>
            <TabsTrigger value="restaurant" className="text-xs sm:text-sm gap-1">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              Restaurant ({restaurantOrders.length})
            </TabsTrigger>
            <TabsTrigger value="taxi" className="text-xs sm:text-sm gap-1">
              <Bike className="w-3.5 h-3.5" />
              Taxi ({taxiTrips.length})
            </TabsTrigger>
          </TabsList>

          {/* Active orders highlight */}
          {totalActive > 0 && (
            <div className="mt-4 mb-2">
              <h2 className="text-sm font-semibold text-primary flex items-center gap-1.5 mb-3">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                En cours
              </h2>
              <div className="space-y-3">
                {activeTab !== 'taxi' && activeRestaurantOrders.map(order => (
                  <RestaurantOrderCard key={order.id} order={order} />
                ))}
                {activeTab !== 'restaurant' && activeTaxiTrips.map(trip => (
                  <TaxiTripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}

          {/* All content */}
          <div className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRestaurant.length === 0 && filteredTaxi.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">{t('mesCommandes.aucuneCommande')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Vos commandes restaurant et courses taxi apparaëtront ici
                </p>
              </div>
            ) : (
              <>
                {totalActive > 0 && (
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3">Historique</h2>
                )}
                <div className="space-y-3">
                  {/* Merge and sort by date */}
                  {[
                    ...filteredRestaurant
                      .filter(o => ['completed', 'cancelled'].includes(o.status || ''))
                      .map(o => ({ type: 'restaurant' as const, data: o, date: o.created_at || '' })),
                    ...filteredTaxi
                      .filter(t => ['completed', 'cancelled', 'cancelled_by_customer', 'cancelled_by_driver'].includes(t.status || ''))
                      .map(t => ({ type: 'taxi' as const, data: t, date: t.requested_at || '' })),
                  ]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(item =>
                      item.type === 'restaurant' ? (
                        <RestaurantOrderCard key={item.data.id} order={item.data as RestaurantOrderTracking} />
                      ) : (
                        <TaxiTripCard key={item.data.id} trip={item.data as TaxiTripTracking} />
                      )
                    )}
                </div>
              </>
            )}
          </div>
        </Tabs>
      </div>

      <QuickFooter />
    </div>
  );
}

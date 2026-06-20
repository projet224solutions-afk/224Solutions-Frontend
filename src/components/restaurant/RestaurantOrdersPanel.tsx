/**
 * Panel de gestion des commandes restaurant
 * Affiche les commandes en temps réel avec possibilité de confirmation
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock, Check, XCircle, ChefHat, Package, Truck,
  Phone, MapPin, CreditCard, Wallet, Banknote, RefreshCw,
  Bell, Eye, Utensils
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface RestaurantOrder {
  id: string;
  professional_service_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  table_number: string | null;
  delivery_address: string | null;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method: string;
  notes: string | null;
  source: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'En attente', color: 'bg-orange-100 text-[#ff4000] border-orange-300', icon: <Clock className="w-4 h-4" /> },
  confirmed: { label: 'Confirmée', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: <Check className="w-4 h-4" /> },
  preparing: { label: 'En préparation', color: 'bg-blue-100 text-[#04439e] border-blue-300', icon: <ChefHat className="w-4 h-4" /> },
  ready: { label: 'Prête', color: 'bg-orange-100 text-[#ff4000] border-orange-300', icon: <Package className="w-4 h-4" /> },
  delivered: { label: 'Livrée', color: 'bg-orange-100 text-[#ff4000] border-orange-300', icon: <Truck className="w-4 h-4" /> },
  completed: { label: 'Terminée', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: <Check className="w-4 h-4" /> },
  cancelled: { label: 'Annulée', color: 'bg-orange-100 text-[#ff4000] border-orange-300', icon: <XCircle className="w-4 h-4" /> },
};

const orderTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  dine_in: { label: 'Sur place', icon: <Utensils className="w-4 h-4" /> },
  takeaway: { label: 'À emporter', icon: <Package className="w-4 h-4" /> },
  delivery: { label: 'Livraison', icon: <Truck className="w-4 h-4" /> },
};

const paymentMethodIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="w-4 h-4 text-[#ff4000]" />,
  mobile: <Phone className="w-4 h-4 text-orange-500" />,
  card: <CreditCard className="w-4 h-4 text-blue-600" />,
};

interface RestaurantOrdersPanelProps {
  serviceId: string;
}

export function RestaurantOrdersPanel({ serviceId }: RestaurantOrdersPanelProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<RestaurantOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'completed'>('pending');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!serviceId) return;

    try {
      setIsRefreshing(true);

      const { data, error } = await supabase
        .from('restaurant_orders')
        .select('*')
        .eq('professional_service_id', serviceId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setOrders((data as RestaurantOrder[]) || []);
      console.log('✅ Commandes restaurant chargées:', data?.length || 0);
    } catch (err) {
      console.error('Erreur chargement commandes:', err);
      toast.error(t('restaurantOrdersPanel.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [serviceId]);

  // Charger au montage
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Temps réel: nouvelles commandes
  useEffect(() => {
    if (!serviceId) return;

    const channel = supabase
      .channel('restaurant-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_orders',
          filter: `professional_service_id=eq.${serviceId}`
        },
        (payload) => {
          console.log('🔔 Changement commande restaurant:', payload);

          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as RestaurantOrder;
            setOrders(prev => [newOrder, ...prev]);

            // Notification sonore et toast
            toast.success(`🔔 Nouvelle commande: ${newOrder.order_number}`, {
              description: `${newOrder.customer_name} - ${fc(newOrder.total)}`
            });

            // Play sound
            try {
              const audio = new Audio('/notification.mp3');
              audio.play().catch(() => {});
            } catch (_e) {}
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as RestaurantOrder;
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serviceId]);

  const updateOrderStatus = async (orderId: string, newStatus: RestaurantOrder['status']) => {
    try {
      const updates: any = { status: newStatus };

      // Timestamps
      const now = new Date().toISOString();
      if (newStatus === 'preparing') updates.started_preparing_at = now;
      if (newStatus === 'ready') updates.ready_at = now;
      if (newStatus === 'completed' || newStatus === 'delivered') updates.completed_at = now;

      const { error } = await supabase
        .from('restaurant_orders')
        .update(updates)
        .eq('id', orderId)
        .eq('professional_service_id', serviceId);

      if (error) throw error;

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success(`Commande ${statusConfig[newStatus].label.toLowerCase()}`);

      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error('Erreur mise à jour statut:', err);
      toast.error(t('restaurantOrdersPanel.erreurLorsDeLaMise'));
    }
  };

  // Les ventes de CAISSE comptoir (source 'pos'/'pos_offline') sont finalisées/encaissées par le
  // restaurateur → elles n'ont rien à faire dans la file « à traiter ». On les exclut de « en attente »
  // et « en cours » (elles restent visibles dans « terminées »/analytics).
  const isClientOrder = (o: RestaurantOrder) => !['pos', 'pos_offline'].includes(o.source as string);
  const pendingOrders = orders.filter(o => o.status === 'pending' && isClientOrder(o));
  const activeOrders = orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status) && isClientOrder(o));
  const completedOrders = orders.filter(o => ['delivered', 'completed', 'cancelled'].includes(o.status));

  const getTabOrders = () => {
    switch (activeTab) {
      case 'pending': return pendingOrders;
      case 'active': return activeOrders;
      case 'completed': return completedOrders;
      default: return orders;
    }
  };

  const renderOrderCard = (order: RestaurantOrder) => {
    const status = statusConfig[order.status] || statusConfig.pending;
    const orderType = orderTypeLabels[order.order_type] || orderTypeLabels.takeaway;
    const _paymentIcon = paymentMethodIcons[order.payment_method] || paymentMethodIcons.cash;
    const isPending = order.status === 'pending';

    return (
      <Card
        key={order.id}
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          isPending && "ring-2 ring-[#ff4000] animate-pulse"
        )}
        onClick={() => setSelectedOrder(order)}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={status.color}>
                {status.icon}
                <span className="ml-1">{status.label}</span>
              </Badge>
              {order.payment_status === 'paid' && (
                <Badge className="bg-[#ff4000]">{t('restaurantOrdersPanel.paye')}</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
            </span>
          </div>

          {/* Order info */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">{order.order_number}</span>
              <span className="font-bold text-primary">{fc(order.total)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{order.customer_name}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {orderType.icon}
                {orderType.label}
              </span>
            </div>
          </div>

          {/* Items preview */}
          <div className="text-sm">
            {Array.isArray(order.items) && order.items.slice(0, 2).map((item: any, i: number) => (
              <span key={i}>
                {i > 0 && ', '}
                {item.quantity}x {item.name}
              </span>
            ))}
            {order.items?.length > 2 && <span className="text-muted-foreground"> +{order.items.length - 2}</span>}
          </div>

          {/* Quick actions */}
          {isPending && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="flex-1 bg-[#ff4000] hover:bg-[#ff4000]"
                onClick={(e) => {
                  e.stopPropagation();
                  updateOrderStatus(order.id, 'confirmed');
                }}
              >
                <Check className="w-4 h-4 mr-1" />
                Confirmer
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  updateOrderStatus(order.id, 'cancelled');
                }}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}

          {order.status === 'confirmed' && (
            <Button
              size="sm"
              className="w-full bg-[#04439e] hover:bg-[#04439e]"
              onClick={(e) => {
                e.stopPropagation();
                updateOrderStatus(order.id, 'preparing');
              }}
            >
              <ChefHat className="w-4 h-4 mr-1" />
              Démarrer préparation
            </Button>
          )}

          {order.status === 'preparing' && (
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                updateOrderStatus(order.id, 'ready');
              }}
            >
              <Package className="w-4 h-4 mr-1" />
              Marquer prête
            </Button>
          )}

          {order.status === 'ready' && (
            <Button
              size="sm"
              className="w-full bg-[#ff4000] hover:bg-[#ff4000]"
              onClick={(e) => {
                e.stopPropagation();
                updateOrderStatus(order.id, order.order_type === 'dine_in' ? 'completed' : 'delivered');
              }}
            >
              {order.order_type === 'dine_in' ? (
                <>
                  <Utensils className="w-4 h-4 mr-1" />
                  Servie
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-1" />
                  Livrée / Récupérée
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">{t('restaurantOrdersPanel.commandes')}</h2>
          {pendingOrders.length > 0 && (
            <Badge className="bg-[#ff4000] animate-pulse">{pendingOrders.length} nouvelle(s)</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadOrders}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("w-4 h-4 mr-1", isRefreshing && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="pending" className="relative">
            En attente
            {pendingOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ff4000] text-white text-xs rounded-full flex items-center justify-center">
                {pendingOrders.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">
            En cours ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Terminées
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {getTabOrders().length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune commande {activeTab === 'pending' ? 'en attente' : activeTab === 'active' ? 'en cours' : 'terminée'}</p>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="grid gap-3">
                {getTabOrders().map(renderOrderCard)}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Order detail modal */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Détails commande
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={statusConfig[selectedOrder.status]?.color}>
                  {statusConfig[selectedOrder.status]?.icon}
                  <span className="ml-1">{statusConfig[selectedOrder.status]?.label}</span>
                </Badge>
                <Badge className={selectedOrder.payment_status === 'paid' ? 'bg-[#ff4000]' : 'bg-[#ff4000]'}>
                  {selectedOrder.payment_status === 'paid' ? 'Payé' : 'À payer'}
                </Badge>
              </div>

              {/* Order info */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('restaurantOrdersPanel.numero')}</span>
                    <span className="font-bold">{selectedOrder.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('restaurantOrdersPanel.client')}</span>
                    <span>{selectedOrder.customer_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('restaurantOrdersPanel.telephone')}</span>
                    <a href={`tel:${selectedOrder.customer_phone}`} className="flex items-center gap-1 text-primary">
                      <Phone className="w-4 h-4" />
                      {selectedOrder.customer_phone}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="flex items-center gap-1">
                      {orderTypeLabels[selectedOrder.order_type]?.icon}
                      {orderTypeLabels[selectedOrder.order_type]?.label}
                    </span>
                  </div>
                  {selectedOrder.table_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Table</span>
                      <span>#{selectedOrder.table_number}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_address && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Adresse</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {selectedOrder.delivery_address}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('restaurantOrdersPanel.paiement')}</span>
                    <span className="flex items-center gap-1">
                      {paymentMethodIcons[selectedOrder.payment_method]}
                      {selectedOrder.payment_method === 'cash' ? 'Espèces' :
                       selectedOrder.payment_method === 'mobile' ? 'Mobile Money' : 'Carte'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('restaurantOrdersPanel.articlesCommandes')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                      <div>
                        <span className="font-medium">{item.quantity}x</span>{' '}
                        <span>{item.name}</span>
                        {item.special_instructions && (
                          <p className="text-xs text-muted-foreground italic">{item.special_instructions}</p>
                        )}
                      </div>
                      <span className="font-medium">{fc(item.total_price || 0)}</span>
                    </div>
                  ))}

                  <div className="pt-2 border-t flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">{fc(selectedOrder.total)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {selectedOrder.notes && (
                <Card>
                  <CardContent className="p-4">
                    <span className="text-muted-foreground text-sm">Notes:</span>
                    <p className="mt-1">{selectedOrder.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

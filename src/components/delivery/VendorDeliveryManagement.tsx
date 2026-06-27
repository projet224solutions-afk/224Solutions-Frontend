/**
 * GESTION DES LIVRAISONS CÔTÉ VENDEUR
 * Affiche les commandes, statuts, et permet de marquer prêt pour livraison
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Package,
  Truck,
  CheckCircle2,
  MapPin,
  Phone,
  User,
  QrCode,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import { VendorDeliveryNotifications } from './VendorDeliveryNotifications';

interface DeliveryOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  package_description: string;
  payment_method: string;
  delivery_fee: number;
  status: string;
  driver_id: string | null;
  driver_name?: string;
  driver_phone?: string;
  created_at: string;
  ready_for_pickup: boolean;
  pickup_code?: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-[#ff4000]' },
  assigned: { label: "Livreur assigné", color: 'bg-blue-500' },
  driver_on_way_to_vendor: { label: 'Livreur en route', color: 'bg-[#04439e]' },
  driver_arrived_vendor: { label: "Livreur arrivé", color: 'bg-[#04439e]' },
  picked_up: { label: "Colis récupéré", color: 'bg-[#04439e]' },
  in_transit: { label: "En livraison", color: 'bg-orange-500' },
  delivered: { label: "Livré", color: 'bg-[#ff4000]' },
  cancelled: { label: "Annulé", color: 'bg-[#ff4000]' }
};

export function VendorDeliveryManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [_selectedOrder, _setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [generatingCode, setGeneratingCode] = useState<string | null>(null);

  // Charger le vendeur
  useEffect(() => {
    const loadVendor = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setVendorId(data.id);
      }
    };
    loadVendor();
  }, [user]);

  // Charger les commandes
  const loadOrders = async () => {
    if (!vendorId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(200); // plafond de sécurité (liste récente) — évite de scanner tout l'historique

      if (error) throw error;
      setOrders((data || []) as DeliveryOrder[]);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error(t('vendorDeliveryManagement.erreurLorsDuChargement'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) {
      loadOrders();

      // Souscription temps réel
      const channel = supabase
        .channel('vendor-deliveries')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: `vendor_id=eq.${vendorId}`
          },
          (payload) => {
            console.log('Delivery update:', payload);
            loadOrders();
            if (payload.eventType === 'INSERT') {
              toast.info(t('vendorDeliveryManagement.nouvelleCommandeRecue'));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  // Marquer prêt pour livraison
  const markReadyForPickup = async (orderId: string) => {
    setGeneratingCode(orderId);
    try {
      // Générer un code de retrait unique
      const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { error } = await supabase
        .from('deliveries')
        .update({
          ready_for_pickup: true,
          ready_at: new Date().toISOString(),
          metadata: { pickup_code: pickupCode }
        } as any)
        .eq('id', orderId);

      if (error) throw error;

      toast.success(t('vendorDeliveryManagement.commandePretePourLeRetrait'));
      loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error(t('vendorDeliveryManagement.erreurLorsDeLaMise'));
    } finally {
      setGeneratingCode(null);
    }
  };

  const formatCurrency = useFormatCurrency();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingOrders = orders.filter(o => ['pending', 'assigned'].includes(o.status));
  const activeOrders = orders.filter(o => ['driver_on_way_to_vendor', 'driver_arrived_vendor', 'picked_up', 'in_transit'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-orange-600" />
          Gestion des livraisons
        </h2>
        <div className="flex items-center gap-2">
          <VendorDeliveryNotifications />
          <Button variant="outline" size="sm" onClick={loadOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-orange-50 dark:bg-[#ff4000]/20">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-[#ff4000]">{pendingOrders.length}</p>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{activeOrders.length}</p>
            <p className="text-xs text-muted-foreground">En cours</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-[#ff4000]/20">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-[#ff4000]">{completedOrders.length}</p>
            <p className="text-xs text-muted-foreground">{t('vendorDeliveryManagement.terminees')}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            En attente ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            En cours ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {pendingOrders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Aucune commande en attente
              </CardContent>
            </Card>
          ) : (
            pendingOrders.map((order) => (
              <Card key={order.id} className="border-l-4 border-l-yellow-500">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{order.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">{order.delivery_address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-3 w-3" />
                        <span>{order.package_description || 'Colis standard'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#ff4000]">{formatCurrency(order.delivery_fee)}</p>
                      <Badge variant="outline" className="text-xs">
                        {order.payment_method === 'cod' ? 'COD' : 'Prépayé'}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {order.status === 'pending' && !order.ready_for_pickup && (
                      <Button
                        className="flex-1 bg-[#ff4000]"
                        onClick={() => markReadyForPickup(order.id)}
                        disabled={generatingCode === order.id}
                      >
                        {generatingCode === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Prête pour livraison
                          </>
                        )}
                      </Button>
                    )}
                    {order.ready_for_pickup && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="flex-1">
                            <QrCode className="h-4 w-4 mr-2" />
                            Voir code retrait
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('vendorDeliveryManagement.codeDeRetrait')}</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col items-center gap-4 py-4">
                            <QRCodeSVG
                              value={`224DELIVERY:${order.id}:${(order as any).metadata?.pickup_code}`}
                              size={200}
                            />
                            <p className="text-3xl font-mono font-bold">
                              {(order as any).metadata?.pickup_code || 'N/A'}
                            </p>
                            <p className="text-sm text-muted-foreground text-center">
                              Le livreur doit scanner ce code ou saisir le PIN pour confirmer le retrait
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-3 mt-4">
          {activeOrders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Aucune livraison en cours
              </CardContent>
            </Card>
          ) : (
            activeOrders.map((order) => (
              <Card key={order.id} className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-blue-600" />
                        <Badge className={statusLabels[order.status]?.color || 'bg-gray-500'}>
                          {statusLabels[order.status]?.label || order.status}
                        </Badge>
                      </div>
                      <p className="font-medium">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                        {order.delivery_address}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#ff4000]">{formatCurrency(order.delivery_fee)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                  </div>

                  {order.driver_name && (
                    <div className="mt-3 p-2 bg-muted/50 rounded-lg flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{order.driver_name}</p>
                        {order.driver_phone && (
                          <a href={`tel:${order.driver_phone}`} className="text-xs text-blue-600 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {order.driver_phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-4">
          {completedOrders.slice(0, 10).map((order) => (
            <Card key={order.id} className={`border-l-4 ${order.status === 'delivered' ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={statusLabels[order.status]?.color || 'bg-gray-500'}>
                        {statusLabels[order.status]?.label || order.status}
                      </Badge>
                    </div>
                    <p className="font-medium">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                  </div>
                  <p className="font-bold text-[#ff4000]">{formatCurrency(order.delivery_fee)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

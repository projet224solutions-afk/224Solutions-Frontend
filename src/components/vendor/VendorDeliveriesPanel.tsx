/**
 * PANNEAU DES COLIS DU VENDEUR
 * Affiche tous les colis créés par le vendeur + Configuration tarification
 */

import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MapPin, Package, User, Clock, Truck, Settings, List, CheckCircle, Image, PenTool,
  TrendingUp, Timer, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ShipmentManager } from './shipment/ShipmentManager';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import VendorDeliveryPricing from './settings/VendorDeliveryPricing';
import { ClientDeliveryTracking } from '@/components/delivery/ClientDeliveryTracking';

interface VendorDelivery {
  id: string;
  pickup_address: any;
  delivery_address: any;
  delivery_fee: number;
  status: string;
  customer_name?: string;
  customer_phone?: string;
  package_description?: string;
  created_at: string;
  driver_id?: string;
  distance_km?: number;
  completed_at?: string;
  proof_photo_url?: string;
  client_signature?: string;
}

export function VendorDeliveriesPanel() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [deliveries, setDeliveries] = useState<VendorDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShipmentManager, setShowShipmentManager] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDelivery, setSelectedDelivery] = useState<VendorDelivery | null>(null);
  const [trackingDeliveryId, setTrackingDeliveryId] = useState<string | null>(null);
  const { vendorId, user, loading: vendorLoading } = useCurrentVendor();

  useEffect(() => {
    if (!vendorLoading && vendorId && user) {
      loadVendorDeliveries();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, user, vendorLoading]);

  // ⚡ Temps réel : recharge la liste dès qu'une livraison du vendeur change (acceptée,
  // récupérée, livrée…). Sans ça, le vendeur ne voyait rien bouger sans « Actualiser ».
  useEffect(() => {
    if (!vendorId) return;
    const channel = supabase
      .channel(`vendor-deliveries-${vendorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries', filter: `vendor_id=eq.${vendorId}` },
        () => { loadVendorDeliveries(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const loadVendorDeliveries = async () => {
    if (!vendorId || !user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setDeliveries(data as any || []);
    } catch (error) {
      console.error('Error loading vendor deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Statistiques calculées
  const stats = useMemo(() => {
    const pending = deliveries.filter(d => d.status === 'pending');
    const inProgress = deliveries.filter(d => ['assigned', 'picked_up', 'in_transit'].includes(d.status));
    const completed = deliveries.filter(d => d.status === 'delivered');
    const cancelled = deliveries.filter(d => d.status === 'cancelled');

    const totalRevenue = completed.reduce((sum, d) => sum + (d.delivery_fee || 0), 0);
    const totalDistance = completed.reduce((sum, d) => sum + (d.distance_km || 0), 0);

    return {
      total: deliveries.length,
      pending: pending.length,
      inProgress: inProgress.length,
      completed: completed.length,
      cancelled: cancelled.length,
      totalRevenue,
      totalDistance,
      successRate: deliveries.length > 0
        ? Math.round((completed.length / (deliveries.length - cancelled.length)) * 100) || 0
        : 0
    };
  }, [deliveries]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]';
      case 'assigned': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'picked_up': return 'bg-blue-100 text-[#04439e] dark:bg-[#04439e]/30 dark:text-[#04439e]';
      case 'in_transit': return 'bg-blue-100 text-[#04439e] dark:bg-[#04439e]/30 dark:text-[#04439e]';
      case 'delivered': return 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]';
      case 'cancelled': return 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'assigned': return 'Assigné';
      case 'picked_up': return 'Récupéré';
      case 'in_transit': return 'En livraison';
      case 'delivered': return 'Livré';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  const pendingDeliveries = deliveries.filter(d => d.status !== 'delivered' && d.status !== 'cancelled');
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');

  if (loading || vendorLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Chargement...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!vendorId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Impossible de charger les données du vendeur
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showShipmentManager) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => {
            setShowShipmentManager(false);
            loadVendorDeliveries();
          }}
        >
          ← Retour aux livraisons
        </Button>
        <ShipmentManager />
      </div>
    );
  }

  const renderDeliveryCard = (delivery: VendorDelivery, showDetails = false) => {
    const pickupAddr = typeof delivery.pickup_address === 'string'
      ? delivery.pickup_address
      : delivery.pickup_address?.address || JSON.stringify(delivery.pickup_address);
    const deliveryAddr = typeof delivery.delivery_address === 'string'
      ? delivery.delivery_address
      : delivery.delivery_address?.address || JSON.stringify(delivery.delivery_address);

    return (
      <div
        key={delivery.id}
        className="p-4 bg-gradient-to-r from-orange-50 to-white dark:from-orange-950/20 dark:to-background rounded-lg border space-y-3"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getStatusColor(delivery.status)}>
                {getStatusLabel(delivery.status)}
              </Badge>
              <Badge variant="outline">
                {fc(delivery.delivery_fee || 0)}
              </Badge>
              {delivery.distance_km && (
                <Badge variant="secondary">
                  {delivery.distance_km} km
                </Badge>
              )}
              {!delivery.driver_id && delivery.status !== 'delivered' && (
                <Badge variant="secondary" className="bg-orange-100 text-[#ff4000]">
                  Sans livreur
                </Badge>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Retrait</p>
                  <p className="text-muted-foreground">{pickupAddr}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#ff4000] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{t('vendorDeliveriesPanel.livraison')}</p>
                  <p className="text-muted-foreground">{deliveryAddr}</p>
                </div>
              </div>
            </div>

            {delivery.customer_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{delivery.customer_name}</span>
                {delivery.customer_phone && (
                  <span>- {delivery.customer_phone}</span>
                )}
              </div>
            )}

            {delivery.package_description && (
              <p className="text-sm text-muted-foreground">
                <Package className="h-4 w-4 inline mr-1" />
                {delivery.package_description}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Créé: {format(new Date(delivery.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
            </div>

            {/* Suivi LIVE pour les livraisons en cours avec un livreur assigné */}
            {delivery.driver_id && ['assigned', 'picked_up', 'in_transit'].includes(delivery.status) && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setTrackingDeliveryId(delivery.id)}
              >
                <MapPin className="h-4 w-4 mr-2 text-[#04439e]" />
                Suivre en direct
              </Button>
            )}

            {/* Bouton voir détails pour les livraisons complétées */}
            {showDetails && delivery.status === 'delivered' && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setSelectedDelivery(delivery)}
              >
                <CheckCircle className="h-4 w-4 mr-2 text-[#ff4000]" />
                Voir détails de confirmation
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header mobile optimisé */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg md:text-2xl font-bold flex items-center gap-2">
            <Truck className="h-5 w-5 md:h-6 md:w-6 text-orange-600 flex-shrink-0" />
            <span className="truncate">{t('vendorDeliveriesPanel.gestionLivraisons')}</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground truncate">{t('vendorDeliveriesPanel.suivezVosExpeditions')}</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Button variant="outline" size="sm" onClick={loadVendorDeliveries} className="flex-shrink-0 h-9 text-xs md:text-sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
          <Button
            onClick={() => setShowShipmentManager(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 flex-shrink-0 h-9 text-xs md:text-sm"
          >
            <Package className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('vendorDeliveriesPanel.nouvelle')}</span> Expédition
          </Button>
        </div>
      </div>

      {/* Statistiques - Grille mobile 2x3 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-2.5 md:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-blue-600 dark:text-blue-400 font-medium">Total</p>
                <p className="text-xl md:text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.total}</p>
              </div>
              <Package className="h-6 w-6 md:h-8 md:w-8 text-blue-500/50 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-[#ff4000]/30 dark:to-[#ff4000]/20 border-orange-200 dark:border-[#ff4000]">
          <CardContent className="p-2.5 md:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-[#ff4000] dark:text-[#ff4000] font-medium">En attente</p>
                <p className="text-xl md:text-2xl font-bold text-[#ff4000] dark:text-orange-300">{stats.pending}</p>
              </div>
              <Timer className="h-6 w-6 md:h-8 md:w-8 text-[#ff4000]/50 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-[#04439e]/30 dark:to-[#04439e]/20 border-blue-200 dark:border-[#04439e]">
          <CardContent className="p-2.5 md:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-[#04439e] dark:text-[#04439e] font-medium">En cours</p>
                <p className="text-xl md:text-2xl font-bold text-[#04439e] dark:text-blue-300">{stats.inProgress}</p>
              </div>
              <Truck className="h-6 w-6 md:h-8 md:w-8 text-[#04439e]/50 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-[#ff4000]/30 dark:to-[#ff4000]/20 border-orange-200 dark:border-[#ff4000]">
          <CardContent className="p-2.5 md:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-[#ff4000] dark:text-[#ff4000] font-medium">{t('vendorDeliveriesPanel.livrees')}</p>
                <p className="text-xl md:text-2xl font-bold text-[#ff4000] dark:text-orange-300">{stats.completed}</p>
              </div>
              <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-[#ff4000]/50 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
          <CardContent className="p-2.5 md:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-orange-600 dark:text-orange-400 font-medium">Distance</p>
                <p className="text-base md:text-lg font-bold text-orange-700 dark:text-orange-300 truncate">
                  {stats.totalDistance.toFixed(1)}
                  <span className="text-[10px] md:text-xs ml-0.5">km</span>
                </p>
              </div>
              <MapPin className="h-6 w-6 md:h-8 md:w-8 text-orange-500/50 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-[#ff4000]/30 dark:to-[#ff4000]/20 border-orange-200 dark:border-[#ff4000]">
          <CardContent className="p-2.5 md:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-[#ff4000] dark:text-[#ff4000] font-medium">{t('vendorDeliveriesPanel.tauxReussite')}</p>
                <p className="text-xl md:text-2xl font-bold text-[#ff4000] dark:text-orange-300">{stats.successRate}%</p>
              </div>
              <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-[#ff4000]/50 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets - Scroll horizontal sur mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto flex md:grid md:grid-cols-4 h-10 md:h-12 scrollbar-hide">
          <TabsTrigger value="overview" className="flex-shrink-0 gap-1.5 px-2 md:px-4 text-xs md:text-sm data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
            <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Vue d'ensemble</span>
            <span className="sm:hidden">Vue</span>
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="flex-shrink-0 gap-1.5 px-2 md:px-4 text-xs md:text-sm data-[state=active]:bg-orange-100 data-[state=active]:text-[#ff4000]">
            <List className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">En cours</span> ({pendingDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="flex-shrink-0 gap-1.5 px-2 md:px-4 text-xs md:text-sm data-[state=active]:bg-orange-100 data-[state=active]:text-[#ff4000]">
            <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">{t('vendorDeliveriesPanel.livrees')}</span> ({completedDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex-shrink-0 gap-1.5 px-2 md:px-4 text-xs md:text-sm data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
            <Settings className="h-3.5 w-3.5 md:h-4 md:w-4" />
            Tarifs
          </TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Dernières livraisons en cours */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Timer className="h-5 w-5 text-[#ff4000]" />
                  Livraisons en cours
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingDeliveries.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('vendorDeliveriesPanel.aucuneLivraisonEnCours')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {pendingDeliveries.slice(0, 5).map((delivery) => (
                      <div key={delivery.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{delivery.customer_name || 'Client'}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {typeof delivery.delivery_address === 'string'
                              ? delivery.delivery_address
                              : delivery.delivery_address?.address}
                          </p>
                        </div>
                        <Badge className={getStatusColor(delivery.status)}>
                          {getStatusLabel(delivery.status)}
                        </Badge>
                      </div>
                    ))}
                    {pendingDeliveries.length > 5 && (
                      <Button
                        variant="ghost"
                        className="w-full text-sm"
                        onClick={() => setActiveTab('deliveries')}
                      >
                        Voir tout ({pendingDeliveries.length})
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dernières livraisons complétées */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-[#ff4000]" />
                  Récemment livrées
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedDeliveries.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('vendorDeliveriesPanel.aucuneLivraisonCompletee')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {completedDeliveries.slice(0, 5).map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between p-3 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-[#ff4000]/30 transition-colors"
                        onClick={() => setSelectedDelivery(delivery)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{delivery.customer_name || 'Client'}</p>
                          <p className="text-xs text-muted-foreground">
                            {delivery.completed_at
                              ? format(new Date(delivery.completed_at), 'dd/MM HH:mm', { locale: fr })
                              : '-'}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-[#ff4000]">
                          {fc(delivery.delivery_fee || 0)}
                        </span>
                      </div>
                    ))}
                    {completedDeliveries.length > 5 && (
                      <Button
                        variant="ghost"
                        className="w-full text-sm"
                        onClick={() => setActiveTab('delivered')}
                      >
                        Voir tout ({completedDeliveries.length})
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deliveries" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />
                Livraisons en cours
              </CardTitle>
              <CardDescription>
                {pendingDeliveries.length} colis en attente ou en livraison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingDeliveries.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>{t('vendorDeliveriesPanel.aucuneLivraisonEnCours')}</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowShipmentManager(true)}
                    >
                      Créer une expédition
                    </Button>
                  </div>
                ) : (
                  pendingDeliveries.map((delivery) => renderDeliveryCard(delivery, false))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivered" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-[#ff4000]" />
                Livraisons complétées
              </CardTitle>
              <CardDescription>
                {completedDeliveries.length} livraisons terminées avec succès
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completedDeliveries.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>{t('vendorDeliveriesPanel.aucuneLivraisonCompletee')}</p>
                  </div>
                ) : (
                  completedDeliveries.map((delivery) => renderDeliveryCard(delivery, true))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <VendorDeliveryPricing vendorId={vendorId} />
        </TabsContent>
      </Tabs>

      {/* Dialog suivi LIVE (carte + position du livreur en temps réel) */}
      <Dialog open={!!trackingDeliveryId} onOpenChange={() => setTrackingDeliveryId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#04439e]" />
              Suivi en direct
            </DialogTitle>
          </DialogHeader>
          {trackingDeliveryId && <ClientDeliveryTracking deliveryId={trackingDeliveryId} />}
        </DialogContent>
      </Dialog>

      {/* Dialog détails de confirmation */}
      <Dialog open={!!selectedDelivery} onOpenChange={() => setSelectedDelivery(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[#ff4000]" />
              Détails de la livraison
            </DialogTitle>
          </DialogHeader>

          {selectedDelivery && (
            <div className="space-y-4">
              {/* Infos client */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedDelivery.customer_name || 'Client'}</p>
                {selectedDelivery.customer_phone && (
                  <p className="text-sm text-muted-foreground">{selectedDelivery.customer_phone}</p>
                )}
              </div>

              {/* Date de confirmation */}
              <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-[#ff4000]/30 rounded-lg">
                <Clock className="h-5 w-5 text-[#ff4000]" />
                <div>
                  <p className="text-sm font-medium">{t('vendorDeliveriesPanel.livreLe')}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedDelivery.completed_at
                      ? format(new Date(selectedDelivery.completed_at), "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr })
                      : 'Date non disponible'}
                  </p>
                </div>
              </div>

              {/* Photo preuve */}
              {selectedDelivery.proof_photo_url ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">{t('vendorDeliveriesPanel.photoDePreuve')}</span>
                  </div>
                  <img
                    src={selectedDelivery.proof_photo_url}
                    alt={t('vendorDeliveriesPanel.preuveDeLivraison')}
                    className="w-full rounded-lg border object-cover max-h-48"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  <Image className="h-4 w-4" />
                  <span>{t('vendorDeliveriesPanel.aucunePhotoDePreuve')}</span>
                </div>
              )}

              {/* Signature */}
              {selectedDelivery.client_signature ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-[#04439e]" />
                    <span className="text-sm font-medium">{t('vendorDeliveriesPanel.signatureDuClient')}</span>
                  </div>
                  <div className="border rounded-lg p-2 bg-white">
                    <img
                      src={selectedDelivery.client_signature}
                      alt={t('vendorDeliveriesPanel.signatureClient')}
                      className="w-full h-24 object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  <PenTool className="h-4 w-4" />
                  <span>{t('vendorDeliveriesPanel.aucuneSignature')}</span>
                </div>
              )}

              {/* Montant */}
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <span className="font-medium">{t('vendorDeliveriesPanel.fraisDeLivraison')}</span>
                <span className="font-bold text-orange-600">
                  {fc(selectedDelivery.delivery_fee || 0)}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
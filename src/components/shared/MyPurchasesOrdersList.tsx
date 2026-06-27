import { useTranslation } from "@/hooks/useTranslation";
/**
 * Liste des achats personnels avec possibilité de confirmer la réception (Escrow)
 * Utilisable par vendeurs et agents quand ils achètent sur le marketplace
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { formatCurrency } from '@/lib/utils';
import { cancelOrder as cancelOrderRequest, confirmCashOnDeliveryOrder, confirmEscrowDelivery, listMyOrders, requestOrderRefund } from '@/services/orderBackendService';
import { Money } from '@/components/Money';
import { toast } from 'sonner';
import {
  Package, CheckCircle, Clock, Truck, XCircle,
  Shield, AlertCircle, Loader2, ListFilter, Ban, DollarSign, Banknote, ShoppingBag, Star, CalendarClock
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ProductRatingDialog from '@/components/client/ProductRatingDialog';

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method?: string;
  total_amount: number;
  created_at: string;
  vendor_id: string;
  metadata?: any;
  shipping_address?: any;
  vendors?: {
    business_name: string;
  };
  order_items?: {
    quantity: number;
    product_name?: string;
    products: {
      name: string;
    } | null;
  }[];
  escrow?: EscrowStatus | null;
}

interface EscrowStatus {
  id: string;
  status: string;
  amount: number;
  commission_amount?: number | null;
  metadata?: Record<string, any> | null;
  currency?: string;
}

interface MyPurchasesOrdersListProps {
  title?: string;
  emptyMessage?: string;
}

interface RatingOrderData {
  orderId: string;
  vendorId: string;
  vendorName: string;
}

// Helper pour vérifier si une commande est paiement à la livraison
const isCashOnDelivery = (order: Order): boolean => {
  return order.payment_method === 'cash' &&
         (order.shipping_address?.is_cod === true || order.metadata?.is_cod === true);
};

const canCancelOrder = (order: Order): boolean => order.status === 'pending';

const getVendorReceivableAmount = (order: Order, escrow?: EscrowStatus | null): number => {
  const metadataVendorAmount = Number(escrow?.metadata?.vendor_amount);
  if (Number.isFinite(metadataVendorAmount)) {
    return metadataVendorAmount;
  }

  if (typeof escrow?.amount === 'number' && Number.isFinite(escrow.amount)) {
    const commissionAmount = Number(escrow.commission_amount);
    return Math.max(escrow.amount - (Number.isFinite(commissionAmount) ? commissionAmount : 0), 0);
  }

  return typeof order.total_amount === 'number' && Number.isFinite(order.total_amount)
    ? order.total_amount
    : 0;
};

const getVendorReceivableCurrency = (order: Order, escrow?: EscrowStatus | null): string => {
  const metadataCurrency = typeof order.metadata?.currency === 'string' ? order.metadata.currency : null;
  const shippingCurrency = typeof order.shipping_address?.currency === 'string' ? order.shipping_address.currency : null;
  return escrow?.currency || metadataCurrency || shippingCurrency || 'GNF';
};

const extractFunctionErrorMessage = async (error: unknown): Promise<string> => {
  if (error instanceof Error && error.message) {
    const functionError = error as Error & { context?: { json?: () => Promise<any> } };
    if (functionError.context?.json) {
      try {
        const payload = await functionError.context.json();
        if (payload?.error && typeof payload.error === 'string') {
          return payload.error;
        }
      } catch {
        // Ignore JSON parsing issues and fallback to the standard error message.
      }
    }

    return error.message;
  }

  return 'Veuillez réessayer';
};

// Tracker visuel de progression
function OrderProgressTracker({ status }: { status: string }) {
  const { t } = useTranslation();
  const steps = [
    { key: 'pending', label: 'En attente', icon: Clock },
    { key: 'confirmed', label: t('myPurchasesOrdersList.confirmee'), icon: CheckCircle },
    { key: 'preparing', label: t('myPurchasesOrdersList.preparation'), icon: Package },
    { key: 'in_transit', label: t('myPurchasesOrdersList.expediee'), icon: Truck },
    { key: 'delivered', label: t('myPurchasesOrdersList.livree'), icon: CheckCircle },
  ];

  const normalizedStatus = status === 'completed' ? 'delivered' : status;
  const currentIndex = steps.findIndex(s => s.key === normalizedStatus);
  const progressPercent = currentIndex >= 0 ? ((currentIndex + 1) / steps.length) * 100 : 0;

  return (
    <div className="w-full py-3">
      <div className="relative">
        {/* Barre de progression */}
        <div className="absolute top-4 left-0 w-full h-1 bg-muted rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Étapes */}
        <div className="flex justify-between relative">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentIndex >= index;
            const isCurrent = currentIndex === index;

            return (
              <div key={step.key} className="flex flex-col items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center z-10
                  ${isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                  ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}
                `}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-xs mt-2 text-center ${isCompleted ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MyPurchasesOrdersList({
  title = "Mes achats",
  emptyMessage = "Vous n'avez pas encore effectué d'achats"
}: MyPurchasesOrdersListProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [escrows, setEscrows] = useState<Record<string, EscrowStatus>>({});
  const [loading, setLoading] = useState(true);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'in_progress' | 'delivered'>('all');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [ratingOrderData, setRatingOrderData] = useState<RatingOrderData | null>(null);
  const [pendingRatingOrderData, setPendingRatingOrderData] = useState<RatingOrderData | null>(null);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const selectedOrderEscrow = selectedOrder ? escrows[selectedOrder.id] ?? selectedOrder.escrow ?? null : null;
  const selectedOrderIsCashOnDelivery = selectedOrder ? isCashOnDelivery(selectedOrder) : false;
  const sellerReceivableAmount = selectedOrder
    ? getVendorReceivableAmount(selectedOrder, selectedOrderEscrow)
    : 0;
  const sellerReceivableCurrency = selectedOrder
    ? getVendorReceivableCurrency(selectedOrder, selectedOrderEscrow)
    : 'GNF';

  useEffect(() => {
    if (user) {
      loadOrders();

      // Écoute temps réel des commandes
      const ordersChannel = supabase
        .channel('my-purchases-orders-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => loadOrders()
        )
        .subscribe();

      // Écoute temps réel des escrows
      const escrowChannel = supabase
        .channel('my-purchases-escrow-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'escrow_transactions' },
          () => loadOrders()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(escrowChannel);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!pendingRatingOrderData || showConfirmDialog) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRatingOrderData(pendingRatingOrderData);
      setShowRatingDialog(true);
      setPendingRatingOrderData(null);
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [pendingRatingOrderData, showConfirmDialog]);

  const loadOrders = async () => {
    try {
      if (!user?.id) return;

      // Vérifier si l'utilisateur est aussi un vendeur (pour exclure ses propres ventes)
      const { data: userVendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const response = await listMyOrders({ limit: 100 });
      if (!response.success) {
        throw new Error(response.error || 'Impossible de charger les commandes');
      }

      const backendOrders = (response.data || []) as Order[];
      const ordersData = userVendor?.id
        ? backendOrders.filter(order => order.vendor_id !== userVendor.id)
        : backendOrders;

      setOrders(ordersData);

      const escrowMap: Record<string, EscrowStatus> = {};
      ordersData.forEach((order) => {
        if (order.escrow) {
          escrowMap[order.id] = order.escrow;
        }
      });
      setEscrows(escrowMap);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error(t('myPurchasesOrdersList.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelivery = (order: Order) => {
    if (isCashOnDelivery(order)) {
      void confirmDelivery(order);
      return;
    }

    setSelectedOrder(order);
    setShowConfirmDialog(true);
  };

  const confirmDelivery = async (orderOverride?: Order) => {
    const orderToConfirm = orderOverride ?? selectedOrder;
    if (!orderToConfirm) return;

    setConfirmingOrderId(orderToConfirm.id);
    if (!orderOverride) {
      setShowConfirmDialog(false);
    }

    try {
      const escrow = escrows[orderToConfirm.id];
      const requiresEscrowRelease = orderToConfirm.payment_method !== 'cash';

      if (requiresEscrowRelease) {
        // Paiement WALLET/escrow : libération atomique vers le vendeur via le backend Node.js
        // (remplace l'Edge Function 'confirm-delivery', qui appelait le RPC avec un mauvais
        // paramètre p_order_id). Le backend retrouve l'escrow et crédite le vendeur (net + commission).
        const response = await confirmEscrowDelivery(orderToConfirm.id);
        if (!response.success) throw new Error(response.error || 'Erreur lors de la confirmation');
      } else {
        // Paiement à la livraison (COD) : confirmation via le backend (marque livré, clôt l'escrow COD).
        const response = await confirmCashOnDeliveryOrder(orderToConfirm.id);
        if (!response.success) throw new Error(response.error || 'Erreur lors de la confirmation');
      }

      toast.success(t('myPurchasesOrdersList.receptionConfirmee'), {
        description: escrow ? 'Le paiement a été transféré au vendeur' : 'Merci d\'avoir confirmé la réception'
      });

      setPendingRatingOrderData({
        orderId: orderToConfirm.id,
        vendorId: orderToConfirm.vendor_id,
        vendorName: orderToConfirm.vendors?.business_name || 'ce vendeur'
      });

      await loadOrders();
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast.error(t('myPurchasesOrdersList.erreurLorsDeLaConfirmation'), {
        description: await extractFunctionErrorMessage(error)
      });
    } finally {
      setConfirmingOrderId(null);
      if (!orderOverride) {
        setSelectedOrder(null);
      }
    }
  };

  const handleCancelOrder = (order: Order) => {
    setSelectedOrder(order);
    setCancelReason('');
    setShowCancelDialog(true);
  };

  const confirmCancelOrder = async () => {
    if (!selectedOrder) return;

    setCancellingOrderId(selectedOrder.id);
    setShowCancelDialog(false);

    try {
      const response = await cancelOrderRequest(
        selectedOrder.id,
        cancelReason.trim() || 'Annulation demandée par le client'
      );

      if (!response.success) throw new Error(response.error || 'Erreur lors de l\'annulation');

      const refund = (response as any).refund;
      if (refund?.refunded && refund.amount > 0) {
        toast.success(t('myPurchasesOrdersList.commandeAnnuleeRemboursementEffectue'), {
          description: `${refund.amount.toLocaleString()} ${refund.currency} remboursés dans votre portefeuille`,
        });
      } else {
        toast.success(t('myPurchasesOrdersList.commandeAnnulee'));
      }

      await loadOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error(t('myPurchasesOrdersList.erreurLorsDeLAnnulation'), {
        description: error instanceof Error ? error.message: t('myPurchasesOrdersList.veuillezReessayer')
      });
    } finally {
      setCancellingOrderId(null);
      setSelectedOrder(null);
      setCancelReason('');
    }
  };

  const handleRequestRefund = (order: Order) => {
    setSelectedOrder(order);
    setRefundReason('');
    setRefundAmount('');
    setShowRefundDialog(true);
  };

  const confirmRequestRefund = async () => {
    if (!selectedOrder) return;

    setRefundingOrderId(selectedOrder.id);
    setShowRefundDialog(false);

    try {
      const response = await requestOrderRefund(selectedOrder.id, {
        reason: refundReason,
        requested_amount: refundAmount ? parseFloat(refundAmount) : undefined,
      });

      if (!response.success) throw new Error(response.error || 'Erreur lors de la demande');

      toast.success(t('myPurchasesOrdersList.demandeDeRemboursementEnvoyee'));
      await loadOrders();
    } catch (error) {
      console.error('Error requesting refund:', error);
      toast.error(t('myPurchasesOrdersList.erreurLorsDeLaDemande'), {
        description: error instanceof Error ? error.message: t('myPurchasesOrdersList.veuillezReessayer')
      });
    } finally {
      setRefundingOrderId(null);
      setSelectedOrder(null);
      setRefundReason('');
      setRefundAmount('');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
      pending: { label: 'En attente', color: 'bg-orange-100 text-[#ff4000]', icon: Clock },
      confirmed: { label: t('myPurchasesOrdersList.confirmee'), color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      preparing: { label: t('myPurchasesOrdersList.enPreparation'), color: 'bg-blue-100 text-[#04439e]', icon: Package },
      ready: { label: t('myPurchasesOrdersList.prete'), color: 'bg-blue-100 text-blue-800', icon: Package },
      in_transit: { label: 'En transit', color: 'bg-orange-100 text-orange-800', icon: Truck },
      delivered: { label: t('myPurchasesOrdersList.livree'), color: 'bg-orange-100 text-[#ff4000]', icon: CheckCircle },
      completed: { label: t('myPurchasesOrdersList.terminee'), color: 'bg-orange-100 text-[#ff4000]', icon: CheckCircle },
      cancelled: { label: t('myPurchasesOrdersList.annulee'), color: 'bg-orange-100 text-[#ff4000]', icon: XCircle }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getEscrowBadge = (escrowStatus?: string) => {
    if (!escrowStatus) return null;

    const escrowConfig: Record<string, { label: string; color: string }> = {
      pending: { label: t('myPurchasesOrdersList.fondsBloques'), color: 'bg-orange-100 text-orange-800' },
      held: { label: t('myPurchasesOrdersList.fondsSecurises'), color: 'bg-blue-100 text-blue-800' },
      released: { label: t('myPurchasesOrdersList.fondsLiberes'), color: 'bg-orange-100 text-[#ff4000]' },
      refunded: { label: t('myPurchasesOrdersList.rembourse'), color: 'bg-gray-100 text-gray-800' },
      dispute: { label: 'Litige', color: 'bg-orange-100 text-[#ff4000]' }
    };

    const config = escrowConfig[escrowStatus];
    if (!config) return null;

    return (
      <Badge className={config.color}>
        <Shield className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Filtrage
  const getFilteredOrders = () => {
    if (activeFilter === 'all') return orders;
    if (activeFilter === 'pending') return orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
    if (activeFilter === 'in_progress') return orders.filter(o => o.status === 'in_transit');
    if (activeFilter === 'delivered') return orders.filter(o => o.status === 'delivered' || o.status === 'completed');
    return orders;
  };

  const filteredOrders = getFilteredOrders();
  const pendingCount = orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).length;
  const inProgressCount = orders.filter(o => o.status === 'in_transit').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered' || o.status === 'completed').length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <ListFilter className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">Filtrer</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={activeFilter === 'all' ? 'default' : 'outline'} onClick={() => setActiveFilter('all')} size="sm">
              <Package className="w-4 h-4 mr-1" /> Toutes ({orders.length})
            </Button>
            <Button variant={activeFilter === 'pending' ? 'default' : 'outline'} onClick={() => setActiveFilter('pending')} size="sm">
              <Clock className="w-4 h-4 mr-1" /> En attente ({pendingCount})
            </Button>
            <Button variant={activeFilter === 'in_progress' ? 'default' : 'outline'} onClick={() => setActiveFilter('in_progress')} size="sm">
              <Truck className="w-4 h-4 mr-1" /> En cours ({inProgressCount})
            </Button>
            <Button variant={activeFilter === 'delivered' ? 'default' : 'outline'} onClick={() => setActiveFilter('delivered')} size="sm">
              <CheckCircle className="w-4 h-4 mr-1" /> Livrées ({deliveredCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <ScrollArea className="h-[600px] pr-4">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('myPurchasesOrdersList.aucuneCommandeDansCetteCategorie')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const escrow = escrows[order.id];
                  const isCODOrder = isCashOnDelivery(order);
                  const requiresEscrowRelease = order.payment_method !== 'cash';
                  const _escrowPending = escrow?.status === 'pending' || escrow?.status === 'held';
                  const isDeliveryPending = order.status === 'in_transit' || order.status === 'shipped' || order.status === 'ready';
                  const isDeliveredAwaitingConfirmation = order.status === 'delivered' && (requiresEscrowRelease ? escrow?.status !== 'released' && escrow?.status !== 'refunded' : true);
                  const canConfirmDelivery = order.status !== 'cancelled' && order.status !== 'completed' && (isDeliveryPending || isDeliveredAwaitingConfirmation);

                  return (
                    <Card key={order.id} className="overflow-hidden border">
                      <CardHeader className="bg-muted/50 p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">#{order.order_number}</CardTitle>
                            <p className="text-sm text-muted-foreground">{order.vendors?.business_name || 'Vendeur'}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold"><Money amount={order.total_amount} from={getVendorReceivableCurrency(order, escrow)} /></div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        </div>

                        {/* Délai de livraison estimé — visible dès la confirmation du vendeur */}
                        {order.metadata?.estimated_delivery_days &&
                          !['pending', 'delivered', 'completed', 'cancelled'].includes(order.status) && (
                          <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <CalendarClock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                                Votre colis sera livré dans :{' '}
                                <span className="font-bold">
                                  {order.metadata.estimated_delivery_days} jour{order.metadata.estimated_delivery_days > 1 ? 's' : ''} ouvrable{order.metadata.estimated_delivery_days > 1 ? 's' : ''}
                                </span>
                              </p>
                              {order.metadata.estimated_delivery_at && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  Livraison prévue le {new Date(order.metadata.estimated_delivery_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        {/* Tracker visuel */}
                        <OrderProgressTracker status={order.status} />

                        {/* Articles */}
                        <div className="space-y-1">
                          {order.order_items?.map((item, idx) => (
                            <div key={idx} className="text-sm">
                              {item.quantity}x {item.products?.name || item.product_name || 'Produit'}
                            </div>
                          ))}
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                          {getStatusBadge(order.status)}
                          {!isCODOrder && escrow && getEscrowBadge(escrow.status)}
                          {isCODOrder && (
                            <Badge className="bg-orange-100 text-[#ff4000]">
                              <Banknote className="w-3 h-3 mr-1" /> Paiement à la livraison
                            </Badge>
                          )}
                        </div>

                        {/* Info Escrow */}
                        {!isCODOrder && escrow && (escrow.status === 'pending' || escrow.status === 'held') && (
                          <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <Shield className="w-5 h-5 text-[#ff4000] flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-[#ff4000]">{t('myPurchasesOrdersList.paiementProtege')}</p>
                              <p className="text-xs text-[#ff4000]">
                                <Money amount={escrow.amount} from={escrow.currency || 'GNF'} /> sécurisés jusqu'à confirmation
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="space-y-2">
                          {canCancelOrder(order) && (
                            <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(order)} disabled={cancellingOrderId === order.id} className="w-full">
                              {cancellingOrderId === order.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                              Annuler la commande
                            </Button>
                          )}

                          {!isCODOrder && escrow && ['pending', 'held', 'released'].includes(escrow.status) && !['cancelled'].includes(order.status) && (
                            <Button variant="outline" size="sm" onClick={() => handleRequestRefund(order)} disabled={refundingOrderId === order.id} className="w-full">
                              {refundingOrderId === order.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                              Demander un remboursement
                            </Button>
                          )}

                          {canConfirmDelivery && (
                            <Button onClick={() => handleConfirmDelivery(order)} disabled={confirmingOrderId === order.id} className="w-full">
                              {confirmingOrderId === order.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                              J'ai reçu ma commande
                            </Button>
                          )}

                          {(order.status === 'completed' || order.status === 'delivered') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRatingOrderData({
                                  orderId: order.id,
                                  vendorId: order.vendor_id,
                                  vendorName: order.vendors?.business_name || 'ce vendeur'
                                });
                                setShowRatingDialog(true);
                              }}
                              className="w-full"
                            >
                              <Star className="w-4 h-4 mr-2" />
                              Laisser un avis
                            </Button>
                          )}
                        </div>

                        {(order.status === 'delivered' || order.status === 'completed') && escrow?.status === 'released' && (
                          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                            <span className="text-sm text-muted-foreground">
                              Terminée - {formatCurrency(getVendorReceivableAmount(order, escrow), getVendorReceivableCurrency(order, escrow))} transférés au vendeur
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('myPurchasesOrdersList.confirmerLaReception')}</AlertDialogTitle>
            <AlertDialogDescription>
              En confirmant, vous attestez avoir reçu votre commande.
              {!selectedOrderIsCashOnDelivery && (
                <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-3">
                  <div className="text-sm text-muted-foreground">{t('myPurchasesOrdersList.montantQuiSeraLibereAu')}</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {formatCurrency(sellerReceivableAmount, sellerReceivableCurrency)}
                  </div>
                </div>
              )}
              <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                  <span className="text-sm text-orange-800">
                    {selectedOrderIsCashOnDelivery
                      ? 'Action irréversible. Après confirmation, la fenêtre d\'avis s\'ouvrira automatiquement.'
                      : 'Action irréversible. Vérifiez votre colis.'}
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('myPurchasesOrdersList.annuler')}</AlertDialogCancel>
            {/* onClick enrobé : confirmDelivery(orderOverride?) ne doit pas recevoir l'event MouseEvent */}
            <AlertDialogAction onClick={() => void confirmDelivery()}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('myPurchasesOrdersList.annulerLaCommande')}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>{t('myPurchasesOrdersList.vousEtesSurLePoint')}</p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2 border rounded-md resize-none"
                  rows={3}
                  placeholder={t('myPurchasesOrdersList.raisonDeLAnnulationOptionnel')}
                />
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                    <span className="text-sm text-blue-800">
                      {selectedOrderIsCashOnDelivery
                        ? 'Cette commande est en paiement à la livraison. Aucun remboursement wallet ne sera effectué.'
                        : 'Votre paiement sera automatiquement remboursé dans votre portefeuille.'}
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelOrder} className="bg-destructive text-destructive-foreground">Confirmer l'annulation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('myPurchasesOrdersList.demanderUnRemboursement')}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>{t('myPurchasesOrdersList.decrivezLaRaisonDeVotre')}</p>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full p-2 border rounded-md resize-none"
                  rows={4}
                  placeholder={t('myPurchasesOrdersList.raisonDuRemboursement')}
                  required
                />
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Montant (optionnel, vide = total)"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('myPurchasesOrdersList.annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRequestRefund} disabled={!refundReason.trim()}>Envoyer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {ratingOrderData && (
        <ProductRatingDialog
          open={showRatingDialog}
          onOpenChange={setShowRatingDialog}
          orderId={ratingOrderData.orderId}
          vendorId={ratingOrderData.vendorId}
          vendorName={ratingOrderData.vendorName}
          onRatingSubmitted={() => {
            setRatingOrderData(null);
            setPendingRatingOrderData(null);
          }}
        />
      )}
    </>
  );
}

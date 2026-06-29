/**
 * Liste des commandes du client avec possibilité de confirmer la réception
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { formatCurrency } from '@/lib/utils';
import { Money } from '@/components/Money';
import { cancelOrder as cancelOrderRequest, confirmCashOnDeliveryOrder, confirmEscrowDelivery, listMyOrders, requestOrderRefund, getDeliveryProof, type DeliveryProof } from '@/services/orderBackendService';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { OrderDisputeThread } from '@/components/disputes/OrderDisputeThread';
import { ReturnRequestDialog } from '@/components/returns/ReturnRequestDialog';
import {
  Package, CheckCircle, Clock, Truck, XCircle,
  Shield, AlertCircle, Loader2, ListFilter, Ban, DollarSign, Banknote, Camera, Star
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
import ProductRatingDialog from './ProductRatingDialog';

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

interface RatingOrderData {
  orderId: string;
  vendorId: string;
  vendorName: string;
}

// Helper pour vérifier si une commande est paiement à la livraison
const isCashOnDelivery = (order: Order): boolean => {
  return order.payment_method === 'cash' &&
         (
           order.shipping_address?.is_cod === true ||
           order.metadata?.is_cod === true ||
           order.metadata?.payment_type === 'cash_on_delivery'
         );
};

const canCancelOrder = (order: Order): boolean => order.status === 'pending';
interface EscrowStatus {
  id: string;
  status: string;
  amount: number;
  commission_amount?: number | null;
  metadata?: Record<string, any> | null;
  currency?: string;
}

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

export default function ClientOrdersList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const focusOrderId = searchParams.get('order');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [escrows, setEscrows] = useState<Record<string, EscrowStatus>>({});
  const [loading, setLoading] = useState(true);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'in_progress' | 'delivered'>('all');
  // PARTIE 1.4 — preuve de livraison par commande (chargée à la demande)
  const [proofs, setProofs] = useState<Record<string, (DeliveryProof & { loading?: boolean }) | undefined>>({});

  const loadProof = async (orderId: string) => {
    setProofs(prev => ({ ...prev, [orderId]: { ...(prev[orderId] as any), loading: true, success: true, purged: false, photo_url: null, video_url: null } }));
    try {
      const res = await getDeliveryProof(orderId);
      setProofs(prev => ({ ...prev, [orderId]: { ...(res as DeliveryProof), loading: false } }));
    } catch {
      setProofs(prev => ({ ...prev, [orderId]: undefined }));
      toast.error('Impossible de charger la preuve de livraison');
    }
  };
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [ratingOrderData, setRatingOrderData] = useState<RatingOrderData | null>(null);
  const [pendingRatingOrderData, setPendingRatingOrderData] = useState<RatingOrderData | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
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

  // Redirection depuis une notification (/orders?order=<id>) : on défile jusqu'à la
  // commande visée et on la met en surbrillance, pour que le client tombe directement
  // sur la bonne carte (ex. bouton « Confirmer la réception »).
  useEffect(() => {
    if (loading || !focusOrderId) return;
    const el = document.getElementById(`order-${focusOrderId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedOrderId(focusOrderId);
    const timer = setTimeout(() => setHighlightedOrderId(null), 2600);
    return () => clearTimeout(timer);
  }, [loading, focusOrderId, orders.length]);

  useEffect(() => {
    if (user) {
      loadOrders();

      // Configurer l'écoute en temps réel pour les commandes ET les escrows
      const ordersChannel = supabase
        .channel('client-orders-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders'
          },
          (payload) => {
            console.log('🔄 Mise à jour en temps réel des commandes:', payload);
            loadOrders(); // Recharger les commandes
          }
        )
        .subscribe();

      // Écouter aussi les changements d'escrow pour mettre à jour le bouton
      const escrowChannel = supabase
        .channel('client-escrow-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'escrow_transactions'
          },
          (payload) => {
            console.log('🔄 Mise à jour en temps réel des escrows:', payload);
            loadOrders(); // Recharger les commandes et escrows
          }
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

      const response = await listMyOrders({ limit: 100 });
      if (!response.success) {
        throw new Error(response.error || 'Impossible de charger les commandes');
      }

      const ordersData = (response.data || []) as Order[];
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
      toast.error(t('profile.errorLoadingOrders'));
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
        // Paiement WALLET/escrow : libération atomique via le backend Node.js (remplace l'Edge
        // Function 'confirm-delivery'). Le backend crédite le vendeur (net + commission plateforme).
        const response = await confirmEscrowDelivery(orderToConfirm.id);
        if (!response.success) throw new Error(response.error || 'Erreur lors de la confirmation');
      } else {
        const response = await confirmCashOnDeliveryOrder(orderToConfirm.id);
        if (!response.success) {
          throw new Error(response.error || 'Erreur lors de la confirmation du paiement à la livraison');
        }
      }

      toast.success(t('orders.receptionConfirmed'), {
        description: escrow ? t('orders.sellerReceivedPayment') : t('orders.orderNowComplete')
      });

      // Afficher la fenêtre de notation
      setPendingRatingOrderData({
        orderId: orderToConfirm.id,
        vendorId: orderToConfirm.vendor_id,
        vendorName: orderToConfirm.vendors?.business_name || 'ce vendeur'
      });

      // Recharger les commandes
      await loadOrders();
    } catch (error) {
      console.error('Error confirming delivery:', error);
      const errorMessage = await extractFunctionErrorMessage(error);
      toast.error(t('orders.confirmError'), {
        description: errorMessage
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

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de l\'annulation');
      }

      const refund = (response as any).refund;
      if (refund?.refunded && refund.amount > 0) {
        toast.success(t('orders.cancelledWithRefund'), {
          description: `${refund.amount.toLocaleString()} ${refund.currency} ${t('orders.refundedToWalletSuffix')}`,
        });
      } else {
        toast.success(t('orders.cancelledSuccess'));
      }

      // Recharger les commandes
      await loadOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error(t('orders.cancelError'), {
        description: error instanceof Error ? error.message : t('orders.pleaseTryAgain')
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
        evidence_text: refundReason,
      });

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la demande de remboursement');
      }

      toast.success(t('orders.refundRequestSent'), {
        description: t('orders.sellerAndTeamNotified')
      });

      // Recharger les commandes
      await loadOrders();
    } catch (error) {
      console.error('Error requesting refund:', error);
      toast.error(t('orders.requestError'), {
        description: error instanceof Error ? error.message : t('orders.pleaseTryAgain')
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
      confirmed: { label: t('clientOrdersList.confirmee'), color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      preparing: { label: t('clientOrdersList.enPreparation'), color: 'bg-blue-100 text-[#04439e]', icon: Package },
      ready: { label: t('clientOrdersList.prete'), color: 'bg-blue-100 text-blue-800', icon: Package },
      in_transit: { label: 'En transit', color: 'bg-orange-100 text-orange-800', icon: Truck },
      delivered: { label: t('clientOrdersList.livree'), color: 'bg-orange-100 text-[#ff4000]', icon: CheckCircle },
      completed: { label: t('clientOrdersList.terminee'), color: 'bg-orange-100 text-[#ff4000]', icon: CheckCircle },
      cancelled: { label: t('clientOrdersList.annulee'), color: 'bg-orange-100 text-[#ff4000]', icon: XCircle }
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
      pending: { label: t('clientOrdersList.fondsBloquesEscrow'), color: 'bg-orange-100 text-orange-800' },
      released: { label: t('clientOrdersList.fondsLiberes'), color: 'bg-orange-100 text-[#ff4000]' },
      refunded: { label: t('clientOrdersList.rembourse'), color: 'bg-gray-100 text-gray-800' },
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Filtrer les commandes selon le filtre actif
  const getFilteredOrders = () => {
    if (activeFilter === 'all') return orders;
    if (activeFilter === 'pending') {
      // En attente = pending, confirmed, preparing, ready
      return orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
    }
    if (activeFilter === 'in_progress') {
      // En cours = in_transit
      return orders.filter(o => o.status === 'in_transit');
    }
    if (activeFilter === 'delivered') {
      // Livrées = delivered + completed
      return orders.filter(o => o.status === 'delivered' || o.status === 'completed');
    }
    return orders;
  };

  const filteredOrders = getFilteredOrders();
  const pendingCount = orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).length;
  const inProgressCount = orders.filter(o => o.status === 'in_transit').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered' || o.status === 'completed').length;

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('orders.noOrdersYet')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Boutons de filtrage */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <ListFilter className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">{t('orders.filterMyOrders')}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('all')}
              className="flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              Toutes ({orders.length})
            </Button>
            <Button
              variant={activeFilter === 'pending' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('pending')}
              className="flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              En attente ({pendingCount})
            </Button>
            <Button
              variant={activeFilter === 'in_progress' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('in_progress')}
              className="flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              En cours ({inProgressCount})
            </Button>
            <Button
              variant={activeFilter === 'delivered' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('delivered')}
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Livrées ({deliveredCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des commandes filtrées */}
      <Card>
        <CardContent className="p-6">
          <ScrollArea className="h-[600px] pr-4">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {activeFilter === 'pending' && 'Aucune commande en attente actuellement'}
                  {activeFilter === 'in_progress' && 'Aucune commande en cours actuellement'}
                  {activeFilter === 'delivered' && 'Aucune commande livrée actuellement'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const escrow = escrows[order.id];
                  const isCODOrder = isCashOnDelivery(order);
                  const requiresEscrowRelease = order.payment_method !== 'cash';
                  const _escrowPending = escrow?.status === 'pending' || escrow?.status === 'held';
                  const isDeliveryPending = order.status === 'in_transit' || order.status === 'shipped' || order.status === 'ready';
                  // ESCROW (wallet/carte) : en attente tant que l'escrow n'est pas libéré/remboursé.
                  // COD : une fois 'delivered', la réception EST confirmée (pas d'escrow) → PLUS de bouton
                  // (sinon « Confirmer la réception » se réaffiche en boucle).
                  const isDeliveredAwaitingConfirmation = order.status === 'delivered' && (requiresEscrowRelease ? escrow?.status !== 'released' && escrow?.status !== 'refunded' : false);
                  const canConfirmDelivery = order.status !== 'cancelled' && order.status !== 'completed' && (isDeliveryPending || isDeliveredAwaitingConfirmation);

                  return (
            <Card
              key={order.id}
              id={`order-${order.id}`}
              className={`overflow-hidden transition-shadow ${highlightedOrderId === order.id ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : ''}`}
            >
              <CardHeader className="bg-muted/50 p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm sm:text-lg truncate">
                      Commande #{order.order_number}
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {order.vendors?.business_name || 'Vendeur'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1">
                    <div className="font-bold text-sm sm:text-lg whitespace-nowrap">
                      <Money amount={order.total_amount} from={getVendorReceivableCurrency(order, escrow)} />
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
              </CardHeader>
              {/* Fil du litige (visible uniquement si un remboursement a été demandé) */}
              <OrderDisputeThread orderId={order.id} currentParty="client" className="px-3 sm:px-6 pt-3" />
              {/* Demande de retour : commande livrée, fonds encore en escrow (fenêtre 14j ouverte) */}
              {(order.status === 'delivered' || order.status === 'completed')
                && escrow && escrow.status !== 'released' && escrow.status !== 'refunded' && (
                <div className="px-3 sm:px-6 pt-3">
                  <ReturnRequestDialog orderId={order.id} orderNumber={order.order_number} onCreated={loadOrders} />
                </div>
              )}
              <CardContent className="p-4 space-y-4">
                {/* Articles */}
                <div className="space-y-1">
                  {order.order_items?.map((item, idx) => (
                    <div key={idx} className="text-sm">
                      {item.quantity}x {item.products?.name || item.product_name || 'Produit'}
                    </div>
                  ))}
                </div>

                {/* Statuts */}
                <div className="flex flex-wrap gap-2">
                  {getStatusBadge(order.status)}
                  {!isCODOrder && escrow && getEscrowBadge(escrow.status)}
                  {/* Badge paiement à la livraison */}
                  {isCODOrder && (
                    <Badge className="bg-orange-100 text-[#ff4000]">
                      <Banknote className="w-3 h-3 mr-1" />
                      Paiement à la livraison
                    </Badge>
                  )}
                </div>

                {/* PARTIE 1.4 — Preuve de livraison (photo + vidéo, supprimée 7j après confirmation) */}
                {['shipped', 'in_transit', 'delivered', 'completed'].includes(order.status) && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                    {!proofs[order.id] ? (
                      <Button variant="outline" size="sm" onClick={() => loadProof(order.id)}>
                        <Camera className="w-4 h-4 mr-2" /> Voir la preuve de livraison
                      </Button>
                    ) : proofs[order.id]?.loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
                      </div>
                    ) : proofs[order.id]?.purged ? (
                      <p className="text-sm text-muted-foreground">Preuve supprimée après 7 jours.</p>
                    ) : (proofs[order.id]?.photo_url || proofs[order.id]?.video_url) ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-blue-800">📸 Preuve de livraison</p>
                        {proofs[order.id]?.photo_url && (
                          <img src={proofs[order.id]!.photo_url!} alt="Preuve de livraison" className="max-h-64 rounded-md border" />
                        )}
                        {proofs[order.id]?.video_url && (
                          <video src={proofs[order.id]!.video_url!} controls className="max-h-64 w-full rounded-md border" />
                        )}
                        <p className="text-[11px] text-muted-foreground">Disponible jusqu'à 7 jours après confirmation de réception.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucune preuve jointe par le vendeur.</p>
                    )}
                  </div>
                )}

                {/* Info Paiement à la livraison */}
                {isCODOrder && !['delivered', 'completed', 'cancelled'].includes(order.status) && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-[#ff4000] rounded-lg border border-orange-200 dark:border-[#ff4000]">
                    <Banknote className="w-5 h-5 text-[#ff4000] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#ff4000] dark:text-orange-200">
                        Paiement à la livraison
                      </p>
                      <p className="text-xs text-[#ff4000] dark:text-orange-300">
                        Vous paierez <Money amount={order.total_amount} from={getVendorReceivableCurrency(order, escrow)} /> à la réception de votre commande
                      </p>
                    </div>
                  </div>
                )}

                {/* Protection Escrow */}
                {!isCODOrder && escrow && (escrow.status === 'pending' || escrow.status === 'held') && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-[#ff4000] rounded-lg border border-orange-200 dark:border-[#ff4000]">
                    <Shield className="w-5 h-5 text-[#ff4000] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#ff4000] dark:text-orange-200">
                        Paiement protégé
                      </p>
                      <p className="text-xs text-[#ff4000] dark:text-orange-300">
                        Vos <Money amount={escrow.amount} from={escrow.currency || 'GNF'} /> sont sécurisés en escrow jusqu'à confirmation de livraison
                      </p>
                    </div>
                  </div>
                )}

                {/* Boutons d'action */}
                <div className="space-y-2">
                  {/* Bouton d'annulation */}
                  {canCancelOrder(order) && (
                    <Button
                      variant="destructive"
                      onClick={() => handleCancelOrder(order)}
                      disabled={cancellingOrderId === order.id}
                      className="w-full"
                    >
                      {cancellingOrderId === order.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Annulation en cours...
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4 mr-2" />
                          Annuler la commande
                        </>
                      )}
                    </Button>
                  )}

                  {/* Bouton de demande de remboursement */}
                  {!isCODOrder && escrow && ['pending', 'held', 'released'].includes(escrow.status) && !['cancelled'].includes(order.status) && (
                    <Button
                      variant="outline"
                      onClick={() => handleRequestRefund(order)}
                      disabled={refundingOrderId === order.id}
                      className="w-full"
                    >
                      {refundingOrderId === order.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4 mr-2" />
                          Demander un remboursement
                        </>
                      )}
                    </Button>
                  )}

                  {/* Bouton de confirmation */}
                  {canConfirmDelivery && (
                    <Button
                      onClick={() => handleConfirmDelivery(order)}
                      disabled={confirmingOrderId === order.id}
                      className="w-full"
                    >
                      {confirmingOrderId === order.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Confirmation en cours...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          J'ai reçu ma commande
                        </>
                      )}
                    </Button>
                  )}

                  {/* Noter le produit + la boutique — persistant après livraison (COD inclus), pour
                      pouvoir laisser un avis à tout moment, pas seulement juste après la confirmation. */}
                  {(order.status === 'delivered' || order.status === 'completed') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRatingOrderData({
                          orderId: order.id,
                          vendorId: order.vendor_id,
                          vendorName: order.vendors?.business_name || 'ce vendeur',
                        });
                        setShowRatingDialog(true);
                      }}
                      className="w-full"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Noter le produit et la boutique
                    </Button>
                  )}
                </div>

                {/* Info si déjà livrée */}
                {(order.status === 'delivered' || order.status === 'completed') && escrow?.status === 'released' && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                    <span className="text-sm text-muted-foreground">
                      Commande terminée et {formatCurrency(getVendorReceivableAmount(order, escrow), getVendorReceivableCurrency(order, escrow))} transférés au vendeur
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

      {/* Dialog de confirmation */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orders.confirmReception')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('orders.confirmReceptionDesc')}
              {!selectedOrderIsCashOnDelivery && (
                <div className="mt-3 rounded-lg border border-primary/15 p-3">
                  <div className="text-sm text-muted-foreground">{t('orders.amountReleasedToSeller')}</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {formatCurrency(sellerReceivableAmount, sellerReceivableCurrency)}
                  </div>
                </div>
              )}
              <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-orange-800 dark:text-orange-200">
                    {selectedOrderIsCashOnDelivery
                      ? t('orders.irreversibleCodReview')
                      : t('orders.irreversibleCheck')}
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            {/* onClick enrobé : confirmDelivery(orderOverride?) ne doit pas recevoir l'event MouseEvent */}
            <AlertDialogAction onClick={() => void confirmDelivery()}>
              {t('orders.confirmReceptionBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog d'annulation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orders.cancelOrderQ')}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>{t('orders.aboutToCancel')}</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('orders.cancelReasonOptional')}</label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full p-2 border rounded-md resize-none"
                    rows={3}
                    placeholder={t('orders.cancelReasonPlaceholder')}
                  />
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-blue-800 dark:text-blue-200">
                      {selectedOrderIsCashOnDelivery
                        ? t('orders.codNoEscrow')
                        : t('orders.paidWillRefund')}
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('orders.keepOrder')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('orders.confirmCancellation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de demande de remboursement */}
      <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orders.requestRefund')}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>{t('orders.refundDescribeReason')}</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('orders.refundReasonRequired')}</label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full p-2 border rounded-md resize-none"
                    rows={4}
                    placeholder={t('orders.refundReasonPlaceholder')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('orders.amountRequestedOptional')}</label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    placeholder={t('orders.amountRequestedPlaceholder')}
                  />
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-orange-800 dark:text-orange-200">
                      {t('orders.disputeWillOpen')}
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRequestRefund} disabled={!refundReason.trim()}>
              {t('orders.sendRequest')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de notation des produits */}
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

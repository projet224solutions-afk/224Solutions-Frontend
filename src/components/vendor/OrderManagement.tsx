import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { OrderDisputeThread } from "@/components/disputes/OrderDisputeThread";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useMoneyFormat } from "@/components/Money";
import { supabase } from "@/integrations/supabase/client";
import { readSectionCache, writeSectionCache, isBrowserOffline } from "@/lib/offline/sectionCache";
import { updateOrderStatus as updateOrderStatusBackend } from "@/services/orderBackendService";
import { backendFetch } from "@/services/backendApi";
import { useToast } from "@/hooks/use-toast";
import CreditSalesForm from "@/components/vendor/CreditSalesForm";
import {
  ShoppingCart, Search, Filter, Eye, Package,
  CheckCircle, XCircle, Truck, CreditCard, FileText,
  Calendar, User, MapPin, Download, Shield, RefreshCw, Banknote, Lock,
  Camera, Printer
} from "lucide-react";

interface Address {
  street: string;
  city: string;
  postal_code?: string;
  country: string;
}

interface EscrowInfo {
  id: string;
  status: string;
  amount: number;
  created_at: string;
}

// Supprimé: StandaloneEscrow interface (non utilisé)

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method?: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  /** Devise de la commande (orders.currency = devise vendeur/produit, pas toujours GNF) */
  currency?: string;
  shipping_address: any; // Json from Supabase
  billing_address?: any; // Json from Supabase
  notes?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  source?: 'online' | 'pos';
  customers?: {
    id: string;
    user_id: string;
    profiles?: {
      public_id?: string;
      first_name?: string;
      last_name?: string;
      full_name?: string;
      phone?: string;
      email?: string;
      city?: string;
      country?: string;
    };
  };
  order_items?: {
    id: string;
    product_id: string;
    variant_id?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products: {
      id: string;
      name: string;
      sku?: string;
      price: number;
      images?: string[];
      stock_quantity?: number;
      is_active: boolean;
    };
  }[];
  escrow?: EscrowInfo;
}

const statusColors: Record<string, string> = {
  pending: 'bg-orange-100 text-[#ff4000]',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-blue-100 text-[#04439e]',
  preparing: 'bg-blue-100 text-[#04439e]',
  ready: 'bg-blue-100 text-blue-800',
  shipped: 'bg-orange-100 text-orange-800',
  in_transit: 'bg-orange-100 text-orange-800',
  delivered: 'bg-orange-100 text-[#ff4000]',
  completed: 'bg-orange-100 text-[#ff4000]',
  cancelled: 'bg-orange-100 text-[#ff4000]'
};

// Clés i18n des statuts (résolues via t() dans le rendu — voir staging .i18n-new-keys.json).
const statusLabelKeys: Record<string, string> = {
  pending: 'orders.status.pending',
  confirmed: 'orders.status.confirmed',
  processing: 'orders.status.processing',
  preparing: 'orders.status.preparing',
  ready: 'orders.status.ready',
  shipped: 'orders.status.shipped',
  in_transit: 'orders.status.in_transit',
  delivered: 'orders.status.delivered',
  completed: 'orders.status.completed',
  cancelled: 'orders.status.cancelled'
};

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-orange-100 text-[#ff4000]',
  paid: 'bg-orange-100 text-[#ff4000]',
  failed: 'bg-orange-100 text-[#ff4000]',
  refunded: 'bg-gray-100 text-gray-800'
};

const paymentStatusLabelKeys: Record<string, string> = {
  pending: 'orders.payStatus.pending',
  paid: 'orders.payStatus.paid',
  failed: 'orders.payStatus.failed',
  refunded: 'orders.payStatus.refunded'
};

// Clés i18n des méthodes de paiement
const paymentMethodLabelKeys: Record<string, string> = {
  wallet: 'orders.payMethod.wallet',
  card: 'orders.payMethod.card',
  cash: 'orders.payMethod.cash',
  mobile_money: 'orders.payMethod.mobile_money',
  bank_transfer: 'orders.payMethod.bank_transfer'
};

const isCashOnDeliveryOrder = (order: Order): boolean => {
  const shippingAddress = order.shipping_address as any;
  return order.source === 'online' &&
    order.payment_method === 'cash' &&
    (
      shippingAddress?.is_cod === true ||
      order.metadata?.is_cod === true ||
      order.metadata?.payment_type === 'cash_on_delivery'
    );
};

// Fonction pour obtenir le libellé de la méthode de paiement (t passé en paramètre).
const getPaymentMethodLabel = (order: Order, t: (k: string) => string): string => {
  const method = order.payment_method;
  if (isCashOnDeliveryOrder(order)) {
    return t('orders.codLabel');
  }
  const isCOD = order.source === 'online' &&
                method === 'cash' &&
                order.payment_status === 'pending' &&
                ((order.shipping_address as any)?.is_cod === true || order.metadata?.is_cod === true);

  if (isCOD) {
    return `💵 ${t('orders.codLabel')}`;
  }

  const key = paymentMethodLabelKeys[method || ''];
  return key ? t(key) : (method || t('orders.unspecified'));
};

export default function OrderManagement() {
  const { t } = useTranslation();
  const { vendorId, user, loading: vendorLoading, canAccessPOS, businessType } = useCurrentVendor();
  const { format, userCurrency } = useMoneyFormat();
  const { toast } = useToast();

  // Convertit un montant de SA devise de stockage (défaut GNF, base plateforme) vers la devise
  // d'affichage de l'utilisateur (taux BCRG). ⚠️ Le défaut DOIT être 'GNF' : avec userCurrency,
  // format(x, userCurrency) = conversion identité → AUCUNE conversion (montants GNF affichés bruts).
  const fmtAmount = (amount: number, currency: string = 'GNF') => format(amount, currency || 'GNF');
  const [orders, setOrders] = useState<Order[]>([]);
  // Ventes POS CASH (table `pos_sales`, distincte de `orders` source='pos' qui ne couvre que
  // les paiements électroniques). Sans ça, le cash était ABSENT de la vue « Ventes POS ».
  const [posSales, setPosSales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<'pos' | 'online'>('online');
  const [onlineStatusFilter, setOnlineStatusFilter] = useState<'all' | 'pending' | 'processing' | 'delivered'>('all');
  const [onlinePeriod, setOnlinePeriod] = useState<'all' | 'day' | 'week' | 'month' | 'year'>('all');
  const [mainTab, setMainTab] = useState<'orders' | 'credit'>('orders');
  const [searchParams] = useSearchParams();
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

  // Redirection PRÉCISE depuis une notification :
  //   /vendeur/orders?online=pending&focus=<id> → onglet commandes, vue « en ligne »,
  //   filtre « en attente », défilement + surbrillance sur la commande concernée.
  const focusParam = searchParams.get('focus') || searchParams.get('order');
  const onlineParam = searchParams.get('online');
  useEffect(() => {
    if (!onlineParam && !focusParam) return;
    setMainTab('orders');
    setActiveView('online');
    if (onlineParam && ['all', 'pending', 'processing', 'delivered'].includes(onlineParam)) {
      setOnlineStatusFilter(onlineParam as 'all' | 'pending' | 'processing' | 'delivered');
    }
    if (loading || !focusParam) return;
    const el = document.getElementById(`order-${focusParam}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedOrderId(focusParam);
    const timer = setTimeout(() => setHighlightedOrderId(null), 2600);
    return () => clearTimeout(timer);
     
  }, [loading, focusParam, onlineParam, orders.length]);
  const [deliveryDialogOrder, setDeliveryDialogOrder] = useState<Order | null>(null);
  const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState('3');
  // PARTIE 3 : compteur de nouvelles commandes + sélection multiple (lot)
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // PARTIE 1.4 : preuve de livraison (photo obligatoire + vidéo courte optionnelle)
  const [proofOrder, setProofOrder] = useState<Order | null>(null);
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
  const [proofVideo, setProofVideo] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);

  useEffect(() => {
    if (!vendorId || vendorLoading) return;
    fetchOrders();

    // Mise à jour en temps réel des commandes (online ET pos)
    const ordersChannel = supabase
      .channel('vendor-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('🔔 Changement commande (realtime):', payload);
          fetchOrders(); // Recharger toutes les commandes

          if (payload.eventType === 'INSERT') {
            const source = (payload.new as any).source;
            toast({
              title: source === 'pos' ? "🛒 Nouvelle vente POS!" : "🎉 Nouvelle commande!",
              description: `Commande ${(payload.new as any).order_number} reçue`
            });
            // ✅ Compteur + bip d'alerte (en plus du toast). Le son ne marche
            // qu'après une 1re interaction utilisateur (politique navigateur) — OK ici.
            setNewOrderCount((c) => c + 1);
            try {
              const Ctx = window.AudioContext || (window as any).webkitAudioContext;
              const ctx = new Ctx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.value = 880; gain.gain.value = 0.1;
              osc.start(); osc.stop(ctx.currentTime + 0.2);
            } catch { /* audio non dispo, silencieux */ }
          }
        }
      )
      .subscribe();

    // Mise à jour en temps réel des escrow (pour voir quand le client confirme la livraison)
    const escrowChannel = supabase
      .channel('vendor-escrow-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'escrow_transactions'
        },
        (payload) => {
          console.log('💰 Changement escrow (realtime):', payload);
          const newStatus = (payload.new as any).status;
          const oldStatus = (payload.old as any)?.status;

          // Notification quand l'escrow est libéré (client a confirmé la livraison)
          if (newStatus === 'released' && oldStatus !== 'released') {
            toast({
              title: t('orderManagement.paiementLibere'),
              description: `Le client a confirmé la réception. ${fmtAmount((payload.new as any).amount || 0)} transférés sur votre compte.`,
              duration: 10000
            });
          }

          fetchOrders(); // Recharger pour mettre à jour l'affichage
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(escrowChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, vendorLoading]);

  // Charge les ventes POS cash (pos_sales) et les normalise au format Order pour la vue POS.
  // useCallback → réutilisable (effet initial + après un remboursement, pour rafraîchir l'état).
  const fetchPosSales = useCallback(async () => {
    if (!vendorId) return;
    const { data, error } = await supabase
      .from('pos_sales')
      .select('id, total_amount, discount_total, payment_method, customer_name, sold_at, status, pos_sale_items(id, product_id, product_name, quantity, unit_price)')
      .eq('vendor_id', vendorId)
      .order('sold_at', { ascending: false });
    if (error || !data) {
      if (error) console.warn('[OrderManagement] pos_sales load:', error.message);
      return;
    }
    const normalized: Order[] = data.map((s: any) => ({
        id: s.id,
        order_number: `POS-${String(s.id).slice(0, 8).toUpperCase()}`,
        status: s.status || 'completed',
        payment_status: s.status === 'refunded' ? 'refunded' : 'paid', // cash = encaissé
        payment_method: s.payment_method || 'cash',
        subtotal: Number(s.total_amount) || 0,
        tax_amount: 0,
        shipping_amount: 0,
        discount_amount: Number(s.discount_total) || 0,
        total_amount: Number(s.total_amount) || 0,
        currency: 'GNF', // pos_sales stocke en GNF (base plateforme) → converti à l'affichage
        shipping_address: null,
        created_at: s.sold_at,
        updated_at: s.sold_at,
        source: 'pos',
        customers: s.customer_name
          ? ({ id: '', user_id: '', profiles: { full_name: s.customer_name } } as any)
          : undefined,
        order_items: (s.pos_sale_items || []).map((i: any) => ({
          id: i.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: Number(i.unit_price) || 0,
          total_price: (Number(i.unit_price) || 0) * (i.quantity || 0),
          products: { id: i.product_id, name: i.product_name, price: Number(i.unit_price) || 0, is_active: true },
        })),
      }));
      setPosSales(normalized);
  }, [vendorId, userCurrency]);

  useEffect(() => {
    if (!vendorId || vendorLoading) return;
    fetchPosSales();
  }, [vendorId, vendorLoading, fetchPosSales]);

  const fetchOrders = async () => {
    if (!vendorId || !user) {
      console.warn('⚠️ Pas de vendorId ou user pour charger les commandes');
      setLoading(false);
      return;
    }

    // 📴 Hors ligne : afficher les dernières commandes connues (cache), sans réseau.
    if (isBrowserOffline()) {
      const cached = readSectionCache<Order>('orders', vendorId);
      if (cached) setOrders(cached);
      setLoading(false);
      return;
    }

    try {
      setIsRefreshing(true);
      console.log('🔍 Fetching ALL orders (online + POS) for vendor:', vendorId);

      // Charger TOUTES les commandes du vendeur (online ET pos) avec les infos clients et produits
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers(
            id,
            user_id
          ),
          order_items(
            id,
            product_id,
            variant_id,
            quantity,
            unit_price,
            total_price,
            products(
              id,
              name,
              sku,
              price,
              images,
              stock_quantity,
              is_active
            )
          )
        `)
        .eq('vendor_id', vendorId)
        .in('source', ['online', 'pos'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching orders:', error);
        throw error;
      }

      // Récupérer les user_ids des customers pour charger les profils
      const userIds = (ordersData || [])
        .filter(o => o.customers?.user_id)
        .map(o => o.customers.user_id);

      // Charger les profils correspondants
      const profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, public_id, first_name, last_name, phone, email, full_name, city, country')
          .in('id', userIds);

        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }

      // Enrichir les commandes avec les données de profil
      const enrichedOrders = (ordersData || []).map(order => {
        if (order.customers?.user_id && profilesMap[order.customers.user_id]) {
          return {
            ...order,
            customers: {
              ...order.customers,
              profiles: profilesMap[order.customers.user_id]
            }
          };
        }
        return order;
      });

      console.log('✅ Orders fetched:', enrichedOrders?.length || 0);

      // Charger les infos escrow en une seule requête batch (optimisation)
      const orderIds = enrichedOrders.map(o => o.id);
      const escrowMap: Record<string, EscrowInfo> = {};

      if (orderIds.length > 0) {
        const { data: escrowData } = await supabase
          .from('escrow_transactions')
          .select('id, status, amount, created_at, order_id')
          .in('order_id', orderIds);

        if (escrowData) {
          escrowData.forEach(e => {
            escrowMap[e.order_id] = {
              id: e.id,
              status: e.status,
              amount: e.amount,
              created_at: e.created_at
            };
          });
        }
      }

      const ordersWithEscrow = enrichedOrders.map(order => ({
        ...order,
        escrow: escrowMap[order.id] || undefined
      }));

      console.log('📦 ALL orders loaded (online + POS):', ordersWithEscrow.length);
      console.log('   - Online:', ordersWithEscrow.filter(o => o.source === 'online').length);
      console.log('   - POS:', ordersWithEscrow.filter(o => o.source === 'pos').length);
      console.log('   - With Escrow:', ordersWithEscrow.filter(o => o.escrow).length);

      setOrders(ordersWithEscrow as Order[]);
      writeSectionCache('orders', vendorId, ordersWithEscrow as Order[]);

      if (ordersWithEscrow.length === 0) {
        console.warn('⚠️ Aucune commande trouvée.');
      }
    } catch (error) {
      console.error('💥 Error in fetchOrders:', error);
      // Repli sur le cache en cas d'échec réseau, sans alarmer inutilement.
      const cached = readSectionCache<Order>('orders', vendorId);
      if (cached) {
        setOrders(cached);
      } else {
        toast({
          title: "Erreur",
          description: t('orderManagement.impossibleDeChargerLesCommandes'),
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const _filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtrer uniquement les ventes en ligne et trier par priorité (escrow en premier)
  const onlineOrders = orders
    .filter(order => order.source === 'online')
    .sort((a, b) => {
      // Priorité 1: Commandes avec escrow en premier
      const aHasEscrow = !!a.escrow;
      const bHasEscrow = !!b.escrow;
      if (aHasEscrow && !bHasEscrow) return -1;
      if (!aHasEscrow && bHasEscrow) return 1;

      // Priorité 2: Statut escrow (pending/held avant released)
      if (aHasEscrow && bHasEscrow) {
        const aEscrowPending = ['pending', 'held'].includes(a.escrow!.status);
        const bEscrowPending = ['pending', 'held'].includes(b.escrow!.status);
        if (aEscrowPending && !bEscrowPending) return -1;
        if (!aEscrowPending && bEscrowPending) return 1;
      }

      // Priorité 3: Date (plus récent en premier)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const _filteredOnlineOrders = onlineOrders.filter(order => {
    const matchesSearch = !searchTerm ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const updateOrderStatus = async (
    orderId: string,
    newStatus: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'in_transit' | 'delivered' | 'cancelled',
    options: { estimated_delivery_days?: number } = {}
  ) => {
    // Prevent duplicate updates
    if (updatingOrderId === orderId) {
      console.log('⏳ Update already in progress for order:', orderId);
      return;
    }

    // Validate required data before proceeding
    if (!vendorId) {
      console.error('❌ No vendorId available');
      toast({
        title: "❌ Erreur",
        description: t('orderManagement.profilVendeurNonTrouveVeuillez'),
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      console.error('❌ No user authenticated');
      toast({
        title: "❌ Erreur",
        description: t('orderManagement.vousDevezEtreConnectePour'),
        variant: "destructive"
      });
      return;
    }

    console.log('🔄 Updating order status:', { orderId, newStatus, vendorId });
    setUpdatingOrderId(orderId);

    // Store previous state for rollback
    const previousOrders = [...orders];

    // Optimistic update
    setOrders(prev => prev.map(order =>
      order.id === orderId
        ? { ...order, status: newStatus as string, updated_at: new Date().toISOString() }
        : order
    ));

    try {
      // Use backend API for proper escrow handling, stock management, and transition guards
      const response = await updateOrderStatusBackend(orderId, newStatus as any, {
        ...(newStatus === 'cancelled' ? { cancellation_reason: 'Annulée par le vendeur' } : {}),
        ...(newStatus === 'confirmed' && options.estimated_delivery_days
          ? { estimated_delivery_days: options.estimated_delivery_days }
          : {}),
      });

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la mise à jour');
      }

      console.log('✅ Order status updated via backend:', response.data);

      toast({
        title: t('orderManagement.statutMisAJour'),
        description: `${t('orders.markedAsPrefix')} ${t(statusLabelKeys[newStatus] || '')}.`,
      });

      // Refresh to ensure sync
      await fetchOrders();
    } catch (error: any) {
      console.error('❌ Failed to update order status:', error);

      // Rollback to previous state
      setOrders(previousOrders);

      toast({
        title: "❌ Erreur",
        description: error instanceof Error ? error.message: t('orderManagement.impossibleDeMettreAJour'),
        variant: "destructive"
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // ───────── PARTIE 3.1 — Sélection multiple + traitement par lot ─────────
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const selectAll = (orderIds: string[]) =>
    setSelectedIds(prev => prev.size === orderIds.length ? new Set() : new Set(orderIds));

  const bulkUpdateStatus = async (newStatus: string) => {
    const ids = Array.from(selectedIds);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try { await updateOrderStatus(id, newStatus); ok++; } catch { fail++; }
    }
    toast({
      title: `${ok} commande(s) mise(s) à jour`,
      description: fail ? `${fail} échec(s)` : undefined,
      variant: fail ? 'destructive' : undefined,
    });
    setSelectedIds(new Set());
    await fetchOrders();
  };

  // ───────── PARTIE 3.2 — Bordereaux d'expédition imprimables (A6) ─────────
  const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

  const printShippingLabels = (list: Order[]) => {
    if (!list.length) return;
    const addr = (o: Order) => [
      (o.shipping_address as any)?.address || (o.shipping_address as any)?.address_line,
      (o.shipping_address as any)?.neighborhood,
      (o.shipping_address as any)?.landmark,
      (o.shipping_address as any)?.city,
      (o.shipping_address as any)?.country,
    ].filter(Boolean).join(', ');
    const name = (o: Order) => o.customers?.profiles?.full_name
      || `${o.customers?.profiles?.first_name || ''} ${o.customers?.profiles?.last_name || ''}`.trim() || 'Client';
    const phone = (o: Order) => (o.shipping_address as any)?.cod_phone || o.customers?.profiles?.phone || '';

    const pages = list.map(o => `
      <div class="label">
        <h2>BORDEREAU D'EXPÉDITION</h2>
        <div class="num">Commande ${esc(o.order_number)}</div>
        <hr/>
        <div class="addr">
          <strong>Destinataire :</strong><br/>
          ${esc(name(o))}<br/>
          ${esc(addr(o))}<br/>
          ${esc(phone(o))}
        </div>
        <hr/>
        <table>
          ${(o.order_items || []).map((it: any) => `<tr><td>${esc(it.quantity)}×</td><td>${esc(it.products?.name || 'Produit')}</td></tr>`).join('')}
        </table>
      </div>`).join('<div class="pagebreak"></div>');

    const html = `<html><head><meta charset="utf-8"><style>
      @page { size: A6; margin: 6mm; }
      .label { font-family: sans-serif; font-size: 13px; }
      .pagebreak { page-break-after: always; }
      h2 { font-size: 15px; text-align:center; margin:4px 0; }
      .num { text-align:center; font-weight:bold; }
      table { width:100%; border-collapse:collapse; margin-top:6px; }
      td { padding:2px 0; border-bottom:1px dashed #ccc; }
    </style></head><body>${pages}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(html); doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus(); iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 250);
    }
  };

  // ───────── PARTIE 1.4 — Upload de la preuve de livraison (vendeur) ─────────
  // Upload d'un fichier de preuve vers le bucket GCS PRIVÉ via URL signée.
  // Renvoie l'objectPath (scopé à la commande) ou null si échec.
  const uploadProofToGcs = async (orderId: string, file: File): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke('gcs-signed-url', {
      body: {
        action: 'upload',
        fileName: file.name,
        folder: orderId,
        contentType: file.type || 'application/octet-stream',
        visibility: 'private',
        expiresInMinutes: 15,
      },
    });
    if (error || !data?.signedUrl || !data?.objectPath) return null;
    const put = await fetch(data.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!put.ok) return null;
    return data.objectPath as string; // ${orderId}/...
  };

  const submitDeliveryProof = async () => {
    if (!proofOrder || !proofPhoto) { toast({ title: 'Photo obligatoire', variant: 'destructive' }); return; }
    setProofUploading(true);
    try {
      const orderId = proofOrder.id;
      // Upload vers GCS privé (URL signée). Confidentialité préservée : lecture
      // uniquement via URL signée temporaire côté backend.
      const photoPath = await uploadProofToGcs(orderId, proofPhoto);
      if (!photoPath) { toast({ title: 'Échec upload photo', variant: 'destructive' }); return; }

      let videoPath: string | undefined;
      if (proofVideo) {
        const vp = await uploadProofToGcs(orderId, proofVideo);
        if (!vp) { toast({ title: 'Échec upload vidéo (photo conservée)', variant: 'destructive' }); }
        else videoPath = vp;
      }

      const res = await backendFetch(`/api/orders/${orderId}/delivery-proof`, {
        method: 'POST', body: { photo_path: photoPath, video_path: videoPath, storage: 'gcs' },
      });
      if (!(res as any)?.success) { toast({ title: 'Échec enregistrement preuve', variant: 'destructive' }); return; }

      toast({ title: 'Preuve de livraison enregistrée', description: 'Le client peut la consulter (supprimée 7j après confirmation de réception).' });
      setProofOrder(null); setProofPhoto(null); setProofVideo(null);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setProofUploading(false);
    }
  };

  const openDeliveryDelayDialog = (order: Order) => {
    if (isCashOnDeliveryOrder(order)) {
      void updateOrderStatus(order.id, 'confirmed');
      return;
    }

    setDeliveryDialogOrder(order);
    setEstimatedDeliveryDays(String(order.metadata?.estimated_delivery_days || 3));
  };

  const confirmOrderWithDeliveryDelay = async () => {
    if (!deliveryDialogOrder) return;

    const days = Number(estimatedDeliveryDays);
    if (!Number.isInteger(days) || days < 1 || days > 60) {
      toast({
        title: t('orderManagement.delaiInvalide'),
        description: t('orderManagement.indiquezUnNombreDeJours'),
        variant: "destructive",
      });
      return;
    }

    const orderId = deliveryDialogOrder.id;
    setDeliveryDialogOrder(null);
    await updateOrderStatus(orderId, 'confirmed', { estimated_delivery_days: days });
  };

  const getOrderStatusActions = (order: Order) => {
    const actions = [];

    if (order.status === 'pending') {
      actions.push(
        <Button
          key="confirm"
          size="sm"
          disabled={updatingOrderId === order.id}
          className="bg-[#ff4000] hover:bg-[#ff4000] text-white disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            console.log('✅ Confirming order:', order.id);
            openDeliveryDelayDialog(order);
          }}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          {updatingOrderId === order.id ? 'En cours...' : 'Confirmer'}
        </Button>
      );
    }

    if (order.status === 'confirmed') {
      actions.push(
        <Button
          key="process"
          size="sm"
          disabled={updatingOrderId === order.id}
          className="bg-vendeur-secondary hover:bg-vendeur-secondary/90 text-white disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            console.log('📦 Preparing order:', order.id);
            updateOrderStatus(order.id, 'preparing');
          }}
        >
          <Package className="w-4 h-4 mr-1" />
          {updatingOrderId === order.id ? 'En cours...' : 'Préparer'}
        </Button>
      );
    }

    if (order.status === 'preparing') {
      actions.push(
        <Button
          key="ready"
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={(e) => {
            e.stopPropagation();
            console.log('✅ Order ready:', order.id);
            updateOrderStatus(order.id, 'ready');
          }}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Prêt
        </Button>
      );
    }

    if (order.status === 'ready') {
      actions.push(
        <Button
          key="ship"
          size="sm"
          className="bg-orange-600 hover:bg-orange-700 text-white"
          onClick={(e) => {
            e.stopPropagation();
            console.log('🚚 Shipping order:', order.id);
            updateOrderStatus(order.id, 'in_transit');
          }}
        >
          <Truck className="w-4 h-4 mr-1" />
          Expédier
        </Button>
      );
    }

    if (order.status === 'in_transit') {
      actions.push(
        <Button
          key="deliver"
          size="sm"
          className="bg-[#ff4000] hover:bg-[#ff4000] text-white"
          onClick={(e) => {
            e.stopPropagation();
            console.log('✅ Delivering order:', order.id);
            updateOrderStatus(order.id, 'delivered');
          }}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Marquer livré
        </Button>
      );
    }

    if (!['cancelled', 'delivered', 'completed'].includes(order.status)) {
      actions.push(
        <Button
          key="cancel"
          size="sm"
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            console.log('❌ Cancelling order:', order.id);
            if (confirm(t('orderManagement.etesVousSurDeVouloir'))) {
              updateOrderStatus(order.id, 'cancelled');
            }
          }}
        >
          <XCircle className="w-4 h-4 mr-1" />
          Annuler
        </Button>
      );
    }

    return actions;
  };

  // Actions spécifiques pour les ventes POS - uniquement remboursement
  const getPOSOrderActions = (order: Order) => {
    return [
      <Button
        key="refund"
        size="sm"
        className="bg-[#ff4000] hover:bg-[#ff4000] text-white"
        onClick={async (e) => {
          e.stopPropagation();
          if (confirm(`Êtes-vous sûr de vouloir rembourser la commande ${order.order_number} ?`)) {
            try {
              // Remboursement ATOMIQUE + restitution du STOCK (gère orders ET pos_sales),
              // idempotent côté serveur (pas de double-restock si déjà remboursé).
              const { data, error } = await supabase.rpc('refund_pos_order_atomic' as any, {
                p_id: order.id,
                p_vendor_id: vendorId,
              });

              if (error) throw error;
              const res = data as any;

              toast({
                title: res?.already_refunded ? "Déjà remboursée" : "✅ Remboursement effectué",
                description: res?.already_refunded
                  ? `La commande ${order.order_number} était déjà remboursée.`
                  : `La commande ${order.order_number} a été remboursée (${fmtAmount(order.total_amount, order.currency)}) et le stock a été remis (${res?.restocked ?? 0} article(s)).`
              });

              // Rafraîchir commandes + ventes cash → la vente remboursée disparaît de la vue.
              await Promise.all([fetchOrders(), fetchPosSales()]);
            } catch (err) {
              console.error('Erreur remboursement:', err);
              toast({
                title: "❌ Erreur",
                description: t('orderManagement.impossibleDeTraiterLeRemboursement'),
                variant: "destructive"
              });
            }
          }
        }}
      >
        <Banknote className="w-4 h-4 mr-1" />
        Rembourser
      </Button>
    ];
  };

  // Statistics - Toutes les commandes
  const _totalOrders = orders.length;
  const _pendingOrders = orders.filter(o => o.status === 'pending').length;
  const _processingOrders = orders.filter(o => ['confirmed', 'processing'].includes(o.status)).length;
  const _deliveredOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status)).length;
  const _totalRevenue = orders
    .filter(o => o.payment_status === 'paid')
    .reduce((sum, o) => sum + o.total_amount, 0);

  // Vue en ligne segmentée par PÉRIODE (jour/semaine/mois/année) ET masquant les commandes
  // REMBOURSÉES/ANNULÉES (elles disparaissent → pas de double-remboursement), comme le POS.
  const onlineVisible = (() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    return onlineOrders.filter(o => {
      if (o.payment_status === 'refunded' || o.status === 'cancelled') return false;
      const d = new Date(o.created_at);
      if (onlinePeriod === 'day') return d >= startOfDay;
      if (onlinePeriod === 'week') return d >= startOfWeek;
      if (onlinePeriod === 'month') return d >= startOfMonth;
      if (onlinePeriod === 'year') return d >= startOfYear;
      return true;
    });
  })();

  // Liste en ligne réellement affichée (période + filtre statut) — réutilisée pour le lot.
  const visibleOnlineFiltered = onlineVisible.filter(order => {
    if (onlineStatusFilter === 'all') return true;
    if (onlineStatusFilter === 'pending') return order.status === 'pending';
    if (onlineStatusFilter === 'processing') return ['processing', 'preparing', 'ready', 'shipped', 'in_transit', 'confirmed'].includes(order.status);
    if (onlineStatusFilter === 'delivered') return ['delivered', 'completed'].includes(order.status);
    return true;
  });
  const selectedOrders = visibleOnlineFiltered.filter(o => selectedIds.has(o.id));

  // Statistics - Ventes en ligne (sur la période sélectionnée, hors remboursées)
  const totalOnlineOrders = onlineVisible.length;
  const pendingOnlineOrders = onlineVisible.filter(o => o.status === 'pending').length;
  const processingOnlineOrders = onlineVisible.filter(o =>
    ['processing', 'preparing', 'ready', 'shipped', 'in_transit', 'confirmed'].includes(o.status)
  ).length;
  const deliveredOnlineOrders = onlineVisible.filter(o =>
    ['delivered', 'completed'].includes(o.status)
  ).length;
  const _totalOnlineRevenue = onlineOrders
    .filter(o => o.payment_status === 'paid')
    .reduce((sum, o) => sum + o.total_amount, 0);

  if (loading) return <div className="p-4">{t('orderManagement.chargementDesCommandes')}</div>;

  return (
    <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as 'orders' | 'credit')} className="w-full">
      {/* Onglets principaux */}
      <TabsList className="grid w-full grid-cols-2 h-auto">
        <TabsTrigger value="orders" className="flex items-center gap-2 text-xs sm:text-sm py-2">
          <ShoppingCart className="w-4 h-4" />
          <span>{t('orderManagement.commandes')}</span>
        </TabsTrigger>
        <TabsTrigger value="credit" className="flex items-center gap-2 text-xs sm:text-sm py-2">
          <CreditCard className="w-4 h-4" />
          <span>{t('orderManagement.ventesACredit')}</span>
        </TabsTrigger>
      </TabsList>

      {/* Onglet Commandes */}
      <TabsContent value="orders" className="mt-6">
        <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Titre et actions - Mobile optimisé */}
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
        <div className="min-w-0">
          <h2 className="text-lg md:text-2xl font-bold truncate">{t('orderManagement.ventesCommandes')}</h2>
          <p className="text-xs md:text-sm text-muted-foreground truncate">{t('orderManagement.ventesPosEnBoutiqueEt')}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Button
            variant="outline"
            onClick={fetchOrders}
            disabled={isRefreshing}
            className="relative flex-shrink-0 h-9 px-3 text-xs md:text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
          <Button variant="outline" className="flex-shrink-0 h-9 px-3 text-xs md:text-sm" onClick={() => {
            toast({
              title: "Export en cours",
              description: t('orderManagement.lExportDesCommandesSera')
            });
          }}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Exporter</span>
          </Button>
          <Button variant="outline" className="flex-shrink-0 h-9 px-3 text-xs md:text-sm" onClick={() => {
            toast({
              title: t('orderManagement.rapportGenere'),
              description: t('orderManagement.leRapportDesCommandesSera')
            });
          }}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Rapport</span>
          </Button>
        </div>
      </div>

      {/* Boutons Ventes POS et En Ligne - Mobile optimisé */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {/* Bouton Ventes POS - Verrouillé si vendeur "online" uniquement */}
        <Card
          className={`border-2 transition-all ${
            canAccessPOS
              ? 'border-vendeur-secondary bg-vendeur-secondary/5 cursor-pointer hover:shadow-lg active:scale-[0.98]'
              : 'border-gray-300 bg-gray-100/50 cursor-not-allowed opacity-60'
          }`}
          onClick={() => {
            if (!canAccessPOS) {
              toast({
                title: t('orderManagement.accesRestreint'),
                description: t('orderManagement.leModulePosNEst'),
                variant: "destructive"
              });
              return;
            }
            setActiveView('pos');
            setTimeout(() => {
              document.querySelector('.pos-orders-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }}
        >
          <CardHeader className="p-3 md:p-6 pb-2 md:pb-4">
            <CardTitle className={`flex items-center gap-2 text-base md:text-lg ${canAccessPOS ? 'text-vendeur-secondary' : 'text-gray-500'}`}>
              {canAccessPOS ? '🛒' : <Lock className="w-4 h-4" />} Ventes POS
              {!canAccessPOS && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Non disponible
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
              {canAccessPOS ? 'Ventes par points de vente' : 'Réservé aux boutiques physiques'}
            </p>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div className="bg-white/80 rounded-lg p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Total ventes</p>
                <p className={`text-xl md:text-3xl font-bold ${canAccessPOS ? 'text-vendeur-secondary' : 'text-gray-400'}`}>
                  {orders.filter(o => o.source === 'pos').length}
                </p>
              </div>
              <div className="bg-white/80 rounded-lg p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Chiffre d'affaires</p>
                <p className={`text-sm md:text-xl font-bold truncate ${canAccessPOS ? 'text-vendeur-secondary' : 'text-gray-400'}`}>
                  {fmtAmount(orders
                    .filter(o => o.source === 'pos' && o.payment_status === 'paid')
                    .reduce((sum, o) => sum + o.total_amount, 0))}
                </p>
              </div>
            </div>
            <Button
              className={`w-full mt-3 md:mt-4 h-9 text-xs md:text-sm ${
                canAccessPOS
                  ? 'bg-vendeur-secondary hover:bg-vendeur-secondary/90'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={!canAccessPOS}
            >
              {canAccessPOS ? 'Voir les ventes POS' : 'POS verrouillé'}
            </Button>
          </CardContent>
        </Card>

        {/* Bouton Ventes En Ligne */}
        <Card
          className="border-2 border-blue-300 bg-blue-50/50 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]"
          onClick={() => {
            setActiveView('online');
            setTimeout(() => {
              document.querySelector('.online-orders-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }}
        >
          <CardHeader className="p-3 md:p-6 pb-2 md:pb-4">
            <CardTitle className="flex items-center gap-2 text-blue-700 text-base md:text-lg">
              📦 Commandes En Ligne
            </CardTitle>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
              Commandes clients à préparer et livrer
            </p>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div className="bg-white/80 rounded-lg p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Total</p>
                <p className="text-xl md:text-3xl font-bold text-blue-700">
                  {totalOnlineOrders}
                </p>
              </div>
              <div className="bg-white/80 rounded-lg p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">En cours</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600">
                  {orders.filter(o => o.source === 'online' && o.status === 'processing').length}
                </p>
              </div>
              <div className="bg-white/80 rounded-lg p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">En attente</p>
                <p className="text-lg md:text-2xl font-bold text-[#ff4000]">
                  {pendingOnlineOrders}
                </p>
              </div>
              <div className="bg-white/80 rounded-lg p-2 md:p-4">
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">{t('orderManagement.livrees')}</p>
                <p className="text-lg md:text-2xl font-bold text-[#ff4000]">
                  {deliveredOnlineOrders}
                </p>
              </div>
            </div>
            <Button className="w-full mt-3 md:mt-4 bg-blue-600 hover:bg-blue-700 h-9 text-xs md:text-sm">
              Voir les commandes
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filtres - Mobile optimisé */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:gap-4 md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('orderManagement.rechercher')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 border rounded-md text-sm flex-1 md:flex-none h-9"
              >
                <option value="all">{t('orderManagement.tousLesStatuts')}</option>
                <option value="pending">En attente</option>
                <option value="confirmed">{t('orderManagement.confirmees')}</option>
                <option value="processing">{t('orderManagement.enPreparation')}</option>
                <option value="shipped">{t('orderManagement.expediees')}</option>
                <option value="delivered">{t('orderManagement.livrees')}</option>
                <option value="cancelled">{t('orderManagement.annulees')}</option>
              </select>
              <Filter className="w-4 h-4 text-muted-foreground hidden md:block" />
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Tableau des Ventes POS */}
      {activeView === 'pos' ? (() => {
        // POS = électronique (orders source='pos') + CASH (pos_sales normalisées). Chemins
        // disjoints côté backend → union sans double-comptage, triée par date.
        // Les ventes REMBOURSÉES sont EXCLUES (elles disparaissent de jour/semaine/… → le vendeur
        // ne peut pas rembourser/restocker deux fois le même produit).
        const posOrders = [...orders.filter(o => o.source === 'pos'), ...posSales]
          .filter(o => o.payment_status !== 'refunded' && o.status !== 'cancelled')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const filterByPeriod = (list: typeof posOrders, period: string) => {
          if (period === 'day') return list.filter(o => new Date(o.created_at) >= startOfDay);
          if (period === 'week') return list.filter(o => new Date(o.created_at) >= startOfWeek);
          if (period === 'month') return list.filter(o => new Date(o.created_at) >= startOfMonth);
          if (period === 'year') return list.filter(o => new Date(o.created_at) >= startOfYear);
          return list;
        };

        const calcCA = (list: typeof posOrders) =>
          list.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total_amount, 0);

        const calcAvg = (list: typeof posOrders) => {
          const paid = list.filter(o => o.payment_status === 'paid');
          return paid.length > 0 ? Math.round(calcCA(list) / paid.length) : 0;
        };

        return (
        <Card className="border-2 border-vendeur-secondary/30 bg-vendeur-secondary/5 pos-orders-section">
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="flex items-center gap-2 text-vendeur-secondary text-base md:text-lg">
            🛒 Ventes POS ({posOrders.length})
          </CardTitle>
          <p className="text-xs md:text-sm text-muted-foreground">
            Commandes via points de vente
          </p>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
          {/* Filtres par période */}
          <Tabs defaultValue="all" className="mb-6">
            <TabsList className="grid grid-cols-5 w-full bg-muted/50">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-vendeur-secondary data-[state=active]:text-white">
                Tout
              </TabsTrigger>
              <TabsTrigger value="day" className="text-xs data-[state=active]:bg-vendeur-secondary data-[state=active]:text-white">
                Jour
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs data-[state=active]:bg-vendeur-secondary data-[state=active]:text-white">
                Semaine
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs data-[state=active]:bg-vendeur-secondary data-[state=active]:text-white">
                Mois
              </TabsTrigger>
              <TabsTrigger value="year" className="text-xs data-[state=active]:bg-vendeur-secondary data-[state=active]:text-white">
                Année
              </TabsTrigger>
            </TabsList>

            {['all', 'day', 'week', 'month', 'year'].map(period => {
              const filtered = filterByPeriod(posOrders, period);
              const ca = calcCA(filtered);
              const avg = calcAvg(filtered);
              const periodLabel = period === 'all' ? 'Total' : period === 'day' ? "Aujourd'hui" : period === 'week' ? 'Cette semaine' : period === 'month' ? 'Ce mois' : 'Cette année';

              return (
                <TabsContent key={period} value={period} className="mt-4 space-y-4">
                  {/* Statistiques par période */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-white/80 dark:bg-card">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[hsl(15,100%,50%)]/10 flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-[hsl(15,100%,50%)]" />
                          </div>
                          <div>
                            <p className="text-[10px] md:text-xs text-muted-foreground">{periodLabel}</p>
                            <p className="text-lg md:text-xl font-bold">{filtered.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/80 dark:bg-card">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[hsl(15,100%,50%)]/10 flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-[hsl(15,100%,50%)]" />
                          </div>
                          <div>
                            <p className="text-[10px] md:text-xs text-muted-foreground">CA {periodLabel}</p>
                            <p className="text-sm md:text-lg font-bold truncate">{fmtAmount(ca)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/80 dark:bg-card">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[hsl(220,96%,32%)]/10 flex items-center justify-center">
                            <Banknote className="w-4 h-4 text-[hsl(220,96%,32%)]" />
                          </div>
                          <div>
                            <p className="text-[10px] md:text-xs text-muted-foreground">Panier moyen</p>
                            <p className="text-sm md:text-lg font-bold truncate">{fmtAmount(avg)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/80 dark:bg-card">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#ff4000]/10 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                          </div>
                          <div>
                            <p className="text-[10px] md:text-xs text-muted-foreground">{t('orderManagement.payees')}</p>
                            <p className="text-lg md:text-xl font-bold">{filtered.filter(o => o.payment_status === 'paid').length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Liste des ventes */}
                  <div className="space-y-4">
                    {filtered.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Aucune vente POS {period !== 'all' ? `pour ${periodLabel.toLowerCase()}` : 'pour le moment'}</p>
                      </div>
                    ) : (
                      filtered.map((order) => (
                <div key={order.id} className="border-2 border-[hsl(15,100%,50%)]/20 rounded-lg p-3 sm:p-6 bg-white hover:shadow-lg transition-all">
                  {/* Mobile-first header layout */}
                  <div className="space-y-3 mb-4">
                    {/* Order number and ID */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-base sm:text-xl text-[hsl(15,100%,50%)] break-all">{order.order_number}</h3>
                      <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                        ID: {order.id.slice(0, 8)}
                      </Badge>
                    </div>

                    {/* Badges - wrap on mobile */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <Badge className="bg-[hsl(15,100%,50%)] text-white text-[10px] sm:text-xs shrink-0">
                        🛒 Vente POS
                      </Badge>
                      <Badge className={`${statusColors[order.status]} text-[10px] sm:text-xs shrink-0`}>
                        {t(statusLabelKeys[order.status] || '')}
                      </Badge>
                      <Badge className={`${paymentStatusColors[order.payment_status]} text-[10px] sm:text-xs shrink-0`}>
                        {t(paymentStatusLabelKeys[order.payment_status] || '')}
                      </Badge>
                    </div>
                  </div>

                  {/* Informations Client - responsive */}
                  <div className="bg-muted/50 rounded-lg p-3 sm:p-4 mb-4 space-y-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-primary mb-2 flex items-center gap-2">
                      <User className="w-3 h-3 sm:w-4 sm:h-4" />
                      Informations Client
                    </h4>
                    <div className="space-y-2 text-xs sm:text-sm">
                      <div>
                        <span className="text-muted-foreground">Nom:</span>
                        <span className="ml-2 font-semibold break-all">
                          {order.customers?.profiles?.full_name
                            || `${order.customers?.profiles?.first_name || ''} ${order.customers?.profiles?.last_name || ''}`.trim()
                            || 'Client'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('orderManagement.idClient')}</span>
                        <span className="ml-2 font-mono text-[10px] sm:text-xs font-semibold bg-muted px-1.5 py-0.5 rounded">
                          {order.customers?.profiles?.public_id || 'Non attribué'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('orderManagement.telephone')}</span>
                        <span className="ml-2 font-semibold">
                          {order.customers?.profiles?.phone || 'Non renseigné'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <span className="ml-2 font-semibold break-all">
                          {order.customers?.profiles?.email || 'Non renseigné'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Date de vente */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-3">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Vendu le {new Date(order.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Articles vendus</p>
                      <div className="space-y-2">
                        {order.order_items?.map((item) => (
                          <div key={item.id} className="flex items-center justify-between bg-muted/30 p-2 rounded">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{item.products?.name || 'Produit'}</p>
                              <p className="text-xs text-muted-foreground">
                                SKU: {item.products?.sku || 'N/A'} |
                                Stock: {item.products?.stock_quantity !== undefined ? item.products.stock_quantity : 'N/A'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">x{item.quantity}</p>
                              <p className="text-xs text-muted-foreground">{fmtAmount(item.unit_price, order.currency)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('orderManagement.montantTotal')}</p>
                      <p className="text-xl font-bold text-[hsl(15,100%,50%)]">
                        {fmtAmount(order.total_amount, order.currency)}
                      </p>
                      {order.discount_amount > 0 && (
                        <p className="text-sm text-[#ff4000]">
                          Remise: -{fmtAmount(order.discount_amount, order.currency)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('orderManagement.methodeDePaiement')}</p>
                      <div className="text-sm text-muted-foreground">
                        <CreditCard className="w-4 h-4 inline mr-1" />
                        {getPaymentMethodLabel(order, t)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {getPOSOrderActions(order)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                        setShowOrderDialog(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Détails
                    </Button>
                  </div>
                </div>
              ))
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
        );
      })() : null}


      {/* Section des Commandes En Ligne */}
      {activeView === 'online' && (
        <Card className="border-2 border-blue-200 bg-blue-50/30 online-orders-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            📦 Commandes En Ligne ({onlineVisible.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Commandes à préparer et livrer aux clients
          </p>
        </CardHeader>
        <CardContent>
          {/* Filtre par période (jour/semaine/mois/année) */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {([
              ['all', 'Tout'], ['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année'],
            ] as const).map(([val, label]) => (
              <Button
                key={val}
                size="sm"
                variant={onlinePeriod === val ? 'default' : 'outline'}
                className="h-8 px-3 text-xs"
                onClick={() => setOnlinePeriod(val)}
              >
                {label}
              </Button>
            ))}
          </div>
          {/* Statistiques Commandes En Ligne */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card
              className={`bg-white/80 cursor-pointer transition-all hover:shadow-md ${onlineStatusFilter === 'all' ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setOnlineStatusFilter('all')}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">{t('orderManagement.totalCommandes')}</p>
                <p className="text-3xl font-bold text-blue-700">
                  {totalOnlineOrders}
                </p>
              </CardContent>
            </Card>
            <Card
              className={`bg-white/80 cursor-pointer transition-all hover:shadow-md ${onlineStatusFilter === 'pending' ? 'ring-2 ring-[#ff4000]' : ''}`}
              onClick={() => setOnlineStatusFilter('pending')}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">En attente</p>
                <p className="text-2xl font-bold text-[#ff4000]">
                  {pendingOnlineOrders}
                </p>
              </CardContent>
            </Card>
            <Card
              className={`bg-white/80 cursor-pointer transition-all hover:shadow-md ${onlineStatusFilter === 'processing' ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setOnlineStatusFilter('processing')}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">En cours</p>
                <p className="text-2xl font-bold text-blue-600">
                  {processingOnlineOrders}
                </p>
              </CardContent>
            </Card>
            <Card
              className={`bg-white/80 cursor-pointer transition-all hover:shadow-md ${onlineStatusFilter === 'delivered' ? 'ring-2 ring-[#ff4000]' : ''}`}
              onClick={() => setOnlineStatusFilter('delivered')}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">{t('orderManagement.livrees')}</p>
                <p className="text-2xl font-bold text-[#ff4000]">
                  {deliveredOnlineOrders}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* PARTIE 3.3 — compteur de nouvelles commandes (realtime) */}
          {newOrderCount > 0 && (
            <div className="flex items-center justify-between gap-2 mb-3 p-2 rounded-lg bg-blue-100 border border-blue-300">
              <span className="text-sm font-semibold text-blue-800">
                🔔 Nouvelles : {newOrderCount}
              </span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNewOrderCount(0)}>
                Marquer comme vues
              </Button>
            </div>
          )}

          {/* PARTIE 3.1 + 3.2 — sélection multiple + actions groupées */}
          {visibleOnlineFiltered.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => selectAll(visibleOnlineFiltered.map(o => o.id))}
              >
                {selectedIds.size === visibleOnlineFiltered.length && visibleOnlineFiltered.length > 0
                  ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Button>
              {selectedIds.size > 0 && (
                <>
                  <Badge className="bg-blue-600 text-white">{selectedIds.size} sélectionnée(s)</Badge>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => bulkUpdateStatus('ready')}>
                    <Package className="w-3.5 h-3.5 mr-1" /> Marquer prêt
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => bulkUpdateStatus('shipped')}>
                    <Truck className="w-3.5 h-3.5 mr-1" /> Marquer expédié
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => printShippingLabels(selectedOrders)}>
                    <Printer className="w-3.5 h-3.5 mr-1" /> Imprimer les bordereaux
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Liste des Commandes En Ligne (période + statut, hors remboursées) */}
          <div className="space-y-4">
            {onlineVisible.filter(order => {
              if (onlineStatusFilter === 'all') return true;
              if (onlineStatusFilter === 'pending') return order.status === 'pending';
              if (onlineStatusFilter === 'processing') return ['processing', 'preparing', 'ready', 'shipped', 'in_transit', 'confirmed'].includes(order.status);
              if (onlineStatusFilter === 'delivered') return ['delivered', 'completed'].includes(order.status);
              return true;
            }).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>
                  {onlineStatusFilter === 'all'
                    ? 'Aucune commande en ligne pour le moment'
                    : `Aucune commande ${onlineStatusFilter === 'pending' ? 'en attente' : onlineStatusFilter === 'processing' ? 'en cours' : 'livrée'}`
                  }
                </p>
              </div>
            ) : (
              onlineVisible.filter(order => {
                if (onlineStatusFilter === 'all') return true;
                if (onlineStatusFilter === 'pending') return order.status === 'pending';
                if (onlineStatusFilter === 'processing') return ['processing', 'preparing', 'ready', 'shipped', 'in_transit', 'confirmed'].includes(order.status);
                if (onlineStatusFilter === 'delivered') return ['delivered', 'completed'].includes(order.status);
                return true;
              }).map((order) => (
                <div key={order.id} id={`order-${order.id}`} className={`border-2 rounded-lg p-3 sm:p-6 bg-white hover:shadow-lg transition-all ${highlightedOrderId === order.id ? 'border-primary ring-2 ring-primary ring-offset-2 shadow-lg' : 'border-blue-200'}`}>
                  {/* Mobile-first header layout */}
                  <div className="space-y-3 mb-4">
                    {/* Order number and ID */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* PARTIE 3.1 — case de sélection pour le traitement par lot */}
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                        checked={selectedIds.has(order.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(order.id)}
                        aria-label={`Sélectionner ${order.order_number}`}
                      />
                      <h3 className="font-bold text-base sm:text-xl text-blue-700 break-all">{order.order_number}</h3>
                      <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                        ID: {order.id.slice(0, 8)}
                      </Badge>
                    </div>

                    {/* Badges - wrap on mobile */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <Badge className="bg-blue-500 text-white text-[10px] sm:text-xs shrink-0">
                        📦 Commande En Ligne
                      </Badge>
                      <Badge className={`${statusColors[order.status]} text-[10px] sm:text-xs shrink-0`}>
                        {t(statusLabelKeys[order.status] || '')}
                      </Badge>
                      <Badge className={`${paymentStatusColors[order.payment_status]} text-[10px] sm:text-xs shrink-0`}>
                        {t(paymentStatusLabelKeys[order.payment_status] || '')}
                      </Badge>
                      {order.escrow && (
                        <Badge className={`text-[10px] sm:text-xs shrink-0 ${
                          order.escrow.status === 'pending' || order.escrow.status === 'held'
                            ? 'bg-orange-100 text-orange-800 border-orange-300 border-2' :
                          order.escrow.status === 'released'
                            ? 'bg-orange-100 text-[#ff4000] border-orange-300 border-2' :
                          order.escrow.status === 'refunded'
                            ? 'bg-gray-100 text-gray-800' :
                          'bg-orange-100 text-[#ff4000]'
                        }`}>
                          <Shield className="w-3 h-3 mr-1" />
                          {(order.escrow.status === 'pending' || order.escrow.status === 'held') && '🔒 Escrow'}
                          {order.escrow.status === 'released' && '✅ Reçu'}
                          {order.escrow.status === 'refunded' && '↩️ Remboursé'}
                          {order.escrow.status === 'dispute' && '⚠️ Litige'}
                        </Badge>
                      )}
                      {/* Badge Paiement à la livraison */}
                      {isCashOnDeliveryOrder(order) && (
                        <Badge className="bg-orange-100 text-[#ff4000] border-orange-300 border-2 text-[10px] sm:text-xs shrink-0">
                          💵 Paiement à la livraison
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Informations Client - responsive */}
                  {order.customers && (
                    <div className="bg-muted/50 rounded-lg p-3 sm:p-4 mb-4 space-y-2">
                      <h4 className="font-semibold text-xs sm:text-sm text-primary mb-2 flex items-center gap-2">
                        <User className="w-3 h-3 sm:w-4 sm:h-4" />
                        Informations Client
                      </h4>
                      <div className="space-y-2 text-xs sm:text-sm">
                        <div>
                          <span className="text-muted-foreground">Nom:</span>
                          <span className="ml-2 font-semibold break-all">
                            {order.customers?.profiles?.full_name
                              || `${order.customers?.profiles?.first_name || ''} ${order.customers?.profiles?.last_name || ''}`.trim()
                              || 'Client'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('orderManagement.idClient')}</span>
                          <span className="ml-2 font-mono text-[10px] sm:text-xs font-semibold bg-muted px-1.5 py-0.5 rounded">
                            {order.customers?.profiles?.public_id || 'Non attribué'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('orderManagement.telephone2')}</span>
                          <span className="ml-2 font-semibold">
                            {order.customers?.profiles?.phone || 'Non renseigné'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <span className="ml-2 font-semibold break-all">
                            {order.customers?.profiles?.email || 'Non renseigné'}
                          </span>
                        </div>
                      </div>
                      {/* Adresse de livraison géolocalisée + numéro COD */}
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-muted-foreground text-xs">{t('orderManagement.adresseDeLivraison')}</span>
                            <p className="font-medium text-sm mt-1">
                              {[
                                (order.shipping_address as any)?.address || (order.shipping_address as any)?.address_line,
                                (order.shipping_address as any)?.neighborhood,
                                (order.shipping_address as any)?.landmark,
                                (order.shipping_address as any)?.city,
                                (order.shipping_address as any)?.country
                              ].filter(Boolean).join(', ') || 'Non disponible'}
                            </p>
                          </div>
                        </div>
                        {(order.shipping_address as any)?.is_cod === true && (order.shipping_address as any)?.cod_phone && (
                          <p className="text-sm font-bold text-primary mt-1 ml-6">
                            📞 Numéro à contacter: {(order.shipping_address as any).cod_phone}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Date de commande */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-3">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Commandé le {new Date(order.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">{t('orderManagement.articlesCommandes')}</p>
                      <div className="space-y-2">
                        {order.order_items?.map((item) => (
                          <div key={item.id} className="flex items-center justify-between bg-muted/30 p-2 rounded">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{item.products?.name || 'Produit'}</p>
                              <p className="text-xs text-muted-foreground">
                                SKU: {item.products?.sku || 'N/A'} |
                                Stock: {item.products?.stock_quantity !== undefined ? item.products.stock_quantity : 'N/A'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">x{item.quantity}</p>
                              <p className="text-xs text-muted-foreground">{fmtAmount(item.unit_price, order.currency)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('orderManagement.montantTotal')}</p>
                      <p className="text-xl font-bold text-blue-700">
                        {fmtAmount(order.total_amount, order.currency)}
                      </p>
                      {order.discount_amount > 0 && (
                        <p className="text-sm text-[#ff4000]">
                          Remise: -{fmtAmount(order.discount_amount, order.currency)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('orderManagement.methodeDePaiement')}</p>
                      <div className="text-sm text-muted-foreground">
                        <CreditCard className="w-4 h-4 inline mr-1" />
                        {getPaymentMethodLabel(order, t)}
                      </div>
                    </div>
                  </div>

                  {/* Escrow workflow info */}
                  {order.escrow && (
                    <div className={`p-3 rounded-lg border mb-4 ${
                      order.escrow.status === 'pending' || order.escrow.status === 'held'
                        ? 'bg-blue-50 border-blue-200'
                        : order.escrow.status === 'released'
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <Shield className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          order.escrow.status === 'pending' || order.escrow.status === 'held'
                            ? 'text-blue-600'
                            : order.escrow.status === 'released'
                            ? 'text-[#ff4000]'
                            : 'text-gray-600'
                        }`} />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            order.escrow.status === 'pending' || order.escrow.status === 'held'
                              ? 'text-blue-800'
                              : order.escrow.status === 'released'
                              ? 'text-[#ff4000]'
                              : 'text-gray-800'
                          }`}>
                            {(order.escrow.status === 'pending' || order.escrow.status === 'held') && (
                              <>🔒 Fonds sécurisés - {fmtAmount(order.escrow.amount, order.currency)}</>
                            )}
                            {order.escrow.status === 'released' && (
                              <>✅ Paiement libéré ! Vous avez reçu {fmtAmount(order.escrow.amount, order.currency)}</>
                            )}
                            {order.escrow.status === 'refunded' && '↩️ Commande remboursée au client'}
                          </p>
                          <p className={`text-xs mt-1 ${
                            order.escrow.status === 'pending' || order.escrow.status === 'held'
                              ? 'text-blue-700'
                              : order.escrow.status === 'released'
                              ? 'text-[#ff4000]'
                              : 'text-gray-700'
                          }`}>
                            {(order.escrow.status === 'pending' || order.escrow.status === 'held') && (
                              order.status === 'in_transit'
                                ? "⏳ En attente de confirmation de livraison par le client"
                                : order.status === 'delivered'
                                ? "📦 Commande livrée - le client doit confirmer la réception"
                                : "Continuez le processus: Confirmer → Préparer → Expédier → Client confirme"
                            )}
                            {order.escrow.status === 'released' && 'Le client a confirmé la réception de sa commande'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {getOrderStatusActions(order)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                        setShowOrderDialog(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Détails
                    </Button>
                    {/* PARTIE 1.4 — joindre une preuve de livraison (photo + vidéo) */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setProofOrder(order); setProofPhoto(null); setProofVideo(null); }}
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      Preuve
                    </Button>
                    {/* PARTIE 3.2 — bordereau d'expédition (unitaire) */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); printShippingLabels([order]); }}
                    >
                      <Printer className="w-4 h-4 mr-1" />
                      Bordereau
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      )}


      {/* PARTIE 1.4 — Modale d'ajout de preuve de livraison (photo obligatoire + vidéo courte) */}
      <Dialog open={!!proofOrder} onOpenChange={(open) => { if (!open && !proofUploading) { setProofOrder(null); setProofPhoto(null); setProofVideo(null); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5" /> Preuve de livraison</DialogTitle>
            <DialogDescription>
              Photo du colis (obligatoire) + courte vidéo (~15-20s, optionnelle). Le client pourra les consulter ; elles sont supprimées 7 jours après sa confirmation de réception.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="proof-photo">Photo du colis *</Label>
              <Input id="proof-photo" type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setProofPhoto(e.target.files?.[0] || null)} />
              {proofPhoto && <p className="text-xs text-muted-foreground">📷 {proofPhoto.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proof-video">Vidéo courte (optionnelle)</Label>
              <Input id="proof-video" type="file" accept="video/mp4,video/quicktime,video/webm"
                onChange={(e) => setProofVideo(e.target.files?.[0] || null)} />
              {proofVideo && <p className="text-xs text-muted-foreground">🎬 {proofVideo.name}</p>}
            </div>
            {proofOrder && <p className="text-xs text-muted-foreground">Commande {proofOrder.order_number}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={proofUploading} onClick={() => { setProofOrder(null); setProofPhoto(null); setProofVideo(null); }}>
              Annuler
            </Button>
            <Button disabled={!proofPhoto || proofUploading} onClick={submitDeliveryProof}>
              {proofUploading ? 'Envoi…' : 'Enregistrer la preuve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deliveryDialogOrder} onOpenChange={(open) => !open && setDeliveryDialogOrder(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('orderManagement.definirLeDelaiDeLivraison')}</DialogTitle>
            <DialogDescription>
              Ce délai démarre dès la confirmation vendeur. Si le client ne confirme pas la réception 72h après cette date, le système libérera automatiquement l'escrow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="estimated-delivery-days">{t('orderManagement.nombreDeJours')}</Label>
            <Input
              id="estimated-delivery-days"
              type="number"
              min={1}
              max={60}
              value={estimatedDeliveryDays}
              onChange={(event) => setEstimatedDeliveryDays(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void confirmOrderWithDeliveryDelay();
                }
              }}
            />
            {deliveryDialogOrder && (
              <p className="text-xs text-muted-foreground">
                Commande {deliveryDialogOrder.order_number}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialogOrder(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => void confirmOrderWithDeliveryDelay()}
              disabled={deliveryDialogOrder ? updatingOrderId === deliveryDialogOrder.id : false}
              className="bg-[#ff4000] hover:bg-[#ff4000] text-white"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog des détails de commande */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la commande {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Informations générales */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">{t('orderManagement.informationsCommande')}</h4>
                  <div className="space-y-2 text-sm">
                    <div>{t('orders.statusLabel')} <Badge className={statusColors[selectedOrder.status]}>{t(statusLabelKeys[selectedOrder.status] || '')}</Badge></div>
                    <div>{t('orderManagement.paiement')} <Badge className={paymentStatusColors[selectedOrder.payment_status]}>{t(paymentStatusLabelKeys[selectedOrder.payment_status] || '')}</Badge></div>
                    <div>Date: {new Date(selectedOrder.created_at).toLocaleDateString('fr-FR')}</div>
                    <div>{t('orders.paymentMethodLabel')} {getPaymentMethodLabel(selectedOrder, t)}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Montants</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Sous-total:</span>
                      <span>{fmtAmount(selectedOrder.subtotal, selectedOrder.currency)}</span>
                    </div>
                    {selectedOrder.tax_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Taxes:</span>
                        <span>{fmtAmount(selectedOrder.tax_amount, selectedOrder.currency)}</span>
                      </div>
                    )}
                    {selectedOrder.shipping_amount > 0 && (
                      <div className="flex justify-between">
                        <span>{t('orderManagement.livraison')}</span>
                        <span>{fmtAmount(selectedOrder.shipping_amount, selectedOrder.currency)}</span>
                      </div>
                    )}
                    {selectedOrder.discount_amount > 0 && (
                      <div className="flex justify-between text-[#ff4000]">
                        <span>Remise:</span>
                        <span>-{fmtAmount(selectedOrder.discount_amount, selectedOrder.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>{fmtAmount(selectedOrder.total_amount, selectedOrder.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Articles commandés */}
              <div>
                <h4 className="font-semibold mb-4">{t('orderManagement.articlesCommandes')}</h4>
                <div className="space-y-2">
                  {selectedOrder.order_items?.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b">
                      <div>
                        <span className="font-medium">{item.products.name}</span>
                      </div>
                      <div className="text-right">
                        <div>{item.quantity} x {fmtAmount(item.unit_price, selectedOrder.currency)}</div>
                        <div className="font-semibold">{fmtAmount(item.total_price, selectedOrder.currency)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Litige (visible si le client a demandé un remboursement) — le vendeur donne sa version */}
              <OrderDisputeThread orderId={selectedOrder.id} currentParty="vendor" />

              {/* Adresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">{t('orderManagement.adresseDeLivraison2')}</h4>
                  <div className="text-sm text-muted-foreground">
                    {selectedOrder.shipping_address ? (
                      <div>
                        {((selectedOrder.shipping_address as any)?.street || (selectedOrder.shipping_address as any)?.address_line) && <div>{(selectedOrder.shipping_address as any).street || (selectedOrder.shipping_address as any).address_line}</div>}
                        {(selectedOrder.shipping_address as Address)?.city && <div>{(selectedOrder.shipping_address as Address).city}</div>}
                        {(selectedOrder.shipping_address as Address)?.postal_code && <div>{(selectedOrder.shipping_address as Address).postal_code}</div>}
                        {(selectedOrder.shipping_address as Address)?.country && <div>{(selectedOrder.shipping_address as Address).country}</div>}
                      </div>
                    ) : (
                      <span>{t('orderManagement.nonSpecifiee')}</span>
                    )}
                  </div>
                </div>
                {selectedOrder.billing_address && (
                  <div>
                    <h4 className="font-semibold mb-2">{t('orderManagement.adresseDeFacturation')}</h4>
                    <div className="text-sm text-muted-foreground">
                      {(selectedOrder.billing_address as Address)?.street && <div>{(selectedOrder.billing_address as Address).street}</div>}
                      {(selectedOrder.billing_address as Address)?.city && <div>{(selectedOrder.billing_address as Address).city}</div>}
                      {(selectedOrder.billing_address as Address)?.postal_code && <div>{(selectedOrder.billing_address as Address).postal_code}</div>}
                      {(selectedOrder.billing_address as Address)?.country && <div>{(selectedOrder.billing_address as Address).country}</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Bouton Étiquette Colis */}
              <div className="border-t pt-4">
                <Button
                  onClick={() => {
                    const addr = selectedOrder.shipping_address as any;
                    const profile = selectedOrder.customers?.profiles;
                    const customerName = profile?.full_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Client';
                    const customerEmail = profile?.email || '';
                    const customerPhone = profile?.phone || '';
                    const codPhone = addr?.cod_phone || selectedOrder.metadata?.cod_phone || '';
                    const isCOD = isCashOnDeliveryOrder(selectedOrder);

                    const labelHTML = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Étiquette Colis - ${selectedOrder.order_number}</title>
<style>
  @page { size: 100mm 150mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; width: 100mm; min-height: 150mm; padding: 5mm; background: #fff; }
  .label { border: 2.5px solid #111; border-radius: 4mm; padding: 5mm; height: 140mm; display: flex; flex-direction: column; }
  .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 4mm; margin-bottom: 4mm; }
  .header h1 { font-size: 14pt; text-transform: uppercase; letter-spacing: 2px; color: #111; }
  .header .order-num { font-size: 11pt; color: #555; margin-top: 2mm; font-weight: 600; }
  .section { margin-bottom: 3mm; }
  .section-title { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; color: #888; font-weight: 700; margin-bottom: 1.5mm; }
  .field { font-size: 11pt; font-weight: 600; color: #111; padding: 1.5mm 0; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 2mm; }
  .field .icon { font-size: 9pt; color: #666; min-width: 12mm; }
  .field .value { flex: 1; }
  .cod-badge { background: #ff4000; color: #fff; font-size: 8pt; font-weight: 800; text-transform: uppercase; padding: 2mm 4mm; border-radius: 2mm; text-align: center; margin-top: 3mm; letter-spacing: 1px; }
  .cod-phone { background: #fff4ee; border: 1.5px solid #ff4000; border-radius: 2mm; padding: 2mm 3mm; margin-top: 2mm; }
  .cod-phone .value { color: #ff4000; font-weight: 800; font-size: 12pt; }
  .footer { margin-top: auto; text-align: center; border-top: 2px dashed #333; padding-top: 3mm; }
  .footer .date { font-size: 8pt; color: #888; }
  .address-block { background: #f8f8f8; border-radius: 2mm; padding: 2.5mm 3mm; margin-top: 2mm; }
  .address-line { font-size: 10pt; color: #333; line-height: 1.5; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="label">
  <div class="header">
    <h1>{t('orderManagement.etiquetteColis')}</h1>
    <div class="order-num">${selectedOrder.order_number}</div>
  </div>

  <div class="section">
    <div class="section-title">Destinataire</div>
    <div class="field"><span class="icon">👤</span><span class="value">${customerName}</span></div>
    ${customerEmail ? `<div class="field"><span class="icon">✉️</span><span class="value">${customerEmail}</span></div>` : ''}
    ${customerPhone ? `<div class="field"><span class="icon">📞</span><span class="value">${customerPhone}</span></div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Articles</div>
    ${(selectedOrder.order_items || []).map((item: any) => `<div class="field"><span class="icon">📦</span><span class="value">${item.products?.name || 'Produit'} × ${item.quantity}</span></div>`).join('')}
  </div>

  ${addr ? `
  <div class="section">
    <div class="section-title">{t('orderManagement.adresseDeLivraison2')}</div>
    <div class="address-block">
      ${addr.street || addr.address_line ? `<div class="address-line">${addr.street || addr.address_line}</div>` : ''}
      <div class="address-line">${addr.city || ''}${addr.postal_code ? ', ' + addr.postal_code : ''}</div>
      ${addr.country ? `<div class="address-line">${addr.country}</div>` : ''}
    </div>
  </div>` : ''}

  ${isCOD ? `
  <div class="section">
    <div class="cod-badge">{t('orderManagement.paiementALaLivraisonCod')}</div>
    ${codPhone ? `
    <div class="cod-phone field">
      <span class="icon">📱</span>
      <span class="value">${codPhone}</span>
    </div>` : ''}
    <div class="field" style="font-size:12pt;font-weight:800;color:#ff4000;justify-content:center;border:none;margin-top:2mm;">
      Montant à collecter: ${fmtAmount(selectedOrder.total_amount, selectedOrder.currency)}
    </div>
  </div>` : ''}

  <div class="footer">
    <div class="date">Imprimé le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>
</div>
</body>
</html>`;

                    const blob = new Blob([labelHTML], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const printWindow = window.open(url, '_blank');
                    if (printWindow) {
                      printWindow.onload = () => {
                        printWindow.print();
                      };
                    }
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                  }}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-md"
                  size="lg"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Générer étiquette colis
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </div>
      </TabsContent>

      {/* Onglet Ventes à Crédit */}
      <TabsContent value="credit" className="mt-6">
        {vendorId ? <CreditSalesForm /> : <p>Chargement...</p>}
      </TabsContent>
    </Tabs>
  );
}

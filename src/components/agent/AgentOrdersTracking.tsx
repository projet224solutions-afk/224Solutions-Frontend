import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShoppingCart, Search, Package, Clock,
  CheckCircle, XCircle, Truck, User, MapPin,
  RefreshCw, Calendar, TrendingUp, AlertCircle,
  Filter, Shield, Banknote
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgentOrdersTrackingProps {
  agentId: string;
}

interface EscrowInfo {
  id: string;
  status: string;
  amount: number;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method?: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  shipping_address: any;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_public_id: string;
  items_count: number;
  vendor_name?: string;
  escrow?: EscrowInfo;
}

const orderSteps = [
  { key: 'pending', label: 'En attente', icon: Clock },
  { key: 'confirmed', label: 'Confirmée', icon: CheckCircle },
  { key: 'preparing', label: 'En préparation', icon: Package },
  { key: 'shipped', label: 'Expédiée', icon: Truck },
  { key: 'delivered', label: 'Livrée', icon: CheckCircle },
];

const statusColors: Record<string, string> = {
  pending: 'bg-orange-100 text-[#ff4000] border-orange-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  processing: 'bg-blue-100 text-[#04439e] border-blue-300',
  preparing: 'bg-blue-100 text-[#04439e] border-blue-300',
  ready: 'bg-blue-100 text-[#04439e] border-blue-300',
  shipped: 'bg-orange-100 text-orange-800 border-orange-300',
  in_transit: 'bg-orange-100 text-orange-800 border-orange-300',
  delivered: 'bg-orange-100 text-[#ff4000] border-orange-300',
  completed: 'bg-orange-100 text-[#ff4000] border-orange-300',
  cancelled: 'bg-orange-100 text-[#ff4000] border-orange-300'
};

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'En préparation',
  preparing: 'En préparation',
  ready: 'Prête',
  shipped: 'Expédiée',
  in_transit: 'En transit',
  delivered: 'Livrée',
  completed: 'Terminée',
  cancelled: 'Annulée'
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  confirmed: <CheckCircle className="w-4 h-4" />,
  processing: <Package className="w-4 h-4" />,
  preparing: <Package className="w-4 h-4" />,
  ready: <CheckCircle className="w-4 h-4" />,
  shipped: <Truck className="w-4 h-4" />,
  in_transit: <Truck className="w-4 h-4" />,
  delivered: <CheckCircle className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />
};

const escrowStatusColors: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800 border-blue-300',
  held: 'bg-orange-100 text-[#ff4000] border-orange-300',
  released: 'bg-orange-100 text-[#ff4000] border-orange-300',
  refunded: 'bg-orange-100 text-[#ff4000] border-orange-300',
  disputed: 'bg-orange-100 text-orange-800 border-orange-300'
};

const escrowStatusLabels: Record<string, string> = {
  pending: 'Fonds sécurisés',
  held: 'En attente',
  released: 'Fonds libérés',
  refunded: 'Remboursé',
  disputed: 'Litige'
};

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-orange-50 text-[#ff4000] border-orange-200',
  paid: 'bg-orange-50 text-[#ff4000] border-orange-200',
  failed: 'bg-orange-50 text-[#ff4000] border-orange-200',
  refunded: 'bg-gray-50 text-gray-700 border-gray-200'
};

const paymentStatusLabels: Record<string, string> = {
  pending: 'En attente',
  paid: 'Payé',
  failed: 'Échoué',
  refunded: 'Remboursé'
};

// Composant de suivi visuel des étapes
function OrderProgressTracker({ currentStatus }: { currentStatus: string }) {
  const { t } = useTranslation();
  const getStepIndex = (status: string) => {
    const statusMap: Record<string, number> = {
      pending: 0,
      confirmed: 1,
      processing: 2,
      preparing: 2,
      ready: 2,
      shipped: 3,
      in_transit: 3,
      delivered: 4,
      completed: 4,
      cancelled: -1
    };
    return statusMap[status] ?? 0;
  };

  const currentStep = getStepIndex(currentStatus);
  const isCancelled = currentStatus === 'cancelled';

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center p-4 bg-orange-50 rounded-xl border border-orange-200">
        <XCircle className="w-6 h-6 text-[#ff4000] mr-2" />
        <span className="font-medium text-[#ff4000]">{t('agentOrdersTracking.commandeAnnulee')}</span>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between relative">
        {/* Ligne de progression */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-slate-200 rounded-full mx-8" />
        <div
          className="absolute top-5 left-0 h-1 bg-[#04439e] rounded-full mx-8 transition-all duration-500"
          style={{ width: `calc(${(currentStep / (orderSteps.length - 1)) * 100}% - 4rem)` }}
        />

        {orderSteps.map((step, index) => {
          const isCompleted = index <= currentStep;
          const isCurrent = index === currentStep;
          const StepIcon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  isCompleted
                    ? "bg-[#04439e] text-white shadow-lg"
                    : "bg-slate-100 text-slate-400 border-2 border-slate-200",
                  isCurrent && "ring-4 ring-blue-100 scale-110"
                )}
              >
                <StepIcon className="w-5 h-5" />
              </div>
              <span
                className={cn(
                  "text-xs mt-2 font-medium text-center max-w-[70px]",
                  isCompleted ? "text-slate-800" : "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AgentOrdersTracking({ agentId }: AgentOrdersTrackingProps) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadOrders();

    // Écoute en temps réel
    const ordersChannel = supabase
      .channel('agent-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();

    const escrowChannel = supabase
      .channel('agent-escrow-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escrow_transactions' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(escrowChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      // 1. Récupérer les utilisateurs créés par cet agent
      const { data: createdUsers, error: usersError } = await supabase
        .from('agent_created_users')
        .select('user_id')
        .eq('agent_id', agentId);

      if (usersError) throw usersError;

      if (!createdUsers || createdUsers.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const userIds = createdUsers.map(u => u.user_id);

      // 2. Récupérer les customers liés à ces user_ids
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, user_id')
        .in('user_id', userIds);

      if (customersError) throw customersError;

      if (!customers || customers.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const customerIds = customers.map(c => c.id);
      const customerUserMap = new Map(customers.map(c => [c.id, c.user_id]));

      // 3. Récupérer les commandes de ces customers
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          payment_status,
          payment_method,
          total_amount,
          created_at,
          updated_at,
          shipping_address,
          customer_id,
          vendor_id,
          order_items(id)
        `)
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // 4. Récupérer les profils des utilisateurs
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, public_id')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // 5. Récupérer les noms des vendeurs
      const vendorIds = [...new Set(ordersData?.map(o => o.vendor_id).filter(Boolean))];
      let vendorNames: Record<string, string> = {};

      if (vendorIds.length > 0) {
        const { data: vendors } = await supabase
          .from('vendors')
          .select('id, business_name')
          .in('id', vendorIds);

        if (vendors) {
          vendorNames = Object.fromEntries(vendors.map(v => [v.id, v.business_name || 'Vendeur']));
        }
      }

      // 6. Récupérer les escrows pour toutes les commandes
      const orderIds = ordersData?.map(o => o.id) || [];
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

      // 7. Mapper les données
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const mappedOrders: Order[] = (ordersData || []).map(order => {
        const userId = customerUserMap.get(order.customer_id);
        const profile = userId ? profileMap.get(userId) : null;

        return {
          id: order.id,
          order_number: order.order_number || order.id.slice(0, 8).toUpperCase(),
          status: order.status,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          total_amount: order.total_amount,
          created_at: order.created_at,
          updated_at: order.updated_at,
          shipping_address: order.shipping_address,
          customer_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Client',
          customer_email: profile?.email || '',
          customer_phone: profile?.phone || '',
          customer_public_id: profile?.public_id || '',
          items_count: order.order_items?.length || 0,
          vendor_name: order.vendor_id ? vendorNames[order.vendor_id] : undefined,
          escrow: escrowMap[order.id]
        };
      });

      setOrders(mappedOrders);
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      toast.error(t('agentOrdersTracking.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const loadOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingDetails(true);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            quantity,
            unit_price,
            total_price,
            products(id, name, images, sku)
          )
        `)
        .eq('id', order.id)
        .single();

      if (error) throw error;
      setOrderDetails(data);
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      toast.error(t('agentOrdersTracking.erreurLorsDuChargementDes2'));
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_public_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => ['processing', 'preparing', 'confirmed', 'shipped', 'in_transit'].includes(o.status)).length,
    completed: orders.filter(o => ['delivered', 'completed'].includes(o.status)).length,
    escrowPending: orders.filter(o => o.escrow?.status === 'pending' || o.escrow?.status === 'held').length,
    totalRevenue: orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + o.total_amount, 0)
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'GNF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-md bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-500 rounded-xl">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#ff4000] font-medium">En attente</p>
                <p className="text-2xl font-bold text-[#ff4000]">{stats.pending}</p>
              </div>
              <div className="p-3 bg-[#ff4000] rounded-xl">
                <Clock className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#04439e] font-medium">En cours</p>
                <p className="text-2xl font-bold text-[#04439e]">{stats.processing}</p>
              </div>
              <div className="p-3 bg-[#04439e] rounded-xl">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#ff4000] font-medium">{t('agentOrdersTracking.livrees')}</p>
                <p className="text-2xl font-bold text-[#ff4000]">{stats.completed}</p>
              </div>
              <div className="p-3 bg-[#ff4000] rounded-xl">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#04439e] font-medium">Escrow actif</p>
                <p className="text-2xl font-bold text-[#04439e]">{stats.escrowPending}</p>
              </div>
              <div className="p-3 bg-[#04439e] rounded-xl">
                <Shield className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Card */}
      <Card className="border-0 shadow-lg bg-[#ff4000] text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">{t('agentOrdersTracking.revenusGeneresParMesUtilisateurs')}</p>
              <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-orange-200" />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50/50">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              Suivi des commandes de mes utilisateurs
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadOrders}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('agentOrdersTracking.rechercherParNCommandeClient')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agentOrdersTracking.tousLesStatuts')}</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="confirmed">{t('agentOrdersTracking.confirmee')}</SelectItem>
                <SelectItem value="preparing">{t('agentOrdersTracking.enPreparation')}</SelectItem>
                <SelectItem value="shipped">{t('agentOrdersTracking.expediee')}</SelectItem>
                <SelectItem value="in_transit">En transit</SelectItem>
                <SelectItem value="delivered">{t('agentOrdersTracking.livree')}</SelectItem>
                <SelectItem value="completed">{t('agentOrdersTracking.terminee')}</SelectItem>
                <SelectItem value="cancelled">{t('agentOrdersTracking.annulee')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">{t('agentOrdersTracking.aucuneCommandeTrouvee')}</p>
              <p className="text-sm">{t('agentOrdersTracking.lesCommandesDeVosUtilisateurs')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="overflow-hidden hover:shadow-md transition-all cursor-pointer border-l-4"
                    style={{
                      borderLeftColor: order.escrow?.status === 'pending' ? '#04439e' :
                                       order.escrow?.status === 'released' ? '#ff4000' :
                                       order.status === 'cancelled' ? '#ff4000' : '#e2e8f0'
                    }}
                    onClick={() => loadOrderDetails(order)}
                  >
                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-blue-50">
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">
                                #{order.order_number}
                              </span>
                              {order.vendor_name && (
                                <span className="text-xs text-slate-500">
                                  • {order.vendor_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                              <User className="w-3 h-3" />
                              <span>{order.customer_name}</span>
                              {order.customer_public_id && (
                                <Badge variant="secondary" className="text-xs font-mono">
                                  {order.customer_public_id}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-lg text-slate-900">
                            {formatCurrency(order.total_amount)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(order.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Tracker */}
                      <OrderProgressTracker currentStatus={order.status} />

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Badge variant="outline" className={cn("text-xs", statusColors[order.status])}>
                          {statusIcons[order.status]}
                          <span className="ml-1">{statusLabels[order.status] || order.status}</span>
                        </Badge>

                        <Badge variant="outline" className={cn("text-xs", paymentStatusColors[order.payment_status])}>
                          <Banknote className="w-3 h-3 mr-1" />
                          {paymentStatusLabels[order.payment_status] || order.payment_status}
                        </Badge>

                        {order.escrow && (
                          <Badge variant="outline" className={cn("text-xs", escrowStatusColors[order.escrow.status])}>
                            <Shield className="w-3 h-3 mr-1" />
                            {escrowStatusLabels[order.escrow.status] || order.escrow.status}
                          </Badge>
                        )}
                      </div>

                      {/* Escrow Info avec étapes claires */}
                      {order.escrow && (
                        <div className={cn(
                          "p-3 mt-4 rounded-lg border",
                          order.escrow.status === 'pending' || order.escrow.status === 'held'
                            ? "bg-blue-50 border-blue-200"
                            : order.escrow.status === 'released'
                            ? "bg-orange-50 border-orange-200"
                            : order.escrow.status === 'refunded'
                            ? "bg-orange-50 border-orange-200"
                            : "bg-gray-50 border-gray-200"
                        )}>
                          <div className="flex items-start gap-2">
                            <Shield className={cn(
                              "w-5 h-5 flex-shrink-0 mt-0.5",
                              order.escrow.status === 'pending' || order.escrow.status === 'held'
                                ? "text-blue-600"
                                : order.escrow.status === 'released'
                                ? "text-[#ff4000]"
                                : "text-gray-600"
                            )} />
                            <div className="flex-1">
                              <p className={cn(
                                "text-sm font-medium",
                                order.escrow.status === 'pending' || order.escrow.status === 'held'
                                  ? "text-blue-800"
                                  : order.escrow.status === 'released'
                                  ? "text-[#ff4000]"
                                  : "text-gray-800"
                              )}>
                                {order.escrow.status === 'pending' && "🔒 Fonds sécurisés - En attente de livraison"}
                                {order.escrow.status === 'held' && "🔒 Fonds bloqués - Le vendeur prépare la commande"}
                                {order.escrow.status === 'released' && "✅ Paiement libéré au vendeur"}
                                {order.escrow.status === 'refunded' && "↩️ Remboursement effectué"}
                              </p>
                              <p className={cn(
                                "text-xs mt-1",
                                order.escrow.status === 'pending' || order.escrow.status === 'held'
                                  ? "text-blue-700"
                                  : order.escrow.status === 'released'
                                  ? "text-[#ff4000]"
                                  : "text-gray-700"
                              )}>
                                {formatCurrency(order.escrow.amount)} •
                                {order.escrow.status === 'pending' || order.escrow.status === 'held'
                                  ? " Le client doit confirmer la réception pour libérer les fonds"
                                  : order.escrow.status === 'released'
                                  ? " Le client a confirmé la réception"
                                  : " Transaction terminée"
                                }
                              </p>
                            </div>
                          </div>

                          {/* Workflow info pour l'agent */}
                          {(order.escrow.status === 'pending' || order.escrow.status === 'held') && (
                            <div className="mt-3 p-2 bg-white/60 rounded-md">
                              <p className="text-xs text-slate-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Workflow: Vendeur confirme → Prépare → Expédie → Client confirme réception → Fonds libérés
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Détails de la commande #{selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-40" />
            </div>
          ) : orderDetails ? (
            <div className="space-y-6">
              {/* Progress Tracker in modal */}
              <OrderProgressTracker currentStatus={orderDetails.status} />

              {/* Status & Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500 mb-1">{t('agentOrdersTracking.statutCommande')}</p>
                  <Badge className={cn("text-sm", statusColors[orderDetails.status])}>
                    {statusIcons[orderDetails.status]}
                    <span className="ml-1">{statusLabels[orderDetails.status]}</span>
                  </Badge>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500 mb-1">{t('agentOrdersTracking.paiement')}</p>
                  <Badge className={cn("text-sm", paymentStatusColors[orderDetails.payment_status])}>
                    {paymentStatusLabels[orderDetails.payment_status]}
                  </Badge>
                </div>
              </div>

              {/* Escrow Status */}
              {selectedOrder?.escrow && (
                <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Protection Escrow
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge className={cn("text-sm", escrowStatusColors[selectedOrder.escrow.status])}>
                        {escrowStatusLabels[selectedOrder.escrow.status]}
                      </Badge>
                    </div>
                    <span className="font-bold text-blue-900">
                      {formatCurrency(selectedOrder.escrow.amount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div className="p-4 rounded-xl border">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Client (créé par vous)
                </h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Nom:</strong> {selectedOrder?.customer_name}</p>
                  <p><strong>Email:</strong> {selectedOrder?.customer_email || '-'}</p>
                  <p><strong>{t('agentOrdersTracking.telephone')}</strong> {selectedOrder?.customer_phone || '-'}</p>
                  {selectedOrder?.customer_public_id && (
                    <p><strong>ID:</strong> {selectedOrder.customer_public_id}</p>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              {orderDetails.shipping_address && (
                <div className="p-4 rounded-xl border">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#ff4000]" />
                    Adresse de livraison
                  </h4>
                  <p className="text-sm text-slate-600">
                    {typeof orderDetails.shipping_address === 'string'
                      ? orderDetails.shipping_address
                      : `${orderDetails.shipping_address.street || ''}, ${orderDetails.shipping_address.city || ''}, ${orderDetails.shipping_address.country || ''}`
                    }
                  </p>
                </div>
              )}

              {/* Order Items */}
              <div className="p-4 rounded-xl border">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#04439e]" />
                  Articles ({orderDetails.order_items?.length || 0})
                </h4>
                <div className="space-y-3">
                  {orderDetails.order_items?.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      {item.products?.images?.[0] && (
                        <img
                          src={item.products.images[0]}
                          alt={item.products.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{item.products?.name}</p>
                        <p className="text-sm text-slate-500">
                          {item.quantity} x {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(item.total_price)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="p-4 rounded-xl bg-[#04439e]/5 border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-slate-700">Total</span>
                  <span className="text-2xl font-bold text-blue-900">
                    {formatCurrency(orderDetails.total_amount)}
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Créée le {formatDate(orderDetails.created_at)}
                </span>
                <span>
                  Mise à jour le {formatDate(orderDetails.updated_at)}
                </span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

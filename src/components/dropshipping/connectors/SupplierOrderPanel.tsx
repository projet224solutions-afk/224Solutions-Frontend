/**
 * SUPPLIER ORDER PANEL
 * Panel de gestion des commandes fournisseurs dropshipping
 * Création automatique ou manuelle de commandes vers les fournisseurs
 *
 * @module SupplierOrderPanel
 * @version 1.0.0
 * @author 224Solutions
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Package,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  MessageSquare,
  Send,
  Loader2,
  RefreshCw,
  MapPin,
  Phone,
  User,
  Box,
  DollarSign,
  Calendar,
  FileText,
  Link2
} from 'lucide-react';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import { useConnectors } from '@/hooks/useConnectors';
import type { ConnectorType, OrderResult, TrackingInfo } from '@/services/connectors';

// ==================== INTERFACES ====================

export interface SupplierOrder {
  id: string;
  internalOrderId: string;
  customerName: string;
  supplierOrderId: string | null;
  connector: ConnectorType;
  productTitle: string;
  productThumbnail: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  currency: string;
  status: 'pending' | 'ordered' | 'shipped' | 'delivered' | 'cancelled' | 'error';
  tracking: TrackingInfo | null;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  notes: string | null;
  createdAt: string;
  orderedAt: string | null;
  updatedAt: string;
}

interface SupplierOrderPanelProps {
  vendorId: string;
  orders: SupplierOrder[];
  loading: boolean;
  onCreateOrder: (orderId: string) => Promise<OrderResult | null>;
  onRefreshTracking: (orderId: string) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onAddNote: (orderId: string, note: string) => Promise<void>;
}

// ==================== HELPER FUNCTIONS ====================

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return {
        icon: Clock,
        label: 'En attente',
        color: 'bg-orange-100 text-[#ff4000]',
        description: 'Commande à passer au fournisseur'
      };
    case 'ordered':
      return {
        icon: Package,
        label: 'Commandé',
        color: 'bg-blue-100 text-blue-800',
        description: 'En attente d\'expédition'
      };
    case 'shipped':
      return {
        icon: Truck,
        label: 'Expédié',
        color: 'bg-blue-100 text-[#04439e]',
        description: 'En cours de livraison'
      };
    case 'delivered':
      return {
        icon: CheckCircle,
        label: 'Livré',
        color: 'bg-orange-100 text-[#ff4000]',
        description: 'Commande livrée au client'
      };
    case 'cancelled':
      return {
        icon: XCircle,
        label: 'Annulé',
        color: 'bg-gray-100 text-gray-800',
        description: 'Commande annulée'
      };
    case 'error':
      return {
        icon: AlertTriangle,
        label: 'Erreur',
        color: 'bg-orange-100 text-[#ff4000]',
        description: 'Erreur lors de la commande'
      };
    default:
      return {
        icon: Clock,
        label: status,
        color: 'bg-gray-100 text-gray-800',
        description: ''
      };
  }
}

// ==================== SUB COMPONENTS ====================

function TrackingTimeline({ tracking }: { tracking: TrackingInfo }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="font-mono">
          {tracking.trackingNumber}
        </Badge>
        <Button variant="ghost" size="sm" asChild>
          <a href={tracking.trackingUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-1" />
            Suivre
          </a>
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>Transporteur: {tracking.carrier}</p>
        {tracking.estimatedDelivery && (
          <p>Livraison estimée: {formatDate(tracking.estimatedDelivery)}</p>
        )}
      </div>

      {tracking.events && tracking.events.length > 0 && (
        <div className="relative pl-4 border-l-2 border-muted space-y-3 mt-4">
          {tracking.events.slice(0, 5).map((event, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[21px] w-4 h-4 rounded-full bg-background border-2 border-primary" />
              <div>
                <p className="text-sm font-medium">{event.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(event.timestamp)}
                  {event.location && ` • ${event.location}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onCreateOrder,
  onRefreshTracking,
  onCancelOrder,
  onAddNote
}: {
  order: SupplierOrder;
  onCreateOrder: () => Promise<OrderResult | null | void>;
  onRefreshTracking: () => Promise<void>;
  onCancelOrder: () => Promise<void>;
  onAddNote: (note: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [noteDialog, setNoteDialog] = useState(false);
  const [note, setNote] = useState('');

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;

  const handleCreateOrder = async () => {
    setLoading(true);
    await onCreateOrder();
    setLoading(false);
  };

  const handleRefreshTracking = async () => {
    setLoading(true);
    await onRefreshTracking();
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (note.trim()) {
      await onAddNote(note);
      setNote('');
      setNoteDialog(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-muted overflow-hidden">
                <img
                  src={order.productThumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <CardTitle className="text-base line-clamp-1">
                  {order.productTitle}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span>Commande #{order.internalOrderId}</span>
                  <Badge variant="outline">{order.connector}</Badge>
                </CardDescription>
              </div>
            </div>

            <Badge className={statusConfig.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Infos commande */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Quantité</p>
              <p className="font-medium">{order.quantity} unité(s)</p>
            </div>
            <div>
              <p className="text-muted-foreground">Coût total</p>
              <p className="font-medium">{formatCurrency(order.totalCost, order.currency)}</p>
            </div>
          </div>

          {/* Adresse livraison */}
          <Accordion type="single" collapsible>
            <AccordionItem value="shipping">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Adresse de livraison
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm pl-6">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{order.shippingAddress.name}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(order.shippingAddress.name)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copier</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{order.shippingAddress.phone}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(order.shippingAddress.phone)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copier</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p>{order.shippingAddress.address}</p>
                      <p>{order.shippingAddress.city}, {order.shippingAddress.country}</p>
                      {order.shippingAddress.postalCode && (
                        <p>{order.shippingAddress.postalCode}</p>
                      )}
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(
                              `${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.country}`
                            )}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copier l'adresse</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Tracking */}
            {order.tracking && (
              <AccordionItem value="tracking">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Suivi expédition
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-6">
                    <TrackingTimeline tracking={order.tracking} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          {/* Numéro commande fournisseur */}
          {order.supplierOrderId && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Réf. fournisseur:</span>
              <code className="font-mono">{order.supplierOrderId}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-auto"
                onClick={() => copyToClipboard(order.supplierOrderId!)}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="text-sm bg-orange-50 rounded-lg p-2 border border-orange-200">
              <p className="text-[#ff4000]">{order.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {order.status === 'pending' && (
              <Button
                className="flex-1"
                onClick={handleCreateOrder}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Passer la commande
              </Button>
            )}

            {order.status === 'shipped' && (
              <Button
                variant="outline"
                onClick={handleRefreshTracking}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Actualiser
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => setNoteDialog(true)}
            >
              <MessageSquare className="w-4 h-4" />
            </Button>

            {['pending', 'ordered'].includes(order.status) && (
              <Button
                variant="outline"
                size="icon"
                className="text-[#ff4000] hover:text-[#ff4000]"
                onClick={onCancelOrder}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog ajout note */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une note</DialogTitle>
            <DialogDescription>
              Commande #{order.internalOrderId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Entrez votre note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddNote}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== MAIN COMPONENT ====================

export function SupplierOrderPanel({
  vendorId,
  orders,
  loading,
  onCreateOrder,
  onRefreshTracking,
  onCancelOrder,
  onAddNote
}: SupplierOrderPanelProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Filtrer les commandes
  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus);

  // Grouper par statut pour les stats
  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    error: orders.filter(o => o.status === 'error').length,
  };

  const totalPendingCost = orders
    .filter(o => o.status === 'pending')
    .reduce((sum, o) => sum + o.totalCost, 0);

  return (
    <div className="space-y-6">
      {/* En-tête avec stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterStatus('pending')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">À commander</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterStatus('ordered')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.ordered}</p>
                <p className="text-xs text-muted-foreground">Commandées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterStatus('shipped')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#04439e]" />
              <div>
                <p className="text-2xl font-bold">{stats.shipped}</p>
                <p className="text-xs text-muted-foreground">En transit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterStatus('delivered')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-2xl font-bold">{stats.delivered}</p>
                <p className="text-xs text-muted-foreground">Livrées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterStatus('error')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-2xl font-bold">{stats.error}</p>
                <p className="text-xs text-muted-foreground">Erreurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerte commandes en attente */}
      {stats.pending > 0 && (
        <Alert className="bg-orange-50 border-orange-200">
          <AlertTriangle className="w-4 h-4 text-[#ff4000]" />
          <AlertTitle className="text-[#ff4000]">
            {stats.pending} commande(s) en attente
          </AlertTitle>
          <AlertDescription className="text-[#ff4000]">
            Coût total estimé: {formatCurrency(totalPendingCost, 'USD')}.
            Passez ces commandes pour éviter les retards de livraison.
          </AlertDescription>
        </Alert>
      )}

      {/* Filtre */}
      <div className="flex items-center gap-4">
        <Label>Filtrer par statut:</Label>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes ({orders.length})</SelectItem>
            <SelectItem value="pending">En attente ({stats.pending})</SelectItem>
            <SelectItem value="ordered">Commandées ({stats.ordered})</SelectItem>
            <SelectItem value="shipped">En transit ({stats.shipped})</SelectItem>
            <SelectItem value="delivered">Livrées ({stats.delivered})</SelectItem>
            <SelectItem value="error">Erreurs ({stats.error})</SelectItem>
          </SelectContent>
        </Select>

        {filterStatus !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setFilterStatus('all')}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Liste des commandes */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Aucune commande</p>
            <p className="text-sm text-muted-foreground">
              {filterStatus === 'all'
                ? 'Les commandes dropshipping apparaîtront ici'
                : 'Aucune commande avec ce statut'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onCreateOrder={() => onCreateOrder(order.id)}
              onRefreshTracking={() => onRefreshTracking(order.id)}
              onCancelOrder={() => onCancelOrder(order.id)}
              onAddNote={(note) => onAddNote(order.id, note)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SupplierOrderPanel;

/**
 * Gestion des commandes Dropshipping
 * Suivi des commandes fournisseurs et statuts
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { backendFetch } from '@/services/backendApi';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ShoppingCart,
  Search,
  MoreVertical,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Package
} from 'lucide-react';
import type { DropshipOrder } from '@/types/dropshipping';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DropshipOrdersProps {
  orders: DropshipOrder[];
  loading: boolean;
  onUpdateStatus: (orderId: string, status: string, notes?: string) => Promise<boolean>;
}

export function DropshipOrders({ orders, loading, onUpdateStatus }: DropshipOrdersProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<DropshipOrder | null>(null);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [placingId, setPlacingId] = useState<string | null>(null);

  // Passe la commande chez le fournisseur via le BACKEND (clés API serveur ; réel si
  // configuré, sinon mock). Met à jour le statut → 'ordered_from_supplier'.
  const handlePlaceWithSupplier = async (order: DropshipOrder) => {
    setPlacingId(order.id);
    try {
      const res = await backendFetch<{ mock?: boolean }>(`/api/v2/dropship/order/${order.id}/place`, { method: 'POST', body: {} });
      if (res.success) {
        toast.success((res as any).mock
          ? 'Commande fournisseur placée (mode test — configurez les clés API pour le réel)'
          : 'Commande passée chez le fournisseur');
        await onUpdateStatus(order.id, 'ordered_from_supplier');
      } else {
        toast.error(res.error || 'Échec du placement chez le fournisseur');
      }
    } finally {
      setPlacingId(null);
    }
  };

  // Rapatrie le n° de suivi depuis le fournisseur (backend ; réel si clés, sinon no-op).
  const handleSyncTracking = async (order: DropshipOrder) => {
    setPlacingId(order.id);
    try {
      const res = await backendFetch<{ changed?: boolean; status?: string }>(`/api/v2/dropship/order/${order.id}/tracking/sync`, { method: 'POST', body: {} });
      if (res.success) {
        const changed = (res as any).changed;
        const newStatus = (res as any).status as string | undefined;
        toast.success(changed ? 'Suivi mis à jour depuis le fournisseur' : 'Aucun nouveau suivi disponible pour le moment');
        if (changed && newStatus) await onUpdateStatus(order.id, newStatus);
      } else {
        toast.error(res.error || 'Synchronisation du suivi impossible');
      }
    } finally {
      setPlacingId(null);
    }
  };

  const filteredOrders = orders.filter(o =>
    o.order_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = useFormatCurrency();

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; icon: any; color: string }> = {
      pending: { label: 'En attente', icon: Clock, color: 'text-gray-500' },
      awaiting_supplier: { label: 'Attente fournisseur', icon: Clock, color: 'text-orange-500' },
      ordered_from_supplier: { label: 'Commandé', icon: Package, color: 'text-blue-500' },
      supplier_confirmed: { label: 'Confirmé', icon: CheckCircle, color: 'text-blue-600' },
      supplier_processing: { label: 'En préparation', icon: Package, color: 'text-[#04439e]' },
      shipped_by_supplier: { label: 'Expédié', icon: Truck, color: 'text-[#04439e]' },
      in_transit: { label: 'En transit', icon: Truck, color: 'text-[#04439e]' },
      delivered_to_customer: { label: 'Livré', icon: CheckCircle, color: 'text-[#ff4000]' },
      completed: { label: 'Terminé', icon: CheckCircle, color: 'text-[#ff4000]' },
      cancelled: { label: 'Annulé', icon: XCircle, color: 'text-[#ff4000]' },
      refunded: { label: 'Remboursé', icon: XCircle, color: 'text-[#ff4000]' },
      disputed: { label: 'Litige', icon: AlertTriangle, color: 'text-[#ff4000]' }
    };
    return configs[status] || { label: status, icon: Clock, color: 'text-gray-500' };
  };

  const handleUpdateTracking = async () => {
    if (!selectedOrder) return;

    // Mise à jour avec tracking
    await onUpdateStatus(selectedOrder.id, 'shipped_by_supplier', `Tracking: ${trackingNumber}`);
    setShowTrackingDialog(false);
    setSelectedOrder(null);
    setTrackingNumber('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Recherche */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('dropshipOrders.rechercherUneCommande')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Liste des commandes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Commandes Fournisseurs ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium text-lg mb-2">{t('dropshipOrders.aucuneCommande')}</h3>
              <p>{t('dropshipOrders.lesCommandesDeProduitsDropshipping')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dropshipOrders.reference')}</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Articles</TableHead>
                    <TableHead>{t('dropshipOrders.clientTotal')}</TableHead>
                    <TableHead>Profit</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const statusConfig = getStatusConfig(order.status);
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <span className="font-mono font-medium">{order.order_reference}</span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(order.created_at), 'dd MMM yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell>{order.supplier?.name || '-'}</TableCell>
                        <TableCell>
                          {order.quantity} article(s)
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(order.customer_total)}
                        </TableCell>
                        <TableCell>
                          <span className="text-[#ff4000] font-medium">
                            {formatCurrency(order.profit_amount || 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                            <span className="text-sm">{statusConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {order.status === 'pending' && (
                                <DropdownMenuItem
                                  disabled={placingId === order.id}
                                  onClick={() => handlePlaceWithSupplier(order)}
                                >
                                  <Package className="w-4 h-4 mr-2" />
                                  Commander chez le fournisseur
                                </DropdownMenuItem>
                              )}
                              {!['pending', 'delivered_to_customer', 'completed', 'cancelled', 'refunded'].includes(order.status) && (
                                <DropdownMenuItem
                                  disabled={placingId === order.id}
                                  onClick={() => handleSyncTracking(order)}
                                >
                                  <Truck className="w-4 h-4 mr-2" />
                                  Synchroniser le suivi
                                </DropdownMenuItem>
                              )}
                              {order.status === 'ordered_from_supplier' && (
                                <DropdownMenuItem onClick={() => onUpdateStatus(order.id, 'supplier_confirmed')}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Confirmer fournisseur
                                </DropdownMenuItem>
                              )}
                              {['supplier_confirmed', 'supplier_processing'].includes(order.status) && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setShowTrackingDialog(true);
                                  }}
                                >
                                  <Truck className="w-4 h-4 mr-2" />
                                  Ajouter tracking
                                </DropdownMenuItem>
                              )}
                              {order.status === 'shipped_by_supplier' && (
                                <DropdownMenuItem onClick={() => onUpdateStatus(order.id, 'delivered_to_customer')}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Marquer livré
                                </DropdownMenuItem>
                              )}
                              {order.status === 'delivered_to_customer' && (
                                <DropdownMenuItem onClick={() => onUpdateStatus(order.id, 'completed')}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Compléter
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              {order.tracking_url && (
                                <DropdownMenuItem asChild>
                                  <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Suivre le colis
                                  </a>
                                </DropdownMenuItem>
                              )}

                              {!['completed', 'cancelled', 'refunded'].includes(order.status) && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => onUpdateStatus(order.id, 'cancelled')}
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Annuler
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog tracking */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dropshipOrders.ajouterLeNumeroDeSuivi')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tracking">{t('dropshipOrders.numeroDeSuivi')}</Label>
              <Input
                id="tracking"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Ex: 1Z999AA10123456784"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('dropshipOrders.notesSurLExpedition')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateTracking} disabled={!trackingNumber}>
              Confirmer l'expédition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

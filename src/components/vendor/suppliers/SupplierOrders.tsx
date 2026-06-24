import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { _Card, _CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SupplierOrder {
  id: string;
  order_number: string;
  supplier_id: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  delivery_method: string;
  created_at: string;
  supplier: {
    business_name: string;
  };
}

interface SupplierOrdersProps {
  vendorId: string;
}

export function SupplierOrders({ vendorId }: SupplierOrdersProps) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('supplier_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supplier_orders',
          filter: `vendor_id=eq.${vendorId}`
        },
        () => loadOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('id', vendorId)
        .single();

      if (!vendor) return;

      const { data, error } = await supabase
        .from('supplier_orders')
        .select(`
          *,
          supplier:suppliers(business_name)
        `)
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error: any) {
      console.error('Erreur chargement commandes:', error);
      toast.error(t('supplierOrders.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, type: 'order' | 'payment') => {
    if (type === 'order') {
      const variants: Record<string, { label: string; variant: any }> = {
        pending: { label: 'En attente', variant: 'secondary' },
        confirmed: { label: t('supplierOrders.confirmee'), variant: 'default' },
        preparing: { label: t('supplierOrders.preparation'), variant: 'default' },
        ready: { label: t('supplierOrders.prete'), variant: 'default' },
        shipped: { label: t('supplierOrders.expediee'), variant: 'default' },
        delivered: { label: t('supplierOrders.livree'), variant: 'secondary' },
        cancelled: { label: t('supplierOrders.annulee'), variant: 'destructive' }
      };
      const config = variants[status] || variants.pending;
      return <Badge variant={config.variant}>{config.label}</Badge>;
    } else {
      const variants: Record<string, { label: string; variant: any }> = {
        pending: { label: 'En attente', variant: 'secondary' },
        partial: { label: 'Partiel', variant: 'default' },
        paid: { label: t('supplierOrders.payee'), variant: 'secondary' }
      };
      const config = variants[status] || variants.pending;
      return <Badge variant={config.variant}>{config.label}</Badge>;
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return <div className="text-center py-8">{t('supplierOrders.chargementDesCommandes')}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucune commande fournisseur pour le moment
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadOrders}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('supplierOrders.nCommande')}</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>{t('supplierOrders.montant')}</TableHead>
              <TableHead>{t('supplierOrders.paiement')}</TableHead>
              <TableHead>{t('supplierOrders.statutCommande')}</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.order_number}</TableCell>
                <TableCell>{order.supplier.business_name}</TableCell>
                <TableCell>{formatAmount(order.total_amount)}</TableCell>
                <TableCell>{getStatusBadge(order.payment_status, 'payment')}</TableCell>
                <TableCell>{getStatusBadge(order.order_status, 'order')}</TableCell>
                <TableCell>{formatDate(order.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    Détails
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

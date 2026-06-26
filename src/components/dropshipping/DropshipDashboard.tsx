/**
 * Tableau de bord Dropshipping
 * Vue d'ensemble des statistiques et activités
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Truck,
  AlertTriangle,
  Clock,
  CheckCircle
} from 'lucide-react';
import type { DropshipStats, DropshipOrder } from '@/types/dropshipping';

interface DropshipDashboardProps {
  stats: DropshipStats | null;
  recentOrders: DropshipOrder[];
}

export function DropshipDashboard({ stats, recentOrders }: DropshipDashboardProps) {
  const { t } = useTranslation();
  const formatCurrency = useFormatCurrency();

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'En attente', variant: 'secondary' },
      awaiting_supplier: { label: 'Attente fournisseur', variant: 'outline' },
      ordered_from_supplier: { label: t('dropshipDashboard.commande'), variant: 'default' },
      shipped_by_supplier: { label: t('dropshipDashboard.expedie'), variant: 'default' },
      in_transit: { label: 'En transit', variant: 'default' },
      delivered_to_customer: { label: t('dropshipDashboard.livre'), variant: 'default' },
      completed: { label: t('dropshipDashboard.termine'), variant: 'default' },
      cancelled: { label: t('dropshipDashboard.annule'), variant: 'destructive' }
    };
    const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Cartes statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('dropshipDashboard.produitsActifs')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeProducts || 0}</div>
            <p className="text-xs text-muted-foreground">
              sur {stats?.totalProducts || 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('dropshipDashboard.commandesEnCours')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              à traiter avec fournisseurs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.completedOrders || 0} commandes complétées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Profit Net</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">
              {formatCurrency(stats?.totalProfit || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Marge moyenne: {(stats?.averageMargin || 0).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Commandes récentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Commandes Dropshipping Récentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('dropshipDashboard.aucuneCommandeDropshippingPourLe')}</p>
              <p className="text-sm mt-1">
                Les commandes de produits dropshipping apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {order.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-[#ff4000]" />
                      ) : order.has_issue ? (
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      ) : (
                        <Clock className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{order.order_reference}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.quantity} article(s) • {order.supplier?.name || 'Fournisseur'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(order.customer_total)}</p>
                      <p className="text-xs text-[#ff4000]">
                        Profit: {formatCurrency(order.profit_amount || 0)}
                      </p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Indicateurs de performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fournisseurs</p>
                <p className="text-2xl font-bold">{stats?.suppliersCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#ff4000]/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('dropshipDashboard.commandesReussies')}</p>
                <p className="text-2xl font-bold">{stats?.completedOrders || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#04439e]/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#04439e]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marge Moyenne</p>
                <p className="text-2xl font-bold">{(stats?.averageMargin || 0).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

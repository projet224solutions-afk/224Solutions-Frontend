/**
 * VendorShopDashboard - Vue boutique pour les vendeurs
 * Affiche les statistiques, commandes et produits basés sur vendor_id
 * Utilisé par défaut quand aucun service professionnel n'est configuré
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart, Package, Users, TrendingUp,
  RefreshCw, Eye, Clock, CheckCircle, XCircle,
  DollarSign, BarChart3, ShoppingBag, AlertTriangle, Plus
} from 'lucide-react';
import { useVendorEcommerceStats } from '@/hooks/useVendorEcommerceStats';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface VendorShopDashboardProps {
  vendorId: string | null;
  businessName?: string;
  onCreateService?: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-orange-100 text-[#ff4000]',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-blue-100 text-[#04439e]',
  ready: 'bg-blue-100 text-[#04439e]',
  in_transit: 'bg-orange-100 text-orange-800',
  delivered: 'bg-orange-100 text-[#ff4000]',
  completed: 'bg-orange-100 text-[#ff4000]',
  cancelled: 'bg-orange-100 text-[#ff4000]',
};

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête',
  in_transit: 'En transit',
  delivered: 'Livrée',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

// formatCurrency importé depuis @/lib/formatters

export function VendorShopDashboard({
  vendorId,
  businessName,
  onCreateService
}: VendorShopDashboardProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency(); // convertit GNF → devise du vendeur (taux BCRG)
  const { stats, recentOrders, loading, error, refresh } = useVendorEcommerceStats(vendorId);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">{error}</p>
          <Button onClick={refresh} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Service professionnel optionnel - discret, non intrusif */}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-primary" />
            {businessName || 'Ma Boutique'}
          </h2>
          <p className="text-muted-foreground">{t('vendorShopDashboard.gerezVosVentesProduitsEt')}</p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/vendeur/orders')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('vendorShopDashboard.commandes')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.orders.total || 0}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {stats?.orders.pending || 0} en attente
              </Badge>
              {(stats?.orders.pending || 0) > 0 && (
                <Clock className="w-3 h-3 text-[#ff4000]" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/vendeur/products')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('vendorShopDashboard.produits')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.products.total || 0}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-[#ff4000]">{stats?.products.active || 0} actifs</span>
              {(stats?.products.lowStock || 0) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {stats?.products.lowStock} stock bas
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.clients.total || 0}</div>
            <div className="flex items-center gap-1 text-xs">
              {(stats?.clients.newThisMonth || 0) > 0 ? (
                <>
                  <TrendingUp className="w-3 h-3 text-[#ff4000]" />
                  <span className="text-[#ff4000]">+{stats?.clients.newThisMonth} ce mois</span>
                </>
              ) : (
                <span className="text-muted-foreground">{t('vendorShopDashboard.aucunNouveauCeMois')}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {fc(stats?.sales.totalRevenue || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {fc(stats?.sales.monthRevenue || 0)} ce mois
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Commandes récentes
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="w-4 h-4 mr-2" />
            Top produits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Résumé des ventes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Total */}
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm font-medium">{t('vendorShopDashboard.totalGeneral')}</span>
                  <span className="font-bold text-primary">{fc(stats?.sales.totalRevenue || 0)}</span>
                </div>

                {/* Séparation POS / Online */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-medium text-orange-700">🏪 POS</span>
                    </div>
                    <div className="text-lg font-bold text-orange-600">
                      {fc(stats?.salesPos?.totalRevenue || 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-medium text-blue-700">🌐 En ligne</span>
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      {fc(stats?.salesOnline?.totalRevenue || 0)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Aujourd'hui</span>
                  <span className="font-semibold">{fc(stats?.sales.todayRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Cette semaine</span>
                  <span className="font-semibold">{fc(stats?.sales.weekRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Ce mois</span>
                  <span className="font-semibold">{fc(stats?.sales.monthRevenue || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Order Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  État des commandes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Séparation POS / Online pour les commandes */}
                <div className="grid grid-cols-2 gap-3 pb-3 border-b">
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-center">
                    <span className="text-xs font-medium text-orange-700">🏪 POS</span>
                    <div className="text-xl font-bold text-orange-600">{stats?.ordersPos?.total || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                    <span className="text-xs font-medium text-blue-700">🌐 En ligne</span>
                    <div className="text-xl font-bold text-blue-600">{stats?.ordersOnline?.total || 0}</div>
                  </div>
                </div>

                {/* Détails par statut */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#ff4000]" />
                      <span className="text-sm">En attente</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                        POS: {stats?.ordersPos?.pending || 0}
                      </Badge>
                      <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                        Web: {stats?.ordersOnline?.pending || 0}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">En cours</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                        POS: {stats?.ordersPos?.confirmed || 0}
                      </Badge>
                      <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                        Web: {stats?.ordersOnline?.confirmed || 0}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                      <span className="text-sm">{t('vendorShopDashboard.livrees')}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                        POS: {stats?.ordersPos?.delivered || 0}
                      </Badge>
                      <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                        Web: {stats?.ordersOnline?.delivered || 0}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-[#ff4000]" />
                      <span className="text-sm">{t('vendorShopDashboard.annulees')}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                        POS: {stats?.ordersPos?.cancelled || 0}
                      </Badge>
                      <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                        Web: {stats?.ordersOnline?.cancelled || 0}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t('vendorShopDashboard.commandesRecentes')}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/vendeur/orders')}>
                <Eye className="w-4 h-4 mr-2" />
                Voir tout
              </Button>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('vendorShopDashboard.aucuneCommandePourLeMoment')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            #{order.booking_number ?? order.id.slice(0, 8)}
                          </span>
                          <Badge className={statusColors[order.status] || 'bg-gray-100'}>
                            {statusLabels[order.status] || order.status}
                          </Badge>
                          {order.source === 'pos' ? (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                              🏪 POS
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                              🌐 En ligne
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer_name || 'Client'} • {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{fc(order.total_amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t('vendorShopDashboard.topProduits')}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/vendeur/products')}>
                <Eye className="w-4 h-4 mr-2" />
                Voir tout
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">{t('vendorShopDashboard.gerezVosProduitsDepuisLa')}</p>
                <Button onClick={() => navigate('/vendeur/products')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un produit
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
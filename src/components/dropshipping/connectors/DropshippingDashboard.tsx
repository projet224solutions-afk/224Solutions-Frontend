/**
 * DROPSHIPPING DASHBOARD
 * Dashboard principal pour la gestion du module dropshipping
 * Agrège toutes les fonctionnalités: connecteurs, produits, commandes
 *
 * @module DropshippingDashboard
 * @version 1.0.0
 * @author 224Solutions
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Zap,
  Package,
  Truck,
  Settings,
  Plus,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Activity
} from 'lucide-react';

// Components
import { ConnectorManager } from './ConnectorManager';
import { ProductImportDialog } from './ProductImportDialog';
import { DropshipProductsTable, DropshipProduct } from './DropshipProductsTable';
import { SupplierOrderPanel, SupplierOrder } from './SupplierOrderPanel';
import { useConnectors } from '@/hooks/useConnectors';
import { formatCurrency } from '@/lib/utils';

// ==================== INTERFACES ====================

interface DropshippingDashboardProps {
  vendorId: string;
}

interface DashboardStats {
  totalProducts: number;
  publishedProducts: number;
  pendingOrders: number;
  shippedOrders: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  syncErrors: number;
}

// ==================== MOCK DATA FOR DEMO ====================

const mockProducts: DropshipProduct[] = [
  {
    id: '1',
    title: "Écouteurs Bluetooth TWS Pro",
    thumbnail: 'https://placehold.co/100x100',
    sourceConnector: 'ALIEXPRESS',
    sourceProductId: '1005004123456',
    sourceUrl: 'https://aliexpress.com/item/1005004123456.html',
    costPrice: 5.50,
    costCurrency: 'USD',
    sellingPrice: 45000,
    margin: 45,
    stockQuantity: 1250,
    stockStatus: 'in_stock',
    syncStatus: 'synced',
    lastSyncAt: new Date().toISOString(),
    priceChange: 'stable',
    priceChangePct: 0,
    isPublished: true,
    totalSold: 23,
    totalRevenue: 1035000,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: "Montre Connectée Sport 2024",
    thumbnail: 'https://placehold.co/100x100',
    sourceConnector: 'ALIBABA',
    sourceProductId: '62845123456',
    sourceUrl: 'https://alibaba.com/product-detail/62845123456.html',
    costPrice: 12.80,
    costCurrency: 'USD',
    sellingPrice: 85000,
    margin: 38,
    stockQuantity: 45,
    stockStatus: 'low_stock',
    syncStatus: 'synced',
    lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
    priceChange: 'down',
    priceChangePct: -5.2,
    isPublished: true,
    totalSold: 15,
    totalRevenue: 1275000,
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    title: "Support Téléphone Voiture Magnétique",
    thumbnail: 'https://placehold.co/100x100',
    sourceConnector: '1688',
    sourceProductId: '678901234567',
    sourceUrl: 'https://detail.1688.com/offer/678901234567.html',
    costPrice: 2.20,
    costCurrency: 'CNY',
    sellingPrice: 15000,
    margin: 62,
    stockQuantity: 0,
    stockStatus: 'out_of_stock',
    syncStatus: 'error',
    lastSyncAt: new Date(Date.now() - 86400000).toISOString(),
    priceChange: 'up',
    priceChangePct: 8.5,
    isPublished: false,
    totalSold: 45,
    totalRevenue: 675000,
    createdAt: new Date().toISOString()
  }
];

const mockOrders: SupplierOrder[] = [
  {
    id: '1',
    internalOrderId: 'ORD-2024-0156',
    customerName: 'Mamadou Diallo',
    supplierOrderId: null,
    connector: 'ALIEXPRESS',
    productTitle: 'Écouteurs Bluetooth TWS Pro',
    productThumbnail: 'https://placehold.co/100x100',
    quantity: 2,
    unitCost: 5.50,
    totalCost: 11.00,
    currency: 'USD',
    status: 'pending',
    tracking: null,
    shippingAddress: {
      name: 'Mamadou Diallo',
      phone: '+224 620 123 456',
      address: 'Quartier Madina, Rue KA-025',
      city: 'Conakry',
      country: 'Guinée'
    },
    notes: null,
    createdAt: new Date().toISOString(),
    orderedAt: null,
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    internalOrderId: 'ORD-2024-0152',
    customerName: 'Fatoumata Camara',
    supplierOrderId: 'AE123456789',
    connector: 'ALIEXPRESS',
    productTitle: 'Montre Connectée Sport 2024',
    productThumbnail: 'https://placehold.co/100x100',
    quantity: 1,
    unitCost: 12.80,
    totalCost: 12.80,
    currency: 'USD',
    status: 'shipped',
    tracking: {
      trackingNumber: 'LP123456789CN',
      carrier: 'Cainiao',
      status: 'in_transit',
      trackingUrl: 'https://track.cainiao.com/LP123456789CN',
      estimatedDelivery: new Date(Date.now() + 604800000),
      events: [
        {
          status: 'in_transit',
          description: "Colis arrivé au centre de tri de destination",
          timestamp: new Date(Date.now() - 86400000),
          location: 'Conakry, Guinée'
        },
        {
          status: 'in_transit',
          description: 'Colis en transit international',
          timestamp: new Date(Date.now() - 259200000),
          location: 'Dubai, UAE'
        },
        {
          status: 'shipped',
          description: "Colis expédié",
          timestamp: new Date(Date.now() - 432000000),
          location: 'Shenzhen, Chine'
        }
      ]
    },
    shippingAddress: {
      name: 'Fatoumata Camara',
      phone: '+224 621 789 012',
      address: 'Immeuble Alpha, Apt 5B, Kaloum',
      city: 'Conakry',
      country: 'Guinée'
    },
    notes: 'Client VIP - Livraison prioritaire',
    createdAt: new Date(Date.now() - 604800000).toISOString(),
    orderedAt: new Date(Date.now() - 518400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// ==================== MAIN COMPONENT ====================

export function DropshippingDashboard({ vendorId }: DropshippingDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [products, setProducts] = useState<DropshipProduct[]>(mockProducts);
  const [orders, setOrders] = useState<SupplierOrder[]>(mockOrders);
  const [loading, _setLoading] = useState(false);
  const [_refreshing, setRefreshing] = useState(false);

  const { activeConnectors } = useConnectors(vendorId);

  // Calculer les statistiques
  const stats: DashboardStats = {
    totalProducts: products.length,
    publishedProducts: products.filter(p => p.isPublished).length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    shippedOrders: orders.filter(o => o.status === 'shipped').length,
    totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
    totalProfit: products.reduce((sum, p) => sum + (p.totalRevenue * p.margin / 100), 0),
    avgMargin: products.length > 0
      ? products.reduce((sum, p) => sum + p.margin, 0) / products.length
      : 0,
    syncErrors: products.filter(p => p.syncStatus === 'error').length
  };

  // Handlers
  const handleRefreshProduct = async (productId: string) => {
    // Simuler sync
    await new Promise(r => setTimeout(r, 1500));
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? { ...p, syncStatus: 'synced' as const, lastSyncAt: new Date().toISOString() }
        : p
    ));
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 2000));
    setProducts(prev => prev.map(p => ({
      ...p,
      syncStatus: 'synced' as const,
      lastSyncAt: new Date().toISOString()
    })));
    setRefreshing(false);
  };

  const handleCreateOrder = async (orderId: string) => {
    await new Promise(r => setTimeout(r, 1500));
    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: 'ordered' as const, supplierOrderId: 'AE' + Date.now(), orderedAt: new Date().toISOString() }
        : o
    ));
    return { success: true, orderId: 'AE' + Date.now() };
  };

  const handleRefreshTracking = async (_orderId: string) => {
    await new Promise(r => setTimeout(r, 1000));
    // Update tracking...
  };

  const handleCancelOrder = async (orderId: string) => {
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: 'cancelled' as const } : o
    ));
  };

  const handleAddNote = async (orderId: string, note: string) => {
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, notes: note } : o
    ));
  };

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="w-8 h-8 text-[#ff4000]" />
            Dropshipping
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos produits dropshipping et commandes fournisseurs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm py-1 px-3">
            <Activity className="w-4 h-4 mr-1" />
            {activeConnectors.length} connecteur(s) actif(s)
          </Badge>

          <Button onClick={() => setImportDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Importer un produit
          </Button>
        </div>
      </div>

      {/* Alertes */}
      {stats.pendingOrders > 0 && (
        <Alert className="bg-orange-50 border-orange-200">
          <AlertTriangle className="w-4 h-4 text-[#ff4000]" />
          <AlertTitle className="text-[#ff4000]">Actions requises</AlertTitle>
          <AlertDescription className="text-[#ff4000]">
            Vous avez {stats.pendingOrders} commande(s) en attente à passer auprès des fournisseurs.
            <Button
              variant="link"
              className="text-[#ff4000] p-0 h-auto ml-2"
              onClick={() => setActiveTab('orders')}
            >
              Voir les commandes →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {stats.syncErrors > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>{t('dropshippingDashboard.erreursDeSynchronisation')}</AlertTitle>
          <AlertDescription>
            {stats.syncErrors} produit(s) n'ont pas pu être synchronisés.
            <Button
              variant="link"
              className="text-orange-200 p-0 h-auto ml-2"
              onClick={() => setActiveTab('products')}
            >
              Résoudre →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Produits ({stats.totalProducts})
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Commandes ({orders.length})
            {stats.pendingOrders > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {stats.pendingOrders}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="connectors" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Connecteurs
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Stats cards */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Revenus Dropshipping
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats.totalRevenue, 'GNF')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <TrendingUp className="w-3 h-3 inline mr-1 text-[#ff4000]" />
                  +12% vs mois dernier
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Profit estimé
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#ff4000]">
                  {formatCurrency(stats.totalProfit, 'GNF')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Marge moyenne: {stats.avgMargin.toFixed(0)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Produits actifs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.publishedProducts} / {stats.totalProducts}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalProducts - stats.publishedProducts} en brouillon
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Commandes en transit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.shippedOrders}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.pendingOrders} en attente
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent activity */}
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('dropshippingDashboard.derniersProduitsImportes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {products.slice(0, 3).map(product => (
                    <div key={product.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                        <img src={product.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.sourceConnector} • {formatCurrency(product.sellingPrice, 'GNF')}
                        </p>
                      </div>
                      <Badge variant={product.isPublished ? 'default' : 'secondary'}>
                        {product.isPublished ? 'Publié' : 'Brouillon'}
                      </Badge>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setActiveTab('products')}
                >
                  Voir tous les produits
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('dropshippingDashboard.commandesRecentes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orders.slice(0, 3).map(order => (
                    <div key={order.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                        <img src={order.productThumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          #{order.internalOrderId} • {order.quantity}x {order.productTitle.substring(0, 20)}...
                        </p>
                      </div>
                      <Badge variant={order.status === 'pending' ? 'destructive' : 'outline'}>
                        {order.status}
                      </Badge>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setActiveTab('orders')}
                >
                  Voir toutes les commandes
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Products */}
        <TabsContent value="products" className="mt-6">
          <DropshipProductsTable
            products={products}
            loading={loading}
            onRefreshProduct={handleRefreshProduct}
            onRefreshAll={handleRefreshAll}
            onEditProduct={(product) => console.log('Edit', product)}
            onDeleteProduct={(id) => setProducts(prev => prev.filter(p => p.id !== id))}
            onTogglePublish={(id, published) => {
              setProducts(prev => prev.map(p =>
                p.id === id ? { ...p, isPublished: published } : p
              ));
            }}
            onViewOnSource={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
          />
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders" className="mt-6">
          <SupplierOrderPanel
            vendorId={vendorId}
            orders={orders}
            loading={loading}
            onCreateOrder={handleCreateOrder}
            onRefreshTracking={handleRefreshTracking}
            onCancelOrder={handleCancelOrder}
            onAddNote={handleAddNote}
          />
        </TabsContent>

        {/* Connectors */}
        <TabsContent value="connectors" className="mt-6">
          <ConnectorManager vendorId={vendorId} />
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <ProductImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        vendorId={vendorId}
        onProductImported={(product) => {
          // Ajouter le produit importé à la liste
          console.log('Product imported:', product);
          setActiveTab('products');
        }}
      />
    </div>
  );
}

export default DropshippingDashboard;

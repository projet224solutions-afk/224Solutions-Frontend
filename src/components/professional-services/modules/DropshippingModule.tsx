/**
 * MODULE DROPSHIPPING PROFESSIONNEL
 * Inspiré de: Shopify, Oberlo, Spocket
 * E-commerce dropshipping avec intégration fournisseurs
 * Extension Chine: Alibaba, AliExpress, 1688
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Package, Globe, TrendingUp, DollarSign, ShoppingCart, AlertCircle, Flag, RefreshCw, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChinaDashboard, ChinaProductImport, ChinaSuppliersList, ChinaCostCalculator } from '@/components/dropshipping/china';
import { useDropshipping } from '@/hooks/useDropshipping';
import { supabase } from '@/integrations/supabase/client';

interface DropshippingModuleProps {
  serviceId: string;
  businessName?: string;
}

export function DropshippingModule({ serviceId, businessName }: DropshippingModuleProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [vendorId, setVendorId] = useState<string | undefined>();
  const [loadingVendor, setLoadingVendor] = useState(true);

  // Récupérer le vendor_id depuis le service professionnel
  useEffect(() => {
    const fetchVendorId = async () => {
      try {
        const { data: service } = await supabase
          .from('professional_services')
          .select('user_id')
          .eq('id', serviceId)
          .single();

        if (service?.user_id) {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('id')
            .eq('user_id', service.user_id)
            .single();

          if (vendor?.id) {
            setVendorId(vendor.id);
          }
        }
      } catch (error) {
        console.error('Erreur récupération vendor:', error);
      } finally {
        setLoadingVendor(false);
      }
    };

    if (serviceId) {
      fetchVendorId();
    }
  }, [serviceId]);

  // Hook dropshipping avec les vraies données
  const {
    stats,
    suppliers,
    products,
    orders,
    loading,
    loadStats,
    loadProducts,
    loadOrders,
    loadSuppliers
  } = useDropshipping(vendorId);

  const handleRefresh = async () => {
    await Promise.all([loadStats(), loadProducts(), loadOrders(), loadSuppliers()]);
  };

  // Formatage monétaire
  const formatCurrency = useFormatCurrency();

  // Afficher un loader pendant le chargement
  if (loadingVendor) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">{t('dropshippingModule.chargementDuModule')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Package className="w-8 h-8 text-primary" />
            {businessName || 'Boutique Dropshipping'}
          </h2>
          <p className="text-muted-foreground">{t('dropshippingModule.venteSansStockAvecFournisseurs')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Globe className="w-3 h-3" />
            {suppliers.length} fournisseurs
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Dropshipping:</strong> Vendez des produits sans gérer de stock.
          Les commandes sont automatiquement envoyées aux fournisseurs qui livrent directement vos clients.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('dropshippingModule.produitsImportes')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeProducts || 0} actifs dans votre catalogue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('dropshippingModule.commandesEnAttente')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingOrders || 0}</div>
            <p className="text-xs text-muted-foreground">{t('dropshippingModule.aTraiter')}</p>
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
            <div className="text-2xl font-bold text-[#ff4000]">{formatCurrency(stats?.totalProfit || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Marge: {(stats?.averageMargin || 0).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">{t('dropshippingModule.tableauDeBord')}</TabsTrigger>
          <TabsTrigger value="suppliers">Fournisseurs</TabsTrigger>
          <TabsTrigger value="import">Importer</TabsTrigger>
          <TabsTrigger value="china" className="flex items-center gap-1">
            <Flag className="w-3 h-3" />
            Chine
          </TabsTrigger>
          <TabsTrigger value="china-import">Import Chine</TabsTrigger>
          <TabsTrigger value="china-costs">{t('dropshippingModule.couts')}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dropshippingModule.commandesRecentes')}</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t('dropshippingModule.aucuneCommandeRecente')}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Les commandes de vos clients seront automatiquement transmises aux fournisseurs
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{order.order_reference}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.quantity} article(s) • {order.supplier?.name || 'Fournisseur'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(order.customer_total)}</p>
                        <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fournisseurs Disponibles ({suppliers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {suppliers.length === 0 ? (
                <div className="text-center py-8">
                  <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">{t('dropshippingModule.aucunFournisseurConfigure')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suppliers.map(supplier => (
                    <Card key={supplier.id} className="border-2">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-4xl">
                              {supplier.country === 'CN' ? '🇨🇳' :
                               supplier.country === 'US' ? '🇺🇸' :
                               supplier.country === 'FR' ? '🇫🇷' : '📦'}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{supplier.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {supplier.country} • {supplier.currency}
                              </p>
                              {supplier.reliability_score && (
                                <p className="text-xs text-muted-foreground">
                                  Fiabilité: {supplier.reliability_score}%
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={supplier.is_verified
                              ? "bg-orange-50 text-[#ff4000] border-orange-200"
                              : "bg-orange-50 text-[#ff4000] border-orange-200"
                            }
                          >
                            {supplier.is_verified ? 'Vérifié' : 'Non vérifié'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dropshippingModule.importerDesProduits')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">{t('dropshippingModule.recherchezDesProduitsAVendre')}</h3>
                <p className="text-muted-foreground mb-4">
                  Parcourez les catalogues de vos fournisseurs et importez les produits dans votre boutique
                </p>
                <Button size="lg">
                  <Globe className="w-4 h-4 mr-2" />
                  Parcourir les Catalogues
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <h3 className="font-bold mb-2">{t('dropshippingModule.avantagesDuDropshipping')}</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>{t('dropshippingModule.pasDeGestionDeStock')}</li>
                <li>✅ Pas d'investissement initial en inventaire</li>
                <li>{t('dropshippingModule.expeditionAutomatiqueParLeFournisseur')}</li>
                <li>{t('dropshippingModule.largeChoixDeProduitsDisponibles')}</li>
                <li>{t('dropshippingModule.miseAJourAutomatiqueDes')}</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === EXTENSION DROPSHIPPING CHINE === */}
        <TabsContent value="china" className="space-y-4">
          <ChinaDashboard />
        </TabsContent>

        <TabsContent value="china-import" className="space-y-4">
          <ChinaProductImport />
        </TabsContent>

        <TabsContent value="china-costs" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChinaCostCalculator />
            <ChinaSuppliersList />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

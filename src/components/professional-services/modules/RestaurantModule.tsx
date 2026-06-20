/**
 * MODULE RESTAURANT - Interface complète
 * Utilise serviceId pour afficher les données spécifiques au restaurant
 */

import { useState, lazy, Suspense } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import {
  UtensilsCrossed, ClipboardList, Users, Calendar,
  TrendingUp, RefreshCw, Clock, CheckCircle, XCircle,
  DollarSign, ShoppingBag, Package, Truck, MapPin, Eye,
  Sparkles, Settings, Plus, LayoutGrid, CalendarCheck, ShoppingCart, Tag, Images,
  UserCog, CreditCard
} from 'lucide-react';
import { ServiceMediaManager } from '@/components/professional-services/ServiceMediaManager';
import { useServiceRestaurantStats } from '@/hooks/useServiceRestaurantStats';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { RestaurantMenuManager } from '@/components/restaurant/RestaurantMenuManager';
import { RestaurantTableManager } from '@/components/restaurant/RestaurantTableManager';
import { RestaurantSettings } from '@/components/restaurant/RestaurantSettings';
import { RestaurantReservationsManager } from '@/components/restaurant/RestaurantReservationsManager';
import { RestaurantOrdersPanel } from '@/components/restaurant/RestaurantOrdersPanel';
import { RestaurantOrdersKanban } from '@/components/professional-services/modules/restaurant/RestaurantOrdersKanban';
import { RestaurantAnalytics } from '@/components/professional-services/modules/restaurant/RestaurantAnalytics';
import { RestaurantPromotions } from '@/components/professional-services/modules/restaurant/RestaurantPromotions';
import { RestaurantPOS } from '@/components/restaurant/RestaurantPOS';
import { RestaurantAgentsManagement } from '@/components/restaurant/RestaurantAgentsManagement';
import { Copilot224 } from '@/components/service-common/Copilot224';
const MyPurchasesOrdersList = lazy(() => import('@/components/shared/MyPurchasesOrdersList'));
const PaymentLinksManager = lazy(() => import('@/components/vendor/PaymentLinksManager'));

interface RestaurantModuleProps {
  serviceId: string;
  businessName?: string;
  /** Mode AGENT : si fourni, on filtre les onglets selon les permissions accordées par le restaurateur.
   *  null/undefined = mode PROPRIÉTAIRE (accès complet). */
  agentPermissions?: Record<string, boolean> | null;
}

// Onglet → permission requise (mode agent). Les onglets sans entrée sont réservés au propriétaire.
const TAB_PERMISSION: Record<string, string> = {
  orders: 'manage_orders',
  pos: 'access_pos',
  menu: 'manage_menu',
  tables: 'manage_tables',
  reservations: 'manage_reservations',
  promotions: 'manage_promotions',
  analytics: 'view_analytics',
  overview: 'view_analytics',
  media: 'manage_media',
  settings: 'manage_settings',
  // 'agents' n'est jamais accessible à un agent (gestion réservée au propriétaire).
};

// formatCurrency importé depuis @/lib/formatters

const _statusColors: Record<string, string> = {
  pending: 'bg-orange-100 text-[#ff4000]',
  preparing: 'bg-blue-100 text-blue-800',
  ready: 'bg-blue-100 text-[#04439e]',
  delivered: 'bg-orange-100 text-[#ff4000]',
  completed: 'bg-orange-100 text-[#ff4000]',
  cancelled: 'bg-orange-100 text-[#ff4000]',
};

const _statusLabels: Record<string, string> = {
  pending: 'En attente',
  preparing: 'En préparation',
  ready: 'Prête',
  delivered: 'Livrée',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

const _orderTypeIcons: Record<string, React.ReactNode> = {
  dine_in: <MapPin className="w-3 h-3" />,
  sur_place: <MapPin className="w-3 h-3" />,
  delivery: <Truck className="w-3 h-3" />,
  livraison: <Truck className="w-3 h-3" />,
  takeaway: <ShoppingBag className="w-3 h-3" />,
  emporter: <ShoppingBag className="w-3 h-3" />,
};

const _orderTypeLabels: Record<string, string> = {
  dine_in: 'Sur place',
  sur_place: 'Sur place',
  delivery: 'Livraison',
  livraison: 'Livraison',
  takeaway: 'À emporter',
  emporter: 'À emporter',
};

export function RestaurantModule({ serviceId, businessName, agentPermissions }: RestaurantModuleProps) {
  const isAgent = !!agentPermissions;
  // En mode agent : un onglet est visible si l'agent a la permission associée. Le propriétaire voit tout.
  const canSee = (tab: string): boolean => {
    if (!isAgent) return true;
    if (tab === 'agents') return false; // jamais pour un agent
    const perm = TAB_PERMISSION[tab];
    return perm ? agentPermissions![perm] === true : false;
  };
  const { t } = useTranslation();
  const { stats, recentOrders, loading, error, refresh } = useServiceRestaurantStats(serviceId);
  // ÉCRAN 1 = tableau de bord des commandes (Kanban temps réel) : c'est l'écran d'accueil du restaurant.
  const [activeTab, setActiveTab] = useState(() => {
    const order = ['orders', 'overview', 'pos', 'reservations', 'menu', 'analytics', 'promotions', 'tables', 'media', 'settings'];
    return order.find(canSee) || 'orders';
  });
  const [showPurchases, setShowPurchases] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const _navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-28" />
        </div>
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

  // Onboarding card (shown on overview when no data)
  const OnboardingCard = () => (
    <Card className="bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-900/20 dark:to-[#ff4000]/20 border-orange-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{t('restaurantModule.bienvenueDansVotreEspaceRestaurant')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configurez votre menu, gérez vos commandes et suivez vos performances en temps réel.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={() => setActiveTab('menu')}
              >
                <Plus className="w-4 h-4" />
                Ajouter un plat
              </Button>
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={() => setActiveTab('tables')}
              >
                <LayoutGrid className="w-4 h-4" />
                Gérer les tables
              </Button>
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={() => setActiveTab('menu')}
              >
                <ClipboardList className="w-4 h-4" />
                Voir le menu
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="w-7 h-7 text-primary" />
            {businessName || 'Restaurant'}
          </h2>
          <p className="text-muted-foreground">{t('restaurantModule.gerezVosCommandesEtVotre')}</p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('restaurantModule.commandes')}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.orders.total || 0}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {(stats?.orders.pending || 0) + (stats?.orders.preparing || 0) > 0 && (
                <Badge variant="secondary" className="text-xs bg-orange-100 text-[#ff4000]">
                  <Clock className="w-3 h-3 mr-1" />
                  {(stats?.orders.pending || 0) + (stats?.orders.preparing || 0)} actives
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Menu</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.menuItems.total || 0}</div>
            <span className="text-xs text-[#ff4000]">{stats?.menuItems.active || 0} plats actifs</span>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('restaurantModule.reservations')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.reservations.today || 0}</div>
            <span className="text-xs text-muted-foreground">aujourd'hui</span>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">
              {formatCurrency(stats?.sales.totalRevenue || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(stats?.sales.todayRevenue || 0)} aujourd'hui
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides (PROPRIÉTAIRE uniquement) : liens de paiement + mes achats personnels */}
      {!isAgent && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant={showLinks ? 'default' : 'outline'} size="sm" className="gap-2" onClick={() => setShowLinks(v => !v)}>
              <CreditCard className="w-4 h-4" /> Liens de paiement
            </Button>
            <Button variant={showPurchases ? 'default' : 'outline'} size="sm" className="gap-2" onClick={() => setShowPurchases(v => !v)}>
              <ShoppingBag className="w-4 h-4" /> Mes Achats
            </Button>
          </div>
          {showLinks && (
            <Card><CardContent className="p-0 sm:p-2">
              <Suspense fallback={<div className="flex items-center justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>}>
                <PaymentLinksManager />
              </Suspense>
            </CardContent></Card>
          )}
          {showPurchases && (
            <Suspense fallback={<div className="flex items-center justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>}>
              <MyPurchasesOrdersList title="Mes Achats Personnels" emptyMessage="Vous n'avez pas encore effectué d'achats sur le marketplace" />
            </Suspense>
          )}
        </>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 h-auto w-full p-1.5 bg-muted/60">
          {canSee('orders') && (
          <TabsTrigger value="orders" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base font-semibold bg-[#ff4000]/10 data-[state=active]:bg-[#ff4000] data-[state=active]:text-white">
            <ShoppingBag className="w-5 h-5 sm:w-4 sm:h-4" />
            Commandes
          </TabsTrigger>)}
          {canSee('overview') && (
          <TabsTrigger value="overview" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base">
            <DollarSign className="w-5 h-5 sm:w-4 sm:h-4" />
            Aperçu
          </TabsTrigger>)}
          {canSee('pos') && (
          <TabsTrigger value="pos" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base font-semibold bg-primary/10">
            <ShoppingCart className="w-5 h-5 sm:w-4 sm:h-4" />
            POS
          </TabsTrigger>)}
          {canSee('reservations') && (
          <TabsTrigger value="reservations" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base">
            <CalendarCheck className="w-5 h-5 sm:w-4 sm:h-4" />
            Réserv.
          </TabsTrigger>)}
          {canSee('menu') && (
          <TabsTrigger value="menu" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base">
            <UtensilsCrossed className="w-5 h-5 sm:w-4 sm:h-4" />
            Menu
          </TabsTrigger>)}
          {canSee('analytics') && (
          <TabsTrigger value="analytics" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base">
            <TrendingUp className="w-5 h-5 sm:w-4 sm:h-4" />
            Analytics
          </TabsTrigger>)}
          {canSee('promotions') && (
          <TabsTrigger value="promotions" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base">
            <Tag className="w-5 h-5 sm:w-4 sm:h-4" />
            Promos
          </TabsTrigger>)}
          {canSee('tables') && (
          <TabsTrigger value="tables" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base">
            <LayoutGrid className="w-5 h-5 sm:w-4 sm:h-4" />
            Tables
          </TabsTrigger>)}
          {canSee('media') && (
          <TabsTrigger value="media" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base">
            <Images className="w-5 h-5 sm:w-4 sm:h-4" />
            Médias
          </TabsTrigger>)}
          {canSee('settings') && (
          <TabsTrigger value="settings" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base">
            <Settings className="w-5 h-5 sm:w-4 sm:h-4" />
            Config
          </TabsTrigger>)}
          {canSee('agents') && (
          <TabsTrigger value="agents" className="flex-col sm:flex-row gap-1.5 py-3 sm:py-2.5 text-sm sm:text-base">
            <UserCog className="w-5 h-5 sm:w-4 sm:h-4" />
            Agents
          </TabsTrigger>)}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Onboarding card if no data */}
          {!stats?.hasData && <OnboardingCard />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* Sales Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Résumé des ventes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm font-medium">Total</span>
                  <span className="font-bold text-primary">{formatCurrency(stats?.sales.totalRevenue || 0)}</span>
                </div>

                {/* Par type */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-3 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg text-center">
                    <MapPin className="w-4 h-4 text-[#ff4000] mx-auto mb-1" />
                    <div className="text-xs font-medium text-[#ff4000]">{t('restaurantModule.surPlace')}</div>
                    <div className="text-lg font-bold text-[#ff4000]">{formatCurrency(stats?.salesDineIn.totalRevenue || 0)}</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
                    <Truck className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    <div className="text-xs font-medium text-blue-700">{t('restaurantModule.livraison')}</div>
                    <div className="text-lg font-bold text-blue-600">{formatCurrency(stats?.salesDelivery.totalRevenue || 0)}</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-[#04439e]/20 border border-blue-200 dark:border-[#04439e] rounded-lg text-center">
                    <ShoppingBag className="w-4 h-4 text-[#04439e] mx-auto mb-1" />
                    <div className="text-xs font-medium text-[#04439e]">{t('restaurantModule.aEmporter')}</div>
                    <div className="text-lg font-bold text-[#04439e]">{formatCurrency(stats?.salesTakeaway.totalRevenue || 0)}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Aujourd'hui</span>
                  <span className="font-semibold">{formatCurrency(stats?.sales.todayRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Ce mois</span>
                  <span className="font-semibold">{formatCurrency(stats?.sales.monthRevenue || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Orders by Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Commandes par type
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-3 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 rounded-lg text-center">
                    <MapPin className="w-4 h-4 text-[#ff4000] mx-auto mb-1" />
                    <div className="text-xs font-medium text-[#ff4000]">{t('restaurantModule.surPlace')}</div>
                    <div className="text-xl font-bold text-[#ff4000]">{stats?.ordersDineIn.total || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg text-center">
                    <Truck className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    <div className="text-xs font-medium text-blue-700">{t('restaurantModule.livraison')}</div>
                    <div className="text-xl font-bold text-blue-600">{stats?.ordersDelivery.total || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-[#04439e]/20 border border-blue-200 rounded-lg text-center">
                    <ShoppingBag className="w-4 h-4 text-[#04439e] mx-auto mb-1" />
                    <div className="text-xs font-medium text-[#04439e]">{t('restaurantModule.aEmporter')}</div>
                    <div className="text-xl font-bold text-[#04439e]">{stats?.ordersTakeaway.total || 0}</div>
                  </div>
                </div>

                {/* Statuts */}
                <div className="space-y-2 pt-3 border-t">
                  <div className="flex justify-between items-center p-2 rounded bg-orange-50">
                    <span className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#ff4000]" /> En attente
                    </span>
                    <span className="font-semibold text-[#ff4000]">{stats?.orders.pending || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-blue-50">
                    <span className="text-sm flex items-center gap-2">
                      <UtensilsCrossed className="w-4 h-4 text-blue-500" /> En préparation
                    </span>
                    <span className="font-semibold text-blue-700">{stats?.orders.preparing || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-blue-50">
                    <span className="text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#04439e]" /> Prêtes
                    </span>
                    <span className="font-semibold text-[#04439e]">{stats?.orders.ready || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-orange-50">
                    <span className="text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#ff4000]" /> Terminées
                    </span>
                    <span className="font-semibold text-[#ff4000]">{stats?.orders.delivered || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <RestaurantAnalytics serviceId={serviceId} rating={(stats as any)?.reviews?.rating} reviewsCount={(stats as any)?.reviews?.count} />
        </TabsContent>

        <TabsContent value="pos" className="mt-4">
          <RestaurantPOS serviceId={serviceId} businessName={businessName} />
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-6">
          {/* Écran signature : Kanban temps réel (Meituan-like) */}
          <RestaurantOrdersKanban serviceId={serviceId} />
          {/* Gestion détaillée (filtres, historique) */}
          <details className="rounded-lg border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground">Vue détaillée / historique</summary>
            <div className="p-2"><RestaurantOrdersPanel serviceId={serviceId} /></div>
          </details>
        </TabsContent>

        <TabsContent value="reservations" className="mt-4">
          <RestaurantReservationsManager serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="menu" className="mt-4">
          <RestaurantMenuManager serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="promotions" className="mt-4">
          <RestaurantPromotions serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="tables" className="mt-4">
          <RestaurantTableManager serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="media" className="mt-4">
          {/* Galerie (photos + vidéos Premium) — RÉSERVÉE au restaurateur (ici, son dashboard). */}
          <ServiceMediaManager serviceId={serviceId} readonly={false} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <RestaurantSettings serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <RestaurantAgentsManagement serviceId={serviceId} />
        </TabsContent>
      </Tabs>

      {/* Copilot IA contextuel au restaurant (bulle flottante). En mode agent, on masque l'alerte
          « solde bas » : le wallet du compte agent n'est pas pertinent (il gère le resto de son employeur). */}
      <Copilot224 service="restaurant" title="Copilot Restaurant" hideWalletAlert={isAgent} />
    </div>
  );
}

export default RestaurantModule;

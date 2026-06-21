/**
 * VENDOR BUSINESS DASHBOARD
 * Interface principale du module métier avec vue complète de la boutique
 * Affiche les statistiques spécifiques au service professionnel sélectionné
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  ShoppingCart, Package, Users, TrendingUp,
  RefreshCw, Clock, XCircle,
  DollarSign, BarChart3, ShoppingBag, Plus,
  Store, ArrowUpRight,
  Sparkles, Settings, BookOpen
} from 'lucide-react';
import { useProfessionalServiceStats } from '@/hooks/useProfessionalServiceStats';
import { useNavigate } from 'react-router-dom';
import { AddServiceModal } from './AddServiceModal';

export interface VendorBusinessDashboardProps {
  businessName: string;
  serviceId: string;
  serviceTypeName?: string;
  serviceTypeCode?: string;
  onRefresh?: () => void;
  professionalService?: any;
}

// formatCurrency importé depuis @/lib/formatters

export function VendorBusinessDashboard({
  businessName,
  serviceId,
  serviceTypeName,
  serviceTypeCode,
  onRefresh,
  professionalService
}: VendorBusinessDashboardProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency(); // convertit GNF → devise du vendeur (taux BCRG)
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddService, setShowAddService] = useState(false);

  // Utiliser les stats spécifiques au service professionnel sélectionné
  console.log('🔍 VendorBusinessDashboard - serviceId:', serviceId);
  console.log('🔍 VendorBusinessDashboard - serviceTypeCode:', serviceTypeCode);
  console.log('🔍 VendorBusinessDashboard - professionalService:', professionalService);

  const { stats, loading, refresh: refreshStats } = useProfessionalServiceStats({
    serviceId,
    serviceTypeCode: serviceTypeCode || professionalService?.service_type?.code
  });

  const handleRefresh = () => {
    refreshStats();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{businessName}</h1>
            <p className="text-sm text-muted-foreground">
              {serviceTypeName || 'Gérez votre activité'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddService(true)} className="hidden md:flex gap-2">
            <Plus className="w-4 h-4" />
            Nouveau service
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline">Actualiser</span>
          </Button>
        </div>
      </div>

      {/* Status Alerts */}
      {professionalService?.status === 'pending' && (
        <Alert variant="default" className="bg-orange-50 border-orange-200 dark:bg-[#ff4000]/20">
          <Clock className="w-4 h-4 text-[#ff4000]" />
          <AlertTitle className="text-[#ff4000] dark:text-orange-100">{t('vendorBusinessDashboard.serviceEnCoursDeValidation')}</AlertTitle>
          <AlertDescription className="text-[#ff4000] dark:text-orange-200">
            Votre service est en attente de validation par notre équipe.
          </AlertDescription>
        </Alert>
      )}

      {professionalService?.verification_status === 'rejected' && (
        <Alert variant="destructive">
          <XCircle className="w-4 h-4" />
          <AlertTitle>{t('vendorBusinessDashboard.serviceRejete')}</AlertTitle>
          <AlertDescription>{t('vendorBusinessDashboard.contactezLeSupportPourPlus')}</AlertDescription>
        </Alert>
      )}

      {/* Onboarding pour nouveau service */}
      {!stats?.hasData && (
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Bienvenue dans votre espace {serviceTypeName || 'professionnel'} !</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ce service est nouveau. Commencez à ajouter du contenu pour voir vos statistiques.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button variant="outline" className="gap-2 justify-start" onClick={() => navigate('/vendeur/products/new')}>
                    <Plus className="w-4 h-4" />
                    Ajouter un article
                  </Button>
                  <Button variant="outline" className="gap-2 justify-start" onClick={() => navigate('/vendeur/settings')}>
                    <Settings className="w-4 h-4" />
                    Configurer
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 justify-start"
                    onClick={() => window.open('https://docs.224solutions.com/guide-vendeur', '_blank', 'noopener,noreferrer')}
                  >
                    <BookOpen className="w-4 h-4" />
                    Guide
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">{t('vendorBusinessDashboard.commandes')}</span>
              <ShoppingCart className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground">{stats?.ordersCount || 0}</div>
            {(stats?.pendingCount || 0) > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-[#ff4000]" />
                <span className="text-xs text-[#ff4000]">{stats?.pendingCount} en attente</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">Produits/Services</span>
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground">{stats?.productsCount || 0}</div>
            <span className="text-xs text-[#ff4000]">{stats?.productsCount || 0} actifs</span>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-transparent hover:border-l-purple-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">Clients</span>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground">{stats?.customersCount || 0}</div>
            {(stats?.newCustomersThisMonth || 0) > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <ArrowUpRight className="w-3 h-3 text-[#ff4000]" />
                <span className="text-xs text-[#ff4000]">+{stats?.newCustomersThisMonth} ce mois</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">Chiffre d'affaires</span>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-primary">{fc(stats?.revenue || 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{fc(stats?.monthRevenue || 0)} ce mois</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto p-1 bg-muted/50">
          <TabsTrigger value="overview" className="text-xs md:text-sm py-2 gap-1 md:gap-2">
            <BarChart3 className="w-4 h-4 hidden md:block" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs md:text-sm py-2 gap-1 md:gap-2">
            <ShoppingBag className="w-4 h-4 hidden md:block" />
            Activité
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs md:text-sm py-2 gap-1 md:gap-2">
            <Package className="w-4 h-4 hidden md:block" />
            Détails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Résumé des ventes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm font-medium">{t('vendorBusinessDashboard.totalGeneral')}</span>
                  <span className="font-bold text-primary">{fc(stats?.revenue || 0)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <Store className="w-3 h-3 text-[#ff4000]" />
                      <span className="text-xs font-medium text-[#ff4000] dark:text-[#ff4000]">{t('vendorBusinessDashboard.surPlace')}</span>
                    </div>
                    <div className="text-lg font-bold text-[#ff4000] dark:text-[#ff4000]">{fc(stats?.revenuePos || 0)}</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#ff4000]" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">{t('vendorBusinessDashboard.livraison')}</span>
                    </div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{fc(stats?.revenueOnline || 0)}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Aujourd'hui</span>
                  <span className="font-semibold">{fc(stats?.todayRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Ce mois</span>
                  <span className="font-semibold">{fc(stats?.monthRevenue || 0)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  État des commandes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 pb-4 border-b">
                  <div className="p-3 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Store className="w-3 h-3 text-[#ff4000]" />
                      <span className="text-xs font-medium text-[#ff4000] dark:text-[#ff4000]">{t('vendorBusinessDashboard.surPlace')}</span>
                    </div>
                    <div className="text-2xl font-bold text-[#ff4000] dark:text-[#ff4000]">{stats?.ordersPos || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#ff4000]" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">{t('vendorBusinessDashboard.livraison')}</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats?.ordersOnline || 0}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <span className="text-sm">{t('vendorBusinessDashboard.totalCommandes')}</span>
                    <span className="font-semibold">{stats?.ordersCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-orange-50 dark:bg-[#ff4000]/10">
                    <span className="text-sm flex items-center gap-2">
                      <Clock className="w-3 h-3 text-[#ff4000]" /> En attente
                    </span>
                    <span className="font-semibold text-[#ff4000]">{stats?.pendingCount || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('vendorBusinessDashboard.lesCommandesRecentesApparaitrontIci')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Les détails de vos produits/services apparaîtront ici</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddServiceModal open={showAddService} onOpenChange={setShowAddService} />
    </div>
  );
}

export default VendorBusinessDashboard;

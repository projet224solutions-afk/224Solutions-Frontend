import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { CommissionService } from '@/services/commissionService';
import DetailedTransactionsList from './DetailedTransactionsList';
import {
  Wallet,
  TrendingUp,
  ShoppingCart,
  Users,
  Truck,
  Package,
  RefreshCw,
  DollarSign,
  Car,
  List
} from "lucide-react";

interface ServiceRevenue {
  service_name: string;
  total_revenue: number;
  total_commission: number;
  transaction_count: number;
}

export default function PlatformRevenueOverview() {
  const { t } = useTranslation();
  const [revenues, setRevenues] = useState<{
    services: ServiceRevenue[];
    total_revenue: number;
    total_commission: number;
    total_transactions: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      console.log('🔄 [PlatformRevenue] Chargement des revenus...');
      const data = await CommissionService.getAllServicesRevenue();
      console.log('✅ [PlatformRevenue] Revenus chargés:', data);
      setRevenues(data);
    } catch (error: any) {
      console.error('❌ [PlatformRevenue] Erreur chargement revenus:', error);
      toast.error(t('platformRevenueOverview.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRevenueData();
    setRefreshing(false);
    toast.success(t('platformRevenueOverview.donneesActualisees'));
  };

  useEffect(() => {
    fetchRevenueData();

    // S'abonner aux changements de transactions en temps réel
    console.log('📡 [PlatformRevenue] Abonnement temps réel activé');
    const channel = supabase
      .channel('platform-revenue-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
        },
        (payload) => {
          console.log('💰 [PlatformRevenue] Transaction détectée:', payload);
          // Recharger les données après un délai pour laisser la transaction se finaliser
          setTimeout(() => {
            fetchRevenueData();
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 [PlatformRevenue] Déconnexion temps réel');
      channel.unsubscribe();
    };
  }, []);

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName) {
      case 'wallet_transfer':
        return <Wallet className="w-5 h-5" />;
      case 'subscription':
        return <Users className="w-5 h-5" />;
      case 'marketplace':
        return <Package className="w-5 h-5" />;
      case 'taxi':
        return <Car className="w-5 h-5" />;
      case 'delivery':
      case 'livreur':
        return <Truck className="w-5 h-5" />;
      default:
        return <DollarSign className="w-5 h-5" />;
    }
  };

  const getServiceLabel = (serviceName: string) => {
    switch (serviceName) {
      case 'wallet_transfer':
        return 'Transferts Wallet';
      case 'subscription':
        return 'Abonnements';
      case 'marketplace':
        return 'E-Commerce';
      case 'taxi':
        return 'Taxi-Moto';
      case 'delivery':
        return 'Livraison';
      case 'livreur':
        return 'Livreur';
      default:
        return serviceName;
    }
  };

  const getServiceColor = (serviceName: string) => {
    switch (serviceName) {
      case 'wallet_transfer':
        return ' border-[#04439e]/30';
      case 'subscription':
        return ' border-[#ff4000]/30';
      case 'marketplace':
        return ' border-[#ff4000]/30';
      case 'taxi':
        return ' border-blue-500/30';
      case 'delivery':
        return ' border-orange-500/30';
      case 'livreur':
        return ' border-[#04439e]/30';
      default:
        return ' border-gray-500/30';
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="summary" className="space-y-4 sm:space-y-6">
      <div className="overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
        <TabsList className="inline-flex w-max sm:w-full sm:max-w-md sm:grid sm:grid-cols-2 gap-1 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="summary" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{t('platformRevenueOverview.resume')}</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{t('platformRevenueOverview.transactionsDetaillees')}</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="summary" className="space-y-4 sm:space-y-6">
        {/* Résumé Global - Mobile: Full width single column */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff4000]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-2 sm:pb-3 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#ff4000]/10 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ff4000]" />
                </div>
                <span className="truncate">Revenus Totaux Plateforme</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-1.5 sm:space-y-2">
                <p className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {formatAmount(revenues?.total_revenue || 0)}
                </p>
                <p className="text-[10px] sm:text-xs text-[#ff4000] flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Tous services confondus
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-2 sm:pb-3 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                </div>
                <span className="truncate">Commissions Totales</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-1.5 sm:space-y-2">
                <p className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {formatAmount(revenues?.total_commission || 0)}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {revenues?.total_transactions || 0} transactions
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group sm:col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-br from-[#04439e]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-2 sm:pb-3 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#04439e]/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#04439e]" />
                </div>
                <span className="truncate">{t('platformRevenueOverview.tauxDeCommissionMoyen')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-1.5 sm:space-y-2">
                <p className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {revenues?.total_revenue && revenues?.total_commission
                    ? ((revenues.total_commission / revenues.total_revenue) * 100).toFixed(2)
                    : 0}%
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Calculé sur tous les services
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Détail par Service - Mobile optimized */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                  <span className="truncate">{t('platformRevenueOverview.revenusParService')}</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">{t('platformRevenueOverview.detailParTypeDeService')}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-2 w-full sm:w-auto"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="sm:inline">Actualiser</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="space-y-3 sm:space-y-4">
              {!revenues?.services || revenues.services.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucune transaction enregistrée pour le moment
                </div>
              ) : (
                revenues.services
                  .filter(service => service.transaction_count > 0)
                  .map((service, index) => (
                  <div
                    key={service.service_name}
                    className={`p-3 sm:p-6 rounded-xl bg-gradient-to-br border transition-all duration-300 hover:shadow-lg animate-fade-in ${getServiceColor(service.service_name)}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-background/50 flex items-center justify-center flex-shrink-0">
                          {getServiceIcon(service.service_name)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm sm:text-lg truncate">{getServiceLabel(service.service_name)}</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {service.transaction_count} transaction{service.transaction_count > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1 mt-2 sm:mt-0 pl-13 sm:pl-0">
                        <p className="text-lg sm:text-2xl font-bold">
                          {formatAmount(service.total_revenue)}
                        </p>
                        {service.total_commission > 0 && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] sm:text-xs whitespace-nowrap">
                            +{formatAmount(service.total_commission)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Information - Mobile optimized */}
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div className="space-y-2 min-w-0">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm sm:text-base">
                  💡 Fonctionnement des Commissions
                </h4>
                <ul className="text-xs sm:text-sm space-y-1 text-blue-800 dark:text-blue-200 list-disc list-inside">
                  <li>{t('platformRevenueOverview.lesCommissionsSontCalculeesAutomatiqueme')}</li>
                  <li>{t('platformRevenueOverview.chaqueServiceASaPropre')}</li>
                  <li className="hidden sm:list-item">{t('platformRevenueOverview.lesFraisSontAutomatiquementAppliques')}</li>
                  <li className="hidden sm:list-item">{t('platformRevenueOverview.lesRevenusSontTrackesEn')}</li>
                  <li className="hidden sm:list-item">{t('platformRevenueOverview.lesConfigurationsPeuventEtreModifiees')}</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="details">
        <DetailedTransactionsList />
      </TabsContent>
    </Tabs>
  );
}
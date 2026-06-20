/**
 * 🎨 DASHBOARD PDG - VUE D'ENSEMBLE
 * KPIs et statistiques RÉELLES en temps réel depuis Supabase
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Package,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  RefreshCw,
  UserCheck,
  Building2,
  Wallet,
  Shield,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePDGStats } from '@/hooks/usePDGStats';
import { WalletBalanceDisplay } from '@/components/wallet/WalletBalanceDisplay';
import { useAuth } from '@/hooks/useAuth';
import { backendFetch } from '@/services/backendApi';

interface PDGDashboardHomeProps {
  onNavigate?: (tab: string) => void;
}

interface CoreFeatureHealth24h {
  lastStatus: 'success' | 'degraded' | 'failure' | null;
  total: number;
  failures: number;
  degraded: number;
}

interface CoreFeatureRegistryRow {
  feature_key: string;
  health24h?: CoreFeatureHealth24h;
}

export function PDGDashboardHome({ onNavigate }: PDGDashboardHomeProps) {
  const { t } = useTranslation();
  const stats = usePDGStats();
  const { user } = useAuth();
  const [coreSummaryLoading, setCoreSummaryLoading] = useState(false);
  const [coreSummary, setCoreSummary] = useState({
    totalFeatures: 0,
    totalEvents24h: 0,
    failures24h: 0,
    degraded24h: 0,
  });

  useEffect(() => {
    if (!user?.id) return;

    const loadCoreSummary = async () => {
      setCoreSummaryLoading(true);
      try {
        const response = await backendFetch<CoreFeatureRegistryRow[]>('/api/core/supervision/feature-registry', {
          method: 'GET',
        });

        if (!response.success) {
          return;
        }

        const payload: any = response.data;
        const rows: CoreFeatureRegistryRow[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.features)
          ? payload.features
          : [];

        if (rows.length === 0) {
          setCoreSummary({
            totalFeatures: 0,
            totalEvents24h: 0,
            failures24h: 0,
            degraded24h: 0,
          });
          return;
        }
        const totalEvents24h = rows.reduce((sum, row) => sum + (row.health24h?.total || 0), 0);
        const failures24h = rows.reduce((sum, row) => sum + (row.health24h?.failures || 0), 0);
        const degraded24h = rows.reduce((sum, row) => sum + (row.health24h?.degraded || 0), 0);

        setCoreSummary({
          totalFeatures: rows.length,
          totalEvents24h,
          failures24h,
          degraded24h,
        });
      } catch {
        // Best effort only for dashboard summary block.
      } finally {
        setCoreSummaryLoading(false);
      }
    };

    loadCoreSummary();
    const intervalId = window.setInterval(loadCoreSummary, 60000);
    return () => window.clearInterval(intervalId);
  }, [user?.id]);

  if (stats.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-muted-foreground">{t('pDGDashboardHome.chargementDesStatistiques')}</span>
        </div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">{t('pDGDashboardHome.erreurDeChargement')}</p>
              <p className="text-sm text-muted-foreground">{stats.error}</p>
            </div>
            <Button onClick={stats.refresh} variant="outline" size="sm" className="ml-auto">
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const kpis = [
    {
      title: 'Chiffre d\'Affaires',
      value: stats.totalRevenue || '0 GNF',
      change: `${(stats.revenueGrowth || 0) >= 0 ? '+' : ''}${stats.revenueGrowth || 0}%`,
      trend: (stats.revenueGrowth || 0) >= 0 ? 'up' : 'down',
      icon: DollarSign,
      color: 'text-[#ff4000] bg-[#ff4000]/10 border-[#ff4000]/20',
      description: 'vs mois dernier'
    },
    {
      title: 'Utilisateurs Plateforme',
      value: (stats.totalUsers || 0).toLocaleString(),
      change: `${(stats.userGrowth || 0) >= 0 ? '+' : ''}${stats.userGrowth || 0}%`,
      trend: (stats.userGrowth || 0) >= 0 ? 'up' : 'down',
      icon: Users,
      color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
      description: `${stats.newUsersThisMonth || 0} nouveaux ce mois`
    },
    {
      title: 'Agents Actifs',
      value: (stats.activeAgents || 0).toLocaleString(),
      change: '+0%',
      trend: 'up',
      icon: UserCheck,
      color: 'text-[#ff4000] bg-[#ff4000]/10 border-[#ff4000]/20',
      description: `${stats.totalAgents || 0} agents au total`
    },
    {
      title: 'Commandes',
      value: (stats.totalOrders || 0).toLocaleString(),
      change: `${(stats.ordersGrowth || 0) >= 0 ? '+' : ''}${stats.ordersGrowth || 0}%`,
      trend: (stats.ordersGrowth || 0) >= 0 ? 'up' : 'down',
      icon: Package,
      color: 'text-[#04439e] bg-[#04439e]/10 border-[#04439e]/20',
      description: `${stats.ordersThisMonth || 0} ce mois`
    },
    {
      title: 'Taux de Conversion',
      value: `${stats.conversionRate || 0}%`,
      change: `${(stats.conversionGrowth || 0) >= 0 ? '+' : ''}${stats.conversionGrowth || 0}%`,
      trend: (stats.conversionGrowth || 0) >= 0 ? 'up' : 'down',
      icon: Activity,
      color: 'text-orange-600 bg-orange-500/10 border-orange-500/20',
      description: 'commandes / utilisateurs'
    },
  ];

  const alerts = [
    {
      type: 'warning',
      message: `${stats.pendingValidations || 0} commande(s) en attente de traitement`,
      icon: Clock,
      color: 'text-[#ff4000] bg-[#ff4000]/10 border-[#ff4000]/20',
      action: 'orders',
      show: (stats.pendingValidations || 0) > 0
    },
    {
      type: 'error',
      message: `${stats.criticalAlerts || 0} alerte(s) API critique(s) nécessitent votre attention`,
      icon: AlertCircle,
      color: 'text-[#ff4000] bg-[#ff4000]/10 border-[#ff4000]/20',
      action: 'security',
      show: (stats.criticalAlerts || 0) > 0
    },
    {
      type: 'success',
      message: `${stats.activeVendors || 0} vendeurs actifs sur ${stats.totalVendors || 0}`,
      icon: CheckCircle,
      color: 'text-[#ff4000] bg-[#ff4000]/10 border-[#ff4000]/20',
      action: 'vendors',
      show: true
    },
    {
      type: 'info',
      message: `${stats.onlineDrivers || 0} livreurs en ligne sur ${stats.totalDrivers || 0}`,
      icon: Activity,
      color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
      action: 'drivers',
      show: true
    },
  ].filter(alert => alert.show);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPIs Grid - 2x2 on mobile, then responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;

          return (
            <Card
              key={kpi.title}
              className="relative overflow-hidden hover:shadow-xl transition-all duration-300 group border border-border/40 bg-card/50 backdrop-blur-sm"
            >
              <div className="absolute top-0 right-0 w-20 sm:w-32 h-20 sm:h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full -mr-10 sm:-mr-16 -mt-10 sm:-mt-16 group-hover:scale-110 transition-transform duration-500" />

              <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 space-y-0 relative z-10 p-3 sm:p-6">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate pr-1">
                  {kpi.title}
                </CardTitle>
                <div className={cn("p-1.5 sm:p-2 rounded-lg flex-shrink-0", kpi.color)}>
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
              </CardHeader>

              <CardContent className="relative z-10 p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <div className="text-lg sm:text-3xl font-bold truncate">{kpi.value}</div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-0.5 sm:gap-1 text-[10px] sm:text-xs w-fit",
                      kpi.trend === 'up' ? 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20' : 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20'
                    )}
                  >
                    <TrendIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    {kpi.change}
                  </Badge>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2 truncate">{kpi.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wallet PDG */}
        <Card className="border border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Wallet PDG
                </CardTitle>
                <CardDescription>{t('pDGDashboardHome.soldeEtGestionDuWallet')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {user?.id ? (
              <WalletBalanceDisplay userId={user.id} compact={false} />
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('pDGDashboardHome.connexionRequise')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="border border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Alertes & Notifications
            </CardTitle>
            <CardDescription>{t('pDGDashboardHome.evenementsImportantsNecessitantVotreAtte')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, index) => {
              const AlertIcon = alert.icon;
              return (
                <button
                  key={index}
                  onClick={() => onNavigate?.(alert.action)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer hover:scale-[1.02]",
                    alert.color
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center flex-shrink-0">
                    <AlertIcon className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-medium flex-1 text-left">{alert.message}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Stats Détaillées */}
        <Card className="border border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Statistiques Détaillées
                </CardTitle>
                <CardDescription>{t('pDGDashboardHome.vueDEnsembleDeLa')}</CardDescription>
              </div>
              <Button onClick={stats.refresh} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-1 sm:space-y-2 p-2 sm:p-0 bg-muted/30 sm:bg-transparent rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground">{t('pDGDashboardHome.produits')}</p>
                <p className="text-xl sm:text-2xl font-bold">{stats.totalProducts || 0}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stats.activeProducts || 0} actifs</p>
              </div>
              <div className="space-y-1 sm:space-y-2 p-2 sm:p-0 bg-muted/30 sm:bg-transparent rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground">Vendeurs</p>
                <p className="text-xl sm:text-2xl font-bold">{stats.totalVendors || 0}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stats.activeVendors || 0} actifs</p>
              </div>
              <div className="space-y-1 sm:space-y-2 p-2 sm:p-0 bg-muted/30 sm:bg-transparent rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground">Agents</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{stats.totalAgents || 0}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stats.activeAgents || 0} actifs</p>
              </div>
              <div className="space-y-1 sm:space-y-2 p-2 sm:p-0 bg-muted/30 sm:bg-transparent rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground">Livreurs</p>
                <p className="text-xl sm:text-2xl font-bold">{stats.totalDrivers || 0}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stats.onlineDrivers || 0} en ligne</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
          <CardDescription>{t('pDGDashboardHome.accesRapideAuxFonctionnalitesPrincipales')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            {[
              {
                label: 'Utilisateurs',
                labelFull: 'Valider Utilisateurs',
                icon: Users,
                color: '',
                action: 'users',
                count: stats.totalUsers || 0,
              },
              {
                label: 'Certif',
                labelFull: 'Certifier Vendeurs',
                icon: Shield,
                color: '',
                action: 'vendor-certification',
                count: stats.totalVendors || 0,
              },
              {
                label: 'Finances',
                labelFull: 'Gérer Finances',
                icon: DollarSign,
                color: '',
                action: 'finance',
                count: stats.totalRevenue || '0 GNF',
              },
              {
                label: 'Sécurité',
                labelFull: 'Vérifier Sécurité',
                icon: AlertCircle,
                color: '',
                action: 'security',
                count: stats.criticalAlerts || 0,
              },
              {
                label: 'Rapports',
                labelFull: 'Voir Rapports',
                icon: Activity,
                color: '',
                action: 'reports',
                count: stats.totalOrders || 0,
              },
            ].map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => onNavigate?.(action.action)}
                  className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-border/40 hover:border-primary/40 bg-card hover:shadow-lg transition-all duration-200 group cursor-pointer"
                >
                  <div className={cn(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform",
                    action.color
                  )}>
                    <ActionIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs sm:text-sm font-medium text-center">
                      <span className="sm:hidden">{action.label}</span>
                      <span className="hidden sm:inline">{action.labelFull}</span>
                    </span>
                    <Badge variant="secondary" className="mt-1 text-[10px] sm:text-xs">
                      {typeof action.count === 'number' ? action.count.toLocaleString() : action.count}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Management Sections - Agents & Syndicats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gestion des Agents */}
        <Card
          className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-50 dark:from-[#ff4000] dark:to-[#ff4000] hover:shadow-xl transition-all duration-300 cursor-pointer group"
          onClick={() => onNavigate?.('agents')}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#ff4000] text-white group-hover:scale-110 transition-transform">
                  <UserCheck className="w-5 h-5" />
                </div>
                Gestion des Agents
              </CardTitle>
              <Badge variant="secondary" className="bg-[#ff4000] text-white">
                Opérationnel
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Gérez votre réseau d'agents commerciaux avec permissions, commissions et suivi des performances en temps réel
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Agents</p>
                <p className="text-lg font-bold text-[#ff4000]">{stats.totalAgents || 0}</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Actifs</p>
                <p className="text-lg font-bold text-[#ff4000]">{stats.activeAgents || 0}</p>
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-[#ff4000] hover:bg-[#ff4000] group-hover:scale-105 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.('agents');
              }}
            >
              Accéder à la gestion
            </Button>
          </CardContent>
        </Card>

        {/* Surveillance Logique Globale */}
        <Card
          className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50 dark:from-[#04439e] dark:to-[#04439e] hover:shadow-xl transition-all duration-300 cursor-pointer group"
          onClick={() => onNavigate?.('debug')}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#04439e] text-white group-hover:scale-110 transition-transform">
                  <Eye className="w-5 h-5" />
                </div>
                Surveillance Logique
              </CardTitle>
              <Badge variant="secondary" className="bg-[#04439e] text-white">
                Sécurité
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Monitez 120 règles métier en temps réel, détectez les anomalies au sein d'une minute et appliquez les corrections automatiquement
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('pDGDashboardHome.detection')}</p>
                <p className="text-lg font-bold text-[#04439e]">1 min</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Couverture</p>
                <p className="text-lg font-bold text-[#04439e]">100%</p>
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-[#04439e] hover:bg-[#04439e] group-hover:scale-105 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.('debug');
              }}
            >
              Accéder à la surveillance
            </Button>
          </CardContent>
        </Card>

        {/* Gestion des Bureaux Syndicats */}
        <Card
          className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-950 dark:to-[#04439e] hover:shadow-xl transition-all duration-300 cursor-pointer group"
          onClick={() => onNavigate?.('syndicat')}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-600 text-white group-hover:scale-110 transition-transform">
                  <Building2 className="w-5 h-5" />
                </div>
                Bureaux Syndicaux
              </CardTitle>
              <Badge variant="secondary" className="bg-blue-600 text-white">
                Opérationnel
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Administrez les bureaux syndicaux de taxi-motos avec accès sécurisé, gestion des membres et cotisations
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Bureaux</p>
                <p className="text-lg font-bold text-blue-600">{stats.totalBureaus || 0}</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('pDGDashboardHome.valides')}</p>
                <p className="text-lg font-bold text-blue-600">{stats.validatedBureaus || 0}</p>
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 group-hover:scale-105 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.('syndicat');
              }}
            >
              Accéder à la gestion
            </Button>
          </CardContent>
        </Card>

        {/* Supervision Core (visible sur Home PDG) */}
        <Card
          className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-50 dark:from-[#ff4000] dark:to-[#ff4000] hover:shadow-xl transition-all duration-300 cursor-pointer group"
          onClick={() => onNavigate?.('api')}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#ff4000] text-white group-hover:scale-110 transition-transform">
                  <Eye className="w-5 h-5" />
                </div>
                Supervision Core
              </CardTitle>
              <Badge variant="secondary" className="bg-[#ff4000] text-white">
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Surveillance centralisée Identity/Payment/Commerce/Intelligence avec état de santé 24h.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Features</p>
                <p className="text-lg font-bold text-[#ff4000]">{coreSummaryLoading ? '...' : coreSummary.totalFeatures}</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('pDGDashboardHome.evenements24h')}</p>
                <p className="text-lg font-bold text-[#ff4000]">{coreSummaryLoading ? '...' : coreSummary.totalEvents24h}</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Failures</p>
                <p className="text-lg font-bold text-[#ff4000]">{coreSummaryLoading ? '...' : coreSummary.failures24h}</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Degraded</p>
                <p className="text-lg font-bold text-[#ff4000]">{coreSummaryLoading ? '...' : coreSummary.degraded24h}</p>
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-[#ff4000] hover:bg-[#ff4000] group-hover:scale-105 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.('api');
              }}
            >
              Ouvrir la supervision API/Core
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

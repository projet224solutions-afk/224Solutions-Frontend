/**
 * Dashboard Dropshipping Chine
 * Vue d'ensemble des opérations Chine
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package,
  TrendingUp,
  Clock,
  AlertTriangle,
  Globe,
  Star,
  Ship,
  RefreshCw
} from 'lucide-react';
import { useDropshippingChina } from '@/hooks/useDropshippingChina';

export function ChinaDashboard() {
  const { t } = useTranslation();
  const { stats, priceAlerts, chinaProducts, loading, refresh } = useDropshippingChina();

  const statCards = [
    {
      title: 'Produits Chine',
      value: stats?.totalChinaProducts || 0,
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950'
    },
    {
      title: 'Commandes Chine',
      value: stats?.totalChinaOrders || 0,
      icon: Ship,
      color: 'text-[#ff4000]',
      bgColor: 'bg-orange-50 dark:bg-[#ff4000]'
    },
    {
      title: 'Marge moyenne',
      value: `${stats?.averageMargin || 0}%`,
      icon: TrendingUp,
      color: 'text-[#ff4000]',
      bgColor: 'bg-orange-50 dark:bg-[#ff4000]'
    },
    {
      title: 'Délai moyen',
      value: `${stats?.averageDeliveryDays || 0}j`,
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950'
    },
    {
      title: 'Alertes prix',
      value: stats?.pendingAlerts || 0,
      icon: AlertTriangle,
      color: 'text-[#ff4000]',
      bgColor: 'bg-orange-50 dark:bg-[#ff4000]'
    },
    {
      title: 'Score fournisseurs',
      value: stats?.supplierScoreAverage || 0,
      icon: Star,
      color: 'text-[#ff4000]',
      bgColor: 'bg-orange-50 dark:bg-[#ff4000]'
    }
  ];

  const platformColors: Record<string, string> = {
    ALIBABA: 'bg-orange-500',
    ALIEXPRESS: 'bg-[#ff4000]',
    '1688': 'bg-blue-600',
    PRIVATE: 'bg-gray-500'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-[#ff4000]">
            <Globe className="h-6 w-6 text-[#ff4000]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Dropshipping Chine</h2>
            <p className="text-muted-foreground">
              Alibaba • AliExpress • 1688
            </p>
          </div>
        </div>
        <Button onClick={refresh} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className={stat.bgColor}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertes prix récentes */}
      {priceAlerts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Alertes Prix ({priceAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {priceAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg"
                >
                  <div>
                    <Badge variant={alert.alert_type === 'increase' ? 'destructive' : 'default'}>
                      {alert.alert_type === 'increase' ? '↑ Hausse' :
                       alert.alert_type === 'decrease' ? '↓ Baisse' : '⚠ Indisponible'}
                    </Badge>
                    <span className="ml-2 text-sm">
                      {alert.change_percent > 0 ? '+' : ''}{alert.change_percent}%
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Produits récents par plateforme */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('chinaDashboard.produitsParPlateforme')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['ALIBABA', 'ALIEXPRESS', '1688', 'PRIVATE'].map((platform) => {
                const count = chinaProducts.filter(
                  p => p.platform_type === platform
                ).length;
                const percentage = chinaProducts.length
                  ? (count / chinaProducts.length * 100).toFixed(0)
                  : 0;

                return (
                  <div key={platform} className="flex items-center gap-3">
                    <Badge className={platformColors[platform]}>
                      {platform}
                    </Badge>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`h-full rounded-full ${platformColors[platform]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Logistique</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Taux blocage douane</span>
                <Badge variant="outline" className="text-[#ff4000]">
                  {stats?.customsBlockedRate || 0}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">{t('chinaDashboard.delaiMoyenLivraison')}</span>
                <Badge variant="outline">
                  {stats?.averageDeliveryDays || 0} jours
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Plateforme top</span>
                <Badge className={platformColors[stats?.topPlatform || 'ALIEXPRESS']}>
                  {stats?.topPlatform || 'ALIEXPRESS'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Score fournisseurs moyen</span>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-[#ff4000] fill-[#ff4000]" />
                  <span className="font-medium">{stats?.supplierScoreAverage || 0}/5</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { useTrafficAnalytics } from "@/hooks/useTrafficAnalytics";
import { Eye, Users, MousePointer, Store, TrendingUp, Smartphone, Globe, MapPin } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#ff4000', '#ff4000', '#ff4000', '#04439e'];

export function TrafficAnalyticsSection() {
  const { t } = useTranslation();
  const { stats, loading, error } = useTrafficAnalytics();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Trafic & Visites</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <p className="text-destructive">Erreur: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Eye className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('trafficAnalyticsSection.aucuneDonneeDeTraficDisponible')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Les statistiques apparaîtront ici une fois que les visiteurs commenceront à consulter vos produits.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Préparer les données pour les graphiques
  const deviceData = Object.entries(stats.deviceBreakdown).map(([name, value]) => ({
    name: name === 'mobile' ? 'Mobile' : name === 'desktop' ? 'Desktop' : name === 'tablet' ? 'Tablette' : name,
    value
  }));

  const countryData = Object.entries(stats.countryBreakdown)
    .slice(0, 5)
    .map(([name, value]) => ({
      name: name === 'unknown' ? 'Inconnu' : name.toUpperCase(),
      value
    }));

  const cityData = Object.entries(stats.cityBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, value]) => ({
      name: name === 'unknown' ? 'Inconnu' : name,
      value
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Eye className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Trafic & Visites</h2>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('trafficAnalyticsSection.vuesProduits')}</p>
                <p className="text-2xl font-bold">{stats.totalProductViews.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  Aujourd'hui: {stats.todayProductViews}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Users className="w-5 h-5 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Visiteurs uniques</p>
                <p className="text-2xl font-bold">{stats.uniqueProductViewers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">30 derniers jours</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Store className="w-5 h-5 text-[#04439e]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('trafficAnalyticsSection.visitesBoutique')}</p>
                <p className="text-2xl font-bold">{stats.totalShopVisits.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  Aujourd'hui: {stats.todayShopVisits}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <MousePointer className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taux d'engagement</p>
                <p className="text-2xl font-bold">
                  {stats.uniqueShopVisitors > 0
                    ? ((stats.uniqueProductViewers / stats.uniqueShopVisitors) * 100).toFixed(1)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Vues / Visiteurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique de tendance */}
      {stats.weeklyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Évolution du trafic (7 derniers jours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(label) => new Date(label).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="productViews"
                  name="Vues produits"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="shopVisits"
                  name="Visites boutique"
                  stroke="#ff4000"
                  fill="#ff4000"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Répartition par appareil et pays */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Appareils */}
        {deviceData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Répartition par appareil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {deviceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Pays */}
        {countryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Top 5 pays
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={countryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={60} />
                  <Tooltip />
                  <Bar dataKey="value" name="Visites" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Villes */}
        {cityData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Top 10 villes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {cityData.map((city, index) => (
                  <div key={city.name} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-primary text-primary-foreground rounded-full text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium">{city.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{city.value} visites</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Message si pas de données détaillées */}
      {stats.totalProductViews === 0 && stats.totalShopVisits === 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-6 text-center">
            <Eye className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{t('trafficAnalyticsSection.pasEncoreDeDonneesDe')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Les statistiques de vues et visites apparaîtront ici une fois que les visiteurs commenceront à consulter votre boutique et vos produits.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

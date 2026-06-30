/**
 * 📊 ANALYTIQUES API - GRAPHIQUES EN TEMPS RÉEL
 * Affiche les statistiques détaillées d'utilisation des API
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { ApiConnection, ApiUsageLog, ApiMonitoringService } from '@/services/apiMonitoring';
import { Activity, Zap,
  Clock, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface ApiAnalyticsProps {
  apis: ApiConnection[];
}

export default function ApiAnalytics({ apis }: ApiAnalyticsProps) {
  const { t } = useTranslation();
  const [_timeRange, _setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [loading, setLoading] = useState(false);
  const [allLogs, setAllLogs] = useState<ApiUsageLog[]>([]);

  useEffect(() => {
    loadAllLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apis]);

  const loadAllLogs = async () => {
    setLoading(true);
    try {
      const logsPromises = apis.map(api =>
        ApiMonitoringService.getApiUsageLogs(api.id, 500)
      );
      const logsArrays = await Promise.all(logsPromises);
      const combined = logsArrays.flat();
      setAllLogs(combined);
    } catch (error) {
      console.error('Erreur chargement logs:', error);
      toast.error(t('apiAnalytics.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  // Calculer les statistiques
  const stats = {
    totalRequests: allLogs.length,
    successRate: allLogs.length > 0
      ? ((allLogs.filter(log => log.status_code && log.status_code < 400).length / allLogs.length) * 100).toFixed(1)
      : '0',
    avgResponseTime: allLogs.length > 0
      ? Math.round(allLogs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / allLogs.length)
      : 0,
    totalTokens: allLogs.reduce((sum, log) => sum + log.tokens_consumed, 0),
    errorRate: allLogs.length > 0
      ? ((allLogs.filter(log => log.status_code && log.status_code >= 400).length / allLogs.length) * 100).toFixed(1)
      : '0'
  };

  // Données pour graphique temporel (derniers 30 jours)
  const getLast30Days = () => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      days.push(date);
    }
    return days;
  };

  const timeSeriesData = getLast30Days().map(date => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayLogs = allLogs.filter(log => {
      const logDate = new Date(log.created_at);
      return logDate >= date && logDate < nextDate;
    });

    return {
      date: date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      requetes: dayLogs.length,
      tokens: dayLogs.reduce((sum, log) => sum + log.tokens_consumed, 0),
      erreurs: dayLogs.filter(log => log.status_code && log.status_code >= 400).length,
      tempsReponse: dayLogs.length > 0
        ? Math.round(dayLogs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / dayLogs.length)
        : 0
    };
  });

  // Répartition par API
  const apiUsageData = apis.map(api => {
    const apiLogs = allLogs.filter(log => log.api_connection_id === api.id);
    return {
      name: api.api_name,
      requests: apiLogs.length,
      tokens: apiLogs.reduce((sum, log) => sum + log.tokens_consumed, 0),
      avgTime: apiLogs.length > 0
        ? Math.round(apiLogs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / apiLogs.length)
        : 0
    };
  }).filter(d => d.requests > 0);

  // Performance par API (radar chart)
  const performanceData = apis.slice(0, 5).map(api => {
    const apiLogs = allLogs.filter(log => log.api_connection_id === api.id);
    const successRate = apiLogs.length > 0
      ? (apiLogs.filter(log => log.status_code && log.status_code < 400).length / apiLogs.length) * 100
      : 0;

    return {
      api: api.api_name.substring(0, 15),
      fiabilite: Math.round(successRate),
      vitesse: apiLogs.length > 0 ? Math.max(0, 100 - (apiLogs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / apiLogs.length / 50)) : 0,
      utilisation: Math.min(100, (apiLogs.length / 100) * 100),
    };
  });

  // Distribution des codes de statut
  const statusDistribution = [
    { name: '2xx Succès', value: allLogs.filter(log => log.status_code && log.status_code >= 200 && log.status_code < 300).length, color: '#ff4000' },
    { name: '4xx Client', value: allLogs.filter(log => log.status_code && log.status_code >= 400 && log.status_code < 500).length, color: '#ff4000' },
    { name: '5xx Serveur', value: allLogs.filter(log => log.status_code && log.status_code >= 500).length, color: '#ff4000' }
  ].filter(item => item.value > 0);

  const _COLORS = ['#04439e', '#ff4000', '#ff4000', '#ff4000', '#04439e', '#ff4000'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">{t('apiAnalytics.chargementDesAnalytiques')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('apiAnalytics.totalRequetes')}</p>
                <p className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('apiAnalytics.tauxDeSucces')}</p>
                <p className="text-2xl font-bold text-[#ff4000]">{stats.successRate}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Temps moyen</p>
                <p className="text-2xl font-bold">{stats.avgResponseTime}ms</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tokens totaux</p>
                <p className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</p>
              </div>
              <Zap className="h-8 w-8 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux d'erreur</p>
                <p className="text-2xl font-bold text-[#ff4000]">{stats.errorRate}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques détaillés */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Chronologie</TabsTrigger>
          <TabsTrigger value="apis">Par API</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="status">Statuts HTTP</TabsTrigger>
        </TabsList>

        {/* Chronologie */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('apiAnalytics.activiteSur30Jours')}</CardTitle>
              <CardDescription>{t('apiAnalytics.evolutionDesRequetesEtTokens')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorRequetes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#04439e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#04439e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff4000" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ff4000" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="requetes" stroke="#04439e" fillOpacity={1} fill="url(#colorRequetes)" />
                  <Area type="monotone" dataKey="tokens" stroke="#ff4000" fillOpacity={1} fill="url(#colorTokens)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('apiAnalytics.tempsDeReponseEtErreurs')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="tempsReponse" stroke="#04439e" strokeWidth={2} name="Temps (ms)" />
                  <Line yAxisId="right" type="monotone" dataKey="erreurs" stroke="#ff4000" strokeWidth={2} name="Erreurs" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Par API */}
        <TabsContent value="apis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Utilisation par API</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={apiUsageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="requests" fill="#04439e" name="Requêtes" />
                  <Bar dataKey="tokens" fill="#ff4000" name="Tokens" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('apiAnalytics.radarDePerformance')}</CardTitle>
              <CardDescription>{t('apiAnalytics.comparaisonDesApiPrincipales')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={performanceData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="api" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="Fiabilité" dataKey="fiabilite" stroke="#ff4000" fill="#ff4000" fillOpacity={0.6} />
                  <Radar name="Vitesse" dataKey="vitesse" stroke="#04439e" fill="#04439e" fillOpacity={0.6} />
                  <Radar name="Utilisation" dataKey="utilisation" stroke="#ff4000" fill="#ff4000" fillOpacity={0.6} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statuts HTTP */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('apiAnalytics.distributionDesCodesHttp')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#04439e"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * MONITORING DASHBOARD - Production-grade realtime monitoring
 * 224Solutions - PDG/Admin SOC-level dashboard
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, Clock,
  RefreshCw, Shield, Database, Server, Wifi, Search,
  Bell, Eye, CheckCheck, Zap, Globe, Smartphone,
  TrendingUp, ArrowLeft
} from 'lucide-react';
import { useMonitoringRealtime, type MonitoringAlert, type ServiceStatus } from '@/hooks/useMonitoringRealtime';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const severityColors: Record<string, string> = {
  critical: 'bg-[#ff4000] text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-[#ff4000] text-black',
  low: 'bg-blue-500 text-white',
  info: 'bg-muted text-muted-foreground',
};

const statusIcons: Record<string, React.ReactNode> = {
  healthy: <CheckCircle className="h-4 w-4 text-[#ff4000]" />,
  degraded: <AlertTriangle className="h-4 w-4 text-[#ff4000]" />,
  critical: <XCircle className="h-4 w-4 text-[#ff4000]" />,
  unknown: <Clock className="h-4 w-4 text-muted-foreground" />,
  maintenance: <Zap className="h-4 w-4 text-blue-500" />,
};

const serviceIcons: Record<string, React.ReactNode> = {
  auth: <Shield className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  payments: <TrendingUp className="h-4 w-4" />,
  edge_functions: <Server className="h-4 w-4" />,
  realtime: <Wifi className="h-4 w-4" />,
  pwa: <Smartphone className="h-4 w-4" />,
  marketplace: <Globe className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
};

export default function MonitoringDashboard() {
  const navigate = useNavigate();
  const { alerts, services, stats, loading, lastRefresh, acknowledgeAlert, resolveAlert, forceHealthCheck, refreshData } = useMonitoringRealtime();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filteredAlerts = alerts.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase()) && !a.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const openAlerts = filteredAlerts.filter(a => a.status === 'open');
  const acknowledgedAlerts = filteredAlerts.filter(a => a.status === 'acknowledged');
  const resolvedAlerts = filteredAlerts.filter(a => a.status === 'resolved');

  const handleAcknowledge = async (id: string) => {
    const ok = await acknowledgeAlert(id);
    if (ok) toast.success('Alerte acquittée');
  };

  const handleResolve = async (id: string) => {
    const ok = await resolveAlert(id);
    if (ok) toast.success('Alerte résolue');
  };

  const handleForceCheck = async () => {
    toast.info('Health check en cours...');
    await forceHealthCheck();
    toast.success('Health check terminé');
  };

  const overallBg = stats.overallStatus === 'healthy' ? 'bg-[#ff4000]/10 border-[#ff4000]/30'
    : stats.overallStatus === 'degraded' ? 'bg-[#ff4000]/10 border-[#ff4000]/30'
    : stats.overallStatus === 'critical' ? 'bg-[#ff4000]/10 border-[#ff4000]/30'
    : 'bg-muted/10 border-border';

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pdg')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Monitoring Temps Réel
            </h1>
            <p className="text-sm text-muted-foreground">
              Dernière MAJ: {formatDistanceToNow(lastRefresh, { addSuffix: true, locale: fr })}
              {' à '}Realtime actif
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleForceCheck}>
            <Zap className="h-4 w-4 mr-1" /> Health Check
          </Button>
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Rafraëchir
          </Button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div className={`rounded-lg border p-4 ${overallBg}`}>
        <div className="flex items-center gap-3">
          {statusIcons[stats.overallStatus]}
          <span className="font-semibold text-lg">
            Système {stats.overallStatus === 'healthy' ? 'Opérationnel' : stats.overallStatus === 'degraded' ? 'Dégradé' : stats.overallStatus === 'critical' ? 'Critique' : 'Inconnu'}
          </span>
          <span className="text-sm text-muted-foreground ml-auto">
            {stats.healthyServices}/{stats.totalServices} services OK
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground">Alertes ouvertes</div>
            <div className="text-2xl font-bold text-orange-500">{stats.openAlerts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground">Critiques</div>
            <div className="text-2xl font-bold text-[#ff4000]">{stats.criticalAlerts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground">Services sains</div>
            <div className="text-2xl font-bold text-[#ff4000]">{stats.healthyServices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground">Services dégradés</div>
            <div className="text-2xl font-bold text-[#ff4000]">{stats.degradedServices + stats.criticalServices}</div>
          </CardContent>
        </Card>
      </div>

      {/* Services Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" /> Santé des services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {services.map(s => (
              <div key={s.service_name} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {serviceIcons[s.service_name] || <Activity className="h-4 w-4" />}
                  <span className="truncate">{s.display_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {statusIcons[s.status]}
                  <span className="text-xs capitalize">{s.status}</span>
                </div>
                {s.response_time_ms != null && (
                  <div className="text-xs text-muted-foreground">{s.response_time_ms}ms</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" /> Alertes ({filteredAlerts.length})
            </CardTitle>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-7 h-8 w-48 text-sm"
                />
              </div>
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="h-8 text-xs border rounded px-2 bg-background"
              >
                <option value="all">Toutes</option>
                <option value="critical">Critique</option>
                <option value="high">Haute</option>
                <option value="medium">Moyenne</option>
                <option value="low">Basse</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="open">
            <TabsList className="mb-3">
              <TabsTrigger value="open" className="text-xs">
                Ouvertes ({openAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="acknowledged" className="text-xs">
                Acquittées ({acknowledgedAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs">
                Résolues ({resolvedAlerts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              <AlertList alerts={openAlerts} onAcknowledge={handleAcknowledge} onResolve={handleResolve} showActions />
            </TabsContent>
            <TabsContent value="acknowledged">
              <AlertList alerts={acknowledgedAlerts} onResolve={handleResolve} showResolve />
            </TabsContent>
            <TabsContent value="resolved">
              <AlertList alerts={resolvedAlerts} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertList({ alerts, onAcknowledge, onResolve, showActions, showResolve }: {
  alerts: MonitoringAlert[];
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
  showActions?: boolean;
  showResolve?: boolean;
}) {
  if (alerts.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucune alerte</p>;
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {alerts.map(alert => (
        <div key={alert.id} className="border rounded-lg p-3 flex items-start gap-3">
          <Badge className={`${severityColors[alert.severity]} text-[10px] px-1.5 py-0.5 shrink-0`}>
            {alert.severity}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{alert.title}</div>
            <div className="text-xs text-muted-foreground truncate">{alert.message}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {alert.occurrence_count > 1 && `×${alert.occurrence_count} à `}
              {formatDistanceToNow(new Date(alert.last_seen_at), { addSuffix: true, locale: fr })}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {showActions && onAcknowledge && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAcknowledge(alert.id)}>
                <Eye className="h-3 w-3 mr-1" /> Ack
              </Button>
            )}
            {(showActions || showResolve) && onResolve && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onResolve(alert.id)}>
                <CheckCheck className="h-3 w-3 mr-1" /> Résoudre
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

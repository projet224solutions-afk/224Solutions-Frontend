// 🛡️ Security Operations Panel - Système de défense et riposte
import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Shield, AlertTriangle, Ban, Activity, Lock, Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSecurityOps } from '@/hooks/useSecurityOps';
import SecurityIncidentsList from './SecurityIncidentsList';
import SecurityAlertsList from './SecurityAlertsList';
import SecurityBlockedIPsList from './SecurityBlockedIPsList';
import SecurityForensics from './SecurityForensics';

const SecurityOpsPanel: React.FC = () => {
  const { t } = useTranslation();
  const {
    incidents,
    alerts,
    blockedIPs,
    stats,
    loading,
    error,
    loadSecurityData,
    createIncident,
    containIncident,
    resolveIncident,
    blockIP,
    unblockIP,
    acknowledgeAlert,
    detectAnomaly
  } = useSecurityOps(true);

  const [activeTab, setActiveTab] = useState('overview');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'destructive';
      case 'investigating': return 'default';
      case 'contained': return 'secondary';
      case 'resolved': return 'outline';
      case 'closed': return 'outline';
      default: return 'outline';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Security Operations Center
          </h2>
          <p className="text-muted-foreground mt-1">
            Système de défense et riposte en temps réel
          </p>
        </div>
        <Button onClick={loadSecurityData} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidents Ouverts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.open_incidents || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.incidents_24h || 0} dans les 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertes en Attente</CardTitle>
            <Zap className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending_alerts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Nécessitent une action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('securityOpsPanel.ipsBloquees')}</CardTitle>
            <Ban className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_blocks || 0}</div>
            <p className="text-xs text-muted-foreground">
              Blocages actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MTTR Moyen</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avg_mttr_minutes || 0}m</div>
            <p className="text-xs text-muted-foreground">
              Temps de réponse
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Incidents Alert */}
      {stats && stats.critical_incidents > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {stats.critical_incidents} Incident{stats.critical_incidents > 1 ? 's' : ''} Critique{stats.critical_incidents > 1 ? 's' : ''}
            </CardTitle>
            <CardDescription>
              Action immédiate requise pour contenir les incidents critiques
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="incidents">
            Incidents
            {stats && stats.open_incidents > 0 && (
              <Badge variant="destructive" className="ml-2">{stats.open_incidents}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            Alertes
            {stats && stats.pending_alerts > 0 && (
              <Badge variant="default" className="ml-2">{stats.pending_alerts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="blocked">{t('securityOpsPanel.ipsBloquees')}</TabsTrigger>
          <TabsTrigger value="forensics">Forensique</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Recent Incidents */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('securityOpsPanel.incidentsRecents')}</CardTitle>
                <CardDescription>{t('securityOpsPanel.derniersIncidentsDetectes')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {incidents.slice(0, 5).map((incident) => (
                    <div key={incident.id} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityColor(incident.severity)}>
                          {incident.severity}
                        </Badge>
                        <span className="text-sm">{incident.title}</span>
                      </div>
                      <Badge variant={getStatusColor(incident.status)}>
                        {incident.status}
                      </Badge>
                    </div>
                  ))}
                  {incidents.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucun incident récent
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('securityOpsPanel.alertesRecentes')}</CardTitle>
                <CardDescription>{t('securityOpsPanel.dernieresAlertesGenerees')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <span className="text-sm">{alert.description}</span>
                      </div>
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          Reconnaître
                        </Button>
                      )}
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune alerte récente
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Keys Status */}
          {stats && stats.keys_need_rotation > 0 && (
            <Card className="border-[#ff4000]">
              <CardHeader>
                <CardTitle className="text-[#ff4000] flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Rotation de Clés Requise
                </CardTitle>
                <CardDescription>
                  {stats.keys_need_rotation} clé{stats.keys_need_rotation > 1 ? 's' : ''} nécessite{stats.keys_need_rotation > 1 ? 'nt' : ''} une rotation dans les 7 jours
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="incidents">
          <SecurityIncidentsList
            incidents={incidents}
            onContain={containIncident}
            onResolve={resolveIncident}
            onCreate={createIncident}
          />
        </TabsContent>

        <TabsContent value="alerts">
          <SecurityAlertsList
            alerts={alerts}
            onAcknowledge={acknowledgeAlert}
          />
        </TabsContent>

        <TabsContent value="blocked">
          <SecurityBlockedIPsList
            blockedIPs={blockedIPs}
            onBlock={blockIP}
            onUnblock={unblockIP}
          />
        </TabsContent>

        <TabsContent value="forensics">
          <SecurityForensics />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityOpsPanel;

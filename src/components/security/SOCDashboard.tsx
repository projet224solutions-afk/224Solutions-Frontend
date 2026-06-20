/**
 * SOC - SECURITY OPERATIONS CENTER
 * Centre opérationnel de sécurité 24/7
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Clock, Users, Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { ResponsiveGrid } from "@/components/responsive/ResponsiveContainer";
import { useSecurityOps } from "@/hooks/useSecurityOps";
import { toast } from "sonner";

export function SOCDashboard() {
  const { t } = useTranslation();
  const { incidents, alerts, stats, loading, loadSecurityData } = useSecurityOps(true);
  const [socStatus, _setSocStatus] = useState({
    operational: true,
    activeAnalysts: 3,
    responseTime: '< 2 min',
    coverage: '24/7'
  });

  const handleRefresh = () => {
    loadSecurityData();
    toast.success(t('sOCDashboard.dashboardSocActualise'));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'text-[#ff4000]';
      case 'contained': return 'text-[#ff4000]';
      case 'investigating': return 'text-blue-600';
      default: return 'text-[#ff4000]';
    }
  };

  const recentIncidents = incidents?.slice(0, 5) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Centre Opérationnel de Sécurité (SOC)
            </CardTitle>
            <CardDescription>
              Surveillance et réponse aux incidents 24/7
            </CardDescription>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statut SOC */}
        <div className={`p-4 rounded-lg border ${
          socStatus.operational
            ? 'bg-orange-50 dark:bg-[#ff4000] border-orange-200 dark:border-[#ff4000]'
            : 'bg-orange-50 dark:bg-[#ff4000] border-orange-200 dark:border-[#ff4000]'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {socStatus.operational ? (
              <CheckCircle className="w-5 h-5 text-[#ff4000]" />
            ) : (
              <XCircle className="w-5 h-5 text-[#ff4000]" />
            )}
            <span className="font-semibold">
              {socStatus.operational ? 'SOC opérationnel' : 'SOC hors ligne'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Couverture {socStatus.coverage} • {socStatus.activeAnalysts} analystes actifs • Temps de réponse moyen: {socStatus.responseTime}
          </p>
        </div>

        {/* Métriques SOC */}
        <ResponsiveGrid mobileCols={2} tabletCols={4} desktopCols={4} gap="sm">
          <div className="p-4 bg-muted rounded-lg">
            <AlertTriangle className="w-8 h-8 text-[#ff4000] mb-2" />
            <div className="text-2xl font-bold">{stats?.total_incidents || 0}</div>
            <div className="text-xs text-muted-foreground">Incidents totaux</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <Activity className="w-8 h-8 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{stats?.total_alerts || 0}</div>
            <div className="text-xs text-muted-foreground">Alertes en cours</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <CheckCircle className="w-8 h-8 text-[#ff4000] mb-2" />
            <div className="text-2xl font-bold">{stats?.open_incidents || 0}</div>
            <div className="text-xs text-muted-foreground">Incidents ouverts</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <Clock className="w-8 h-8 text-[#04439e] mb-2" />
            <div className="text-2xl font-bold">{stats?.avg_mttr_minutes || 0} min</div>
            <div className="text-xs text-muted-foreground">MTTR moyen</div>
          </div>
        </ResponsiveGrid>

        {/* Incidents récents */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">{t('sOCDashboard.incidentsRecents')}</h4>
            <Badge variant="outline">{recentIncidents.length} actifs</Badge>
          </div>

          {recentIncidents.length === 0 ? (
            <div className="p-4 border rounded-lg text-center text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#ff4000]" />
              <p className="text-sm">{t('sOCDashboard.aucunIncidentActif')}</p>
            </div>
          ) : (
            recentIncidents.map((incident: any) => (
              <div key={incident.id} className="p-3 border rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      incident.severity === 'critical' ? 'destructive' :
                      incident.severity === 'high' ? 'default' : 'secondary'
                    }>
                      {incident.severity}
                    </Badge>
                    <Badge variant="outline" className={getStatusColor(incident.status)}>
                      {incident.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(incident.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                <h5 className="font-medium text-sm mb-1">{incident.title}</h5>
                <p className="text-xs text-muted-foreground">{incident.description}</p>
              </div>
            ))
          )}
        </div>

        {/* Actions SOC */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Users className="w-4 h-4 mr-2" />
            Équipe SOC
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Activity className="w-4 h-4 mr-2" />
            Playbooks
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

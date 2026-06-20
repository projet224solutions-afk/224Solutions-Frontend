/**
 * SIEM DASHBOARD - VERSION CONNECTÉE
 * Security Information and Event Management
 * Corrélation des logs et détection des menaces en temps réel
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Activity, AlertTriangle, Eye, TrendingUp, RefreshCw } from "lucide-react";
import { ResponsiveGrid } from "@/components/responsive/ResponsiveContainer";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer as RechartsContainer } from 'recharts';
import { useSecurityData } from "@/hooks/useSecurityData";
import { toast } from "sonner";

interface SecurityEvent {
  id: string;
  timestamp: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  description: string;
  correlated: boolean;
}

const _recentEvents: SecurityEvent[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    type: 'Tentative d\'accès non autorisé',
    severity: 'critical',
    source: '192.168.1.45',
    description: 'Multiple failed login attempts detected',
    correlated: true
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    type: 'Anomalie de trafic',
    severity: 'high',
    source: 'backend-api',
    description: 'Unusual spike in API requests',
    correlated: true
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    type: 'Modification de configuration',
    severity: 'medium',
    source: 'admin-panel',
    description: 'Security policy updated',
    correlated: false
  }
];

const _threatData = [
  { time: '00:00', threats: 12 },
  { time: '04:00', threats: 8 },
  { time: '08:00', threats: 25 },
  { time: '12:00', threats: 35 },
  { time: '16:00', threats: 45 },
  { time: '20:00', threats: 28 },
];

const _siemStats = {
  eventsProcessed: 2456789,
  threatsDetected: 1247,
  correlatedIncidents: 89,
  responseTime: '2.3s'
};

export function SIEMDashboard() {
  const { t } = useTranslation();
  const { auditLogs, stats, loading, refetch } = useSecurityData(true);
  const [threatData, setThreatData] = useState<any[]>([]);
  const [siemStats, setSiemStats] = useState({
    eventsProcessed: 0,
    threatsDetected: 0,
    correlatedIncidents: 0,
    responseTime: '2.3s'
  });

  useEffect(() => {
    if (auditLogs && stats) {
      setSiemStats({
        eventsProcessed: auditLogs.length,
        threatsDetected: stats.critical_alerts + stats.high_alerts,
        correlatedIncidents: stats.critical_alerts,
        responseTime: '—'
      });

      // Agrégation RÉELLE : nombre d'événements par tranche de 4 h sur les dernières 24 h
      // (remplace l'ancien Math.random() qui affichait de fausses menaces).
      const nowMs = Date.now();
      const fourHoursMs = 4 * 60 * 60 * 1000;
      const buckets = Array.from({ length: 6 }, (_, i) => {
        const end = nowMs - (5 - i) * fourHoursMs;
        const start = end - fourHoursMs;
        const count = (auditLogs || []).filter((l) => {
          const t = new Date(l.created_at).getTime();
          return Number.isFinite(t) && t > start && t <= end;
        }).length;
        return {
          time: new Date(end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          threats: count,
        };
      });
      setThreatData(buckets);
    }
  }, [auditLogs, stats]);

  const handleRefresh = () => {
    refetch();
    toast.success(t('sIEMDashboard.dashboardSiemActualise'));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-[#ff4000]';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-[#ff4000]';
      case 'low': return 'bg-blue-500';
    }
  };

  const recentEvents = auditLogs?.slice(0, 5).map(log => ({
    id: log.id,
    timestamp: log.created_at,
    type: log.action,
    severity: (log.data_json?.severity || 'low') as 'critical' | 'high' | 'medium' | 'low',
    source: log.ip_address || 'N/A',
    description: log.data_json?.description || log.action,
    correlated: log.data_json?.severity === 'critical'
  })) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              SIEM - Corrélation en Temps Réel
            </CardTitle>
            <CardDescription>
              Analyse multi-sources avec intelligence de corrélation
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
        {/* Statistiques SIEM */}
        <ResponsiveGrid mobileCols={2} tabletCols={4} desktopCols={4} gap="sm">
          <div className="p-4 bg-muted rounded-lg">
            <Activity className="w-8 h-8 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{siemStats.eventsProcessed.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{t('sIEMDashboard.evenementsTraites')}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <AlertTriangle className="w-8 h-8 text-[#ff4000] mb-2" />
            <div className="text-2xl font-bold">{siemStats.threatsDetected.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{t('sIEMDashboard.menacesDetectees')}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <TrendingUp className="w-8 h-8 text-[#04439e] mb-2" />
            <div className="text-2xl font-bold">{siemStats.correlatedIncidents}</div>
            <div className="text-xs text-muted-foreground">{t('sIEMDashboard.incidentsCorreles')}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <Eye className="w-8 h-8 text-[#ff4000] mb-2" />
            <div className="text-2xl font-bold">{siemStats.responseTime}</div>
            <div className="text-xs text-muted-foreground">{t('sIEMDashboard.tempsDeReponse')}</div>
          </div>
        </ResponsiveGrid>

        {/* Graphique des menaces */}
        <div>
          <h4 className="font-semibold text-sm mb-3">{t('sIEMDashboard.activiteDeSecuriteEvenementsPar')}</h4>
          <div className="h-48">
            <RechartsContainer width="100%" height="100%">
              <LineChart data={threatData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="threats" stroke="#04439e" strokeWidth={2} />
              </LineChart>
            </RechartsContainer>
          </div>
        </div>

        {/* Événements récents */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">{t('sIEMDashboard.evenementsDeSecuriteRecents')}</h4>
            <Button variant="outline" size="sm">
              Voir tout
            </Button>
          </div>
          {recentEvents.map((event) => (
            <div key={event.id} className="p-3 border rounded-lg">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={getSeverityColor(event.severity)}>
                    {event.severity}
                  </Badge>
                  {event.correlated && (
                    <Badge variant="outline" className="text-xs">
                      Corrélé
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString('fr-FR')}
                </span>
              </div>
              <h5 className="font-medium text-sm mb-1">{event.type}</h5>
              <p className="text-xs text-muted-foreground mb-1">{event.description}</p>
              <p className="text-xs text-muted-foreground">Source: {event.source}</p>
            </div>
          ))}
        </div>

        <div className="p-4 bg-orange-50 dark:bg-[#ff4000] rounded-lg border border-orange-200 dark:border-[#ff4000]">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-[#ff4000]" />
            <span className="font-semibold text-sm">{t('sIEMDashboard.systemeSiemOperationnel')}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Tous les services de surveillance sont actifs. Corrélation automatique des événements activée.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

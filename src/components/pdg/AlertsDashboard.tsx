import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  module: string;
  status: 'active' | 'acknowledged' | 'resolved';
  suggested_fix: string;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata?: any;
}

interface AlertStats {
  active: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export default function AlertsDashboard() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    active: 0,
    acknowledged: 0,
    resolved: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('active');

  const loadAlerts = async () => {
    setLoading(true);
    try {
      // Charger les alertes
      let query = supabase
        .from('system_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data: alertsData } = await query;

      if (alertsData) {
        setAlerts(alertsData as Alert[]);
      }

      // Calculer les statistiques
      const { data: allAlerts } = await supabase
        .from('system_alerts')
        .select('severity, status');

      if (allAlerts) {
        const newStats = allAlerts.reduce((acc, alert) => {
          acc[alert.status as keyof AlertStats]++;
          acc[alert.severity as keyof AlertStats]++;
          return acc;
        }, {
          active: 0,
          acknowledged: 0,
          resolved: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        });
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
      toast.error(t('alertsDashboard.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();

    // Real-time subscription
    const channel = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_alerts',
        },
        () => {
          loadAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('system_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;

      toast.success(t('alertsDashboard.alerteAcquittee'));
      loadAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast.error(t('alertsDashboard.erreurLorsDeLAcquittement'));
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('system_alerts')
        .update({
          status: 'resolved',
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;

      toast.success(t('alertsDashboard.alerteResolue'));
      loadAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error(t('alertsDashboard.erreurLorsDeLaResolution'));
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <Clock className="h-4 w-4" />;
      case 'low':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <AlertTriangle className="h-4 w-4 text-[#ff4000]" />;
      case 'acknowledged':
        return <Clock className="h-4 w-4 text-[#ff4000]" />;
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alertes Actives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-[#ff4000]">{stats.active}</div>
              <AlertTriangle className="h-5 w-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('alertsDashboard.acquittees')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-[#ff4000]">{stats.acknowledged}</div>
              <Clock className="h-5 w-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('alertsDashboard.resolues')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-[#ff4000]">{stats.resolved}</div>
              <CheckCircle2 className="h-5 w-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critiques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-[#ff4000]">{stats.critical}</div>
              <Zap className="h-5 w-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('alertsDashboard.alertesSysteme')}</CardTitle>
              <CardDescription>{t('alertsDashboard.surveillanceEtGestionEnTemps')}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAlerts}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Toutes
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('active')}
            >
              Actives
            </Button>
            <Button
              variant={filter === 'acknowledged' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('acknowledged')}
            >
              Acquittées
            </Button>
            <Button
              variant={filter === 'resolved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('resolved')}
            >
              Résolues
            </Button>
          </div>

          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-[#ff4000]" />
                  <p className="text-lg font-semibold">{t('alertsDashboard.aucuneAlerte')}</p>
                  <p className="text-sm">{t('alertsDashboard.tousLesSystemesFonctionnentNormalement')}</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <Card key={alert.id} className="bg-card">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="mt-0.5">
                              {getStatusIcon(alert.status)}
                            </div>
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={getSeverityColor(alert.severity)} className="gap-1">
                                  {getSeverityIcon(alert.severity)}
                                  {alert.severity}
                                </Badge>
                                <Badge variant="outline">{alert.module}</Badge>
                                <Badge variant={
                                  alert.status === 'active' ? 'destructive' :
                                  alert.status === 'acknowledged' ? 'secondary' : 'default'
                                }>
                                  {alert.status}
                                </Badge>
                              </div>
                              <h4 className="font-semibold">{alert.title}</h4>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                            </div>
                          </div>
                        </div>

                        {/* Suggested Fix */}
                        {alert.suggested_fix && (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs font-semibold text-primary mb-1">
                              💡 Correction suggérée:
                            </p>
                            <p className="text-xs text-muted-foreground">{alert.suggested_fix}</p>
                          </div>
                        )}

                        {/* Metadata */}
                        {alert.metadata?.autoFix && (
                          <div className="flex items-center gap-2 text-xs text-[#ff4000]">
                            <Zap className="h-3 w-3" />
                            <span>{t('alertsDashboard.autoFixAppliqueAutomatiquement')}</span>
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="text-xs text-muted-foreground">
                          <p>Créée: {new Date(alert.created_at).toLocaleString()}</p>
                          {alert.acknowledged_at && (
                            <p>Acquittée: {new Date(alert.acknowledged_at).toLocaleString()}</p>
                          )}
                          {alert.resolved_at && (
                            <p>Résolue: {new Date(alert.resolved_at).toLocaleString()}</p>
                          )}
                        </div>

                        {/* Actions */}
                        {alert.status === 'active' && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledge(alert.id)}
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              Acquitter
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleResolve(alert.id)}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Résoudre
                            </Button>
                          </div>
                        )}
                        {alert.status === 'acknowledged' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleResolve(alert.id)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Résoudre
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

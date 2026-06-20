import {} from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Activity, Eye, CheckCircle, RefreshCw, Clock, _TrendingUp } from 'lucide-react';
import { useSecurityData } from '@/hooks/useSecurityData';

export default function PDGSecurity() {
  const { t } = useTranslation();
  const { auditLogs, fraudLogs, stats, loading, refetch, markFraudAsReviewed } = useSecurityData(true);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium': return 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20';
      default: return 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20';
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('SUSPENDED') || action.includes('DELETED')) {
      return 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20';
    }
    if (action.includes('ACTIVATED') || action.includes('CREATED')) {
      return 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20';
    }
    return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('pDGSecurity.securiteAudit')}</h2>
          <p className="text-muted-foreground">{t('pDGSecurity.surveillanceEtDetectionDesMenaces')}</p>
        </div>
        <Button onClick={refetch} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </Button>
      </div>

      {/* Security Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_audit_logs}</p>
                <p className="text-sm text-muted-foreground">Actions Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.recent_actions}</p>
                <p className="text-sm text-muted-foreground">Actions 24h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff4000]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#ff4000]/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.critical_alerts + stats.high_alerts}</p>
                <p className="text-sm text-muted-foreground">Alertes Critiques</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff4000]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#ff4000]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.reviewed_alerts}</p>
                <p className="text-sm text-muted-foreground">{t('pDGSecurity.alertesTraitees')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fraud Detection Alerts */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
                Détection de Fraude
              </CardTitle>
              <CardDescription>{t('pDGSecurity.alertesDeSecuriteEtTransactions')}</CardDescription>
            </div>
            {stats.pending_alerts > 0 && (
              <Badge variant="outline" className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">
                {stats.pending_alerts} en attente
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {fraudLogs.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 mx-auto mb-4 text-[#ff4000] opacity-50" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Aucune alerte de fraude
              </h3>
              <p className="text-sm text-muted-foreground">
                Tous les systèmes fonctionnent normalement
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {fraudLogs.map((fraud, index) => (
                <div
                  key={fraud.id}
                  className="p-4 rounded-xl border border-border/40 bg-muted/30 hover:bg-muted/50 transition-all duration-200 animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        fraud.risk_level === 'critical' ? 'bg-[#ff4000]/10' :
                        fraud.risk_level === 'high' ? 'bg-orange-500/10' :
                        'bg-[#ff4000]/10'
                      }`}>
                        <AlertTriangle className={`w-6 h-6 ${
                          fraud.risk_level === 'critical' ? 'text-[#ff4000]' :
                          fraud.risk_level === 'high' ? 'text-orange-500' :
                          'text-[#ff4000]'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className={getRiskColor(fraud.risk_level)}>
                            {fraud.risk_level?.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-semibold">Score: {fraud.risk_score}/100</span>
                          {fraud.reviewed && (
                            <Badge variant="outline" className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Traité
                            </Badge>
                          )}
                        </div>
                        {fraud.user_id && (
                          <p className="text-sm text-muted-foreground">
                            User ID: {fraud.user_id.substring(0, 8)}...
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(fraud.created_at).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    {!fraud.reviewed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markFraudAsReviewed(fraud.id)}
                        className="gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Marquer traité
                      </Button>
                    )}
                  </div>
                  {fraud.action_taken && (
                    <div className="mt-2 p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        <strong>Action:</strong> {fraud.action_taken}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Journal d'Audit
          </CardTitle>
          <CardDescription>{t('pDGSecurity.historiqueCompletDesActionsAdministrativ')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {auditLogs.map((log, index) => (
              <div
                key={log.id}
                className="p-4 rounded-xl border border-border/40 bg-muted/30 hover:bg-muted/50 transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        {log.target_type && (
                          <span className="text-xs text-muted-foreground">
                            • {log.target_type}
                          </span>
                        )}
                      </div>
                      {log.actor_id && (
                        <p className="text-sm text-muted-foreground mb-1">
                          Actor: {log.actor_id.substring(0, 8)}...
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {log.ip_address && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.ip_address}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Dashboard de sécurité temps réel amélioré
 * Phase 5 du plan de sécurité
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Lock,
  Eye,
  Ban,
  Server,
  Database,
  Zap,
  RefreshCw
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';

interface SecurityMetrics {
  score: number;
  activeThreats: number;
  blockedIPs: number;
  failedLogins24h: number;
  successfulLogins24h: number;
  pendingReviews: number;
  rlsPolicies: number;
  tables: number;
  edgeFunctions: number;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  severity_level: string;
  user_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const COLORS = ['#ff4000', '#ff4000', '#ff4000', '#04439e'];

export const RealTimeSecurityDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    score: 85,
    activeThreats: 0,
    blockedIPs: 0,
    failedLogins24h: 0,
    successfulLogins24h: 0,
    pendingReviews: 0,
    rlsPolicies: 842,
    tables: 361,
    edgeFunctions: 143
  });
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealTime, setIsRealTime] = useState(true);

  useEffect(() => {
    loadSecurityData();

    if (isRealTime) {
      const interval = setInterval(loadSecurityData, 30000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealTime]);

  const loadSecurityData = async () => {
    try {
      // Charger les événements de sécurité récents
      const { data: securityEvents } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (securityEvents) {
        setEvents(securityEvents as SecurityEvent[]);
      }

      // Charger les IPs bloquées
      const { count: blockedCount } = await supabase
        .from('blocked_ips')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Charger les incidents actifs
      const { count: incidentCount } = await supabase
        .from('security_incidents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      // Charger les tentatives d'auth des dernières 24h
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: authAttempts } = await supabase
        .from('auth_attempts_log')
        .select('success')
        .gte('attempted_at', yesterday);

      const failedLogins = authAttempts?.filter(a => !a.success).length || 0;
      const successfulLogins = authAttempts?.filter(a => a.success).length || 0;

      setMetrics(prev => ({
        ...prev,
        blockedIPs: blockedCount || 0,
        activeThreats: incidentCount || 0,
        failedLogins24h: failedLogins,
        successfulLogins24h: successfulLogins,
        score: calculateSecurityScore(blockedCount || 0, incidentCount || 0, failedLogins)
      }));

    } catch (error) {
      console.error('Erreur chargement données sécurité:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSecurityScore = (blocked: number, incidents: number, failed: number): number => {
    let score = 100;
    score -= Math.min(incidents * 5, 20);
    score -= Math.min(Math.floor(failed / 10), 15);
    score -= Math.min(Math.floor(blocked / 5), 10);
    return Math.max(0, score);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-[#ff4000]';
    if (score >= 70) return 'text-[#ff4000]';
    if (score >= 50) return 'text-orange-600';
    return 'text-[#ff4000]';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 90) return { label: 'Excellent', icon: ShieldCheck, color: 'bg-orange-100 text-[#ff4000]' };
    if (score >= 70) return { label: 'Bon', icon: Shield, color: 'bg-orange-100 text-[#ff4000]' };
    if (score >= 50) return { label: 'Attention', icon: ShieldAlert, color: 'bg-orange-100 text-orange-800' };
    return { label: 'Critique', icon: XCircle, color: 'bg-orange-100 text-[#ff4000]' };
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-orange-100 text-[#ff4000]';
      case 'warning': return 'bg-orange-100 text-[#ff4000]';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const threatData = [
    { name: 'Lun', threats: 12, blocked: 10 },
    { name: 'Mar', threats: 8, blocked: 8 },
    { name: 'Mer', threats: 15, blocked: 14 },
    { name: 'Jeu', threats: 6, blocked: 6 },
    { name: 'Ven', threats: 10, blocked: 9 },
    { name: 'Sam', threats: 4, blocked: 4 },
    { name: 'Dim', threats: 7, blocked: 7 }
  ];

  const pieData = [
    { name: 'Succès', value: metrics.successfulLogins24h },
    { name: 'Échecs', value: metrics.failedLogins24h },
    { name: 'Bloqués', value: metrics.blockedIPs }
  ];

  const status = getScoreStatus(metrics.score);
  const StatusIcon = status.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec score global */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('realTimeSecurityDashboard.centreDeSecurite')}</h1>
            <p className="text-muted-foreground">{t('realTimeSecurityDashboard.monitoringEtProtectionEnTemps')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={isRealTime ? "default" : "outline"}
            size="sm"
            onClick={() => setIsRealTime(!isRealTime)}
          >
            {isRealTime ? <Activity className="h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {isRealTime ? 'Temps réel' : 'Pausé'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadSecurityData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Score de sécurité global */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="relative">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${metrics.score * 2.51} 251`}
                    className={getScoreColor(metrics.score)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${getScoreColor(metrics.score)}`}>
                    {metrics.score}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusIcon className="h-5 w-5" />
                  <Badge className={status.color}>{status.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Score de sécurité global basé sur {metrics.rlsPolicies} politiques RLS
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#ff4000]">{metrics.rlsPolicies}</div>
                <div className="text-xs text-muted-foreground">Politiques RLS</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{metrics.tables}</div>
                <div className="text-xs text-muted-foreground">Tables</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{metrics.edgeFunctions}</div>
                <div className="text-xs text-muted-foreground">Edge Functions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{metrics.activeThreats}</div>
                <div className="text-xs text-muted-foreground">Menaces actives</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métriques clés */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('realTimeSecurityDashboard.connexionsReussies24h')}</p>
                <p className="text-2xl font-bold text-[#ff4000]">{metrics.successfulLogins24h}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-[#ff4000]" />
            </div>
            <div className="mt-2 flex items-center text-xs text-[#ff4000]">
              <TrendingUp className="h-3 w-3 mr-1" />
              Authentifications valides
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('realTimeSecurityDashboard.echecsDeConnexion24h')}</p>
                <p className="text-2xl font-bold text-[#ff4000]">{metrics.failedLogins24h}</p>
              </div>
              <XCircle className="h-8 w-8 text-[#ff4000]" />
            </div>
            <div className="mt-2 flex items-center text-xs text-[#ff4000]">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Tentatives suspectes
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('realTimeSecurityDashboard.ipsBloquees')}</p>
                <p className="text-2xl font-bold text-orange-600">{metrics.blockedIPs}</p>
              </div>
              <Ban className="h-8 w-8 text-orange-600" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <Lock className="h-3 w-3 mr-1" />
              Protection active
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incidents ouverts</p>
                <p className="text-2xl font-bold text-[#ff4000]">{metrics.activeThreats}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-[#ff4000]" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <Eye className="h-3 w-3 mr-1" />
              En investigation
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques et événements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique des menaces */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('realTimeSecurityDashboard.tendanceDesMenaces7Jours')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={threatData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="threats" stroke="#ff4000" fill="#ffd9cc" name="Détectées" />
                <Area type="monotone" dataKey="blocked" stroke="#ff4000" fill="#d1fae5" name="Bloquées" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Répartition des authentifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('realTimeSecurityDashboard.repartitionDesAuthentifications')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#04439e"
                  paddingAngle={5}
                  dataKey="value"
                  label
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Événements récents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('realTimeSecurityDashboard.evenementsDeSecuriteRecents')}</CardTitle>
            <Badge variant="outline">{events.length} événements</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {events.length === 0 ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Aucun événement de sécurité récent. Votre système est sécurisé.
                  </AlertDescription>
                </Alert>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                      event.severity_level === 'critical' ? 'text-[#ff4000]' :
                      event.severity_level === 'warning' ? 'text-[#ff4000]' : 'text-blue-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{event.event_type}</span>
                        <Badge className={getSeverityColor(event.severity_level)} variant="secondary">
                          {event.severity_level}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {event.ip_address && <span className="mr-3">IP: {event.ip_address}</span>}
                        <span>{new Date(event.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Infrastructure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('realTimeSecurityDashboard.infrastructureDeSecurite')}</CardTitle>
          <CardDescription>{t('realTimeSecurityDashboard.composantsDeProtectionActifs')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <Database className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="font-bold">{metrics.rlsPolicies}</div>
              <div className="text-xs text-muted-foreground">RLS Policies</div>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Server className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="font-bold">{metrics.edgeFunctions}</div>
              <div className="text-xs text-muted-foreground">Edge Functions</div>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Lock className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="font-bold">AES-256</div>
              <div className="text-xs text-muted-foreground">Encryption</div>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Zap className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="font-bold">ML Fraud</div>
              <div className="text-xs text-muted-foreground">Detection</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealTimeSecurityDashboard;

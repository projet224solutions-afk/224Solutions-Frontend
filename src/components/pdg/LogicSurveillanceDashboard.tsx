/**
 * TABLEAU DE BORD SURVEILLANCE LOGIQUE GLOBALE - PDG
 * Contrôle total sur toutes les fonctionnalités du système
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  Activity,
  Zap,
  Database,
  Wallet,
  ShoppingCart,
  Package,
  Truck,
  Settings,
  Play,
  AlertOctagon,
  FileText,
  Clock,
  TrendingUp,
  Monitor
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import SystemLiveMonitor from './SystemLiveMonitor';

interface DashboardData {
  pending_anomalies: number;
  critical_anomalies: number;
  today_anomalies: number;
  auto_corrected_today: number;
  domains_stats: Record<string, number>;
  recent_anomalies: Anomaly[];
  last_snapshot: {
    id: string;
    snapshot_type: string;
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
    anomalies_detected: number;
    completed_at: string;
  } | null;
  generated_at: string;
}

interface Anomaly {
  id: string;
  domain: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  expected_value: Record<string, unknown>;
  actual_value: Record<string, unknown>;
  severity: string;
  status: string;
  detected_at: string;
}

interface ValidationRule {
  id: string;
  domain: string;
  rule_code: string;
  rule_name: string;
  description: string;
  severity: string;
  is_active: boolean;
  auto_correct_enabled: boolean;
}

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  pos: ShoppingCart,
  stock: Package,
  wallet: Wallet,
  commission: TrendingUp,
  order: Truck,
  sync: RefreshCw,
  security: Shield,
  default: Database
};

const DOMAIN_COLORS: Record<string, string> = {
  pos: 'bg-blue-500',
  stock: 'bg-[#ff4000]',
  wallet: 'bg-[#04439e]',
  commission: 'bg-[#ff4000]',
  order: 'bg-orange-500',
  sync: 'bg-[#04439e]',
  security: 'bg-[#ff4000]',
  default: 'bg-gray-500'
};

const LogicSurveillanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningValidation, setRunningValidation] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [showLiveMonitor, setShowLiveMonitor] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      // Load dashboard stats via RPC
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_logic_surveillance_dashboard');

      if (statsError) throw statsError;
      setDashboardData(statsData as unknown as DashboardData);

      // Load validation rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('logic_validation_rules')
        .select('*')
        .order('domain', { ascending: true });

      if (!rulesError && rulesData) {
        setRules(rulesData as ValidationRule[]);
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message: t('logicSurveillanceDashboard.erreurDeChargement');
      console.error('Error loading dashboard:', error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();

    // Refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const runFullValidation = async () => {
    if (!user?.id) return;

    setRunningValidation(true);
    try {
      // Utiliser detect_all_anomalies au lieu de run_full_system_validation
      const { data, error } = await supabase.rpc('detect_all_anomalies', {
        p_domain_filter: null,
        p_severity_filter: null
      });

      if (error) throw error;

      toast.success(`Validation terminée: ${data?.length || 0} domaines vérifiés`);
      loadDashboard();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message: t('logicSurveillanceDashboard.erreurDeValidation');
      console.error('Validation error:', error);
      toast.error(message);
    } finally {
      setRunningValidation(false);
    }
  };

  const handleCorrection = async (anomalyId: string, correctionType: 'auto' | 'manual') => {
    if (!user?.id) return;

    try {
      if (correctionType === 'auto') {
        // Récupérer le domaine de l'anomalie
        const { data: anomaly } = await supabase
          .from('logic_anomalies')
          .select('domain')
          .eq('id', anomalyId)
          .single();

        if (anomaly?.domain === 'stock') {
          const { error } = await supabase.rpc('auto_correct_stock_anomaly', {
            p_anomaly_id: anomalyId,
            p_corrected_by: user.id
          });
          if (error) throw error;
        }
      } else {
        // Correction manuelle - marquer comme corrigée
        const { error } = await supabase
          .from('logic_anomalies')
          .update({
            status: 'corrected',
            corrected_by: user.id,
            corrected_at: new Date().toISOString(),
            correction_type: 'manual',
            notes: correctionReason
          })
          .eq('id', anomalyId);

        if (error) throw error;
      }

      toast.success(t('logicSurveillanceDashboard.correctionAppliqueeAvecSucces'));
      setCorrectionReason('');
      loadDashboard();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message: t('logicSurveillanceDashboard.erreurDeCorrection');
      toast.error(message);
    }
  };

  const ignoreAnomaly = async (anomalyId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('logic_anomalies')
        .update({
          status: 'ignored',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          notes: correctionReason || 'Ignoré par le PDG'
        })
        .eq('id', anomalyId);

      if (error) throw error;

      toast.success(t('logicSurveillanceDashboard.anomalieIgnoree'));
      setCorrectionReason('');
      loadDashboard();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur';
      toast.error(message);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-[#ff4000] text-white';
      case 'warning': return 'bg-[#ff4000] text-black';
      default: return 'bg-blue-500 text-white';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-orange-500">En attente</Badge>;
      case 'corrected': return <Badge className="bg-[#ff4000]">{t('logicSurveillanceDashboard.corrige')}</Badge>;
      case 'ignored': return <Badge variant="secondary">{t('logicSurveillanceDashboard.ignore')}</Badge>;
      case 'escalated': return <Badge variant="destructive">{t('logicSurveillanceDashboard.escalade')}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const formatValue = (value: Record<string, unknown>) => {
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const healthScore = dashboardData?.last_snapshot
    ? Math.round((dashboardData.last_snapshot.passed_checks / Math.max(dashboardData.last_snapshot.total_checks, 1)) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" />
            Surveillance Logique Globale
          </h1>
          <p className="text-muted-foreground">{t('logicSurveillanceDashboard.controleDIntegriteEnTemps')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Bouton Monitor Live 24/7 - Spectaculaire */}
          <Button
            onClick={() => setShowLiveMonitor(true)}
            className="bg-[#ff4000] hover:bg-[#ff4000] text-white font-bold shadow-lg shadow-[#ff4000]/40 border-0"
          >
            <Monitor className="h-4 w-4 mr-2 animate-pulse" />
            <span className="relative flex items-center gap-2">
              <span className="w-2 h-2 bg-[#ff4000] rounded-full animate-ping absolute -left-1" />
              <span className="w-2 h-2 bg-[#ff4000] rounded-full relative -left-1" />
              Voir Système Live 24/7
            </span>
          </Button>

          <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>

          <Button
            onClick={runFullValidation}
            disabled={runningValidation}
            className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40"
          >
            <Play className={`h-4 w-4 mr-2 ${runningValidation ? 'animate-spin' : ''}`} />
            {runningValidation ? 'Validation...' : 'Lancer Validation'}
          </Button>
        </div>
      </div>

      {/* Modal Live Monitor */}
      <SystemLiveMonitor open={showLiveMonitor} onOpenChange={setShowLiveMonitor} />

      {/* Alertes critiques */}
      {(dashboardData?.critical_anomalies || 0) > 0 && (
        <Card className="border-[#ff4000] bg-orange-50 dark:bg-[#ff4000]/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertOctagon className="h-8 w-8 text-[#ff4000]" />
              <div>
                <p className="font-bold text-[#ff4000]">
                  {dashboardData?.critical_anomalies} ANOMALIE(S) CRITIQUE(S) DÉTECTÉE(S)
                </p>
                <p className="text-sm text-[#ff4000]">
                  Action immédiate requise - Vérifiez les détails ci-dessous
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#ff4000]" />
              Santé Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthScore}%</div>
            <Progress value={healthScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card className={dashboardData?.pending_anomalies ? 'border-orange-500' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Anomalies en attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.pending_anomalies || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {dashboardData?.critical_anomalies || 0} critiques
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.today_anomalies || 0}
            </div>
            <div className="text-xs text-muted-foreground">{t('logicSurveillanceDashboard.anomaliesDetectees')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#ff4000]" />
              Auto-corrigées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">
              {dashboardData?.auto_corrected_today || 0}
            </div>
            <div className="text-xs text-muted-foreground">aujourd'hui</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#04439e]" />
              Règles actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter(r => r.is_active).length}
            </div>
            <div className="text-xs text-muted-foreground">
              sur {rules.length} règles
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats par domaine */}
      {dashboardData?.domains_stats && Object.keys(dashboardData.domains_stats).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Anomalies par domaine</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(dashboardData.domains_stats).map(([domain, count]) => {
                const Icon = DOMAIN_ICONS[domain] || DOMAIN_ICONS.default;
                const color = DOMAIN_COLORS[domain] || DOMAIN_COLORS.default;
                return (
                  <Badge key={domain} className={`${color} text-white flex items-center gap-1`}>
                    <Icon className="h-3 w-3" />
                    {domain}: {count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="anomalies" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="anomalies" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Anomalies
            {(dashboardData?.pending_anomalies || 0) > 0 && (
              <Badge variant="destructive" className="ml-1">{dashboardData?.pending_anomalies}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Règles
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="anomalies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('logicSurveillanceDashboard.anomaliesRecentes')}</CardTitle>
              <CardDescription>{t('logicSurveillanceDashboard.incoherencesLogiquesDetecteesDansLe')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {!dashboardData?.recent_anomalies?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mb-4 text-[#ff4000]" />
                    <p className="text-lg font-medium">{t('logicSurveillanceDashboard.aucuneAnomalieDetectee')}</p>
                    <p className="text-sm">{t('logicSurveillanceDashboard.leSystemeFonctionneCorrectement')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.recent_anomalies.map((anomaly) => {
                      const DomainIcon = DOMAIN_ICONS[anomaly.domain] || DOMAIN_ICONS.default;
                      return (
                        <div
                          key={anomaly.id}
                          className={`p-4 rounded-lg border ${
                            anomaly.status === 'pending' ? 'bg-muted/50 border-orange-200' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${DOMAIN_COLORS[anomaly.domain] || DOMAIN_COLORS.default}`}>
                                <DomainIcon className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{anomaly.domain.toUpperCase()}</span>
                                  <Badge className={getSeverityColor(anomaly.severity)}>
                                    {anomaly.severity}
                                  </Badge>
                                  {getStatusBadge(anomaly.status)}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {anomaly.entity_type} • {anomaly.action_type}
                                </p>
                                <div className="text-xs space-y-1 bg-muted p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-3 w-3 text-[#ff4000]" />
                                    <span><strong>Attendu:</strong> {formatValue(anomaly.expected_value)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <XCircle className="h-3 w-3 text-[#ff4000]" />
                                    <span><strong>{t('logicSurveillanceDashboard.reel')}</strong> {formatValue(anomaly.actual_value)}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Détecté le {new Date(anomaly.detected_at).toLocaleString('fr-FR')}
                                </p>
                              </div>
                            </div>

                            {anomaly.status === 'pending' && (
                              <div className="flex flex-col gap-2">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="default">
                                      <Zap className="h-3 w-3 mr-1" />
                                      Corriger
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{t('logicSurveillanceDashboard.correctionDeLAnomalie')}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Choisissez le type de correction à appliquer.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <Textarea
                                      placeholder={t('logicSurveillanceDashboard.raisonDeLaCorrectionOptionnel')}
                                      value={correctionReason}
                                      onChange={(e) => setCorrectionReason(e.target.value)}
                                      className="my-4"
                                    />
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t('logicSurveillanceDashboard.annuler')}</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleCorrection(anomaly.id, 'auto')}
                                        className="bg-[#ff4000]"
                                      >
                                        Correction Auto
                                      </AlertDialogAction>
                                      <AlertDialogAction
                                        onClick={() => handleCorrection(anomaly.id, 'manual')}
                                      >
                                        Correction Manuelle
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => ignoreAnomaly(anomaly.id)}
                                >
                                  Ignorer
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('logicSurveillanceDashboard.reglesDeValidation')}</CardTitle>
              <CardDescription>{t('logicSurveillanceDashboard.reglesDeLogiqueMetierSurveillees')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {Object.entries(
                    rules.reduce((acc, rule) => {
                      if (!acc[rule.domain]) acc[rule.domain] = [];
                      acc[rule.domain].push(rule);
                      return acc;
                    }, {} as Record<string, ValidationRule[]>)
                  ).map(([domain, domainRules]) => {
                    const DomainIcon = DOMAIN_ICONS[domain] || DOMAIN_ICONS.default;
                    return (
                      <div key={domain} className="space-y-2">
                        <div className="flex items-center gap-2 font-medium">
                          <DomainIcon className="h-4 w-4" />
                          {domain.toUpperCase()}
                        </div>
                        <div className="pl-6 space-y-2">
                          {domainRules.map((rule) => (
                            <div
                              key={rule.id}
                              className={`p-3 rounded-lg border ${
                                rule.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{rule.rule_name}</span>
                                    <Badge className={getSeverityColor(rule.severity)}>
                                      {rule.severity}
                                    </Badge>
                                    {rule.auto_correct_enabled && (
                                      <Badge variant="outline" className="text-[#ff4000] border-[#ff4000]">
                                        <Zap className="h-3 w-3 mr-1" />
                                        Auto-correct
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {rule.description}
                                  </p>
                                  <code className="text-xs bg-muted px-2 py-0.5 rounded mt-2 inline-block">
                                    {rule.rule_code}
                                  </code>
                                </div>
                                <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                                  {rule.is_active ? 'Actif' : 'Inactif'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('logicSurveillanceDashboard.historiqueDesValidations')}</CardTitle>
              <CardDescription>{t('logicSurveillanceDashboard.snapshotsEtCorrectionsEffectuees')}</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.last_snapshot ? (
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium">{t('logicSurveillanceDashboard.derniereValidation')}</span>
                    </div>
                    <Badge variant="outline">
                      {dashboardData.last_snapshot.snapshot_type}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('logicSurveillanceDashboard.verifications')}</p>
                      <p className="text-xl font-bold">{dashboardData.last_snapshot.total_checks}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('logicSurveillanceDashboard.reussies')}</p>
                      <p className="text-xl font-bold text-[#ff4000]">{dashboardData.last_snapshot.passed_checks}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('logicSurveillanceDashboard.echouees')}</p>
                      <p className="text-xl font-bold text-[#ff4000]">{dashboardData.last_snapshot.failed_checks}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Anomalies</p>
                      <p className="text-xl font-bold text-orange-600">{dashboardData.last_snapshot.anomalies_detected}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Complétée le {new Date(dashboardData.last_snapshot.completed_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('logicSurveillanceDashboard.aucuneValidationEffectuee')}</p>
                  <Button onClick={runFullValidation} className="mt-4">
                    Lancer la première validation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LogicSurveillanceDashboard;

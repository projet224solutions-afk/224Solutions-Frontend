import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePdgMonitoring } from '@/hooks/usePdgMonitoring';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Zap,
  RefreshCw,
  Brain,
  Shield,
  Database,
  Users,
  ArrowLeft,
  Bell
} from 'lucide-react';
import AlertsDashboard from '@/components/pdg/AlertsDashboard';
import AutoHealingDashboard from '@/components/pdg/AutoHealingDashboard';
import { useNavigate } from 'react-router-dom';

const normalizeCopilotText = (value: string) => value
  .replaceAll('ré', 'ré')
  .replaceAll('dé', 'dé')
  .replaceAll('gé', 'gé')
  .replaceAll('Système', 'Système')
  .replaceAll('État', 'État')
  .replaceAll('vérification', 'vérification')
  .replaceAll('fréquentes', 'fréquentes')
  .replaceAll('suggérées', 'suggérées')
  .replaceAll('Priorité', 'Priorité')
  .replaceAll('réussite', 'réussite')
  .replaceAll('Monitoring System', 'système de monitoring')
  .replaceAll('Recommandations actionnables', 'Actions recommandées')
  .replaceAll('L\'état global du système est **dégradé**.', 'L\'état global du système est dégradé.')
  .replaceAll('Bien que la santé système soit à 100%, le service de **Monitoring System est dégradé** et il y a un nombre élevé d\'**erreurs en attente', 'Même si la santé système est à 100%, le service de monitoring est dégradé et il y a un nombre élevé d\'erreurs en attente')
  .replaceAll('**Recommandations actionnables :**', 'Actions recommandées :')
  .replaceAll('1.  **Prioriser l\'investigation du Monitoring System dégradé :** Cela pourrait masquer d\'autres problèmes ou empêcher une détection rapide.', '1. Priorisez l\'investigation du système de monitoring dégradé : cela pourrait masquer d\'autres problèmes ou empêcher une détection rapide.')
  .replaceAll('2.  **Analyser les erreurs en attente :** Identifier les causes profondes des erreurs `frontend_promise` (notamment `Cannot read properties of null` et `Lock broken`) et `frontend_resource` pour réduire leur nombre.', '2. Analysez les erreurs en attente : identifiez les causes profondes des erreurs frontend (notamment "Cannot read properties of null" et "Lock broken") et des ressources frontend pour réduire leur nombre.')
  .replaceAll('en plus tu corrige tous les texte qui son mal écrit', 'Corrigez également tous les textes mal écrits.');

export default function PdgCommandCenter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    systemHealth,
    interfaceMetrics,
    autoFixes,
    stats,
    loading,
    realTimeEnabled,
    setRealTimeEnabled,
    loadMonitoringData,
    analyzeErrorWithAI,
    askAICopilot,
    detectAnomalies
  } = usePdgMonitoring();

  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [analyzingError, setAnalyzingError] = useState<string | null>(null);

  const handleAskAI = async () => {
    if (!aiQuery.trim()) return;

    setAiLoading(true);
    const response = await askAICopilot(aiQuery);
    setAiLoading(false);

    if (response) {
      setAiResponse(normalizeCopilotText(response.answer || response.suggestion || 'Pas de réponse'));
    }
  };

  const handleAnalyzeError = async (errorId: string) => {
    setAnalyzingError(errorId);
    await analyzeErrorWithAI(errorId);
    setAnalyzingError(null);
    loadMonitoringData();
  };

  // Charger les erreurs récentes uniquement au montage du composant
  useEffect(() => {
    const loadRecentErrors = async () => {
      const { data } = await supabase
        .from('system_errors')
        .select('*')
        .neq('status', 'fixed')
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        setRecentErrors(data);
      }
    };
    loadRecentErrors();
     
  }, []); // Charger une seule fois au montage

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'default';
      case 'warning':
      case 'degraded':
        return 'secondary';
      case 'critical':
      case 'offline':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return <CheckCircle2 className="h-5 w-5 text-[#ff4000]" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-[#ff4000]" />;
      case 'critical':
      case 'offline':
        return <AlertTriangle className="h-5 w-5 text-[#ff4000]" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header - Mobile Optimized */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/pdg')}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold truncate">{t('pdgCommandCenter.centreDeCommande')}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                Surveillance & Debug - 224SOLUTIONS
              </p>
            </div>
          </div>

          {/* Controls - Mobile Row */}
          <div className="flex items-center gap-2">
            <Button
              variant={realTimeEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setRealTimeEnabled(!realTimeEnabled)}
              className="flex-1 sm:flex-none text-xs sm:text-sm h-9"
            >
              <Activity className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{realTimeEnabled ? 'Temps réel actif' : 'Temps réel désactivé'}</span>
              <span className="sm:hidden">{realTimeEnabled ? 'Actif' : 'Inactif'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMonitoringData()}
              disabled={loading}
              className="h-9 w-9 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Stats globales - 2x2 grid on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card>
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">{t('pdgCommandCenter.santeSysteme')}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="flex items-center justify-between">
                <div className="text-lg sm:text-2xl font-bold">{stats.systemHealth.toFixed(1)}%</div>
                {getHealthIcon(systemHealth.status)}
              </div>
              <Badge variant={getStatusColor(systemHealth.status)} className="mt-1 sm:mt-2 text-xs">
                {systemHealth.status}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Erreurs Critiques</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="flex items-center justify-between">
                <div className="text-lg sm:text-2xl font-bold">{stats.criticalErrors}</div>
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-[#ff4000]" />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
                {stats.pendingErrors} en attente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Corrections Auto</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="flex items-center justify-between">
                <div className="text-lg sm:text-2xl font-bold">{stats.autoFixedErrors}</div>
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-[#ff4000]" />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
                {autoFixes.length} actifs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="flex items-center justify-between">
                <div className="text-lg sm:text-2xl font-bold">{stats.totalTransactions}</div>
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
                ~{stats.avgResponseTime.toFixed(0)}ms
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs principales - Scrollable on mobile */}
        <Tabs defaultValue="overview" className="space-y-4">
          <div className="overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="w-max sm:w-auto">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3">
                <Activity className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Vue d'ensemble</span>
                <span className="sm:hidden">{t('pdgCommandCenter.apercu')}</span>
              </TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs sm:text-sm px-2 sm:px-3">
                <Bell className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Alertes
              </TabsTrigger>
              <TabsTrigger value="services" className="text-xs sm:text-sm px-2 sm:px-3">
                <Database className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Services
              </TabsTrigger>
              <TabsTrigger value="interfaces" className="text-xs sm:text-sm px-2 sm:px-3">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Interfaces</span>
                <span className="sm:hidden">UI</span>
              </TabsTrigger>
              <TabsTrigger value="fixes" className="text-xs sm:text-sm px-2 sm:px-3">
                <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Auto-Fixes</span>
                <span className="sm:hidden">Fixes</span>
              </TabsTrigger>
              <TabsTrigger value="auto-healing" className="text-xs sm:text-sm px-2 sm:px-3">
                <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t('pdgCommandCenter.autoReparation')}</span>
                <span className="sm:hidden">{t('pdgCommandCenter.autoRep')}</span>
              </TabsTrigger>
              <TabsTrigger value="copilot" className="text-xs sm:text-sm px-2 sm:px-3">
                <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                IA
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Vue d'ensemble */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('pdgCommandCenter.etatDesServices')}</CardTitle>
                  <CardDescription>
                    Dernière vérification : {new Date(systemHealth.lastCheck).toLocaleString('fr-FR')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {systemHealth.services.map((service) => (
                      <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getHealthIcon(service.status)}
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {service.responseTime} ms • Erreurs : {service.errorRate}%
                            </p>
                          </div>
                        </div>
                        <Badge variant={getStatusColor(service.status)}>
                          {service.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Actions Rapides</CardTitle>
                  <CardDescription>{t('pdgCommandCenter.outilsDeDiagnosticEtCorrection')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={detectAnomalies}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Détecter les anomalies
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => navigate('/pdg/debug')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Voir les erreurs détaillées
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => navigate('/pdg/security')}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Centre de sécurité
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Alertes Dashboard */}
          <TabsContent value="alerts">
            <AlertsDashboard />
          </TabsContent>

          {/* Services */}
          <TabsContent value="services">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('pdgCommandCenter.etatDesServices')}</CardTitle>
                  <CardDescription>
                    Dernière vérification : {new Date(systemHealth.lastCheck).toLocaleString('fr-FR')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {systemHealth.services.map((service) => (
                      <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getHealthIcon(service.status)}
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {service.responseTime} ms • Erreurs : {service.errorRate}%
                            </p>
                          </div>
                        </div>
                        <Badge variant={getStatusColor(service.status)}>
                          {service.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Actions Rapides</CardTitle>
                  <CardDescription>{t('pdgCommandCenter.outilsDeDiagnosticEtCorrection')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={detectAnomalies}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Détecter les anomalies
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => navigate('/pdg/debug')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Voir les erreurs détaillées
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => navigate('/pdg/security')}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Centre de sécurité
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Services */}
          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>{t('pdgCommandCenter.monitoringDesServices')}</CardTitle>
                <CardDescription>{t('pdgCommandCenter.etatDetailleDeTousLes')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {systemHealth.services.map((service) => (
                      <Card key={service.name}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {getHealthIcon(service.status)}
                                <h4 className="font-semibold">{service.name}</h4>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>Temps de réponse : {service.responseTime} ms</p>
                                <p>Taux d'erreur: {service.errorRate}%</p>
                                <p>Uptime: {systemHealth.uptime}%</p>
                              </div>
                            </div>
                            <Badge variant={getStatusColor(service.status)}>
                              {service.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interfaces */}
          <TabsContent value="interfaces">
            <Card>
              <CardHeader>
                <CardTitle>{t('pdgCommandCenter.metriquesDesInterfacesUtilisateur')}</CardTitle>
                <CardDescription>{t('pdgCommandCenter.performanceEtUtilisationParInterface')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {interfaceMetrics.map((metric) => (
                      <Card key={metric.interface}>
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold">{metric.interface}</h4>
                              <Badge variant={metric.errors > 5 ? 'destructive' : 'default'}>
                                {metric.errors} erreurs
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-muted-foreground">Utilisateurs actifs</p>
                                <p className="font-medium">{metric.activeUsers}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Transactions</p>
                                <p className="font-medium">{metric.transactions}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-muted-foreground">Performance</p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-secondary rounded-full h-2">
                                    <div
                                      className="bg-primary rounded-full h-2 transition-all"
                                      style={{ width: `${metric.performance}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-medium">
                                    {metric.performance.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto-Fixes */}
          <TabsContent value="fixes">
            <div className="space-y-4">
              {/* Erreurs récentes à analyser */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('pdgCommandCenter.erreursRecentesAnalyseIa')}</CardTitle>
                  <CardDescription>
                    Cliquez sur "Analyser avec IA" pour obtenir une solution automatique
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {recentErrors.map((error) => (
                        <Card key={error.id} className="bg-muted/30">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={
                                    error.severity === 'critique' ? 'destructive' :
                                    error.severity === 'modérée' ? 'secondary' : 'outline'
                                  }>
                                    {error.severity}
                                  </Badge>
                                  <span className="font-semibold">{error.module}</span>
                                </div>
                                <p className="text-sm">{error.error_message}</p>
                                {error.metadata?.ai_analysis && (
                                  <div className="mt-2 p-3 bg-background rounded-lg space-y-2">
                                    <p className="text-xs font-semibold text-primary">
                                      Analyse IA:
                                    </p>
                                    <p className="text-xs">{error.metadata.ai_analysis.cause}</p>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={
                                        error.metadata.ai_analysis.autoFixable
                                          ? 'default'
                                          : 'secondary'
                                      }>
                                        {error.metadata.ai_analysis.autoFixable
                                          ? 'Auto-fixable'
                                          : 'Manuel'}
                                      </Badge>
                                      <Badge variant="outline">
                                        Priorité : {error.metadata.ai_analysis.priority}
                                      </Badge>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleAnalyzeError(error.id)}
                                disabled={analyzingError === error.id}
                                className="gap-2"
                              >
                                {analyzingError === error.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Brain className="h-4 w-4" />
                                )}
                                Analyser avec IA
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Correctifs actifs */}
              <Card>
                <CardHeader>
                  <CardTitle>Correctifs Automatiques Actifs</CardTitle>
                  <CardDescription>
                    {autoFixes.length} correctifs générés par l'IA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {autoFixes.map((fix) => (
                        <Card key={fix.id}>
                          <CardContent className="pt-6">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1 flex-1">
                                  <h4 className="font-semibold">{fix.fix_description}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Pattern: {fix.error_pattern}
                                  </p>
                                </div>
                                <Badge variant={fix.is_active ? 'default' : 'secondary'}>
                                  {fix.is_active ? 'Actif' : 'Inactif'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Appliqué : {fix.times_applied} fois</span>
                                <span>Taux de réussite : {fix.success_rate.toFixed(1)}%</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Auto-Réparation supervisée (dual-IA) */}
          <TabsContent value="auto-healing">
            <AutoHealingDashboard />
          </TabsContent>

          {/* IA Copilote */}
          <TabsContent value="copilot">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  IA Copilote
                </CardTitle>
                <CardDescription>
                  Posez vos questions sur l'état du système et obtenez des recommandations claires
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder={t('pdgCommandCenter.exQuellesSontLesErreurs')}
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAskAI()}
                  />
                  <Button onClick={handleAskAI} disabled={aiLoading}>
                    {aiLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      'Demander'
                    )}
                  </Button>
                </div>

                {aiResponse && (
                  <Card className="bg-muted">
                    <CardContent className="pt-6">
                      <div className="prose prose-sm max-w-none text-foreground [&_p]:mb-3 [&_ol]:my-3 [&_ul]:my-3 [&_li]:my-1 [&_strong]:text-foreground">
                        <ReactMarkdown>{aiResponse}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('pdgCommandCenter.questionsSuggerees')}</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Quel est l\'état global du système ?',
                      'Quelles interfaces ont le plus d\'erreurs ?',
                      'Recommande des améliorations',
                      'Analyse les performances'
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAiQuery(suggestion);
                          handleAskAI();
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

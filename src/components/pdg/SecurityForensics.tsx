import React, { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { FileSearch, Database, Download, Brain, GitMerge, Clock, FileText, Share2, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useForensics } from '@/hooks/useForensics';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

const SecurityForensics: React.FC = () => {
  const { t } = useTranslation();
  const {
    loading,
    snapshots,
    timeline,
    createSnapshot,
    loadSnapshots,
    analyzeBehavior,
    correlateEvents,
    reconstructTimeline,
    generateForensicReport,
    exportToSIEM,
    exportAuditLogs
  } = useForensics();

  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [behaviorAnalysis, setBehaviorAnalysis] = useState<any>(null);
  const [siemType, setSiemType] = useState('splunk');

  useEffect(() => {
    loadSnapshots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSnapshot = async () => {
    try {
      await createSnapshot(selectedIncidentId || undefined);
    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  };

  const handleAnalyzeBehavior = async () => {
    try {
      const result = await analyzeBehavior(selectedUserId || undefined, '24h');
      setBehaviorAnalysis(result);
      toast.success(t('securityForensics.analyseComportementaleTerminee'));
    } catch (error) {
      console.error('Error analyzing behavior:', error);
    }
  };

  const handleCorrelateEvents = async () => {
    if (!selectedIncidentId) {
      toast.error(t('securityForensics.veuillezSelectionnerUnIncident'));
      return;
    }
    try {
      await correlateEvents(selectedIncidentId);
    } catch (error) {
      console.error('Error correlating events:', error);
    }
  };

  const handleReconstructTimeline = async () => {
    if (!selectedIncidentId) {
      toast.error(t('securityForensics.veuillezSelectionnerUnIncident'));
      return;
    }
    try {
      await reconstructTimeline(selectedIncidentId);
    } catch (error) {
      console.error('Error reconstructing timeline:', error);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedIncidentId) {
      toast.error(t('securityForensics.veuillezSelectionnerUnIncident'));
      return;
    }
    try {
      const report = await generateForensicReport(selectedIncidentId, 'full_forensic');
      // Create download link
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forensic_report_${selectedIncidentId}_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  const handleExportToSIEM = async () => {
    try {
      const data = {
        incident_id: selectedIncidentId,
        timestamp: new Date().toISOString(),
        source: '224solutions'
      };
      await exportToSIEM(data, siemType);
    } catch (error) {
      console.error('Error exporting to SIEM:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-bold">{t('securityForensics.forensiqueEtAnalyse')}</h3>
        <p className="text-muted-foreground">{t('securityForensics.outilsDInvestigationEtDe')}</p>
      </div>

      <Tabs defaultValue="snapshots" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
          <TabsTrigger value="behavior">Comportement</TabsTrigger>
          <TabsTrigger value="correlation">{t('securityForensics.correlation')}</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="reports">Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="snapshots" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Créer un Snapshot
                </CardTitle>
                <CardDescription>
                  Capture complète de l'état du système
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="snapshot-incident">ID Incident (optionnel)</Label>
                  <Input
                    id="snapshot-incident"
                    value={selectedIncidentId}
                    onChange={(e) => setSelectedIncidentId(e.target.value)}
                    placeholder={t('securityForensics.uuidDeLIncident')}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateSnapshot}
                  disabled={loading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Créer un Snapshot
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5" />
                  Exporter les Logs
                </CardTitle>
                <CardDescription>
                  Export des logs d'audit en JSON
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => exportAuditLogs()}
                  disabled={loading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter les Logs
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('securityForensics.snapshotsRecents')}</CardTitle>
              <CardDescription>
                {snapshots.length} snapshot(s) disponible(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {snapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{snapshot.snapshot_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(snapshot.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Analyse Comportementale Avancée
              </CardTitle>
              <CardDescription>
                Détection d'anomalies et patterns suspects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="user-id">ID Utilisateur (optionnel)</Label>
                <Input
                  id="user-id"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  placeholder={t('securityForensics.uuidDeLUtilisateur')}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleAnalyzeBehavior}
                disabled={loading}
              >
                <Brain className="h-4 w-4 mr-2" />
                Lancer l'Analyse
              </Button>

              {behaviorAnalysis && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Score d'Anomalie</p>
                      <p className="text-2xl font-bold">
                        {behaviorAnalysis.anomalyScore !== null && behaviorAnalysis.anomalyScore !== undefined
                          ? behaviorAnalysis.anomalyScore.toFixed(1)
                          : '0.0'}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">{t('securityForensics.niveauDeRisque')}</p>
                      <p className="text-2xl font-bold capitalize">{behaviorAnalysis.riskLevel}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">{t('securityForensics.patternsDetectes')}</h4>
                    <ul className="space-y-1">
                      {behaviorAnalysis.patterns.map((pattern: string, idx: number) => (
                        <li key={idx} className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          {pattern}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Recommandations</h4>
                    <ul className="space-y-1">
                      {behaviorAnalysis.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitMerge className="h-5 w-5" />
                Corrélation d'Événements Multi-Sources
              </CardTitle>
              <CardDescription>
                Analyse croisée des incidents, alertes et logs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="correlate-incident">ID Incident</Label>
                <Input
                  id="correlate-incident"
                  value={selectedIncidentId}
                  onChange={(e) => setSelectedIncidentId(e.target.value)}
                  placeholder={t('securityForensics.uuidDeLIncident')}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCorrelateEvents}
                disabled={loading || !selectedIncidentId}
              >
                <GitMerge className="h-4 w-4 mr-2" />
                Corréler les Événements
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Reconstruction de Timeline
              </CardTitle>
              <CardDescription>
                Chronologie détaillée des événements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="timeline-incident">{t('securityForensics.selectionnerUnIncident')}</Label>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={async () => {
                    // Charger les incidents récents depuis audit_logs
                    const { data } = await supabase
                      .from('audit_logs')
                      .select('id, action, created_at, actor_id')
                      .order('created_at', { ascending: false })
                      .limit(10);

                    if (data && data.length > 0) {
                      toast.info(`${data.length} incidents récents trouvés`);
                      console.log('Incidents récents:', data);
                    }
                  }}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Charger les incidents récents
                </Button>
              </div>
              <div>
                <Label htmlFor="timeline-incident-id">{t('securityForensics.ouEntrerUnIdD')}</Label>
                <Input
                  id="timeline-incident-id"
                  value={selectedIncidentId}
                  onChange={(e) => setSelectedIncidentId(e.target.value)}
                  placeholder={t('securityForensics.uuidDeLIncidentOu')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Vous pouvez aussi utiliser un ID utilisateur pour voir son historique
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleReconstructTimeline}
                disabled={loading || !selectedIncidentId}
              >
                <Clock className="h-4 w-4 mr-2" />
                Reconstruire la Timeline
              </Button>

              {timeline.length > 0 && (
                <ScrollArea className="h-[400px] mt-4">
                  <div className="space-y-4">
                    {timeline.map((event, idx) => (
                      <div key={idx} className="flex gap-4 border-l-2 border-primary pl-4 pb-4">
                        <div className="flex-shrink-0 w-24 text-sm text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{event.event_type}</p>
                            <Badge variant="outline" className="text-xs">
                              {event.source}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                          {event.actor && (
                            <p className="text-xs text-muted-foreground mt-1">Par: {event.actor}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Génération de Rapports
                </CardTitle>
                <CardDescription>
                  Rapports forensiques complets
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="report-incident">ID Incident</Label>
                  <Input
                    id="report-incident"
                    value={selectedIncidentId}
                    onChange={(e) => setSelectedIncidentId(e.target.value)}
                    placeholder={t('securityForensics.uuidDeLIncident')}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleGenerateReport}
                  disabled={loading || !selectedIncidentId}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Générer le Rapport
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Intégration SIEM
                </CardTitle>
                <CardDescription>
                  Export vers outils SIEM externes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="siem-type">{t('securityForensics.typeDeSiem')}</Label>
                  <Select value={siemType} onValueChange={setSiemType}>
                    <SelectTrigger id="siem-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="splunk">Splunk</SelectItem>
                      <SelectItem value="elk">ELK Stack</SelectItem>
                      <SelectItem value="qradar">IBM QRadar</SelectItem>
                      <SelectItem value="sentinel">Azure Sentinel</SelectItem>
                      <SelectItem value="sumologic">Sumo Logic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="siem-incident">ID Incident</Label>
                  <Input
                    id="siem-incident"
                    value={selectedIncidentId}
                    onChange={(e) => setSelectedIncidentId(e.target.value)}
                    placeholder={t('securityForensics.uuidDeLIncident')}
                  />
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleExportToSIEM}
                  disabled={loading}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Exporter vers {siemType}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Statistiques Forensiques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Snapshots</p>
                  <p className="text-2xl font-bold">{snapshots.length}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Analyses</p>
                  <p className="text-2xl font-bold">{behaviorAnalysis ? 1 : 0}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Timeline Events</p>
                  <p className="text-2xl font-bold">{timeline.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityForensics;
